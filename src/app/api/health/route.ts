import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logging/logger';
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Rate limiting: 60 requests per minute per IP
  const clientIp = getClientIp(request);
  const rateLimit = checkRateLimit(`health:${clientIp}`, 60, 60);

  if (!rateLimit.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Too many health check requests.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  const startTime = Date.now();
  let dbStatus: 'healthy' | 'unhealthy' = 'unhealthy';
  let dbLatencyMs = 0;
  let dbErrorDetails: string | undefined = undefined;

  try {
    const supabase = await createClient();
    const dbStart = Date.now();
    const { error } = await supabase
      .from('profiles')
      .select('count', { count: 'exact', head: true });
    
    dbLatencyMs = Date.now() - dbStart;

    if (error) {
      dbErrorDetails = error.message;
      logger.warn('Health check database query returned error', { error: error.message }, 'HealthCheck');
    } else {
      dbStatus = 'healthy';
    }
  } catch (err) {
    dbErrorDetails = err instanceof Error ? err.message : String(err);
    logger.error('Health check database exception', err, undefined, 'HealthCheck');
  }

  const isHealthy = dbStatus === 'healthy';
  const totalDurationMs = Date.now() - startTime;

  return NextResponse.json(
    {
      status: isHealthy ? 'healthy' : 'degraded',
      service: 'postflow-api',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime ? process.uptime() : 0),
      durationMs: totalDurationMs,
      checks: {
        database: {
          status: dbStatus,
          latencyMs: dbLatencyMs,
          ...(dbErrorDetails ? { error: dbErrorDetails } : {}),
        },
        storage: {
          status: 'healthy',
        },
        scheduler: {
          engine: 'inngest',
          status: 'active',
        },
      },
    },
    {
      status: isHealthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}
