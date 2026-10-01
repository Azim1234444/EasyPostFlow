import { z } from 'zod';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

export const COMMON_TIMEZONES = [
  { label: 'UTC (Coordinated Universal Time)', value: 'UTC' },
  { label: 'Singapore / Malaysia (UTC+8)', value: 'Asia/Singapore' },
  { label: 'Jakarta / Bangkok (UTC+7)', value: 'Asia/Jakarta' },
  { label: 'Tokyo / Seoul (UTC+9)', value: 'Asia/Tokyo' },
  { label: 'London / GMT (UTC+0 / UTC+1)', value: 'Europe/London' },
  { label: 'New York (EDT/EST, UTC-4 / UTC-5)', value: 'America/New_York' },
  { label: 'Los Angeles (PDT/PST, UTC-7 / UTC-8)', value: 'America/Los_Angeles' },
  { label: 'Sydney (AEST, UTC+10 / UTC+11)', value: 'Australia/Sydney' },
] as const;

export const schedulePostSchema = z.object({
  content_id: z.string().uuid('Invalid content ID'),
  platform_account_id: z.string().uuid('Invalid platform account ID'),
  platform: z.enum(['tiktok', 'shopee']),
  scheduled_at: z
    .string()
    .datetime({ message: 'Scheduled time must be a valid ISO 8601 string' })
    .refine(
      (val) => {
        const scheduledDate = new Date(val);
        const now = new Date();
        // Must be at least 1 minute in the future
        return scheduledDate.getTime() > now.getTime() + 60 * 1000;
      },
      { message: 'Scheduled time must be at least 1 minute in the future' }
    ),
  timezone: z.string().default('UTC'),
});

export type SchedulePostInput = z.infer<typeof schedulePostSchema>;

/**
 * Generate a deterministic idempotency key for a publishing job.
 * Ensures the exact same schedule request cannot publish twice.
 */
export function generateIdempotencyKey(
  contentId: string,
  platformAccountId: string,
  scheduledAtIso: string
): string {
  // Normalize timestamp to Unix seconds to avoid sub-second drift
  const timestampSeconds = Math.floor(new Date(scheduledAtIso).getTime() / 1000);
  return `pub_${contentId}_${platformAccountId}_${timestampSeconds}`;
}

/**
 * Calculate exponential retry backoff in seconds based on attempt number.
 * Attempt 1: ~60s (1m)
 * Attempt 2: ~300s (5m)
 * Attempt 3: ~900s (15m)
 */
export function calculateRetryDelaySeconds(attemptNumber: number): number {
  const delays = [60, 300, 900];
  const index = Math.min(Math.max(attemptNumber - 1, 0), delays.length - 1);
  return delays[index];
}

/**
 * Convert a local date string (YYYY-MM-DD) and time string (HH:MM) in a given timezone to UTC ISO string.
 */
export function combineLocalDateTimeToUtc(
  dateStr: string,
  timeStr: string,
  timeZone: string
): string {
  const combined = `${dateStr}T${timeStr}:00`;
  const utcDate = fromZonedTime(combined, timeZone);
  return utcDate.toISOString();
}

/**
 * Check if an ISO timestamp is in the future.
 */
export function isFutureDate(utcIso: string, minMinutesAhead: number = 1): boolean {
  const scheduledTime = new Date(utcIso).getTime();
  return scheduledTime > Date.now() + minMinutesAhead * 60 * 1000;
}

/**
 * Format a UTC ISO timestamp for display in a specific timezone.
 */
export function formatUtcToLocal(
  utcIso: string,
  timeZone: string,
  formatPattern: string = 'PPpp'
): string {
  return formatInTimeZone(new Date(utcIso), timeZone, formatPattern);
}
