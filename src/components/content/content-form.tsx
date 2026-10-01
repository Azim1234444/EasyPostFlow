'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { VideoUploader } from '@/components/content/video-uploader';
import { createContent, updateContent } from '@/lib/actions/content';
import type { ContentWithMedia, ContentStatus } from '@/types/database';
import type { MediaAttachmentData } from '@/lib/validators/content';
import { Loader2, ArrowLeft, Hash, Link as LinkIcon, AlertCircle, CheckCircle2, X } from 'lucide-react';
import Link from 'next/link';

interface ContentFormProps {
  initialData?: ContentWithMedia;
  mode?: 'create' | 'edit';
}

type AffiliatePlatformOption = 'shopee' | 'tiktok_shop' | 'amazon' | 'lazada' | 'other' | '';

export function ContentForm({ initialData, mode = 'create' }: ContentFormProps) {
  const router = useRouter();

  const [title, setTitle] = useState(initialData?.title || '');
  const [caption, setCaption] = useState(initialData?.caption || '');
  const [tagInput, setTagInput] = useState('');
  const [hashtags, setHashtags] = useState<string[]>(initialData?.hashtags || []);
  const [affiliateUrl, setAffiliateUrl] = useState(initialData?.affiliate_url || '');
  const [affiliatePlatform, setAffiliatePlatform] = useState<AffiliatePlatformOption>(
    (initialData?.affiliate_platform as AffiliatePlatformOption) || 'shopee'
  );
  const [status, setStatus] = useState<ContentStatus>(initialData?.status || 'DRAFT');
  const [mediaList, setMediaList] = useState<MediaAttachmentData[]>(
    initialData?.media?.map((m) => ({
      media_type: m.media_type,
      storage_path: m.storage_path,
      original_filename: m.original_filename,
      mime_type: m.mime_type || 'video/mp4',
      file_size: m.file_size,
      duration_seconds: m.duration_seconds,
      width: m.width,
      height: m.height,
      thumbnail_path: m.thumbnail_path,
      metadata: m.metadata || {},
    })) || []
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleAddHashtag = () => {
    const raw = tagInput.replace(/^#/, '').trim();
    if (raw && !hashtags.includes(raw)) {
      setHashtags([...hashtags, raw]);
      setTagInput('');
    }
  };

  const handleRemoveHashtag = (tagToRemove: string) => {
    setHashtags(hashtags.filter((t) => t !== tagToRemove));
  };

  const handleKeyDownHashtag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddHashtag();
    }
  };

  const handleSubmit = async (targetStatus?: ContentStatus) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!title.trim()) {
      setErrorMessage('Please provide a title or internal name for this post.');
      return;
    }

    const finalStatus = targetStatus || status;

    setIsSubmitting(true);

    try {
      const payload = {
        title: title.trim(),
        caption: caption.trim() || undefined,
        hashtags,
        affiliate_url: affiliateUrl.trim() || undefined,
        affiliate_platform: affiliatePlatform || undefined,
        status: finalStatus,
        media: mediaList,
      };

      if (mode === 'edit' && initialData?.id) {
        const res = await updateContent(initialData.id, payload);
        if (res.error) {
          throw new Error(res.error);
        }
        setSuccessMessage('Content updated successfully.');
        router.refresh();
      } else {
        const res = await createContent(payload);
        if (res.error) {
          throw new Error(res.error);
        }
        setSuccessMessage('Content created successfully!');
        router.push('/content');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save content');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/content"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {mode === 'edit' ? 'Edit Content' : 'Create New Content'}
            </h1>
            <p className="text-sm text-muted-foreground">
              Prepare video content, captions, and affiliate links for scheduling
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => handleSubmit('DRAFT')}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save as Draft
          </Button>

          <Button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleSubmit('SCHEDULED')}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Ready to Schedule
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {errorMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="ml-auto text-destructive hover:opacity-80"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Metadata & Caption */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Post Information</CardTitle>
              <CardDescription>
                Title, caption, and hashtags that will be published to social media
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="title">Title / Internal Name *</Label>
                  <span className="text-xs text-muted-foreground">{title.length}/150</span>
                </div>
                <Input
                  id="title"
                  placeholder="e.g. Summer Outfit Review #1"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={150}
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="caption">Post Caption</Label>
                  <span className="text-xs text-muted-foreground">{caption.length}/2200</span>
                </div>
                <Textarea
                  id="caption"
                  placeholder="Write your engaging caption here..."
                  rows={4}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  maxLength={2200}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="hashtags">Hashtags</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Hash className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="hashtags"
                      placeholder="Type hashtag and press Enter or comma"
                      className="pl-8"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleKeyDownHashtag}
                    />
                  </div>
                  <Button type="button" variant="secondary" onClick={handleAddHashtag}>
                    Add
                  </Button>
                </div>

                {hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {hashtags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="flex items-center gap-1 px-2.5 py-1 text-xs"
                      >
                        #{tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveHashtag(tag)}
                          className="hover:text-destructive transition-colors ml-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Affiliate Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LinkIcon className="h-4 w-4 text-primary" />
                Affiliate Information
              </CardTitle>
              <CardDescription>
                Track affiliate products and commissions for this campaign
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="affiliate_platform">Platform</Label>
                  <select
                    id="affiliate_platform"
                    value={affiliatePlatform}
                    onChange={(e) => setAffiliatePlatform(e.target.value as AffiliatePlatformOption)}
                    className="w-full h-9 rounded-lg border border-border bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="shopee">Shopee</option>
                    <option value="tiktok_shop">TikTok Shop</option>
                    <option value="amazon">Amazon</option>
                    <option value="lazada">Lazada</option>
                    <option value="other">Other Platform</option>
                  </select>
                </div>

                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="affiliate_url">Affiliate / Product URL</Label>
                  <Input
                    id="affiliate_url"
                    placeholder="https://shope.ee/... or product link"
                    value={affiliateUrl}
                    onChange={(e) => setAffiliateUrl(e.target.value)}
                  />
                </div>
              </div>

              <div className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Architecture Notice:</span> Affiliate
                data is managed within PostFlow for tracking and attribution. Because TikTok does not
                permit third-party APIs to attach product anchor links directly via the Content Posting
                API, link attachment remains decoupled from direct publishing.
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Video Upload & Status */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Video Media</CardTitle>
              <CardDescription>Upload short-form vertical video</CardDescription>
            </CardHeader>
            <CardContent>
              <VideoUploader
                initialMedia={mediaList}
                onMediaChange={(updated) => setMediaList(updated)}
                disabled={isSubmitting}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Post Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="status">Current Status</Label>
                <select
                  id="status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ContentStatus)}
                  className="w-full h-9 rounded-lg border border-border bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="DRAFT">Draft (Editing)</option>
                  <option value="SCHEDULED">Ready to Schedule</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              <div className="pt-2">
                <Button
                  type="button"
                  className="w-full"
                  disabled={isSubmitting}
                  onClick={() => handleSubmit()}
                >
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {mode === 'edit' ? 'Update Post' : 'Save Content'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
