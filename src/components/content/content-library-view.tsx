'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Search,
  FileVideo,
  ExternalLink,
  Edit2,
  Trash2,
  Calendar,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Play,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScheduleDialog } from '@/components/scheduling/schedule-dialog';
import { deleteContent } from '@/lib/actions/content';
import type { ContentWithMedia, ContentStatus } from '@/types/database';

interface ContentLibraryViewProps {
  initialContent: ContentWithMedia[];
}

const STATUS_TABS: { label: string; value: string }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Drafts', value: 'DRAFT' },
  { label: 'Scheduled', value: 'SCHEDULED' },
  { label: 'Processing', value: 'PROCESSING' },
  { label: 'Published', value: 'PUBLISHED' },
  { label: 'Failed', value: 'FAILED' },
];

export function ContentLibraryView({ initialContent }: ContentLibraryViewProps) {
  const router = useRouter();
  const [contentList, setContentList] = useState<ContentWithMedia[]>(initialContent);
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [schedulingItem, setSchedulingItem] = useState<ContentWithMedia | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Filter content based on tab and search
  const filteredContent = contentList.filter((item) => {
    const matchesTab = activeTab === 'ALL' || item.status === activeTab;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      item.title.toLowerCase().includes(q) ||
      (item.caption && item.caption.toLowerCase().includes(q)) ||
      item.hashtags.some((h) => h.toLowerCase().includes(q));

    return matchesTab && matchesSearch;
  });

  const getStatusBadge = (status: ContentStatus) => {
    switch (status) {
      case 'DRAFT':
        return (
          <Badge variant="secondary" className="flex items-center gap-1 font-medium">
            <Clock className="h-3 w-3" /> Draft
          </Badge>
        );
      case 'SCHEDULED':
        return (
          <Badge className="bg-blue-600/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900 flex items-center gap-1 font-medium">
            <Calendar className="h-3 w-3" /> Scheduled
          </Badge>
        );
      case 'PROCESSING':
        return (
          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900 flex items-center gap-1 font-medium">
            <Loader2 className="h-3 w-3 animate-spin" /> Processing
          </Badge>
        );
      case 'PUBLISHED':
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900 flex items-center gap-1 font-medium">
            <CheckCircle2 className="h-3 w-3" /> Published
          </Badge>
        );
      case 'FAILED':
        return (
          <Badge variant="destructive" className="flex items-center gap-1 font-medium">
            <AlertCircle className="h-3 w-3" /> Failed
          </Badge>
        );
      case 'CANCELLED':
        return (
          <Badge variant="outline" className="flex items-center gap-1 text-muted-foreground font-medium">
            <XCircle className="h-3 w-3" /> Cancelled
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDuration = (seconds?: number | null) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDeleteConfirm = async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    setActionError(null);

    try {
      const res = await deleteContent(deletingId);
      if (res.error) {
        throw new Error(res.error);
      }
      setContentList((prev) => prev.filter((item) => item.id !== deletingId));
      setDeletingId(null);
      router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete content');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Content Library</h1>
          <p className="text-sm text-muted-foreground">
            Manage your short-form videos, affiliate links, and scheduled publications
          </p>
        </div>

        <Link
          href="/content/new"
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/80"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Content
        </Link>
      </div>

      {actionError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        {/* Status Tabs */}
        <div className="flex flex-wrap gap-1">
          {STATUS_TABS.map((tab) => {
            const count =
              tab.value === 'ALL'
                ? contentList.length
                : contentList.filter((c) => c.status === tab.value).length;

            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {tab.label}
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full ${
                    activeTab === tab.value
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search posts or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
      </div>

      {/* Grid of Content Cards */}
      {filteredContent.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredContent.map((item) => {
            const videoMedia = item.media?.find((m) => m.media_type === 'video');
            const previewThumb =
              (videoMedia?.metadata?.client_preview_thumb as string) || videoMedia?.thumbnail_path;

            return (
              <Card key={item.id} className="flex flex-col overflow-hidden transition-all hover:shadow-md">
                {/* Media Preview Box */}
                <div className="relative aspect-[9/16] max-h-[220px] w-full bg-slate-950 flex items-center justify-center overflow-hidden">
                  {previewThumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewThumb}
                      alt={item.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-500 gap-1.5">
                      <FileVideo className="h-10 w-10" />
                      <span className="text-xs">No video preview</span>
                    </div>
                  )}

                  {/* Status Overlay */}
                  <div className="absolute top-2.5 left-2.5">{getStatusBadge(item.status)}</div>

                  {/* Duration Badge */}
                  {videoMedia?.duration_seconds && (
                    <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                      <Play className="h-2.5 w-2.5 fill-white" />
                      {formatDuration(videoMedia.duration_seconds)}
                    </div>
                  )}
                </div>

                {/* Content Details */}
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base font-semibold line-clamp-1" title={item.title}>
                    {item.title}
                  </CardTitle>
                  {item.caption && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{item.caption}</p>
                  )}
                </CardHeader>

                <CardContent className="p-4 pt-0 flex-1 space-y-2">
                  {/* Hashtags */}
                  {item.hashtags && item.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {item.hashtags.slice(0, 3).map((tag) => (
                        <span key={tag} className="text-[11px] text-blue-600 dark:text-blue-400">
                          #{tag}
                        </span>
                      ))}
                      {item.hashtags.length > 3 && (
                        <span className="text-[11px] text-muted-foreground">
                          +{item.hashtags.length - 3} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Affiliate Link Badge */}
                  {item.affiliate_url && (
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground truncate pt-1">
                      <ExternalLink className="h-3 w-3 shrink-0 text-primary" />
                      <span className="truncate">
                        {item.affiliate_platform ? `[${item.affiliate_platform.toUpperCase()}] ` : ''}
                        {item.affiliate_url}
                      </span>
                    </div>
                  )}
                </CardContent>

                {/* Card Actions */}
                <CardFooter className="p-3 bg-muted/30 border-t border-border flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                      onClick={() => setSchedulingItem(item)}
                      title="Schedule post"
                    >
                      <Calendar className="h-3.5 w-3.5" />
                    </Button>

                    <Link
                      href={`/content/${item.id}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      title="Edit post"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Link>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeletingId(item.id)}
                      title="Delete post"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-12 text-center">
          <div className="rounded-full bg-muted p-4 mb-4 text-muted-foreground">
            <FileVideo className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold">
            {searchQuery || activeTab !== 'ALL' ? 'No matching content' : 'Your content library is empty'}
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-6">
            {searchQuery || activeTab !== 'ALL'
              ? 'Try changing your search terms or filter selection to find what you are looking for.'
              : 'Upload short-form videos, write captions, attach affiliate URLs, and prepare for scheduled posting.'}
          </p>

          {searchQuery || activeTab !== 'ALL' ? (
            <Button
              variant="outline"
              onClick={() => {
                setActiveTab('ALL');
                setSearchQuery('');
              }}
            >
              Reset filters
            </Button>
          ) : (
            <Link
              href="/content/new"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/80"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create your first post
            </Link>
          )}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Content</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete this content item and all associated media?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              disabled={isDeleting}
              onClick={() => setDeletingId(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={handleDeleteConfirm}
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Post Dialog */}
      {schedulingItem && (
        <ScheduleDialog
          open={!!schedulingItem}
          onOpenChange={(open) => !open && setSchedulingItem(null)}
          contentId={schedulingItem.id}
          contentTitle={schedulingItem.title}
          onSuccess={() => {
            setSchedulingItem(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
