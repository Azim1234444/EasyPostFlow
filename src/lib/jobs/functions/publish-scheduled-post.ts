import { inngest } from '@/lib/jobs/inngest';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPlatformAdapter } from '@/lib/platforms/registry';
import { calculateRetryDelaySeconds } from '@/lib/validators/schedule';
import { TikTokClient } from '@/lib/platforms/tiktok/client';
import { encryptToken, decryptToken } from '@/lib/crypto/encryption';
import { logger } from '@/lib/logging/logger';
import { diagnoseStageFailure, checkVideoUrlAccessibility } from '@/lib/diagnostics/integration';
import type { PlatformCredentials, PublishRequestPayload } from '@/lib/platforms/types';
import type { PlatformAccount } from '@/types/database';

interface JobLockResult {
  shouldProcess: boolean;
  reason: string | null;
  job: Record<string, unknown> | null;
  currentAttempt: number;
  attemptId: string | null;
}

export const publishScheduledPost = inngest.createFunction(
  {
    id: 'publish-scheduled-post',
    name: 'Publish Scheduled Post Pipeline',
    triggers: [{ event: 'postflow/post.publish.requested' }],
    retries: 0, // Managed explicitly in database & Inngest multi-step pipeline for auditability
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: { event: any; step: any }) => {
    const { jobId, scheduledPostId } = event.data as {
      jobId: string;
      scheduledPostId: string;
      idempotencyKey?: string;
      isRetry?: boolean;
    };

    // ============================================================
    // STEP 0: Check Schedule Timing & Sleep Until Scheduled Time
    // Priority 1: Ensures posts NEVER publish before scheduled_at
    // ============================================================
    const timingCheck = await step.run('check-schedule-timing', async () => {
      const supabase = createAdminClient();

      const { data: scheduledPost, error: postErr } = await supabase
        .from('scheduled_posts')
        .select('id, scheduled_at, status')
        .eq('id', scheduledPostId)
        .single();

      if (postErr || !scheduledPost) {
        return { shouldWait: false, waitUntil: null, isCancelled: true, reason: 'POST_NOT_FOUND' };
      }

      if (scheduledPost.status === 'CANCELLED') {
        return { shouldWait: false, waitUntil: null, isCancelled: true, reason: 'ALREADY_CANCELLED' };
      }

      const { data: job } = await supabase
        .from('publishing_jobs')
        .select('id, status, next_retry_at')
        .eq('id', jobId)
        .single();

      if (job?.status === 'CANCELLED') {
        return { shouldWait: false, waitUntil: null, isCancelled: true, reason: 'JOB_CANCELLED' };
      }

      // If this is a retry run with a future next_retry_at, wait until next_retry_at
      if (job?.next_retry_at && new Date(job.next_retry_at).getTime() > Date.now()) {
        return {
          shouldWait: true,
          waitUntil: job.next_retry_at,
          isCancelled: false,
          reason: 'WAIT_FOR_RETRY',
        };
      }

      // Check scheduled_at timestamp
      const scheduledTimeMs = new Date(scheduledPost.scheduled_at).getTime();
      const nowMs = Date.now();
      const shouldWait = scheduledTimeMs > nowMs;

      return {
        shouldWait,
        waitUntil: scheduledPost.scheduled_at,
        isCancelled: false,
        reason: shouldWait ? 'WAIT_FOR_SCHEDULED_TIME' : 'READY_TO_EXECUTE',
      };
    });

    if (timingCheck.isCancelled) {
      return { status: 'SKIPPED', reason: timingCheck.reason };
    }

    // Sleep until exact scheduled timestamp or retry timestamp
    if (timingCheck.shouldWait && timingCheck.waitUntil) {
      await step.sleepUntil('wait-for-exact-schedule', new Date(timingCheck.waitUntil));

      // Re-verify status after waking up to handle cancellation or rescheduling safely
      const wakeupVerify = await step.run('verify-status-after-wakeup', async () => {
        const supabase = createAdminClient();

        const { data: post } = await supabase
          .from('scheduled_posts')
          .select('id, status, scheduled_at')
          .eq('id', scheduledPostId)
          .single();

        if (!post || post.status === 'CANCELLED') {
          return { canProceed: false, reason: 'CANCELLED_WHILE_WAITING' };
        }

        // If rescheduled to a time further in the future (more than 1 minute ahead), skip this run
        const postTime = new Date(post.scheduled_at).getTime();
        if (postTime > Date.now() + 60 * 1000) {
          return { canProceed: false, reason: 'RESCHEDULED_TO_FUTURE_TIME' };
        }

        const { data: job } = await supabase
          .from('publishing_jobs')
          .select('id, status')
          .eq('id', jobId)
          .single();

        if (!job || job.status === 'CANCELLED') {
          return { canProceed: false, reason: 'JOB_CANCELLED_WHILE_WAITING' };
        }

        return { canProceed: true, reason: null };
      });

      if (!wakeupVerify.canProceed) {
        return { status: 'SKIPPED', reason: wakeupVerify.reason };
      }
    }

    // ============================================================
    // STEP 1: Verify and Lock Job (Idempotency & Admin DB Access)
    // ============================================================
    const lockResult: JobLockResult = await step.run(
      'verify-and-lock-job',
      async (): Promise<JobLockResult> => {
        const supabase = createAdminClient();

        const { data: job, error: jobError } = await supabase
          .from('publishing_jobs')
          .select('*')
          .eq('id', jobId)
          .single();

        if (jobError || !job) {
          throw new Error(`Publishing job not found: ${jobId}`);
        }

        // 1. Idempotency Check: Already completed
        if (job.status === 'COMPLETED') {
          return {
            shouldProcess: false,
            reason: 'ALREADY_COMPLETED',
            job,
            currentAttempt: job.attempts || 0,
            attemptId: null,
          };
        }

        // 2. Cancellation Check
        if (job.status === 'CANCELLED') {
          return {
            shouldProcess: false,
            reason: 'JOB_CANCELLED',
            job,
            currentAttempt: job.attempts || 0,
            attemptId: null,
          };
        }

        // 3. Concurrency Lock: Check if actively processing in the last 5 minutes
        if (job.status === 'PROCESSING' || job.status === 'PUBLISHING') {
          const startedTime = job.started_at ? new Date(job.started_at).getTime() : 0;
          const now = Date.now();
          if (now - startedTime < 5 * 60 * 1000) {
            return {
              shouldProcess: false,
              reason: 'ALREADY_PROCESSING',
              job,
              currentAttempt: job.attempts || 0,
              attemptId: null,
            };
          }
        }

        // Lock the job
        const currentAttempt = (job.attempts || 0) + 1;
        await supabase
          .from('publishing_jobs')
          .update({
            status: 'PROCESSING',
            started_at: new Date().toISOString(),
            attempts: currentAttempt,
            updated_at: new Date().toISOString(),
          })
          .eq('id', jobId);

        // Record attempt
        const { data: attemptRow } = await supabase
          .from('publishing_attempts')
          .insert({
            job_id: jobId,
            attempt_number: currentAttempt,
            status: 'started',
            started_at: new Date().toISOString(),
          })
          .select()
          .single();

        return {
          shouldProcess: true,
          reason: null,
          job,
          currentAttempt,
          attemptId: attemptRow?.id || null,
        };
      }
    );

    if (!lockResult.shouldProcess || !lockResult.job) {
      return { status: 'SKIPPED', reason: lockResult.reason };
    }

    // ============================================================
    // STEP 2: Prepare Content, Media & Rotate/Refresh Tokens
    // Priority 7: Automatic server-side TikTok token refresh
    // ============================================================
    const preparedData = await step.run('prepare-content-and-credentials', async () => {
      const supabase = createAdminClient();

      const { data: scheduledPost } = await supabase
        .from('scheduled_posts')
        .select('*, content:content(*, media:content_media(*)), account:platform_accounts(*)')
        .eq('id', scheduledPostId)
        .single();

      if (!scheduledPost || !scheduledPost.content) {
        throw new Error('Content associated with scheduled post was not found');
      }

      const content = scheduledPost.content;
      const account = scheduledPost.account as PlatformAccount;

      // Extract primary video
      const videoMedia = content.media?.find((m: { media_type: string }) => m.media_type === 'video');
      let signedVideoUrl = '';

      if (videoMedia?.storage_path) {
        const { data: signed } = await supabase.storage
          .from('videos')
          .createSignedUrl(videoMedia.storage_path, 3600);
        signedVideoUrl = signed?.signedUrl || '';

        if (signedVideoUrl) {
          try {
            const videoDiag = await checkVideoUrlAccessibility(signedVideoUrl);
            if (!videoDiag.isAccessible) {
              diagnoseStageFailure('video_accessibility', new Error(videoDiag.error || 'Video URL accessibility check failed'));
            }
          } catch (urlDiagErr) {
            logger.warn('Non-blocking video URL accessibility check warning', { error: String(urlDiagErr) });
          }
        }
      }

      // Priority 7: Check and automatically refresh TikTok access token if expired or near expiry
      let effectiveAccessToken = account?.access_token_encrypted || 'stub_token';
      if (scheduledPost.platform === 'tiktok' && account && account.access_token_encrypted) {
        const expiresAt = account.token_expires_at ? new Date(account.token_expires_at).getTime() : 0;
        const now = Date.now();
        const isExpiredOrNear = expiresAt > 0 && expiresAt <= now + 5 * 60 * 1000;

        if (isExpiredOrNear && account.refresh_token_encrypted) {
          try {
            const rawRefreshToken = decryptToken(account.refresh_token_encrypted);
            const ttClient = new TikTokClient();
            const refreshed = await ttClient.refreshAccessToken(rawRefreshToken);

            const newEncryptedAccess = encryptToken(refreshed.access_token);
            const newEncryptedRefresh = encryptToken(refreshed.refresh_token);
            const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

            await supabase
              .from('platform_accounts')
              .update({
                access_token_encrypted: newEncryptedAccess,
                refresh_token_encrypted: newEncryptedRefresh,
                token_expires_at: newExpiresAt,
                status: 'connected',
                updated_at: new Date().toISOString(),
              })
              .eq('id', account.id);

            effectiveAccessToken = newEncryptedAccess;
            logger.info('TikTok access token automatically refreshed before publishing', { accountId: account.id });
          } catch (refreshErr) {
            diagnoseStageFailure('token_refresh', refreshErr);
            logger.error('Failed to auto-refresh TikTok token before publishing', refreshErr, { accountId: account.id });
            await supabase
              .from('platform_accounts')
              .update({ status: 'expired', updated_at: new Date().toISOString() })
              .eq('id', account.id);
            throw new Error('TikTok authorization has expired. Please reconnect your TikTok account.');
          }
        }
      }

      const payload: PublishRequestPayload = {
        contentId: content.id,
        title: content.title,
        caption: content.caption,
        hashtags: content.hashtags || [],
        videoStoragePath: videoMedia?.storage_path || '',
        videoUrl: signedVideoUrl,
        transferMode: 'FILE_UPLOAD',
        affiliateUrl: content.affiliate_url,
        affiliatePlatform: content.affiliate_platform,
      };

      const credentials: PlatformCredentials = {
        platform: scheduledPost.platform,
        platformUserId: account?.platform_user_id || null,
        platformUsername: account?.platform_username || null,
        accessToken: effectiveAccessToken,
        refreshToken: account?.refresh_token_encrypted || null,
        tokenExpiresAt: account?.token_expires_at || null,
        accountType: account?.account_type || 'standard',
        metadata: (account?.metadata as Record<string, unknown>) || {},
      };

      return {
        payload,
        credentials,
        userId: scheduledPost.user_id,
        platform: scheduledPost.platform,
      };
    });

    // ============================================================
    // STEP 3: Execute Platform Publication
    // ============================================================
    const initialPublishResult = await step.run('execute-platform-publish', async () => {
      const adapter = getPlatformAdapter(preparedData.platform);
      const res = await adapter.publish(preparedData.payload, preparedData.credentials);
      if (!res.success) {
        diagnoseStageFailure('publish_init', new Error(res.error || 'Failed to initialize publish on platform'));
      }
      return res;
    });

    // ============================================================
    // STEP 3.5: Poll TikTok Video Publishing Status
    // Priority 3: Only mark PUBLISHED when TikTok confirms complete
    // ============================================================
    let confirmedResult = initialPublishResult;

    if (
      initialPublishResult.success &&
      initialPublishResult.status === 'PROCESSING' &&
      initialPublishResult.publishId &&
      preparedData.platform === 'tiktok'
    ) {
      // Poll TikTok status up to 4 iterations with progressive sleep
      const MAX_POLLS = 4;
      for (let pollIdx = 1; pollIdx <= MAX_POLLS; pollIdx++) {
        const sleepSec = pollIdx === 1 ? 10 : 15;
        await step.sleep(`poll-tiktok-wait-${pollIdx}`, `${sleepSec}s`);

        const pollStatus = await step.run(`check-tiktok-status-${pollIdx}`, async () => {
          const adapter = getPlatformAdapter('tiktok');
          if (adapter.checkPublishStatus) {
            return await adapter.checkPublishStatus(
              initialPublishResult.publishId!,
              preparedData.credentials
            );
          }
          return { status: 'COMPLETED' as const };
        });

        if (pollStatus.status === 'COMPLETED') {
          confirmedResult = {
            success: true,
            status: 'PUBLISHED',
            publishId: initialPublishResult.publishId,
            providerPostId: pollStatus.providerPostId || initialPublishResult.publishId,
            rawResponse: pollStatus.rawResponse || initialPublishResult.rawResponse,
          };
          break;
        }

        if (pollStatus.status === 'FAILED') {
          diagnoseStageFailure('status_polling', new Error(pollStatus.errorMessage || 'TikTok status polling returned failed'));
          confirmedResult = {
            success: false,
            status: 'FAILED',
            error: pollStatus.errorMessage || 'TikTok rejected or failed to process the video.',
            rawResponse: pollStatus.rawResponse || initialPublishResult.rawResponse,
          };
          break;
        }

        // If reached max polls and still processing
        if (pollIdx === MAX_POLLS) {
          confirmedResult = {
            success: true,
            status: 'PROCESSING',
            publishId: initialPublishResult.publishId,
            providerPostId: initialPublishResult.publishId,
            rawResponse: {
              ...initialPublishResult.rawResponse,
              note: 'Video is still encoding/processing on TikTok servers.',
            },
          };
        }
      }
    }

    // ============================================================
    // STEP 4: Record Results, Audit Attempts, Notifications & Retries
    // Priority 4: Re-trigger retries with delay until max attempts
    // ============================================================
    const finalResult = await step.run('record-result-and-notify', async () => {
      const supabase = createAdminClient();

      if (confirmedResult.success) {
        const isManual = confirmedResult.status === 'MANUAL_ACTION_REQUIRED';
        const isStillProcessing = confirmedResult.status === 'PROCESSING';

        const dbJobStatus = isStillProcessing ? 'PROCESSING' : 'COMPLETED';
        const dbPostStatus = isStillProcessing ? 'PROCESSING' : 'PUBLISHED';

        await supabase
          .from('publishing_jobs')
          .update({
            status: dbJobStatus,
            provider_post_id: confirmedResult.providerPostId || null,
            completed_at: isStillProcessing ? null : new Date().toISOString(),
            provider_response: confirmedResult.rawResponse || {},
            updated_at: new Date().toISOString(),
          })
          .eq('id', jobId);

        await supabase
          .from('scheduled_posts')
          .update({ status: dbPostStatus, updated_at: new Date().toISOString() })
          .eq('id', scheduledPostId);

        await supabase
          .from('content')
          .update({ status: dbPostStatus, updated_at: new Date().toISOString() })
          .eq('id', preparedData.payload.contentId);

        // Update attempt record
        if (lockResult.attemptId) {
          await supabase
            .from('publishing_attempts')
            .update({
              status: isStillProcessing ? 'publishing' : 'completed',
              completed_at: isStillProcessing ? null : new Date().toISOString(),
              provider_response: confirmedResult.rawResponse || {},
            })
            .eq('id', lockResult.attemptId);
        }

        const notifTitle = isManual
          ? 'Shopee Post Package Ready (Manual Action Required)'
          : isStillProcessing
          ? `Processing on ${preparedData.platform.toUpperCase()}`
          : `Published to ${preparedData.platform.toUpperCase()}`;

        const notifMessage = isManual
          ? confirmedResult.manualActionInstructions || 'Your Shopee video and copy are ready for mobile posting.'
          : isStillProcessing
          ? `Your video "${preparedData.payload.title}" is being processed by ${preparedData.platform.toUpperCase()}.`
          : `Your post "${preparedData.payload.title}" has been successfully published!`;

        await supabase.from('notifications').insert({
          user_id: preparedData.userId,
          type: isManual ? 'system' : 'publish_success',
          title: notifTitle,
          message: notifMessage,
          severity: isManual ? 'info' : 'success',
          data: {
            content_id: preparedData.payload.contentId,
            scheduled_post_id: scheduledPostId,
            provider_post_id: confirmedResult.providerPostId,
            status: confirmedResult.status,
            manual_instructions: confirmedResult.manualActionInstructions,
          },
        });

        return {
          status: confirmedResult.status,
          providerPostId: confirmedResult.providerPostId,
        };
      } else {
        // Failure path
        const currentAttempt = lockResult.currentAttempt || 1;
        const maxAttempts = (lockResult.job?.max_attempts as number) || 3;
        const hasRemainingAttempts = currentAttempt < maxAttempts;
        const nextRetrySeconds = calculateRetryDelaySeconds(currentAttempt);
        const nextRetryAt = new Date(Date.now() + nextRetrySeconds * 1000).toISOString();

        await supabase
          .from('publishing_jobs')
          .update({
            status: hasRemainingAttempts ? 'PENDING' : 'FAILED',
            last_error: confirmedResult.error || 'Unknown publishing error',
            next_retry_at: hasRemainingAttempts ? nextRetryAt : null,
            provider_response: confirmedResult.rawResponse || {},
            updated_at: new Date().toISOString(),
          })
          .eq('id', jobId);

        // Update attempt record
        if (lockResult.attemptId) {
          await supabase
            .from('publishing_attempts')
            .update({
              status: 'failed',
              error_message: confirmedResult.error || 'Publish failed',
              completed_at: new Date().toISOString(),
              provider_response: confirmedResult.rawResponse || {},
            })
            .eq('id', lockResult.attemptId);
        }

        if (!hasRemainingAttempts) {
          diagnoseStageFailure('worker', new Error(confirmedResult.error || 'Publishing attempts exhausted'));
          // Final exhaustion: mark post and content as FAILED
          await supabase
            .from('scheduled_posts')
            .update({ status: 'FAILED', updated_at: new Date().toISOString() })
            .eq('id', scheduledPostId);

          await supabase
            .from('content')
            .update({ status: 'FAILED', updated_at: new Date().toISOString() })
            .eq('id', preparedData.payload.contentId);

          await supabase.from('notifications').insert({
            user_id: preparedData.userId,
            type: 'publish_failure',
            title: `Publishing Failed: ${preparedData.platform.toUpperCase()}`,
            message: `Could not publish "${preparedData.payload.title}". ${confirmedResult.error || ''}`,
            severity: 'error',
            data: {
              content_id: preparedData.payload.contentId,
              scheduled_post_id: scheduledPostId,
              error: confirmedResult.error,
              attempts: currentAttempt,
            },
          });
        }

        return {
          status: hasRemainingAttempts ? 'RETRY_SCHEDULED' : 'FAILED',
          error: confirmedResult.error,
          nextRetryAt: hasRemainingAttempts ? nextRetryAt : null,
          hasRemainingAttempts,
          currentAttempt,
        };
      }
    });

    // Priority 4: Re-dispatch Inngest event for remaining retries
    if (finalResult.status === 'RETRY_SCHEDULED' && finalResult.hasRemainingAttempts) {
      try {
        await inngest.send({
          name: 'postflow/post.publish.requested',
          data: {
            jobId,
            scheduledPostId,
            idempotencyKey: `${event.data.idempotencyKey || jobId}_retry_${(finalResult.currentAttempt || 1) + 1}`,
            isRetry: true,
          },
        });
        logger.info('Scheduled retry dispatched to Inngest', { jobId, nextRetryAt: finalResult.nextRetryAt });
      } catch (inngestErr) {
        logger.warn('Failed to dispatch retry event to Inngest', { error: String(inngestErr) });
      }
    }

    return finalResult;
  }
);
