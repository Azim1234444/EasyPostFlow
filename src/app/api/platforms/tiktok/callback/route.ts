import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { TikTokClient } from '@/lib/platforms/tiktok/client';
import { encryptToken } from '@/lib/crypto/encryption';
import { diagnoseStageFailure } from '@/lib/diagnostics/integration';
import { buildSafeRedirectUrl } from '@/lib/security/app-url';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const errorParam = searchParams.get('error');
  const errorDesc = searchParams.get('error_description');

  const buildRedirect = (params: Record<string, string>) =>
    buildSafeRedirectUrl('/accounts', params, request.url);

  // 1. Check for platform OAuth error
  if (errorParam) {
    diagnoseStageFailure('oauth', new Error(errorDesc || errorParam));
    return NextResponse.redirect(buildRedirect({ error: errorDesc || errorParam }));
  }

  if (!code || !state) {
    diagnoseStageFailure('oauth', new Error('Missing code or state parameter in callback URL'));
    return NextResponse.redirect(buildRedirect({ error: 'Missing code or state parameter' }));
  }

  // 2. Validate CSRF state
  const storedState = request.cookies.get('tt_oauth_state')?.value;
  const codeVerifier = request.cookies.get('tt_code_verifier')?.value;

  if (!storedState || storedState !== state) {
    diagnoseStageFailure('oauth', new Error('CSRF state mismatch: stored cookie did not match state param'));
    return NextResponse.redirect(
      buildRedirect({ error: 'OAuth state verification failed. Possible CSRF attack.' })
    );
  }

  if (!codeVerifier) {
    diagnoseStageFailure('oauth', new Error('PKCE code verifier missing or expired in cookies'));
    return NextResponse.redirect(
      buildRedirect({ error: 'PKCE code verifier expired. Please try connecting again.' })
    );
  }

  // 3. Authenticate current PostFlow user
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    const loginUrl = buildSafeRedirectUrl('/login', { redirect: '/accounts' }, request.url);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const client = new TikTokClient();

    // 4. Exchange authorization code for tokens
    const tokens = await client.exchangeCodeForToken(code, codeVerifier);

    // 5. Retrieve basic user profile
    let displayName = 'TikTok Creator';
    let avatarUrl = '';
    try {
      const userInfo = await client.getUserInfo(tokens.access_token);
      displayName = userInfo.display_name || displayName;
      avatarUrl = userInfo.avatar_url || '';
    } catch (profileErr) {
      console.warn('Could not fetch optional TikTok profile info:', profileErr);
    }

    // 6. Encrypt sensitive tokens before writing to database
    const encryptedAccessToken = encryptToken(tokens.access_token);
    const encryptedRefreshToken = encryptToken(tokens.refresh_token);
    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // 7. Upsert into public.platform_accounts
    const { error: dbError } = await supabase.from('platform_accounts').upsert(
      {
        user_id: user.id,
        platform: 'tiktok',
        account_type: 'standard',
        platform_user_id: tokens.open_id,
        platform_username: displayName,
        display_name: displayName,
        avatar_url: avatarUrl,
        access_token_encrypted: encryptedAccessToken,
        refresh_token_encrypted: encryptedRefreshToken,
        token_expires_at: tokenExpiresAt,
        status: 'connected',
        scopes: tokens.scope ? tokens.scope.split(',') : [],
        connected_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,platform,platform_user_id',
      }
    );

    if (dbError) {
      throw new Error(`Database error saving account: ${dbError.message}`);
    }

    const response = NextResponse.redirect(buildRedirect({ success: 'tiktok_connected' }));

    // Clear temporary cookies
    response.cookies.delete('tt_oauth_state');
    response.cookies.delete('tt_code_verifier');

    return response;
  } catch (err) {
    diagnoseStageFailure('oauth', err);
    const response = NextResponse.redirect(
      buildRedirect({
        error: err instanceof Error ? err.message : 'TikTok account connection failed',
      })
    );
    response.cookies.delete('tt_oauth_state');
    response.cookies.delete('tt_code_verifier');
    return response;
  }
}
