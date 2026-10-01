import crypto from 'node:crypto';
import type {
  TikTokTokenResponse,
  TikTokUserInfo,
  TikTokCreatorInfo,
  TikTokPublishInitResponse,
  TikTokPublishStatusResponse,
  TikTokPostConfig,
} from './types.ts';
import type { TikTokChunkPlan } from './chunks.ts';

const TIKTOK_AUTH_BASE = 'https://www.tiktok.com/v2/auth/authorize/';
const TIKTOK_API_BASE = 'https://open.tiktokapis.com/v2';
const TIKTOK_SCOPES = 'user.info.basic,video.publish';

/**
 * Client for interacting with the official TikTok Open API v2.
 */
export class TikTokClient {
  private clientKey: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor(config?: { clientKey?: string; clientSecret?: string; redirectUri?: string }) {
    this.clientKey = config?.clientKey || process.env.TIKTOK_CLIENT_KEY || '';
    this.clientSecret = config?.clientSecret || process.env.TIKTOK_CLIENT_SECRET || '';
    this.redirectUri =
      config?.redirectUri ||
      process.env.TIKTOK_REDIRECT_URI ||
      'http://localhost:3000/api/platforms/tiktok/callback';
  }

  /**
   * Generate state, PKCE code verifier and code challenge for OAuth 2.0.
   */
  generateOAuthParams() {
    const state = crypto.randomBytes(16).toString('hex');
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    const params = new URLSearchParams({
      client_key: this.clientKey,
      scope: TIKTOK_SCOPES,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    const authUrl = `${TIKTOK_AUTH_BASE}?${params.toString()}`;

    return {
      authUrl,
      state,
      codeVerifier,
    };
  }

  /**
   * Exchange OAuth authorization code for access and refresh tokens.
   */
  async exchangeCodeForToken(
    code: string,
    codeVerifier: string
  ): Promise<TikTokTokenResponse> {
    const url = `${TIKTOK_API_BASE}/oauth/token/`;

    const body = new URLSearchParams({
      client_key: this.clientKey,
      client_secret: this.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: this.redirectUri,
      code_verifier: codeVerifier,
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cache-Control': 'no-cache',
      },
      body: body.toString(),
    });

    const data = await res.json();

    if (!res.ok || data.error || !data.access_token) {
      const msg = data.error_description || data.message || `HTTP ${res.status}`;
      throw new Error(`TikTok token exchange failed: ${msg}`);
    }

    return data as TikTokTokenResponse;
  }

  /**
   * Refresh an expired access token using the refresh token.
   */
  async refreshAccessToken(refreshToken: string): Promise<TikTokTokenResponse> {
    const url = `${TIKTOK_API_BASE}/oauth/token/`;

    const body = new URLSearchParams({
      client_key: this.clientKey,
      client_secret: this.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cache-Control': 'no-cache',
      },
      body: body.toString(),
    });

    const data = await res.json();

    if (!res.ok || data.error || !data.access_token) {
      const msg = data.error_description || data.message || `HTTP ${res.status}`;
      throw new Error(`TikTok token refresh failed: ${msg}`);
    }

    return data as TikTokTokenResponse;
  }

  /**
   * Query basic profile information of the authenticated user.
   */
  async getUserInfo(accessToken: string): Promise<TikTokUserInfo> {
    const url = `${TIKTOK_API_BASE}/user/info/?fields=open_id,union_id,avatar_url,display_name`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await res.json();

    if (!res.ok || data.error?.code !== 'ok') {
      const msg = data.error?.message || `HTTP ${res.status}`;
      throw new Error(`Failed to fetch TikTok user info: ${msg}`);
    }

    return data.data.user as TikTokUserInfo;
  }

  /**
   * Query creator constraints and privacy level options.
   * Required by TikTok before executing video publication.
   */
  async getCreatorInfo(accessToken: string): Promise<TikTokCreatorInfo> {
    const url = `${TIKTOK_API_BASE}/post/publish/creator_info/query/`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    const data = await res.json();

    if (!res.ok || (data.error && data.error.code !== 'ok')) {
      const msg = data.error?.message || `HTTP ${res.status}`;
      throw new Error(`Failed to query TikTok creator info: ${msg}`);
    }

    return data.data as TikTokCreatorInfo;
  }

  /**
   * Initialize a direct video publication request on TikTok.
   */
  async initPublish(
    accessToken: string,
    config: TikTokPostConfig
  ): Promise<TikTokPublishInitResponse> {
    const url = `${TIKTOK_API_BASE}/post/publish/video/init/`;

    // Prepare body: Supports both FILE_UPLOAD (recommended) and PULL_FROM_URL
    const body: Record<string, unknown> = {
      post_info: {
        title: config.title,
        privacy_level: config.privacy_level || 'SELF_ONLY',
        disable_duet: config.disable_duet ?? false,
        disable_stitch: config.disable_stitch ?? false,
        disable_comment: config.disable_comment ?? false,
        is_aigc: config.is_aigc ?? false,
      },
    };

    if (config.source === 'FILE_UPLOAD' || (config.video_size && !config.video_url)) {
      body.source_info = {
        source: 'FILE_UPLOAD',
        video_size: config.video_size,
        chunk_size: config.chunk_size,
        total_chunk_count: config.total_chunk_count,
      };
    } else if (config.video_url) {
      body.source_info = {
        source: 'PULL_FROM_URL',
        video_url: config.video_url,
      };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok || (data.error && data.error.code !== 'ok')) {
      const msg = data.error?.message || `HTTP ${res.status}`;
      throw new Error(`TikTok publish init failed: ${msg}`);
    }

    return data as TikTokPublishInitResponse;
  }

  /**
   * Upload a single binary video chunk to TikTok's upload_url via HTTP PUT.
   */
  async uploadVideoChunk(
    uploadUrl: string,
    chunkBuffer: Uint8Array | Buffer,
    contentRange: string,
    contentType = 'video/mp4'
  ): Promise<{ status: number }> {
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'Content-Range': contentRange,
        'Content-Length': chunkBuffer.byteLength.toString(),
      },
      body: chunkBuffer as unknown as BodyInit,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`TikTok chunk upload failed with HTTP ${res.status}: ${errText}`);
    }

    return { status: res.status };
  }

  /**
   * Sequentially upload all video chunks to TikTok's upload_url.
   */
  async uploadVideoInChunks(
    uploadUrl: string,
    videoBuffer: Uint8Array | Buffer,
    chunkPlan: TikTokChunkPlan,
    contentType = 'video/mp4'
  ): Promise<{ totalUploadedChunks: number }> {
    for (const chunk of chunkPlan.chunks) {
      const chunkSlice = videoBuffer.subarray(chunk.startByte, chunk.endByte + 1);
      await this.uploadVideoChunk(uploadUrl, chunkSlice, chunk.contentRange, contentType);
    }

    return { totalUploadedChunks: chunkPlan.totalChunkCount };
  }

  /**
   * Fetch publication processing status from TikTok.
   */
  async fetchPublishStatus(
    accessToken: string,
    publishId: string
  ): Promise<TikTokPublishStatusResponse> {
    const url = `${TIKTOK_API_BASE}/post/publish/status/fetch/`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        publish_id: publishId,
      }),
    });

    const data = await res.json();

    if (!res.ok || (data.error && data.error.code !== 'ok')) {
      const msg = data.error?.message || `HTTP ${res.status}`;
      throw new Error(`Failed to fetch TikTok publish status: ${msg}`);
    }

    return data as TikTokPublishStatusResponse;
  }
}
