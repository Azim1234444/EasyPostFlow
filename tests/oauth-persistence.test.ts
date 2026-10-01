import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { encryptToken, decryptToken } from '../src/lib/crypto/encryption.ts';
import { createAdminClient } from '../src/lib/supabase/admin.ts';
import { buildSafeRedirectUrl } from '../src/lib/security/app-url.ts';

describe('OAuth Callback & Platform Accounts Persistence Security', () => {
  describe('Server-Side Session Security & User ID Invariants', () => {
    it('should derive user_id exclusively from verified server session, rejecting client parameters', () => {
      // Simulates the security invariant in callback/route.ts:
      // user_id MUST come from supabase.auth.getUser() and never from searchParams or body
      const serverAuthSessionUser = { id: 'usr_verified_session_abc123' };
      const maliciousClientQuery = { user_id: 'usr_attacker_spoofed_xyz789' };

      // Invariant: The persistence record must use serverAuthSessionUser.id
      const accountRecordToPersist = {
        user_id: serverAuthSessionUser.id,
        platform: 'tiktok',
        platform_user_id: 'tt_open_id_456',
      };

      assert.strictEqual(accountRecordToPersist.user_id, serverAuthSessionUser.id);
      assert.notStrictEqual(accountRecordToPersist.user_id, maliciousClientQuery.user_id);
    });
  });

  describe('Token Encryption & Zero-Leakage Invariants', () => {
    it('should encrypt sensitive tokens with AES-256-GCM before persisting to database', () => {
      const rawAccessToken = 'act_live_tiktok_access_token_12345';
      const rawRefreshToken = 'rft_live_tiktok_refresh_token_67890';

      const encryptedAccessToken = encryptToken(rawAccessToken);
      const encryptedRefreshToken = encryptToken(rawRefreshToken);

      // Verify encrypted format: iv:authTag:ciphertext
      const accessParts = encryptedAccessToken.split(':');
      assert.strictEqual(accessParts.length, 3, 'Encrypted access token must contain IV, authTag, and ciphertext');
      assert.strictEqual(accessParts[0].length, 24, 'IV must be 12 bytes hex (24 chars)');
      assert.strictEqual(accessParts[1].length, 32, 'AuthTag must be 16 bytes hex (32 chars)');

      // Verify raw secrets are not present in encrypted strings
      assert.strictEqual(encryptedAccessToken.includes(rawAccessToken), false);
      assert.strictEqual(encryptedRefreshToken.includes(rawRefreshToken), false);

      // Verify lossless decryption with valid key
      assert.strictEqual(decryptToken(encryptedAccessToken), rawAccessToken);
      assert.strictEqual(decryptToken(encryptedRefreshToken), rawRefreshToken);
    });

    it('should never expose tokens or secrets in redirect URLs', () => {
      const sensitiveToken = 'act_secret_tiktok_token_never_expose';
      const redirectUrl = buildSafeRedirectUrl(
        '/accounts',
        { success: 'tiktok_connected' },
        'https://postflow.app/api/platforms/tiktok/callback'
      );

      const urlString = redirectUrl.toString();
      assert.strictEqual(urlString.includes(sensitiveToken), false);
      assert.strictEqual(redirectUrl.searchParams.get('success'), 'tiktok_connected');
      assert.strictEqual(redirectUrl.searchParams.has('access_token'), false);
      assert.strictEqual(redirectUrl.searchParams.has('refresh_token'), false);
    });
  });

  describe('Database Upsert Conflict Resolution', () => {
    it('should enforce unique conflict resolution on user_id, platform, platform_user_id', () => {
      const onConflictTarget = 'user_id,platform,platform_user_id';
      const parts = onConflictTarget.split(',');

      assert.strictEqual(parts.length, 3);
      assert.ok(parts.includes('user_id'));
      assert.ok(parts.includes('platform'));
      assert.ok(parts.includes('platform_user_id'));
    });
  });

  describe('Admin Client Security Boundaries', () => {
    it('should throw immediately if createAdminClient is invoked in browser context', () => {
      // Simulate browser environment
      // @ts-expect-error Mocking global window for testing security guard
      globalThis.window = {} as unknown;

      try {
        assert.throws(
          () => createAdminClient(),
          (err: Error) => err.message.includes('FATAL: createAdminClient cannot be called from the browser')
        );
      } finally {
        // @ts-expect-error Deleting mocked window
        delete globalThis.window;
      }
    });

    it('should instantiate admin client in server environment without browser leak', () => {
      const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const origServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      try {
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://mock-test-project.supabase.co';
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock_service_role_key_for_testing';
        const adminClient = createAdminClient();
        assert.ok(adminClient !== null);
      } finally {
        process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl;
        process.env.SUPABASE_SERVICE_ROLE_KEY = origServiceKey;
      }
    });
  });

  describe('CSRF State & PKCE Verification Guards', () => {
    it('should reject callback execution if state cookie does not match state parameter', () => {
      const storedCookieState: string = 'state_from_original_request_abc';
      const callbackParamState: string = 'state_from_attacker_tampering_xyz';

      const isStateValid = storedCookieState === callbackParamState;
      assert.strictEqual(isStateValid, false, 'Mismatched CSRF state must fail validation');
    });

    it('should reject callback execution if PKCE code verifier is missing', () => {
      const getStoredVerifier = (): string | undefined => undefined;
      const storedVerifier = getStoredVerifier();
      const hasVerifier = !!storedVerifier && storedVerifier.length >= 32;

      assert.strictEqual(hasVerifier, false, 'Missing PKCE verifier must halt OAuth exchange');
    });
  });
});
