/**
 * PostFlow Integration Diagnostics & Troubleshooting Utility
 *
 * CRITICAL SECURITY INVARIANT:
 * This module NEVER exposes raw secret keys, decrypted tokens, or sensitive credentials.
 * It provides safe, structured diagnostics to debug integration readiness and platform failures.
 */

import { logger } from '../logging/logger.ts';

export interface EnvDiagnosticItem {
  key: string;
  category: 'supabase' | 'tiktok' | 'inngest' | 'security' | 'shopee' | 'app';
  required: boolean;
  isConfigured: boolean;
  isValid: boolean;
  notes?: string;
}

export interface VideoAccessibilityResult {
  isAccessible: boolean;
  statusCode?: number;
  contentType?: string;
  contentLengthBytes?: number;
  contentLengthFormatted?: string;
  supportsByteRanges: boolean;
  diagnostics: string[];
  error?: string;
}

export interface TikTokAccountDiagnostic {
  accountId: string;
  status: string;
  tokenFormatValid: boolean;
  hasRefreshToken: boolean;
  tokenExpiresAt: string | null;
  isExpired: boolean;
  expiresInMinutes: number | null;
  scopesConfigured: string[];
  hasBasicInfoScope: boolean;
  hasPublishScope: boolean;
  hasUploadScope?: boolean;
  recommendations: string[];
}

export interface StageFailureDiagnostic {
  stage: 'oauth' | 'token_refresh' | 'video_accessibility' | 'publish_init' | 'status_polling' | 'worker';
  rawError: string;
  category: string;
  likelyCause: string;
  remediationSteps: string[];
}

/**
 * 1. Safe Environment Variables Inspection (Zero Secret Leakage)
 */
export function checkEnvironmentDiagnostics(): EnvDiagnosticItem[] {
  const encKey = process.env.TOKEN_ENCRYPTION_KEY || '';
  const isEncValid = encKey.length === 64 && /^[0-9a-fA-F]{64}$/.test(encKey);

  const ttRedirect = process.env.TIKTOK_REDIRECT_URI || '';
  let isTtRedirectValid = false;
  try {
    if (ttRedirect) {
      new URL(ttRedirect);
      isTtRedirectValid = true;
    }
  } catch {
    isTtRedirectValid = false;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  let isSupabaseUrlValid = false;
  try {
    if (supabaseUrl) {
      new URL(supabaseUrl);
      isSupabaseUrlValid = true;
    }
  } catch {
    isSupabaseUrlValid = false;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  let isAppUrlValid = false;
  try {
    if (appUrl) {
      new URL(appUrl);
      isAppUrlValid = true;
    }
  } catch {
    isAppUrlValid = false;
  }

  return [
    {
      key: 'NEXT_PUBLIC_SUPABASE_URL',
      category: 'supabase',
      required: true,
      isConfigured: !!supabaseUrl,
      isValid: isSupabaseUrlValid,
      notes: isSupabaseUrlValid ? 'Valid HTTPS/HTTP URL' : 'Must be a valid URL',
    },
    {
      key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      category: 'supabase',
      required: true,
      isConfigured: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      isValid: (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').length > 20,
      notes: 'Browser-safe public anon key',
    },
    {
      key: 'SUPABASE_SERVICE_ROLE_KEY',
      category: 'supabase',
      required: true,
      isConfigured: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      isValid: (process.env.SUPABASE_SERVICE_ROLE_KEY || '').length > 20,
      notes: 'Server-only administrative key (bypasses RLS)',
    },
    {
      key: 'TOKEN_ENCRYPTION_KEY',
      category: 'security',
      required: true,
      isConfigured: !!encKey,
      isValid: isEncValid,
      notes: isEncValid ? 'Valid 64-hex AES-256 key' : 'Must be exactly 64 hexadecimal characters',
    },
    {
      key: 'TIKTOK_CLIENT_KEY',
      category: 'tiktok',
      required: true,
      isConfigured: !!process.env.TIKTOK_CLIENT_KEY,
      isValid: (process.env.TIKTOK_CLIENT_KEY || '').length > 5,
      notes: 'TikTok Developer App Client Key',
    },
    {
      key: 'TIKTOK_CLIENT_SECRET',
      category: 'tiktok',
      required: true,
      isConfigured: !!process.env.TIKTOK_CLIENT_SECRET,
      isValid: (process.env.TIKTOK_CLIENT_SECRET || '').length > 5,
      notes: 'TikTok Developer App Client Secret',
    },
    {
      key: 'TIKTOK_REDIRECT_URI',
      category: 'tiktok',
      required: true,
      isConfigured: !!ttRedirect,
      isValid: isTtRedirectValid,
      notes: isTtRedirectValid ? 'Must match TikTok Developer Portal exactly' : 'Invalid URL format',
    },
    {
      key: 'INNGEST_EVENT_KEY',
      category: 'inngest',
      required: true,
      isConfigured: !!process.env.INNGEST_EVENT_KEY,
      isValid: !!process.env.INNGEST_EVENT_KEY,
      notes: 'Inngest Event Key for dispatching jobs',
    },
    {
      key: 'INNGEST_SIGNING_KEY',
      category: 'inngest',
      required: true,
      isConfigured: !!process.env.INNGEST_SIGNING_KEY,
      isValid: !!process.env.INNGEST_SIGNING_KEY,
      notes: 'Inngest Signing Key for function verification',
    },
    {
      key: 'NEXT_PUBLIC_APP_URL',
      category: 'app',
      required: true,
      isConfigured: !!appUrl,
      isValid: isAppUrlValid,
      notes: 'Root application URL for OAuth redirects',
    },
    {
      key: 'SHOPEE_AFFILIATE_APP_ID',
      category: 'shopee',
      required: false,
      isConfigured: !!process.env.SHOPEE_AFFILIATE_APP_ID,
      isValid: true,
      notes: 'Optional: Shopee Affiliate GraphQL link tracking',
    },
    {
      key: 'SHOPEE_AFFILIATE_APP_SECRET',
      category: 'shopee',
      required: false,
      isConfigured: !!(process.env.SHOPEE_AFFILIATE_APP_SECRET || process.env.SHOPEE_AFFILIATE_SECRET),
      isValid: true,
      notes: 'Optional: Shopee Affiliate GraphQL secret key',
    },
  ];
}

/**
 * 2. Video URL Accessibility & Compliance Check
 * Verifies whether TikTok's PULL_FROM_URL ingestion can access the video from Supabase Storage.
 */
export async function checkVideoUrlAccessibility(videoUrl: string): Promise<VideoAccessibilityResult> {
  const diagnostics: string[] = [];

  if (!videoUrl) {
    return {
      isAccessible: false,
      supportsByteRanges: false,
      diagnostics: ['Video URL is empty or null.'],
      error: 'Empty video URL',
    };
  }

  try {
    const parsed = new URL(videoUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return {
        isAccessible: false,
        supportsByteRanges: false,
        diagnostics: [`Invalid protocol: ${parsed.protocol}. Must be HTTPS or HTTP.`],
        error: 'Invalid URL protocol',
      };
    }
  } catch {
    return {
      isAccessible: false,
      supportsByteRanges: false,
      diagnostics: ['String cannot be parsed as a valid URL.'],
      error: 'Malformed URL',
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    // Perform a Range request to inspect headers without downloading whole file
    const res = await fetch(videoUrl, {
      method: 'GET',
      headers: {
        Range: 'bytes=0-1024',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const statusCode = res.status;
    const contentType = res.headers.get('content-type') || '';
    const contentRange = res.headers.get('content-range') || '';
    const acceptRanges = res.headers.get('accept-ranges') || '';

    // Parse full content length from Content-Range or Content-Length
    let totalBytes: number | undefined = undefined;
    if (contentRange && contentRange.includes('/')) {
      const parts = contentRange.split('/');
      const parsed = parseInt(parts[1], 10);
      if (!isNaN(parsed)) totalBytes = parsed;
    } else {
      const len = res.headers.get('content-length');
      if (len) {
        const parsed = parseInt(len, 10);
        if (!isNaN(parsed)) totalBytes = parsed;
      }
    }

    const is2xx = statusCode >= 200 && statusCode < 300;
    const supportsByteRanges = statusCode === 206 || acceptRanges.toLowerCase().includes('bytes');

    if (is2xx) {
      diagnostics.push(`HTTP ${statusCode} OK. Server reachable.`);
    } else {
      diagnostics.push(`HTTP ${statusCode}. Failed to reach video resource.`);
    }

    const isVideoMime = contentType.toLowerCase().startsWith('video/') || contentType.includes('mp4');
    if (isVideoMime) {
      diagnostics.push(`Content-Type: "${contentType}" is a recognized video stream.`);
    } else {
      diagnostics.push(`WARNING: Content-Type: "${contentType}". TikTok expects a video MIME type (e.g. video/mp4).`);
    }

    if (supportsByteRanges) {
      diagnostics.push('Server supports byte-range requests (recommended for video pull ingestion).');
    }

    let formattedLength: string | undefined = undefined;
    if (totalBytes !== undefined) {
      const mb = (totalBytes / (1024 * 1024)).toFixed(2);
      formattedLength = `${mb} MB (${totalBytes.toLocaleString()} bytes)`;
      diagnostics.push(`File size: ${formattedLength}`);

      if (totalBytes > 500 * 1024 * 1024) {
        diagnostics.push('WARNING: File size exceeds 500MB maximum limit for direct URL pull.');
      } else if (totalBytes < 1000) {
        diagnostics.push('WARNING: File size is unusually small for a video (< 1KB).');
      }
    }

    const isAccessible = is2xx && (statusCode === 200 || statusCode === 206);

    return {
      isAccessible,
      statusCode,
      contentType,
      contentLengthBytes: totalBytes,
      contentLengthFormatted: formattedLength,
      supportsByteRanges,
      diagnostics,
      error: isAccessible ? undefined : `HTTP ${statusCode} received from storage provider`,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    diagnostics.push(`Network fetch error: ${errMsg}`);
    return {
      isAccessible: false,
      supportsByteRanges: false,
      diagnostics,
      error: errMsg,
    };
  }
}

/**
 * 3. TikTok Account Health & Scope Diagnostic
 */
export function diagnoseTikTokAccount(account: {
  id: string;
  status: string;
  token_expires_at?: string | null;
  access_token_encrypted?: string | null;
  refresh_token_encrypted?: string | null;
  scopes?: string[] | null;
}): TikTokAccountDiagnostic {
  const recommendations: string[] = [];
  const token = account.access_token_encrypted || '';
  const tokenParts = token.split(':');
  const tokenFormatValid = tokenParts.length === 3 && tokenParts[0].length === 24; // 12-byte IV in hex is 24 chars

  const hasRefreshToken = !!account.refresh_token_encrypted;

  let isExpired = false;
  let expiresInMinutes: number | null = null;

  if (account.token_expires_at) {
    const expiryMs = new Date(account.token_expires_at).getTime();
    const diffMs = expiryMs - Date.now();
    expiresInMinutes = Math.round(diffMs / (60 * 1000));
    isExpired = diffMs <= 0;
  }

  const scopes = account.scopes || [];
  const hasBasicInfoScope = scopes.includes('user.info.basic');
  const hasPublishScope = scopes.includes('video.publish');
  const hasUploadScope = scopes.includes('video.upload');

  if (!tokenFormatValid) {
    recommendations.push('Access token is missing or corrupted. Reconnect your TikTok account.');
  }

  if (isExpired) {
    if (hasRefreshToken) {
      recommendations.push('Token is expired. Automatic refresh will execute prior to publication.');
    } else {
      recommendations.push('Token is expired and no refresh token is stored. User MUST reconnect account.');
    }
  } else if (expiresInMinutes !== null && expiresInMinutes < 30) {
    recommendations.push(`Token will expire in ${expiresInMinutes} minutes. Background worker will auto-refresh.`);
  }

  if (!hasBasicInfoScope) {
    recommendations.push('Missing "user.info.basic" scope. Reconnect account and approve basic profile permission.');
  }

  if (!hasPublishScope) {
    recommendations.push('Missing "video.publish" scope. Reconnect account and approve Direct Post permission.');
  }

  return {
    accountId: account.id,
    status: account.status,
    tokenFormatValid,
    hasRefreshToken,
    tokenExpiresAt: account.token_expires_at || null,
    isExpired,
    expiresInMinutes,
    scopesConfigured: scopes,
    hasBasicInfoScope,
    hasPublishScope,
    hasUploadScope,
    recommendations,
  };
}

/**
 * 4. Structured Failure Diagnostic & Actionable Remediation
 */
export function diagnoseStageFailure(
  stage: 'oauth' | 'token_refresh' | 'video_accessibility' | 'publish_init' | 'status_polling' | 'worker',
  error: unknown
): StageFailureDiagnostic {
  const rawError = error instanceof Error ? error.message : String(error);
  const lower = rawError.toLowerCase();

  let category = 'Unknown Failure';
  let likelyCause = 'An unanticipated exception occurred during pipeline execution.';
  const remediationSteps: string[] = [];

  switch (stage) {
    case 'oauth':
      if (lower.includes('csrf') || lower.includes('state')) {
        category = 'CSRF / State Mismatch';
        likelyCause = 'The OAuth state cookie expired, was cleared, or user initiated flow in a different browser.';
        remediationSteps.push('Ensure third-party cookies or same-site cookies are permitted in browser.');
        remediationSteps.push('Initiate connection flow and complete authorization within 10 minutes.');
      } else if (lower.includes('redirect_uri') || lower.includes('redirect')) {
        category = 'Redirect URI Misconfiguration';
        likelyCause = 'The TIKTOK_REDIRECT_URI does not match the URI registered in the TikTok Developer Portal.';
        remediationSteps.push('Check TikTok Developer Portal -> App Details -> Login Kit.');
        remediationSteps.push('Verify exact character match (protocol, port, path, trailing slashes).');
      } else if (lower.includes('access_denied') || lower.includes('user_cancelled')) {
        category = 'User Declined Permission';
        likelyCause = 'User clicked cancel on the TikTok consent dialog.';
        remediationSteps.push('User must authorize the requested scopes to connect PostFlow.');
      }
      break;

    case 'token_refresh':
      category = 'Token Refresh Failure';
      if (lower.includes('invalid_grant') || lower.includes('refresh_token')) {
        likelyCause = 'The TikTok refresh token has expired (typically 365 days) or was revoked by creator.';
        remediationSteps.push('Mark account status as "expired".');
        remediationSteps.push('Prompt user to re-authenticate via the Accounts page.');
      } else {
        likelyCause = 'TikTok OAuth token endpoint returned an error or network was unreachable.';
        remediationSteps.push('Verify TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET in .env.local.');
      }
      break;

    case 'video_accessibility':
      category = 'Video URL Access Failure';
      likelyCause = 'TikTok servers cannot download the video from Supabase Storage.';
      remediationSteps.push('Verify that Supabase Storage "videos" bucket exists.');
      remediationSteps.push('Ensure the signed URL has not expired (PostFlow sets 1-hour expiration).');
      remediationSteps.push('Ensure the video file is not stored in an unreachable local private IP.');
      break;

    case 'publish_init':
      category = 'TikTok Publish Initialization Rejected';
      if (lower.includes('unaudited_client') || lower.includes('admin') || lower.includes('scope')) {
        likelyCause = 'TikTok App has not passed Direct Post App Review for public posting, or user is not an app administrator/test user.';
        remediationSteps.push('In TikTok Developer Sandbox mode, only registered test users can publish.');
        remediationSteps.push('Submit app for TikTok Partner / Direct Post App Review for production access.');
      } else if (lower.includes('spam') || lower.includes('rate')) {
        category = 'Rate Limit / Creator Restriction';
        likelyCause = 'TikTok daily posting limit reached or creator account has publishing restrictions.';
        remediationSteps.push('Wait for TikTok daily quota to reset or test with a different creator account.');
      } else {
        likelyCause = 'TikTok rejected post parameters (title length, privacy level, or video format).';
        remediationSteps.push('Ensure title is <= 2200 characters and video is supported MP4/MOV.');
      }
      break;

    case 'status_polling':
      category = 'Publish Status Processing';
      if (lower.includes('failed') || lower.includes('fail_reason')) {
        likelyCause = 'TikTok media transcoding or content moderation rejected the video.';
        remediationSteps.push('Check TikTok creator inbox in mobile app for specific rejection reason.');
        remediationSteps.push('Verify video adheres to TikTok community guidelines and codec standards (H.264/AAC).');
      } else {
        likelyCause = 'Network timeout while querying TikTok publish status.';
        remediationSteps.push('PostFlow preserves PROCESSING status so video status can be verified later.');
      }
      break;

    case 'worker':
      category = 'Worker Execution Error';
      if (lower.includes('service_role') || lower.includes('admin')) {
        likelyCause = 'SUPABASE_SERVICE_ROLE_KEY missing or invalid in serverless worker environment.';
        remediationSteps.push('Configure SUPABASE_SERVICE_ROLE_KEY in environment variables.');
      } else if (lower.includes('inngest')) {
        likelyCause = 'Inngest communication error or signature verification failure.';
        remediationSteps.push('Ensure Inngest dev server is running or cloud signing keys are configured.');
      } else {
        likelyCause = 'Unexpected error in background worker execution.';
        remediationSteps.push('Inspect Inngest dashboard function logs for step-by-step trace.');
      }
      break;
  }

  if (remediationSteps.length === 0) {
    remediationSteps.push('Check server application logs for detailed trace.');
    remediationSteps.push('Verify all required environment variables are set in .env.local.');
  }

  logger.warn('Diagnostic recorded for pipeline stage failure', {
    stage,
    category,
    likelyCause,
    error: rawError,
  });

  return {
    stage,
    rawError,
    category,
    likelyCause,
    remediationSteps,
  };
}
