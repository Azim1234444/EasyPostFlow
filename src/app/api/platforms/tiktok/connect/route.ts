import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { TikTokClient } from '@/lib/platforms/tiktok/client';
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit';
import { buildSafeRedirectUrl } from '@/lib/security/app-url';

export async function GET(request: NextRequest) {
  // Rate limiting: 10 connect requests per 5 minutes per IP
  const clientIp = getClientIp(request);
  const rateLimit = checkRateLimit(`tt_connect:${clientIp}`, 10, 300);

  if (!rateLimit.success) {
    const errorUrl = buildSafeRedirectUrl(
      '/accounts',
      { error: 'Too many account connection attempts. Please wait a few minutes.' },
      request.url
    );
    return NextResponse.redirect(errorUrl);
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    const loginUrl = buildSafeRedirectUrl(
      '/login',
      { redirect: '/accounts' },
      request.url
    );
    return NextResponse.redirect(loginUrl);
  }

  const client = new TikTokClient();
  const { authUrl, state, codeVerifier } = client.generateOAuthParams();

  const response = NextResponse.redirect(authUrl);

  const isHttps =
    request.url.startsWith('https://') ||
    process.env.NEXT_PUBLIC_APP_URL?.startsWith('https://') ||
    process.env.NODE_ENV === 'production';

  // Set secure HTTP-only cookies for CSRF state and PKCE verifier (10 minutes expiry)
  response.cookies.set('tt_oauth_state', state, {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });

  response.cookies.set('tt_code_verifier', codeVerifier, {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });

  return response;
}
