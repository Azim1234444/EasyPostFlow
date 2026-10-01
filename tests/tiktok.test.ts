import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { TikTokClient } from '../src/lib/platforms/tiktok/client.ts';
import { TikTokAdapter } from '../src/lib/platforms/tiktok/adapter.ts';
import { encryptToken } from '../src/lib/crypto/encryption.ts';

test('tiktok client: generates valid OAuth 2.0 PKCE parameters', () => {
  const client = new TikTokClient({
    clientKey: 'test_client_key_123',
    clientSecret: 'test_client_secret_456',
    redirectUri: 'https://postflow.app/api/platforms/tiktok/callback',
  });

  const { authUrl, state, codeVerifier } = client.generateOAuthParams();

  assert.ok(state.length >= 16);
  assert.ok(codeVerifier.length >= 32);

  const parsedUrl = new URL(authUrl);
  assert.equal(parsedUrl.origin, 'https://www.tiktok.com');
  assert.equal(parsedUrl.pathname, '/v2/auth/authorize/');
  assert.equal(parsedUrl.searchParams.get('client_key'), 'test_client_key_123');
  assert.equal(parsedUrl.searchParams.get('response_type'), 'code');
  assert.equal(parsedUrl.searchParams.get('code_challenge_method'), 'S256');

  // Verify PKCE code challenge computation: SHA256(verifier).base64url
  const expectedChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  assert.equal(parsedUrl.searchParams.get('code_challenge'), expectedChallenge);
  assert.ok(parsedUrl.searchParams.get('scope')?.includes('video.publish'));
  assert.ok(parsedUrl.searchParams.get('scope')?.includes('user.info.basic'));
  assert.strictEqual(parsedUrl.searchParams.get('scope')?.includes('video.upload'), false);
});

test('tiktok adapter: validates required media and captions', async () => {
  const adapter = new TikTokAdapter();

  const noTitleResult = await adapter.publish(
    {
      contentId: '1',
      title: '',
      caption: null,
      hashtags: [],
      videoStoragePath: 'path.mp4',
      videoUrl: 'https://storage/video.mp4',
      affiliateUrl: null,
      affiliatePlatform: null,
    },
    {
      platform: 'tiktok',
      platformUserId: 'user-1',
      accessToken: 'stub_token',
      accountType: 'standard',
    }
  );

  assert.equal(noTitleResult.success, false);
  assert.equal(noTitleResult.status, 'FAILED');
  assert.ok(noTitleResult.error?.includes('requires a title or caption'));

  const noVideoResult = await adapter.publish(
    {
      contentId: '1',
      title: 'Valid Title',
      caption: null,
      hashtags: [],
      videoStoragePath: '',
      videoUrl: '',
      affiliateUrl: null,
      affiliatePlatform: null,
    },
    {
      platform: 'tiktok',
      platformUserId: 'user-1',
      accessToken: 'stub_token',
      accountType: 'standard',
    }
  );

  assert.equal(noVideoResult.success, false);
  assert.equal(noVideoResult.status, 'FAILED');
  assert.ok(noVideoResult.error?.includes('Video source URL is required'));
});

test('tiktok adapter: decrypts AES-256 encrypted tokens during execution', async () => {
  const adapter = new TikTokAdapter();
  const rawToken = 'stub_valid_live_token_123';
  const encryptedToken = encryptToken(rawToken);

  const result = await adapter.publish(
    {
      contentId: 'c1',
      title: 'Summer Outfit Trends',
      caption: 'Link in bio for deals',
      hashtags: ['fashion', 'affiliate'],
      videoStoragePath: 'user/video.mp4',
      videoUrl: 'https://supabase.co/storage/v1/object/sign/videos/vid.mp4',
      affiliateUrl: 'https://shope.ee/item',
      affiliatePlatform: 'shopee',
    },
    {
      platform: 'tiktok',
      platformUserId: 'tt_open_id_123',
      accessToken: encryptedToken,
      accountType: 'standard',
    }
  );

  assert.equal(result.success, true);
  assert.ok(result.providerPostId);
  assert.ok(result.publishId);
});

test('tiktok adapter: checkPublishStatus handles PUBLISH_COMPLETE state', async () => {
  const mockClient = {
    fetchPublishStatus: async () => ({
      data: {
        status: 'PUBLISH_COMPLETE' as const,
        publicaly_available_post_id: ['v_item_99999'],
      },
      error: { code: 'ok', message: '', log_id: 'log1' },
    }),
  } as unknown as TikTokClient;

  const adapter = new TikTokAdapter(mockClient);
  process.env.TIKTOK_CLIENT_KEY = 'mock_key';

  const statusResult = await adapter.checkPublishStatus('v_pub_123', {
    platform: 'tiktok',
    platformUserId: 'u1',
    accessToken: 'real_bearer_token',
    accountType: 'standard',
  });

  assert.equal(statusResult.status, 'COMPLETED');
  assert.equal(statusResult.providerPostId, 'v_item_99999');

  delete process.env.TIKTOK_CLIENT_KEY;
});

test('tiktok adapter: checkPublishStatus handles in-flight PROCESSING state', async () => {
  const mockClient = {
    fetchPublishStatus: async () => ({
      data: {
        status: 'PROCESSING_DOWNLOAD' as const,
      },
      error: { code: 'ok', message: '', log_id: 'log2' },
    }),
  } as unknown as TikTokClient;

  const adapter = new TikTokAdapter(mockClient);
  process.env.TIKTOK_CLIENT_KEY = 'mock_key';

  const statusResult = await adapter.checkPublishStatus('v_pub_123', {
    platform: 'tiktok',
    platformUserId: 'u1',
    accessToken: 'real_bearer_token',
    accountType: 'standard',
  });

  assert.equal(statusResult.status, 'PROCESSING');

  delete process.env.TIKTOK_CLIENT_KEY;
});

test('tiktok adapter: checkPublishStatus handles FAILED state with error message', async () => {
  const mockClient = {
    fetchPublishStatus: async () => ({
      data: {
        status: 'FAILED' as const,
        fail_reason: 'Video resolution exceeds maximum allowed dimensions',
      },
      error: { code: 'ok', message: '', log_id: 'log3' },
    }),
  } as unknown as TikTokClient;

  const adapter = new TikTokAdapter(mockClient);
  process.env.TIKTOK_CLIENT_KEY = 'mock_key';

  const statusResult = await adapter.checkPublishStatus('v_pub_123', {
    platform: 'tiktok',
    platformUserId: 'u1',
    accessToken: 'real_bearer_token',
    accountType: 'standard',
  });

  assert.equal(statusResult.status, 'FAILED');
  assert.ok(statusResult.errorMessage?.includes('Video resolution exceeds'));

  delete process.env.TIKTOK_CLIENT_KEY;
});
