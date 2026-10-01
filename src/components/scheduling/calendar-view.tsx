'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Trash2,
  Edit2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScheduleDialog } from '@/components/scheduling/schedule-dialog';
import { cancelScheduledPost } from '@/lib/actions/schedule';
import { formatUtcToLocal } from '@/lib/validators/schedule';
import type { ScheduledPostWithRelations } from '@/lib/actions/schedule';

interface CalendarViewProps {
  initialPosts: ScheduledPostWithRelations[];
}

export function CalendarView({ initialPosts }: CalendarViewProps) {
  const router = useRouter();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedPlatform, setSelectedPlatform] = useState<string>('ALL');
  const [selectedPost, setSelectedPost] = useState<ScheduledPostWithRelations | null>(null);
  const [reschedulingPost, setReschedulingPost] = useState<ScheduledPostWithRelations | null>(null);
  const [cancellingPost, setCancellingPost] = useState<ScheduledPostWithRelations | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Filter posts
  const filteredPosts = initialPosts.filter((post) => {
    if (selectedPlatform !== 'ALL' && post.platform !== selectedPlatform) {
      return false;
    }
    return true;
  });

  // Calendar calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sunday
  const daysInMonth = lastDayOfMonth.getDate();

  const monthName = currentDate.toLocaleString('default', { month: 'long' });

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleCancelConfirm = async () => {
    if (!cancellingPost) return;
    setIsCancelling(true);
    setActionError(null);

    try {
      const res = await cancelScheduledPost(cancellingPost.id);
      if (res.error) throw new Error(res.error);
      setCancellingPost(null);
      setSelectedPost(null);
      router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Cancellation failed');
    } finally {
      setIsCancelling(false);
    }
  };

  // Group posts by day of current month
  const postsByDay: Record<number, ScheduledPostWithRelations[]> = {};
  filteredPosts.forEach((post) => {
    const postDate = new Date(post.scheduled_at);
    if (postDate.getFullYear() === year && postDate.getMonth() === month) {
      const day = postDate.getDate();
      if (!postsByDay[day]) postsByDay[day] = [];
      postsByDay[day].push(post);
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SCHEDULED':
        return (
          <Badge className="bg-blue-600/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900 text-[10px] font-medium">
            Scheduled
          </Badge>
        );
      case 'PROCESSING':
        return (
          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900 text-[10px] font-medium">
            Processing
          </Badge>
        );
      case 'PUBLISHED':
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900 text-[10px] font-medium">
            Published
          </Badge>
        );
      case 'FAILED':
        return (
          <Badge variant="destructive" className="text-[10px] font-medium">
            Failed
          </Badge>
        );
      case 'CANCELLED':
        return (
          <Badge variant="outline" className="text-[10px] text-muted-foreground font-medium">
            Cancelled
          </Badge>
        );
      default:
        return <Badge variant="secondary" className="text-[10px]">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Publishing Calendar</h1>
          <p className="text-sm text-muted-foreground">
            Schedule, monitor, and organize upcoming social media releases
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/content"
            className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-3.5 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Pick Content to Schedule
          </Link>
        </div>
      </div>

      {actionError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Calendar Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        {/* Navigation */}
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold min-w-[160px]">
            {monthName} {year}
          </h2>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={handlePrevMonth} className="h-8 w-8 p-0">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleToday} className="h-8 px-2.5 text-xs">
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={handleNextMonth} className="h-8 w-8 p-0">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Platform Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Platform:</span>
          <select
            value={selectedPlatform}
            onChange={(e) => setSelectedPlatform(e.target.value)}
            className="h-8 rounded-lg border border-border bg-background px-2.5 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="ALL">All Platforms</option>
            <option value="tiktok">TikTok Only</option>
            <option value="shopee">Shopee Only</option>
          </select>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card className="overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-center text-xs font-semibold text-muted-foreground py-2.5">
          <div>Sun</div>
          <div>Mon</div>
          <div>Tue</div>
          <div>Wed</div>
          <div>Thu</div>
          <div>Fri</div>
          <div>Sat</div>
        </div>

        <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-border bg-background">
          {/* Empty cells before month starts */}
          {Array.from({ length: startingDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[110px] bg-muted/10 p-2 opacity-50" />
          ))}

          {/* Days of current month */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNumber = i + 1;
            const dayPosts = postsByDay[dayNumber] || [];
            const isToday =
              dayNumber === new Date().getDate() &&
              month === new Date().getMonth() &&
              year === new Date().getFullYear();

            return (
              <div
                key={`day-${dayNumber}`}
                className={`min-h-[110px] p-2 flex flex-col transition-colors ${
                  isToday ? 'bg-primary/5 font-semibold' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                      isToday ? 'bg-primary text-primary-foreground font-bold' : 'text-muted-foreground'
                    }`}
                  >
                    {dayNumber}
                  </span>
                  {dayPosts.length > 0 && (
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {dayPosts.length} {dayPosts.length === 1 ? 'post' : 'posts'}
                    </span>
                  )}
                </div>

                {/* Posts on this date */}
                <div className="flex-1 space-y-1.5 overflow-y-auto max-h-[140px]">
                  {dayPosts.map((post) => {
                    const timeLabel = new Date(post.scheduled_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <div
                        key={post.id}
                        onClick={() => setSelectedPost(post)}
                        className="cursor-pointer rounded border border-border bg-card p-1.5 text-xs shadow-xs transition-transform hover:scale-[1.02] hover:border-primary"
                      >
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span className="font-semibold text-[10px] uppercase text-primary">
                            {post.platform}
                          </span>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <Clock className="h-2.5 w-2.5" />
                            {timeLabel}
                          </span>
                        </div>
                        <p className="line-clamp-1 font-medium text-[11px] text-foreground">
                          {post.content?.title || 'Scheduled Post'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Post Detail & Actions Modal */}
      {selectedPost && (
        <Dialog open={!!selectedPost} onOpenChange={(open) => !open && setSelectedPost(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <div className="flex items-center justify-between pr-4">
                <span className="text-xs uppercase font-bold tracking-wider text-primary">
                  {selectedPost.platform} Post
                </span>
                {getStatusBadge(selectedPost.status)}
              </div>
              <DialogTitle className="text-lg font-bold mt-1">
                {selectedPost.content?.title}
              </DialogTitle>
              <DialogDescription>
                Scheduled for {formatUtcToLocal(selectedPost.scheduled_at, selectedPost.timezone, 'PPP p')}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              {selectedPost.content?.caption && (
                <div className="rounded-lg bg-muted/60 p-3 space-y-1">
                  <span className="font-semibold text-muted-foreground uppercase text-[10px]">
                    Caption
                  </span>
                  <p className="text-foreground whitespace-pre-wrap">{selectedPost.content.caption}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                <div>
                  <span className="font-medium text-foreground">Timezone:</span> {selectedPost.timezone}
                </div>
                <div>
                  <span className="font-medium text-foreground">Account:</span> @
                  {selectedPost.account?.platform_username || selectedPost.account?.display_name || 'Account'}
                </div>
              </div>

              {selectedPost.content?.affiliate_url && (
                <div className="text-muted-foreground truncate">
                  <span className="font-medium text-foreground">Affiliate:</span>{' '}
                  {selectedPost.content.affiliate_url}
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              {selectedPost.status === 'SCHEDULED' && (
                <>
                  <Button
                    variant="outline"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      setCancellingPost(selectedPost);
                      setSelectedPost(null);
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" />
                    Cancel Post
                  </Button>

                  <Button
                    onClick={() => {
                      setReschedulingPost(selectedPost);
                      setSelectedPost(null);
                    }}
                  >
                    <Edit2 className="h-4 w-4 mr-1.5" />
                    Reschedule
                  </Button>
                </>
              )}

              {selectedPost.status !== 'SCHEDULED' && (
                <Button variant="outline" onClick={() => setSelectedPost(null)}>
                  Close
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Reschedule Dialog */}
      {reschedulingPost && (
        <ScheduleDialog
          open={!!reschedulingPost}
          onOpenChange={(open) => !open && setReschedulingPost(null)}
          contentId={reschedulingPost.content_id}
          contentTitle={reschedulingPost.content?.title || 'Post'}
          existingScheduleId={reschedulingPost.id}
          initialScheduledAt={reschedulingPost.scheduled_at}
          initialTimezone={reschedulingPost.timezone}
          onSuccess={() => {
            setReschedulingPost(null);
            router.refresh();
          }}
        />
      )}

      {/* Cancel Confirmation Dialog */}
      {cancellingPost && (
        <Dialog open={!!cancellingPost} onOpenChange={(open) => !open && setCancellingPost(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Cancel Scheduled Post</DialogTitle>
              <DialogDescription>
                Are you sure you want to cancel the scheduled publication for &quot;
                {cancellingPost.content?.title}&quot;? The post will return to draft state.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                disabled={isCancelling}
                onClick={() => setCancellingPost(null)}
              >
                Keep Scheduled
              </Button>
              <Button
                variant="destructive"
                disabled={isCancelling}
                onClick={handleCancelConfirm}
              >
                {isCancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm Cancellation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
