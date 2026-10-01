'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logging/logger';
import { redirect } from 'next/navigation';

export interface ActionResponse<T = unknown> {
  data?: T;
  error?: string;
}

/**
 * Permanently delete the authenticated user's account and all associated data:
 * 1. Storage media (videos, thumbnails)
 * 2. Publishing jobs and scheduled posts
 * 3. Content items and media metadata
 * 4. Encrypted platform credentials and accounts
 * 5. Profile data and auth session
 */
export async function deleteUserAccount(): Promise<ActionResponse<boolean>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: 'Unauthorized: No active session' };
    }

    const userId = user.id;

    logger.info('Initiating account deletion process', { userId }, 'UserManagement');

    // 1. Delete storage files
    try {
      const { data: videoFiles } = await supabase.storage.from('videos').list(userId);
      if (videoFiles && videoFiles.length > 0) {
        const paths = videoFiles.map((f) => `${userId}/${f.name}`);
        await supabase.storage.from('videos').remove(paths);
      }

      const { data: thumbFiles } = await supabase.storage.from('thumbnails').list(userId);
      if (thumbFiles && thumbFiles.length > 0) {
        const paths = thumbFiles.map((f) => `${userId}/${f.name}`);
        await supabase.storage.from('thumbnails').remove(paths);
      }
    } catch (storageErr) {
      logger.warn('Storage cleanup non-fatal warning during account deletion', { error: String(storageErr) });
    }

    // 2. Cascade delete database records
    // Content media, publishing jobs, scheduled posts, and platform accounts cascade with user_id
    const { error: deleteProfileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (deleteProfileError) {
      logger.error('Failed to delete user profile', deleteProfileError, { userId }, 'UserManagement');
      return { error: 'Failed to delete account data' };
    }

    // Explicit cleanup of platform accounts & content if not fully cascaded
    await supabase.from('platform_accounts').delete().eq('user_id', userId);
    await supabase.from('content').delete().eq('user_id', userId);

    // 3. Delete user from Supabase Auth (auth.users) using admin client
    try {
      const adminClient = createAdminClient();
      const { error: adminDeleteError } = await adminClient.auth.admin.deleteUser(userId);
      if (adminDeleteError) {
        logger.error('Failed to delete auth user via admin client', adminDeleteError, { userId }, 'UserManagement');
      }
    } catch (adminErr) {
      logger.warn('Admin client deleteUser warning', { error: String(adminErr) }, 'UserManagement');
    }

    // 4. Sign out the user session
    await supabase.auth.signOut();

    logger.info('Account deleted successfully', { userId }, 'UserManagement');
  } catch (err) {
    logger.error('Exception during account deletion', err, undefined, 'UserManagement');
    return {
      error: err instanceof Error ? err.message : 'An error occurred during account deletion',
    };
  }

  redirect('/login?deleted=true');
}
