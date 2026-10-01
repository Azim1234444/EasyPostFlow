'use server';

import { createClient } from '@/lib/supabase/server';
import {
  schedulePostSchema,
  generateIdempotencyKey,
  type SchedulePostInput,
} from '@/lib/validators/schedule';
import { inngest } from '@/lib/jobs/inngest';
import { logger } from '@/lib/logging/logger';
import type { ScheduledPost, PlatformAccount, ContentWithMedia } from '@/types/database';
import { revalidatePath } from 'next/cache';

export interface ActionResponse<T = unknown> {
  data?: T;
  error?: string;
}

export interface ScheduledPostWithRelations extends ScheduledPost {
  content?: ContentWithMedia;
  account?: PlatformAccount;
}

/**
 * Schedule a content item for publication to a specific connected platform account.
 */
export async function schedulePost(
  input: SchedulePostInput
): Promise<ActionResponse<ScheduledPost>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: 'You must be signed in to schedule posts.' };
    }

    const validated = schedulePostSchema.parse(input);

    // 1. Verify content ownership
    const { data: content, error: contentError } = await supabase
      .from('content')
      .select('id, user_id, title')
      .eq('id', validated.content_id)
      .eq('user_id', user.id)
      .single();

    if (contentError || !content) {
      return { error: 'Content not found or unauthorized' };
    }

    // 2. Verify platform account ownership
    const { data: account, error: accountError } = await supabase
      .from('platform_accounts')
      .select('id, user_id, platform, status')
      .eq('id', validated.platform_account_id)
      .eq('user_id', user.id)
      .single();

    if (accountError || !account) {
      return { error: 'Selected social account was not found' };
    }

    if (account.status !== 'connected') {
      return { error: `Account status is ${account.status}. Please reconnect before scheduling.` };
    }

    // 3. Prevent duplicate active schedules for same content + platform account
    const { data: existingActive } = await supabase
      .from('scheduled_posts')
      .select('id')
      .eq('content_id', validated.content_id)
      .eq('platform_account_id', validated.platform_account_id)
      .in('status', ['SCHEDULED', 'PROCESSING'])
      .maybeSingle();

    if (existingActive) {
      return {
        error:
          'This post is already scheduled on this account. Cancel or reschedule the existing post instead.',
      };
    }

    // 4. Generate deterministic idempotency key
    const idempotencyKey = generateIdempotencyKey(
      validated.content_id,
      validated.platform_account_id,
      validated.scheduled_at
    );

    // 5. Insert scheduled_post record
    const { data: scheduledPost, error: scheduleError } = await supabase
      .from('scheduled_posts')
      .insert({
        content_id: validated.content_id,
        platform_account_id: validated.platform_account_id,
        user_id: user.id,
        platform: validated.platform,
        scheduled_at: validated.scheduled_at,
        timezone: validated.timezone,
        status: 'SCHEDULED',
      })
      .select()
      .single();

    if (scheduleError || !scheduledPost) {
      return { error: scheduleError?.message || 'Failed to create schedule' };
    }

    // 6. Insert publishing_job record
    const { data: publishingJob, error: jobError } = await supabase
      .from('publishing_jobs')
      .insert({
        scheduled_post_id: scheduledPost.id,
        content_id: validated.content_id,
        platform_account_id: validated.platform_account_id,
        platform: validated.platform,
        status: 'PENDING',
        attempts: 0,
        max_attempts: 3,
        idempotency_key: idempotencyKey,
      })
      .select()
      .single();

    if (jobError || !publishingJob) {
      // Rollback scheduled post if job creation fails
      await supabase.from('scheduled_posts').delete().eq('id', scheduledPost.id);
      return { error: jobError?.message || 'Failed to initialize publishing job' };
    }

    // 7. Update content status to SCHEDULED
    await supabase
      .from('content')
      .update({ status: 'SCHEDULED' })
      .eq('id', validated.content_id);

    // 8. Dispatch Inngest event
    try {
      await inngest.send({
        name: 'postflow/post.publish.requested',
        data: {
          jobId: publishingJob.id,
          scheduledPostId: scheduledPost.id,
          idempotencyKey,
        },
      });
    } catch (inngestErr) {
      // In local dev without Inngest server running, log warning but keep DB schedule
      console.warn('Inngest dispatch warning (offline in dev):', inngestErr);
    }

    revalidatePath('/calendar');
    revalidatePath('/content');
    revalidatePath('/dashboard');

    return { data: scheduledPost as ScheduledPost };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'An error occurred during scheduling',
    };
  }
}

/**
 * Reschedule an existing scheduled post to a new date/time.
 */
export async function reschedulePost(
  scheduledPostId: string,
  newScheduledAtIso: string,
  timezone: string
): Promise<ActionResponse<boolean>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: 'Unauthorized' };
    }

    const scheduledDate = new Date(newScheduledAtIso);
    if (scheduledDate.getTime() <= Date.now() + 60 * 1000) {
      return { error: 'New scheduled time must be at least 1 minute in the future' };
    }

    // Verify ownership and status
    const { data: post, error: fetchError } = await supabase
      .from('scheduled_posts')
      .select('*')
      .eq('id', scheduledPostId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !post) {
      return { error: 'Scheduled post not found' };
    }

    if (post.status !== 'SCHEDULED') {
      return { error: `Cannot reschedule a post with status ${post.status}` };
    }

    // Generate fresh idempotency key
    const newIdempotencyKey = generateIdempotencyKey(
      post.content_id,
      post.platform_account_id,
      newScheduledAtIso
    );

    // Update scheduled post
    await supabase
      .from('scheduled_posts')
      .update({
        scheduled_at: newScheduledAtIso,
        timezone,
      })
      .eq('id', scheduledPostId);

    // Update publishing job
    await supabase
      .from('publishing_jobs')
      .update({
        idempotency_key: newIdempotencyKey,
        status: 'PENDING',
        attempts: 0,
      })
      .eq('scheduled_post_id', scheduledPostId);

    revalidatePath('/calendar');
    revalidatePath('/dashboard');

    return { data: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to reschedule post',
    };
  }
}

/**
 * Cancel a scheduled post.
 */
export async function cancelScheduledPost(
  scheduledPostId: string
): Promise<ActionResponse<boolean>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: 'Unauthorized' };
    }

    const { data: post, error: fetchError } = await supabase
      .from('scheduled_posts')
      .select('*, content_id')
      .eq('id', scheduledPostId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !post) {
      return { error: 'Scheduled post not found' };
    }

    if (post.status === 'PUBLISHED') {
      return { error: 'Cannot cancel a post that has already been published.' };
    }

    // Update status to CANCELLED
    await supabase
      .from('scheduled_posts')
      .update({ status: 'CANCELLED' })
      .eq('id', scheduledPostId);

    await supabase
      .from('publishing_jobs')
      .update({ status: 'CANCELLED' })
      .eq('scheduled_post_id', scheduledPostId);

    // Check if content has other active schedules
    const { data: otherActive } = await supabase
      .from('scheduled_posts')
      .select('id')
      .eq('content_id', post.content_id)
      .in('status', ['SCHEDULED', 'PROCESSING'])
      .neq('id', scheduledPostId);

    if (!otherActive || otherActive.length === 0) {
      await supabase
        .from('content')
        .update({ status: 'DRAFT' })
        .eq('id', post.content_id);
    }

    revalidatePath('/calendar');
    revalidatePath('/content');
    revalidatePath('/dashboard');

    return { data: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to cancel scheduled post',
    };
  }
}

/**
 * Retrieve user's scheduled posts with joined content and account metadata.
 */
export async function getScheduledPosts(params?: {
  platform?: string;
  status?: string;
}): Promise<ActionResponse<ScheduledPostWithRelations[]>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: 'Unauthorized' };
    }

    let query = supabase
      .from('scheduled_posts')
      .select('*, content:content(*, media:content_media(*)), account:platform_accounts(*)')
      .eq('user_id', user.id)
      .order('scheduled_at', { ascending: true });

    if (params?.platform && params.platform !== 'ALL') {
      query = query.eq('platform', params.platform);
    }

    if (params?.status && params.status !== 'ALL') {
      query = query.eq('status', params.status);
    }

    const { data, error } = await query;

    if (error) {
      return { error: error.message };
    }

    return { data: (data as ScheduledPostWithRelations[]) || [] };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to fetch scheduled posts',
    };
  }
}

/**
 * Retrieve user's connected platform accounts for the schedule selector.
 */
export async function getConnectedAccounts(): Promise<ActionResponse<PlatformAccount[]>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: 'Unauthorized' };
    }

    const { data, error } = await supabase
      .from('platform_accounts')
      .select('*')
      .eq('user_id', user.id)
      .order('platform', { ascending: true });

    if (error) {
      return { error: error.message };
    }

    return { data: (data as PlatformAccount[]) || [] };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to fetch connected accounts',
    };
  }
}

/**
 * Manually retry a failed or cancelled publishing job.
 */
export async function retryPublishingJob(scheduledPostId: string): Promise<ActionResponse<boolean>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: 'Unauthorized' };
    }

    // 1. Fetch scheduled post
    const { data: scheduledPost, error: fetchError } = await supabase
      .from('scheduled_posts')
      .select('*')
      .eq('id', scheduledPostId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !scheduledPost) {
      return { error: 'Scheduled post not found' };
    }

    // 2. Fetch or create publishing job
    const { data: job } = await supabase
      .from('publishing_jobs')
      .select('*')
      .eq('scheduled_post_id', scheduledPostId)
      .order('created_at', { ascending: false })
      .maybeSingle();

    let targetJobId = job?.id;

    if (job) {
      // Reset existing job
      await supabase
        .from('publishing_jobs')
        .update({
          status: 'PENDING',
          attempts: 0,
          last_error: null,
          started_at: null,
          completed_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);
    } else {
      // Create new publishing job
      const idempotencyKey = generateIdempotencyKey(
        scheduledPost.content_id,
        scheduledPost.platform_account_id,
        new Date().toISOString()
      );
      const { data: newJob, error: createJobError } = await supabase
        .from('publishing_jobs')
        .insert({
          scheduled_post_id: scheduledPost.id,
          status: 'PENDING',
          attempts: 0,
          max_attempts: 3,
          idempotency_key: idempotencyKey,
        })
        .select()
        .single();

      if (createJobError || !newJob) {
        return { error: 'Failed to recreate publishing job' };
      }
      targetJobId = newJob.id;
    }

    // 3. Reset scheduled post and content statuses
    await supabase
      .from('scheduled_posts')
      .update({
        status: 'SCHEDULED',
        updated_at: new Date().toISOString(),
      })
      .eq('id', scheduledPost.id);

    await supabase
      .from('content')
      .update({
        status: 'SCHEDULED',
        updated_at: new Date().toISOString(),
      })
      .eq('id', scheduledPost.content_id);

    // 4. Trigger Inngest job immediately
    try {
      await inngest.send({
        name: 'postflow/post.publish.requested',
        data: {
          jobId: targetJobId,
          scheduledPostId: scheduledPost.id,
          isRetry: true,
        },
      });
    } catch (inngestErr) {
      logger.warn('Inngest retry dispatch warning (offline or queued):', { error: String(inngestErr) }, 'Scheduler');
    }

    logger.info('Scheduled post retry initiated', { scheduledPostId, jobId: targetJobId }, 'Scheduler');

    revalidatePath('/calendar');
    revalidatePath('/content');
    revalidatePath('/dashboard');

    return { data: true };
  } catch (err) {
    logger.error('Failed to retry publishing job', err, { scheduledPostId }, 'Scheduler');
    return {
      error: err instanceof Error ? err.message : 'Failed to retry publishing job',
    };
  }
}

