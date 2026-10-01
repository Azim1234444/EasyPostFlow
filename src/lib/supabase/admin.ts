import { createClient } from '@supabase/supabase-js';

/**
 * Creates a trusted Supabase client with the Service Role key.
 *
 * CRITICAL SECURITY INVARIANTS:
 * 1. MUST NEVER be imported into or invoked from Client Components ('use client').
 * 2. Bypasses Row Level Security (RLS) — intended strictly for trusted background workers
 *    (e.g., Inngest processing pipeline) and privileged administrative operations (e.g. account deletion).
 */
export function createAdminClient() {
  if (typeof window !== 'undefined') {
    throw new Error('FATAL: createAdminClient cannot be called from the browser.');
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set.');
  }

  if (!serviceRoleKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'FATAL: SUPABASE_SERVICE_ROLE_KEY is required in production for background workers and administrative operations.'
      );
    }
    // In local dev/testing without a separate service role key, warn and fallback to anon key
    console.warn(
      '[PostFlow Security Warning]: SUPABASE_SERVICE_ROLE_KEY not configured. Falling back to ANON_KEY in development.'
    );
    return createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'stub_key', {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
