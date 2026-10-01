'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  schedulePost,
  getConnectedAccounts,
  reschedulePost,
} from '@/lib/actions/schedule';
import {
  COMMON_TIMEZONES,
  combineLocalDateTimeToUtc,
  formatUtcToLocal,
  isFutureDate,
} from '@/lib/validators/schedule';
import type { PlatformAccount } from '@/types/database';
import { Calendar as CalendarIcon, Clock, Globe, AlertCircle, Loader2, Link as LinkIcon } from 'lucide-react';
import Link from 'next/link';

interface ScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentId: string;
  contentTitle: string;
  existingScheduleId?: string;
  initialScheduledAt?: string;
  initialTimezone?: string;
  onSuccess?: () => void;
}

export function ScheduleDialog({
  open,
  onOpenChange,
  contentId,
  contentTitle,
  existingScheduleId,
  initialScheduledAt,
  initialTimezone,
  onSuccess,
}: ScheduleDialogProps) {
  const router = useRouter();

  // Detect user's browser timezone
  const detectedTz =
    initialTimezone ||
    (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC');

  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [dateStr, setDateStr] = useState(() => {
    if (initialScheduledAt) {
      return new Date(initialScheduledAt).toISOString().split('T')[0];
    }
    const defaultDate = new Date(Date.now() + 2 * 60 * 60 * 1000);
    return defaultDate.toISOString().split('T')[0];
  });
  const [timeStr, setTimeStr] = useState(() => {
    const d = initialScheduledAt
      ? new Date(initialScheduledAt)
      : new Date(Date.now() + 2 * 60 * 60 * 1000);
    const hours = d.getHours().toString().padStart(2, '0');
    const mins = d.getMinutes().toString().padStart(2, '0');
    return `${hours}:${mins}`;
  });
  const [timezone, setTimezone] = useState(detectedTz);
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [minDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Load connected accounts when modal opens
  useEffect(() => {
    let ignore = false;
    if (open) {
      getConnectedAccounts().then((res) => {
        if (!ignore) {
          if (res.data) {
            setAccounts(res.data);
            if (res.data.length > 0) {
              setSelectedAccountId((curr) => curr || res.data![0].id);
            }
          }
          setAccountsLoaded(true);
        }
      });
    }
    return () => {
      ignore = true;
    };
  }, [open]);

  // Compute calculated UTC preview
  let calculatedUtcIso: string | null = null;
  try {
    if (dateStr && timeStr) {
      calculatedUtcIso = combineLocalDateTimeToUtc(dateStr, timeStr, timezone);
    }
  } catch {
    calculatedUtcIso = null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!dateStr || !timeStr) {
      setErrorMessage('Please select both a publication date and time.');
      return;
    }

    if (!calculatedUtcIso || !isFutureDate(calculatedUtcIso)) {
      setErrorMessage('Scheduled time must be at least 1 minute in the future.');
      return;
    }

    const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
    if (!existingScheduleId && !selectedAccount) {
      setErrorMessage('Please select a connected social media account.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (existingScheduleId) {
        // Reschedule
        const res = await reschedulePost(existingScheduleId, calculatedUtcIso, timezone);
        if (res.error) throw new Error(res.error);
      } else {
        // New schedule
        const res = await schedulePost({
          content_id: contentId,
          platform_account_id: selectedAccountId,
          platform: selectedAccount!.platform,
          scheduled_at: calculatedUtcIso,
          timezone,
        });
        if (res.error) throw new Error(res.error);
      }

      onOpenChange(false);
      router.refresh();
      if (onSuccess) onSuccess();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Scheduling failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            {existingScheduleId ? 'Reschedule Post' : 'Schedule Publication'}
          </DialogTitle>
          <DialogDescription className="line-clamp-1">
            Post: <span className="font-medium text-foreground">{contentTitle}</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {errorMessage && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Platform Account Selector (only when creating new schedule) */}
          {!existingScheduleId && (
            <div className="space-y-2">
              <Label htmlFor="account">Target Social Account</Label>
              {!accountsLoaded ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading accounts...
                </div>
              ) : accounts.length > 0 ? (
                <select
                  id="account"
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full h-9 rounded-lg border border-border bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  required
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.platform.toUpperCase()} — @{acc.platform_username || acc.display_name || 'Account'} (
                      {acc.account_type})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="rounded-lg border border-border p-3 text-xs space-y-2">
                  <p className="text-muted-foreground">No social media accounts connected yet.</p>
                  <Link
                    href="/accounts"
                    className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                  >
                    <LinkIcon className="h-3 w-3" /> Connect TikTok or Shopee account
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Date & Time Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="date" className="flex items-center gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" /> Date
              </Label>
              <Input
                id="date"
                type="date"
                min={minDate}
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="time" className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" /> Time
              </Label>
              <Input
                id="time"
                type="time"
                value={timeStr}
                onChange={(e) => setTimeStr(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Timezone Selector */}
          <div className="space-y-2">
            <Label htmlFor="timezone" className="flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-muted-foreground" /> Timezone
            </Label>
            <select
              id="timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full h-9 rounded-lg border border-border bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
              {!COMMON_TIMEZONES.some((t) => t.value === timezone) && (
                <option value={timezone}>{timezone}</option>
              )}
            </select>
          </div>

          {/* Time Preview Box */}
          {calculatedUtcIso && (
            <div className="rounded-lg bg-muted/60 p-3 text-xs space-y-1 text-muted-foreground">
              <div className="flex justify-between font-medium">
                <span>Local Publication:</span>
                <span className="text-foreground">
                  {formatUtcToLocal(calculatedUtcIso, timezone, 'PPP p')}
                </span>
              </div>
              <div className="flex justify-between">
                <span>UTC Internal Timestamp:</span>
                <span>{calculatedUtcIso}</span>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !calculatedUtcIso || (!existingScheduleId && accounts.length === 0)}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {existingScheduleId ? 'Update Schedule' : 'Schedule Post'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
