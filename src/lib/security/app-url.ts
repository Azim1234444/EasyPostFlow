/**
 * Application Base URL and Safe Redirect Utilities
 *
 * Prevents open redirect vulnerabilities behind reverse proxies, development tunnels
 * (ngrok, Cloudflare Tunnel), and production custom domains.
 */

/**
 * Resolves the trusted application base URL for OAuth callbacks and internal redirects.
 * Prioritizes validated NEXT_PUBLIC_APP_URL to support HTTPS tunnels and production domains,
 * falling back to the current request URL or localhost:3000.
 */
export function getTrustedAppBaseUrl(requestUrl?: string): URL {
  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configuredAppUrl) {
    try {
      const parsed = new URL(configuredAppUrl);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed;
      }
    } catch {
      // Configured URL was malformed; fall through to fallback
    }
  }

  if (requestUrl) {
    try {
      const parsed = new URL(requestUrl);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return new URL(parsed.origin);
      }
    } catch {
      // Request URL was malformed; fall through to default
    }
  }

  return new URL('http://localhost:3000');
}

/**
 * Builds a validated, safe redirect URL guaranteed to belong strictly to the application's
 * trusted origin. Rejects arbitrary external hosts and protocol-relative schemes.
 *
 * @param pathname Relative application pathname (e.g. '/accounts', '/login')
 * @param searchParams Key-value query parameters to append
 * @param requestUrl Optional incoming request URL
 */
export function buildSafeRedirectUrl(
  pathname: string,
  searchParams?: Record<string, string | null | undefined>,
  requestUrl?: string
): URL {
  const base = getTrustedAppBaseUrl(requestUrl);

  // Security check: pathname must be a relative path starting with a single '/'
  // Rejects: '//attacker.com', 'https://attacker.com', 'javascript:alert(1)'
  let safePath = pathname.trim();
  if (!safePath.startsWith('/') || safePath.startsWith('//') || safePath.includes('\\')) {
    safePath = '/accounts';
  }

  // Prevent embedded protocol schemes in path
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(safePath)) {
    safePath = '/accounts';
  }

  const destination = new URL(safePath, base.origin);

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== undefined && value !== null) {
        destination.searchParams.set(key, value);
      }
    }
  }

  return destination;
}
