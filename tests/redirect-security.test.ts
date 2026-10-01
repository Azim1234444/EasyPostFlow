import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getTrustedAppBaseUrl, buildSafeRedirectUrl } from '../src/lib/security/app-url.ts';

describe('OAuth Redirect URL & Reverse-Proxy Security', () => {
  describe('Trusted Base URL Resolution', () => {
    it('should prioritize NEXT_PUBLIC_APP_URL when configured for HTTPS tunnels', () => {
      const origEnv = process.env.NEXT_PUBLIC_APP_URL;
      try {
        (process.env as Record<string, string | undefined>).NEXT_PUBLIC_APP_URL =
          'https://postflow-tunnel.ngrok-free.app';

        const base = getTrustedAppBaseUrl('http://localhost:3000/api/platforms/tiktok/callback');
        assert.strictEqual(base.origin, 'https://postflow-tunnel.ngrok-free.app');
        assert.strictEqual(base.protocol, 'https:');
      } finally {
        (process.env as Record<string, string | undefined>).NEXT_PUBLIC_APP_URL = origEnv;
      }
    });

    it('should fall back to request URL origin if NEXT_PUBLIC_APP_URL is not set', () => {
      const origEnv = process.env.NEXT_PUBLIC_APP_URL;
      try {
        delete (process.env as Record<string, string | undefined>).NEXT_PUBLIC_APP_URL;

        const base = getTrustedAppBaseUrl('http://127.0.0.1:4000/some/path');
        assert.strictEqual(base.origin, 'http://127.0.0.1:4000');
      } finally {
        (process.env as Record<string, string | undefined>).NEXT_PUBLIC_APP_URL = origEnv;
      }
    });

    it('should fall back to localhost:3000 if no URL is provided or URL is invalid', () => {
      const origEnv = process.env.NEXT_PUBLIC_APP_URL;
      try {
        delete (process.env as Record<string, string | undefined>).NEXT_PUBLIC_APP_URL;

        const base = getTrustedAppBaseUrl('not-a-valid-url');
        assert.strictEqual(base.origin, 'http://localhost:3000');
      } finally {
        (process.env as Record<string, string | undefined>).NEXT_PUBLIC_APP_URL = origEnv;
      }
    });
  });

  describe('Safe Redirect Construction & Open Redirect Prevention', () => {
    it('should safely build redirect URLs pointing to the trusted application origin', () => {
      const origEnv = process.env.NEXT_PUBLIC_APP_URL;
      try {
        (process.env as Record<string, string | undefined>).NEXT_PUBLIC_APP_URL =
          'https://postflow.app';

        const redirectUrl = buildSafeRedirectUrl(
          '/accounts',
          { success: 'tiktok_connected', accountId: 'acc_123' },
          'http://localhost:3000'
        );

        assert.strictEqual(redirectUrl.origin, 'https://postflow.app');
        assert.strictEqual(redirectUrl.pathname, '/accounts');
        assert.strictEqual(redirectUrl.searchParams.get('success'), 'tiktok_connected');
        assert.strictEqual(redirectUrl.searchParams.get('accountId'), 'acc_123');
      } finally {
        (process.env as Record<string, string | undefined>).NEXT_PUBLIC_APP_URL = origEnv;
      }
    });

    it('should strictly reject open redirect attempts with absolute URLs or protocol-relative paths', () => {
      const origEnv = process.env.NEXT_PUBLIC_APP_URL;
      try {
        (process.env as Record<string, string | undefined>).NEXT_PUBLIC_APP_URL =
          'https://postflow-tunnel.ngrok-free.app';

        // Attack 1: Protocol-relative open redirect //attacker.com
        const attack1 = buildSafeRedirectUrl('//attacker.com/leak');
        assert.strictEqual(attack1.origin, 'https://postflow-tunnel.ngrok-free.app');
        assert.strictEqual(attack1.pathname, '/accounts');

        // Attack 2: Absolute external URL https://evil.com
        const attack2 = buildSafeRedirectUrl('https://evil.com/phish');
        assert.strictEqual(attack2.origin, 'https://postflow-tunnel.ngrok-free.app');
        assert.strictEqual(attack2.pathname, '/accounts');

        // Attack 3: Javascript scheme javascript:alert(1)
        const attack3 = buildSafeRedirectUrl('javascript:alert(1)');
        assert.strictEqual(attack3.origin, 'https://postflow-tunnel.ngrok-free.app');
        assert.strictEqual(attack3.pathname, '/accounts');

        // Attack 4: Backslash trick \attacker.com
        const attack4 = buildSafeRedirectUrl('\\attacker.com');
        assert.strictEqual(attack4.origin, 'https://postflow-tunnel.ngrok-free.app');
        assert.strictEqual(attack4.pathname, '/accounts');
      } finally {
        (process.env as Record<string, string | undefined>).NEXT_PUBLIC_APP_URL = origEnv;
      }
    });
  });
});
