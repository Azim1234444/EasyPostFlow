import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { generateShopeeHmacSignature } from '../src/lib/platforms/shopee/crypto.ts';
import { ShopeeClient } from '../src/lib/platforms/shopee/client.ts';
import { ShopeeAdapter } from '../src/lib/platforms/shopee/adapter.ts';

test('shopee crypto: generates exact HMAC-SHA256 signatures per Open Platform specs', () => {
  const partnerId = '100001';
  const partnerKey = 'test_partner_secret_key_888';
  const apiPath = '/api/v2/media_space/init_video_upload';
  const timestamp = 1727750000;
  const accessToken = 'tok_shopee_access_123';
  const shopId = 'shop_999';

  const signature = generateShopeeHmacSignature({
    partnerId,
    apiPath,
    timestamp,
    accessToken,
    shopId,
    partnerKey,
  });

  const expectedBase = `${partnerId}${apiPath}${timestamp}${accessToken}${shopId}`;
  const expectedSign = crypto
    .createHmac('sha256', partnerKey)
    .update(expectedBase)
    .digest('hex');

  assert.equal(signature, expectedSign);
  assert.equal(signature.length, 64); // 256-bit hex string
});

test('shopee client: builds signed API URLs with required query parameters', () => {
  const client = new ShopeeClient({
    partnerId: '100001',
    partnerKey: 'test_key',
  });

  const urlString = client.buildSignedUrl('/api/v2/test_endpoint', 'acc_tok', 'shop_123');
  const parsed = new URL(urlString);

  assert.equal(parsed.pathname, '/api/v2/test_endpoint');
  assert.equal(parsed.searchParams.get('partner_id'), '100001');
  assert.equal(parsed.searchParams.get('access_token'), 'acc_tok');
  assert.equal(parsed.searchParams.get('shop_id'), 'shop_123');
  assert.ok(parsed.searchParams.get('sign'));
  assert.ok(parsed.searchParams.get('timestamp'));
});

test('shopee adapter: routes seller accounts through assisted manual workflow', async () => {
  const adapter = new ShopeeAdapter();

  const isSupported = adapter.supportsDirectPublish({
    platform: 'shopee',
    platformUserId: 'shop_1',
    accessToken: 'stub_seller_token',
    accountType: 'seller',
  });

  // Confirms Shopee Video feed does not pretend to support direct automated API publishing
  assert.equal(isSupported, false);

  const result = await adapter.publish(
    {
      contentId: 'c1',
      title: 'New Product Arrival 2026',
      caption: 'Check out our new stock',
      hashtags: ['seller', 'newarrival'],
      videoStoragePath: 'user/shop-video.mp4',
      videoUrl: 'https://storage/vid.mp4',
      affiliateUrl: 'https://shopee.com/product/999',
      affiliatePlatform: 'shopee',
    },
    {
      platform: 'shopee',
      platformUserId: 'shop_1',
      accessToken: 'stub_seller_token',
      accountType: 'seller',
    }
  );

  assert.equal(result.success, true);
  assert.equal(result.status, 'MANUAL_ACTION_REQUIRED');
  assert.ok(result.manualActionInstructions?.includes('Shopee Mobile App'));
  assert.ok(result.rawResponse?.formatted_caption);
  assert.ok(String(result.rawResponse?.formatted_caption).includes('Product Link:'));
});

test('shopee adapter: affiliate account triggers assisted manual workflow with tracking link', async () => {
  const adapter = new ShopeeAdapter();

  const isDirectSupported = adapter.supportsDirectPublish({
    platform: 'shopee',
    platformUserId: 'aff_user',
    accessToken: 'stub_token',
    accountType: 'affiliate',
  });

  assert.equal(isDirectSupported, false);

  const result = await adapter.publish(
    {
      contentId: 'c2',
      title: 'Top 5 Tech Gadgets on Shopee',
      caption: 'Huge discounts this month!',
      hashtags: ['affiliate', 'deals', 'tech'],
      videoStoragePath: 'user/gadgets.mp4',
      videoUrl: 'https://storage/gadgets.mp4',
      affiliateUrl: 'https://shopee.com/product/123',
      affiliatePlatform: 'shopee',
    },
    {
      platform: 'shopee',
      platformUserId: 'aff_user',
      accessToken: 'stub_token',
      accountType: 'affiliate',
    }
  );

  assert.equal(result.success, true);
  assert.equal(result.status, 'MANUAL_ACTION_REQUIRED');
  assert.ok(result.manualActionInstructions?.includes('Shopee Mobile App'));
  assert.ok(result.rawResponse?.formatted_caption);
  assert.ok(String(result.rawResponse?.formatted_caption).includes('#deals'));
  assert.ok(String(result.rawResponse?.formatted_caption).includes('Product Link:'));
});

test('shopee adapter: rejects posts missing required fields', async () => {
  const adapter = new ShopeeAdapter();

  const noTitleRes = await adapter.publish(
    {
      contentId: '1',
      title: '',
      caption: null,
      hashtags: [],
      videoStoragePath: 'path.mp4',
      videoUrl: 'https://storage/vid.mp4',
      affiliateUrl: null,
      affiliatePlatform: null,
    },
    {
      platform: 'shopee',
      platformUserId: 'shop_1',
      accessToken: 'token',
      accountType: 'seller',
    }
  );

  assert.equal(noTitleRes.success, false);
  assert.equal(noTitleRes.status, 'FAILED');
  assert.ok(noTitleRes.error?.includes('requires a title or caption'));

  const noVideoRes = await adapter.publish(
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
      platform: 'shopee',
      platformUserId: 'shop_1',
      accessToken: 'token',
      accountType: 'seller',
    }
  );

  assert.equal(noVideoRes.success, false);
  assert.equal(noVideoRes.status, 'FAILED');
  assert.ok(noVideoRes.error?.includes('Video source URL is required'));
});
