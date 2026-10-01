import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkEnvironmentDiagnostics,
  checkVideoUrlAccessibility,
  diagnoseTikTokAccount,
  diagnoseStageFailure,
} from '../src/lib/diagnostics/integration.ts';

describe('Integration Diagnostics Utility', () => {
  describe('Environment Diagnostics', () => {
    it('should return structured diagnostics for all critical system variables', () => {
      const items = checkEnvironmentDiagnostics();
      assert.ok(Array.isArray(items));
      assert.ok(items.length >= 8);

      const keys = items.map((i) => i.key);
      assert.ok(keys.includes('NEXT_PUBLIC_SUPABASE_URL'));
      assert.ok(keys.includes('SUPABASE_SERVICE_ROLE_KEY'));
      assert.ok(keys.includes('TOKEN_ENCRYPTION_KEY'));
      assert.ok(keys.includes('TIKTOK_CLIENT_KEY'));
      assert.ok(keys.includes('TIKTOK_CLIENT_SECRET'));
      assert.ok(keys.includes('TIKTOK_REDIRECT_URI'));
      assert.ok(keys.includes('INNGEST_EVENT_KEY'));
      assert.ok(keys.includes('INNGEST_SIGNING_KEY'));
    });

    it('should NEVER expose raw secret values in the diagnostic output', () => {
      const items = checkEnvironmentDiagnostics();
      for (const item of items) {
        // Assert that the object only contains metadata, no raw string value
        assert.strictEqual('value' in item, false);
        assert.strictEqual(typeof item.isConfigured, 'boolean');
        assert.strictEqual(typeof item.isValid, 'boolean');
      }
    });
  });

  describe('Video URL Accessibility Diagnostic', () => {
    it('should flag empty or malformed URLs immediately', async () => {
      const emptyRes = await checkVideoUrlAccessibility('');
      assert.strictEqual(emptyRes.isAccessible, false);
      assert.strictEqual(emptyRes.error, 'Empty video URL');

      const malformedRes = await checkVideoUrlAccessibility('not-a-valid-url');
      assert.strictEqual(malformedRes.isAccessible, false);
      assert.strictEqual(malformedRes.error, 'Malformed URL');
    });

    it('should reject non-HTTP/HTTPS protocols', async () => {
      const ftpRes = await checkVideoUrlAccessibility('ftp://example.com/video.mp4');
      assert.strictEqual(ftpRes.isAccessible, false);
      assert.strictEqual(ftpRes.error, 'Invalid URL protocol');
    });
  });

  describe('TikTok Account Health Diagnostic', () => {
    it('should identify valid vs corrupted encrypted token format', () => {
      const validAccount = {
        id: 'acc-1',
        status: 'connected',
        token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
        access_token_encrypted: '0123456789abcdef01234567:authTagBase64:ciphertextBase64',
        refresh_token_encrypted: '0123456789abcdef01234567:authTagBase64:refreshCiphertext',
        scopes: ['user.info.basic', 'video.publish'],
      };

      const diag = diagnoseTikTokAccount(validAccount);
      assert.strictEqual(diag.tokenFormatValid, true);
      assert.strictEqual(diag.isExpired, false);
      assert.strictEqual(diag.hasBasicInfoScope, true);
      assert.strictEqual(diag.hasPublishScope, true);
      assert.strictEqual(diag.recommendations.length, 0);
    });

    it('should flag expired tokens and missing scopes with clear remediation', () => {
      const expiredAccount = {
        id: 'acc-2',
        status: 'connected',
        token_expires_at: new Date(Date.now() - 3600 * 1000).toISOString(),
        access_token_encrypted: 'corrupted-token-no-iv',
        refresh_token_encrypted: null,
        scopes: ['user.info.basic'], // missing video.publish
      };

      const diag = diagnoseTikTokAccount(expiredAccount);
      assert.strictEqual(diag.tokenFormatValid, false);
      assert.strictEqual(diag.isExpired, true);
      assert.strictEqual(diag.hasBasicInfoScope, true);
      assert.strictEqual(diag.hasPublishScope, false);
      assert.ok(diag.recommendations.some((r) => r.includes('corrupted')));
      assert.ok(diag.recommendations.some((r) => r.includes('video.publish')));
    });
  });

  describe('Stage Failure Diagnostic', () => {
    it('should provide structured cause and remediation for OAuth CSRF mismatch', () => {
      const diag = diagnoseStageFailure('oauth', new Error('CSRF state mismatch'));
      assert.strictEqual(diag.stage, 'oauth');
      assert.strictEqual(diag.category, 'CSRF / State Mismatch');
      assert.ok(diag.remediationSteps.length > 0);
    });

    it('should provide structured cause and remediation for unaudited TikTok sandbox errors', () => {
      const diag = diagnoseStageFailure('publish_init', new Error('unaudited_client_can_only_post_to_admin'));
      assert.strictEqual(diag.stage, 'publish_init');
      assert.strictEqual(diag.category, 'TikTok Publish Initialization Rejected');
      assert.ok(diag.remediationSteps.some((r) => r.includes('Sandbox') || r.includes('test user')));
    });

    it('should provide structured cause and remediation for worker service role missing error', () => {
      const diag = diagnoseStageFailure('worker', new Error('SUPABASE_SERVICE_ROLE_KEY is required'));
      assert.strictEqual(diag.stage, 'worker');
      assert.strictEqual(diag.category, 'Worker Execution Error');
      assert.ok(diag.remediationSteps.some((r) => r.includes('SUPABASE_SERVICE_ROLE_KEY')));
    });
  });
});
