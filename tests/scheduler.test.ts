import test from 'node:test';
import assert from 'node:assert/strict';
import {
  schedulePostSchema,
  generateIdempotencyKey,
  calculateRetryDelaySeconds,
  combineLocalDateTimeToUtc,
  formatUtcToLocal,
} from '../src/lib/validators/schedule.ts';
import { getPlatformAdapter } from '../src/lib/platforms/registry.ts';

test('schedulePostSchema: accepts valid future scheduled post', () => {
  const futureIso = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const contentId = crypto.randomUUID();
  const accountId = crypto.randomUUID();

  const validData = {
    content_id: contentId,
    platform_account_id: accountId,
    platform: 'tiktok' as const,
    scheduled_at: futureIso,
    timezone: 'Asia/Singapore',
  };

  const parsed = schedulePostSchema.parse(validData);
  assert.equal(parsed.content_id, validData.content_id);
  assert.equal(parsed.platform, 'tiktok');
  assert.equal(parsed.timezone, 'Asia/Singapore');
});

test('schedulePostSchema: rejects past timestamps', () => {
  const pastIso = new Date(Date.now() - 60 * 1000).toISOString();

  assert.throws(
    () =>
      schedulePostSchema.parse({
        content_id: crypto.randomUUID(),
        platform_account_id: crypto.randomUUID(),
        platform: 'tiktok',
        scheduled_at: pastIso,
        timezone: 'UTC',
      }),
    (err: Error) =>
      err.message.includes('Scheduled time must be at least 1 minute in the future')
  );
});

test('timezone: correctly converts local date and time to UTC ISO string', () => {
  // Singapore is UTC+8
  const utcFromSg = combineLocalDateTimeToUtc('2026-10-15', '14:00', 'Asia/Singapore');
  assert.equal(utcFromSg, '2026-10-15T06:00:00.000Z');

  // New York in October is EDT (UTC-4)
  const utcFromNy = combineLocalDateTimeToUtc('2026-10-15', '09:00', 'America/New_York');
  assert.equal(utcFromNy, '2026-10-15T13:00:00.000Z');
});

test('timezone: correctly formats UTC ISO string back to local timezone', () => {
  const utcIso = '2026-10-15T06:00:00.000Z';

  // Format to Singapore local time
  const localSg = formatUtcToLocal(utcIso, 'Asia/Singapore', 'yyyy-MM-dd HH:mm');
  assert.equal(localSg, '2026-10-15 14:00');

  // Format to New York local time (06:00 UTC - 4h = 02:00 EDT)
  const localNy = formatUtcToLocal(utcIso, 'America/New_York', 'yyyy-MM-dd HH:mm');
  assert.equal(localNy, '2026-10-15 02:00');
});

test('idempotencyKey: generates deterministic key and prevents duplicate collision', () => {
  const contentId = 'c1234567-0000-0000-0000-000000000001';
  const accountId = 'a1234567-0000-0000-0000-000000000002';
  const timeIso = '2026-10-15T10:00:00.000Z';

  const key1 = generateIdempotencyKey(contentId, accountId, timeIso);
  const key2 = generateIdempotencyKey(contentId, accountId, timeIso);

  // Exact same inputs MUST yield exact same key
  assert.equal(key1, key2);
  assert.match(key1, /^pub_c1234567-0000-0000-0000-000000000001_a1234567-0000-0000-0000-000000000002_\d+$/);

  // Different timestamp must yield different key
  const differentTime = '2026-10-15T10:05:00.000Z';
  const keyDifferentTime = generateIdempotencyKey(contentId, accountId, differentTime);
  assert.notEqual(key1, keyDifferentTime);
});

test('retryBackoff: calculates progressive exponential retry delays', () => {
  assert.equal(calculateRetryDelaySeconds(1), 60); // 1 minute
  assert.equal(calculateRetryDelaySeconds(2), 300); // 5 minutes
  assert.equal(calculateRetryDelaySeconds(3), 900); // 15 minutes
  assert.equal(calculateRetryDelaySeconds(4), 900); // Caps at max delay
});

test('platformAdapter: provides isolated platform integrations', async () => {
  const tiktok = getPlatformAdapter('tiktok');
  assert.equal(tiktok.platform, 'tiktok');
  assert.equal(tiktok.supportsDirectPublish(), true);

  const shopee = getPlatformAdapter('shopee');
  assert.equal(shopee.platform, 'shopee');
  // Shopee Video does not support direct automated API publishing
  assert.equal(
    shopee.supportsDirectPublish({
      platform: 'shopee',
      platformUserId: 'shop-1',
      accessToken: 'token',
      accountType: 'seller',
    }),
    false
  );
  // Affiliate account also uses assisted manual workflow
  assert.equal(
    shopee.supportsDirectPublish({
      platform: 'shopee',
      platformUserId: 'aff-1',
      accessToken: 'token',
      accountType: 'affiliate',
    }),
    false
  );
});

test('platformAdapter: tiktok adapter enforces video requirements', async () => {
  const tiktok = getPlatformAdapter('tiktok');

  const invalidResult = await tiktok.publish(
    {
      contentId: '1',
      title: '',
      caption: null,
      hashtags: [],
      videoStoragePath: '',
      videoUrl: '',
      affiliateUrl: null,
      affiliatePlatform: null,
    },
    {
      platform: 'tiktok',
      platformUserId: 'tt-1',
      accessToken: 'tok',
      accountType: 'standard',
    }
  );

  assert.equal(invalidResult.success, false);
  assert.equal(invalidResult.status, 'FAILED');
  assert.ok(invalidResult.error?.includes('requires a title or caption'));
});

test('platformAdapter: shopee affiliate mode returns manual action instructions', async () => {
  const shopee = getPlatformAdapter('shopee');

  const affiliateResult = await shopee.publish(
    {
      contentId: '1',
      title: 'Shopee Affiliate Haul',
      caption: 'Link in bio',
      hashtags: ['shopee'],
      videoStoragePath: 'path/to/video.mp4',
      videoUrl: 'https://storage/video.mp4',
      affiliateUrl: 'https://shope.ee/link',
      affiliatePlatform: 'shopee',
    },
    {
      platform: 'shopee',
      platformUserId: 'aff-creator',
      accessToken: 'tok',
      accountType: 'affiliate',
    }
  );

  assert.equal(affiliateResult.success, true);
  assert.equal(affiliateResult.status, 'MANUAL_ACTION_REQUIRED');
  assert.ok(affiliateResult.manualActionInstructions?.includes('Shopee Mobile App'));
});
