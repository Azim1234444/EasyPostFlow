import { describe, it } from 'node:test';
import assert from 'node:assert';
import { sanitizeLogData } from '../src/lib/logging/logger.ts';
import {
  calculateRetryDelaySeconds,
  isFutureDate,
  schedulePostSchema,
  combineLocalDateTimeToUtc,
} from '../src/lib/validators/schedule.ts';
import { checkRateLimit } from '../src/lib/security/rate-limit.ts';
import { encryptToken } from '../src/lib/crypto/encryption.ts';

describe('Quality, Security, Rate Limiting & Scheduler Invariants', () => {
  describe('Logger Credential Sanitization', () => {
    it('should redact sensitive keys such as access_token, client_secret, and partner_key', () => {
      const sensitivePayload = {
        userId: 'usr_123',
        access_token: 'secret_tiktok_access_token_xyz',
        refresh_token: 'secret_tiktok_refresh_token_abc',
        client_secret: 'shopee_client_secret_999',
        partner_key: 'shopee_partner_key_888',
        safeMetadata: {
          username: 'affiliate_pro',
          role: 'SELLER',
        },
      };

      const sanitized = sanitizeLogData(sensitivePayload) as Record<string, unknown>;

      assert.strictEqual(sanitized.userId, 'usr_123');
      assert.strictEqual(sanitized.access_token, '[REDACTED_LEN_30]');
      assert.strictEqual(sanitized.refresh_token, '[REDACTED_LEN_31]');
      assert.strictEqual(sanitized.client_secret, '[REDACTED_LEN_24]');
      assert.strictEqual(sanitized.partner_key, '[REDACTED_LEN_22]');

      const safeMeta = sanitized.safeMetadata as Record<string, unknown>;
      assert.strictEqual(safeMeta.username, 'affiliate_pro');
      assert.strictEqual(safeMeta.role, 'SELLER');
    });

    it('should handle circular references gracefully without throwing', () => {
      const circularObj: Record<string, unknown> = { name: 'cyclic' };
      circularObj.self = circularObj;

      assert.doesNotThrow(() => {
        const sanitized = sanitizeLogData(circularObj) as Record<string, unknown>;
        assert.strictEqual(sanitized.name, 'cyclic');
        assert.strictEqual(sanitized.self, '[Circular Reference]');
      });
    });

    it('should format Error objects into structured log entries', () => {
      const sampleErr = new Error('Database connection failed');
      const sanitized = sanitizeLogData(sampleErr) as Record<string, unknown>;

      assert.strictEqual(sanitized.name, 'Error');
      assert.strictEqual(sanitized.message, 'Database connection failed');
    });
  });

  describe('Security & Production Fail-Fast Guarantees', () => {
    it('should throw fatal error in production if TOKEN_ENCRYPTION_KEY is missing', () => {
      const origEnv = process.env.NODE_ENV;
      const origKey = process.env.TOKEN_ENCRYPTION_KEY;

      const envMap = process.env as Record<string, string | undefined>;
      envMap.NODE_ENV = 'production';
      delete process.env.TOKEN_ENCRYPTION_KEY;

      assert.throws(
        () => encryptToken('secret_token'),
        (err: Error) => err.message.includes('TOKEN_ENCRYPTION_KEY environment variable is required in production')
      );

      envMap.NODE_ENV = origEnv;
      if (origKey) process.env.TOKEN_ENCRYPTION_KEY = origKey;
    });

    it('should enforce rate limits and block requests exceeding limit', () => {
      const testKey = `test_ip_${Date.now()}`;
      // Allow 3 requests per 60 seconds
      const r1 = checkRateLimit(testKey, 3, 60);
      assert.strictEqual(r1.success, true);
      assert.strictEqual(r1.remaining, 2);

      const r2 = checkRateLimit(testKey, 3, 60);
      assert.strictEqual(r2.success, true);
      assert.strictEqual(r2.remaining, 1);

      const r3 = checkRateLimit(testKey, 3, 60);
      assert.strictEqual(r3.success, true);
      assert.strictEqual(r3.remaining, 0);

      // 4th request must be rejected
      const r4 = checkRateLimit(testKey, 3, 60);
      assert.strictEqual(r4.success, false);
      assert.strictEqual(r4.remaining, 0);
    });
  });

  describe('Scheduler Invariants & Timing Precision', () => {
    it('should return correct exponential delay intervals for retries', () => {
      assert.strictEqual(calculateRetryDelaySeconds(1), 60); // 1 minute
      assert.strictEqual(calculateRetryDelaySeconds(2), 300); // 5 minutes
      assert.strictEqual(calculateRetryDelaySeconds(3), 900); // 15 minutes
      assert.strictEqual(calculateRetryDelaySeconds(4), 900); // Max ceiling 15 minutes
    });

    it('should accurately detect future vs past scheduling dates', () => {
      const pastDate = new Date(Date.now() - 3600000).toISOString();
      const futureDate = new Date(Date.now() + 3600000).toISOString();

      assert.strictEqual(isFutureDate(pastDate), false);
      assert.strictEqual(isFutureDate(futureDate), true);
    });

    it('should reject schedule inputs with past timestamps or invalid formats', () => {
      const pastSchedule = {
        content_id: '11111111-1111-4111-8111-111111111111',
        platform_account_id: '22222222-2222-4222-8222-222222222222',
        platform: 'tiktok',
        scheduled_at: new Date(Date.now() - 600000).toISOString(),
        user_timezone: 'America/New_York',
      };

      const result = schedulePostSchema.safeParse(pastSchedule);
      assert.strictEqual(result.success, false);
      if (!result.success) {
        assert.ok(result.error.issues.some((i) => i.message.includes('future')));
      }
    });

    it('should convert local times across international timezones safely to UTC', () => {
      // 2026-12-25 15:00:00 in Asia/Singapore (UTC+8) -> 2026-12-25 07:00:00 UTC
      const utcIso = combineLocalDateTimeToUtc('2026-12-25', '15:00', 'Asia/Singapore');
      assert.ok(utcIso.startsWith('2026-12-25T07:00:00'));

      // 2026-12-25 15:00:00 in America/New_York (UTC-5 in winter EST) -> 2026-12-25 20:00:00 UTC
      const nyUtcIso = combineLocalDateTimeToUtc('2026-12-25', '15:00', 'America/New_York');
      assert.ok(nyUtcIso.startsWith('2026-12-25T20:00:00'));
    });
  });
});
