import type {
  PlatformAdapter,
  PublishRequestPayload,
  PlatformCredentials,
  PublishResult,
  PublishStatusResult,
} from '../types.ts';
import { TikTokClient } from './client.ts';
import { calculateTikTokChunks } from './chunks.ts';
import { decryptToken } from '../../crypto/encryption.ts';
import { createAdminClient } from '../../supabase/admin.ts';

export class TikTokAdapter implements PlatformAdapter {
  readonly platform = 'tiktok' as const;
  private client: TikTokClient;

  constructor(client?: TikTokClient) {
    this.client = client || new TikTokClient();
  }

  supportsDirectPublish(): boolean {
    return true;
  }

  /**
   * Helper to retrieve raw decrypted access token from credentials
   */
  private resolveAccessToken(credentials: PlatformCredentials): string {
    const raw = credentials.accessToken;
    if (!raw) {
      throw new Error('TikTok access token is missing');
    }

    // Check if token is encrypted (format: iv:authTag:ciphertext)
    if (raw.includes(':') && raw.split(':').length === 3) {
      try {
        return decryptToken(raw);
      } catch (err) {
        console.warn('Could not decrypt token; assuming raw token:', err);
        return raw;
      }
    }

    return raw;
  }

  async publish(
    payload: PublishRequestPayload,
    credentials: PlatformCredentials
  ): Promise<PublishResult> {
    if (!payload.title && !payload.caption) {
      return {
        success: false,
        status: 'FAILED',
        error: 'TikTok requires a title or caption for video posts.',
      };
    }

    const hasBuffer = !!payload.videoBuffer && payload.videoBuffer.byteLength > 0;
    const hasStoragePath = !!payload.videoStoragePath;
    const hasUrl = !!payload.videoUrl;

    if (!hasBuffer && !hasStoragePath && !hasUrl) {
      return {
        success: false,
        status: 'FAILED',
        error: 'Video source URL is required for publication.',
      };
    }

    const accessToken = this.resolveAccessToken(credentials);

    // If running in development stub or mock mode without live TikTok keys
    if (accessToken.startsWith('stub_') || !process.env.TIKTOK_CLIENT_KEY) {
      const mockPostId = `tiktok_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      return {
        success: true,
        status: 'PUBLISHED',
        providerPostId: mockPostId,
        publishId: `v_pub_${mockPostId}`,
        rawResponse: {
          mode: 'development_sandbox_simulation',
          platform: 'tiktok',
          timestamp: new Date().toISOString(),
        },
      };
    }

    try {
      // Step A: Query creator constraints and privacy levels
      let allowedPrivacy = 'SELF_ONLY';
      try {
        const creatorInfo = await this.client.getCreatorInfo(accessToken);
        if (
          creatorInfo.privacy_level_options &&
          creatorInfo.privacy_level_options.includes('PUBLIC_TO_EVERYONE')
        ) {
          allowedPrivacy = 'PUBLIC_TO_EVERYONE';
        }
      } catch (infoErr) {
        console.warn('Creator info query warning (defaulting to SELF_ONLY):', infoErr);
      }

      // Step B: Prepare title + hashtags (max 2200 chars)
      let postText = payload.title;
      if (payload.hashtags && payload.hashtags.length > 0) {
        const tagString = payload.hashtags.map((h) => `#${h}`).join(' ');
        postText = `${postText} ${tagString}`;
      }

      if (postText.length > 2200) {
        postText = postText.substring(0, 2197) + '...';
      }

      // Step C: Determine Transfer Mode
      // FILE_UPLOAD is preferred whenever binary buffer or server-side storage path is available.
      // PULL_FROM_URL is used ONLY when explicitly configured or when only a public URL is supplied.
      const isExplicitPull = payload.transferMode === 'PULL_FROM_URL';
      const useFileUpload = !isExplicitPull && (hasBuffer || hasStoragePath);

      if (useFileUpload) {
        // Retrieve binary buffer
        let videoBuffer: Buffer | Uint8Array;
        if (hasBuffer) {
          videoBuffer = payload.videoBuffer!;
        } else {
          const supabase = createAdminClient();
          const { data: fileBlob, error: dlErr } = await supabase.storage
            .from('videos')
            .download(payload.videoStoragePath);

          if (dlErr || !fileBlob) {
            throw new Error(`Failed to retrieve video from storage: ${dlErr?.message || 'Empty file'}`);
          }
          const ab = await fileBlob.arrayBuffer();
          videoBuffer = Buffer.from(ab);
        }

        // Calculate chunk plan per TikTok specifications
        const chunkPlan = calculateTikTokChunks(videoBuffer.byteLength);

        // Initialize upload request with TikTok
        const initRes = await this.client.initPublish(accessToken, {
          title: postText,
          privacy_level: allowedPrivacy,
          source: 'FILE_UPLOAD',
          video_size: chunkPlan.videoSize,
          chunk_size: chunkPlan.chunkSize,
          total_chunk_count: chunkPlan.totalChunkCount,
          disable_duet: false,
          disable_stitch: false,
          disable_comment: false,
        });

        const publishId = initRes.data?.publish_id;
        const uploadUrl = initRes.data?.upload_url;

        if (!publishId) {
          throw new Error(initRes.error?.message || 'Failed to receive publish_id from TikTok');
        }

        if (!uploadUrl) {
          throw new Error('TikTok did not provide an upload_url for FILE_UPLOAD');
        }

        // Upload chunks sequentially to upload_url
        await this.client.uploadVideoInChunks(uploadUrl, videoBuffer, chunkPlan);

        return {
          success: true,
          status: 'PROCESSING',
          publishId,
          rawResponse: {
            publish_id: publishId,
            transfer_mode: 'FILE_UPLOAD',
            total_chunks: chunkPlan.totalChunkCount,
            video_size: chunkPlan.videoSize,
            privacy_level: allowedPrivacy,
            response: initRes,
          },
        };
      } else {
        // Fallback: PULL_FROM_URL mode
        if (!payload.videoUrl) {
          throw new Error('Video source URL is required for PULL_FROM_URL transfer mode.');
        }

        const initRes = await this.client.initPublish(accessToken, {
          title: postText,
          privacy_level: allowedPrivacy,
          source: 'PULL_FROM_URL',
          video_url: payload.videoUrl,
          disable_duet: false,
          disable_stitch: false,
          disable_comment: false,
        });

        const publishId = initRes.data?.publish_id;
        if (!publishId) {
          throw new Error(initRes.error?.message || 'Failed to receive publish_id from TikTok');
        }

        return {
          success: true,
          status: 'PROCESSING',
          publishId,
          rawResponse: {
            publish_id: publishId,
            transfer_mode: 'PULL_FROM_URL',
            privacy_level: allowedPrivacy,
            response: initRes,
          },
        };
      }
    } catch (err) {
      return {
        success: false,
        status: 'FAILED',
        error: err instanceof Error ? err.message : 'TikTok publication failed',
      };
    }
  }

  async checkPublishStatus(
    publishId: string,
    credentials: PlatformCredentials
  ): Promise<PublishStatusResult> {
    const accessToken = this.resolveAccessToken(credentials);

    // If stub token, simulate completed
    if (accessToken.startsWith('stub_') || !process.env.TIKTOK_CLIENT_KEY) {
      return {
        status: 'COMPLETED',
        providerPostId: publishId.replace('v_pub_', ''),
      };
    }

    try {
      const res = await this.client.fetchPublishStatus(accessToken, publishId);
      const statusData = res.data;

      if (!statusData) {
        return {
          status: 'PROCESSING',
        };
      }

      if (statusData.status === 'PUBLISH_COMPLETE') {
        // Access intentional typo in official TikTok API: publicaly_available_post_id
        const postIds = statusData.publicaly_available_post_id;
        const providerPostId = postIds && postIds.length > 0 ? postIds[0] : publishId;

        return {
          status: 'COMPLETED',
          providerPostId,
          rawResponse: res as unknown as Record<string, unknown>,
        };
      }

      if (statusData.status === 'FAILED') {
        return {
          status: 'FAILED',
          errorMessage: statusData.fail_reason || 'Publication processing failed on TikTok',
          rawResponse: res as unknown as Record<string, unknown>,
        };
      }

      // PROCESSING_UPLOAD, PROCESSING_DOWNLOAD, SEND_TO_USER_INBOX
      return {
        status: 'PROCESSING',
        rawResponse: res as unknown as Record<string, unknown>,
      };
    } catch (err) {
      return {
        status: 'FAILED',
        errorMessage: err instanceof Error ? err.message : 'Error polling TikTok status',
      };
    }
  }
}
