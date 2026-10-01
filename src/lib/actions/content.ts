'use server';

import { createClient } from '@/lib/supabase/server';
import { contentFormSchema, type ContentFormValues } from '@/lib/validators/content';
import type { ContentWithMedia, ContentMedia, ContentStatus } from '@/types/database';
import { revalidatePath } from 'next/cache';

export interface ActionResponse<T = unknown> {
  data?: T;
  error?: string;
}

/**
 * Fetch a list of content for the current authenticated user.
 */
export async function getContentList(params?: {
  status?: string;
  search?: string;
}): Promise<ActionResponse<ContentWithMedia[]>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: 'You must be signed in to view content.' };
    }

    let query = supabase
      .from('content')
      .select('*, media:content_media(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (params?.status && params.status !== 'ALL') {
      query = query.eq('status', params.status);
    }

    if (params?.search && params.search.trim().length > 0) {
      const term = `%${params.search.trim()}%`;
      query = query.or(`title.ilike.${term},caption.ilike.${term}`);
    }

    const { data, error } = await query;

    if (error) {
      return { error: error.message };
    }

    return { data: (data as ContentWithMedia[]) || [] };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to fetch content list' };
  }
}

/**
 * Fetch a single content item with associated media by ID.
 */
export async function getContentById(id: string): Promise<ActionResponse<ContentWithMedia>> {
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
      .from('content')
      .select('*, media:content_media(*)')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error || !data) {
      return { error: error?.message || 'Content not found' };
    }

    return { data: data as ContentWithMedia };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to fetch content' };
  }
}

/**
 * Create a new content item with media attachments.
 */
export async function createContent(
  values: ContentFormValues
): Promise<ActionResponse<ContentWithMedia>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: 'You must be signed in to create content.' };
    }

    const validated = contentFormSchema.parse(values);

    // 1. Insert content record
    const { data: newContent, error: contentError } = await supabase
      .from('content')
      .insert({
        user_id: user.id,
        title: validated.title,
        caption: validated.caption,
        hashtags: validated.hashtags,
        affiliate_url: validated.affiliate_url,
        affiliate_platform: validated.affiliate_platform,
        affiliate_metadata: validated.affiliate_metadata,
        status: validated.status as ContentStatus,
      })
      .select()
      .single();

    if (contentError || !newContent) {
      return { error: contentError?.message || 'Failed to create content item' };
    }

    // 2. Insert media records if provided
    let attachedMedia: ContentMedia[] = [];
    if (validated.media && validated.media.length > 0) {
      const mediaRows = validated.media.map((m) => ({
        content_id: newContent.id,
        media_type: m.media_type,
        storage_path: m.storage_path,
        original_filename: m.original_filename || null,
        mime_type: m.mime_type || null,
        file_size: m.file_size || null,
        duration_seconds: m.duration_seconds || null,
        width: m.width || null,
        height: m.height || null,
        thumbnail_path: m.thumbnail_path || null,
        metadata: m.metadata || {},
      }));

      const { data: mediaData, error: mediaError } = await supabase
        .from('content_media')
        .insert(mediaRows)
        .select();

      if (mediaError) {
        // Log media error but keep content row
        console.error('Failed to attach media rows:', mediaError);
      } else {
        attachedMedia = (mediaData as ContentMedia[]) || [];
      }
    }

    revalidatePath('/content');
    revalidatePath('/dashboard');

    return {
      data: {
        ...newContent,
        media: attachedMedia,
      } as ContentWithMedia,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'An error occurred while creating content',
    };
  }
}

/**
 * Update an existing content item.
 */
export async function updateContent(
  id: string,
  values: ContentFormValues
): Promise<ActionResponse<ContentWithMedia>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: 'Unauthorized' };
    }

    const validated = contentFormSchema.parse(values);

    // 1. Update content record
    const { data: updatedContent, error: updateError } = await supabase
      .from('content')
      .update({
        title: validated.title,
        caption: validated.caption,
        hashtags: validated.hashtags,
        affiliate_url: validated.affiliate_url,
        affiliate_platform: validated.affiliate_platform,
        affiliate_metadata: validated.affiliate_metadata,
        status: validated.status as ContentStatus,
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError || !updatedContent) {
      return { error: updateError?.message || 'Failed to update content' };
    }

    // 2. Synchronize media attachments if updated
    if (validated.media && validated.media.length > 0) {
      // Remove existing media and re-insert new specifications
      await supabase.from('content_media').delete().eq('content_id', id);

      const mediaRows = validated.media.map((m) => ({
        content_id: id,
        media_type: m.media_type,
        storage_path: m.storage_path,
        original_filename: m.original_filename || null,
        mime_type: m.mime_type || null,
        file_size: m.file_size || null,
        duration_seconds: m.duration_seconds || null,
        width: m.width || null,
        height: m.height || null,
        thumbnail_path: m.thumbnail_path || null,
        metadata: m.metadata || {},
      }));

      await supabase.from('content_media').insert(mediaRows);
    }

    revalidatePath('/content');
    revalidatePath(`/content/${id}`);
    revalidatePath('/dashboard');

    return getContentById(id);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'An error occurred while updating content',
    };
  }
}

/**
 * Delete a content item and clean up storage assets.
 */
export async function deleteContent(id: string): Promise<ActionResponse<boolean>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: 'Unauthorized' };
    }

    // 1. Fetch media to identify storage paths for cleanup
    const { data: mediaRows } = await supabase
      .from('content_media')
      .select('storage_path, thumbnail_path, media_type')
      .eq('content_id', id);

    // 2. Clean up storage files
    if (mediaRows && mediaRows.length > 0) {
      const videoPaths: string[] = [];
      const thumbnailPaths: string[] = [];

      for (const item of mediaRows) {
        if (item.media_type === 'video' && item.storage_path) {
          videoPaths.push(item.storage_path);
        }
        if (item.thumbnail_path) {
          thumbnailPaths.push(item.thumbnail_path);
        }
      }

      if (videoPaths.length > 0) {
        await supabase.storage.from('videos').remove(videoPaths);
      }
      if (thumbnailPaths.length > 0) {
        await supabase.storage.from('thumbnails').remove(thumbnailPaths);
      }
    }

    // 3. Delete content row (cascades to content_media)
    const { error: deleteError } = await supabase
      .from('content')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (deleteError) {
      return { error: deleteError.message };
    }

    revalidatePath('/content');
    revalidatePath('/dashboard');

    return { data: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to delete content',
    };
  }
}

/**
 * Generate a signed upload URL for secure direct client uploads.
 * Private credentials are never exposed to the browser.
 */
export async function createSignedUploadUrl(
  bucket: 'videos' | 'thumbnails',
  filename: string
): Promise<
  ActionResponse<{
    signedUrl: string;
    token: string;
    path: string;
  }>
> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: 'Unauthorized' };
    }

    // Sanitize filename & guarantee isolation in user folder
    const cleanName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `${user.id}/${Date.now()}-${cleanName}`;

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(path);

    if (error || !data) {
      return { error: error?.message || 'Failed to create signed upload URL' };
    }

    return {
      data: {
        signedUrl: data.signedUrl,
        token: data.token,
        path: data.path,
      },
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Error generating upload credentials',
    };
  }
}

/**
 * Generate a viewable/downloadable URL for a stored asset.
 */
export async function getMediaUrl(
  bucket: 'videos' | 'thumbnails',
  storagePath: string
): Promise<ActionResponse<string>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: 'Unauthorized' };
    }

    if (bucket === 'thumbnails') {
      const { data } = supabase.storage.from('thumbnails').getPublicUrl(storagePath);
      return { data: data.publicUrl };
    }

    // For private 'videos' bucket, generate a 1-hour signed URL
    const { data, error } = await supabase.storage
      .from('videos')
      .createSignedUrl(storagePath, 3600);

    if (error || !data) {
      return { error: error?.message || 'Failed to generate signed media URL' };
    }

    return { data: data.signedUrl };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to retrieve media URL' };
  }
}
