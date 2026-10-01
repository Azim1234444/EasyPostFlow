import Link from 'next/link';
import {
  Calendar,
  CheckCircle2,
  AlertCircle,
  Link as LinkIcon,
  Plus,
  FileVideo,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getContentList } from '@/lib/actions/content';
import { createClient } from '@/lib/supabase/server';

export default async function DashboardPage() {
  const { data: contentList = [] } = await getContentList();

  // Query connected platform accounts count
  let connectedAccountsCount = 0;
  try {
    const supabase = await createClient();
    const { count } = await supabase
      .from('platform_accounts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'connected');
    connectedAccountsCount = count || 0;
  } catch {
    connectedAccountsCount = 0;
  }

  const scheduledCount = contentList.filter((c) => c.status === 'SCHEDULED').length;
  const publishedCount = contentList.filter((c) => c.status === 'PUBLISHED').length;
  const failedCount = contentList.filter((c) => c.status === 'FAILED').length;
  const draftsCount = contentList.filter((c) => c.status === 'DRAFT').length;

  const recentPosts = contentList.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overview of your scheduled content and publishing status
          </p>
        </div>
        <Link
          href="/content/new"
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/80"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Content
        </Link>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Scheduled */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ready / Scheduled</CardTitle>
            <Calendar className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{scheduledCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Ready for publishing queue</p>
          </CardContent>
        </Card>

        {/* Drafts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Drafts</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{draftsCount}</div>
            <p className="text-xs text-muted-foreground mt-1">In-progress content</p>
          </CardContent>
        </Card>

        {/* Published */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Published Posts</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{publishedCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Successfully published</p>
          </CardContent>
        </Card>

        {/* Connected Accounts or Failed */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {failedCount > 0 ? 'Failed Posts' : 'Connected Accounts'}
            </CardTitle>
            {failedCount > 0 ? (
              <AlertCircle className="h-4 w-4 text-destructive" />
            ) : (
              <LinkIcon className="h-4 w-4 text-purple-500" />
            )}
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                failedCount > 0 ? 'text-destructive' : 'text-foreground'
              }`}
            >
              {failedCount > 0 ? failedCount : connectedAccountsCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {failedCount > 0 ? 'Needs attention or retry' : 'TikTok & Shopee profiles'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity / Content List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Content</CardTitle>
            <CardDescription>Recently created and scheduled short-form video posts</CardDescription>
          </div>
          <Link
            href="/content"
            className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
          >
            View All Content <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {recentPosts.length > 0 ? (
            <div className="divide-y divide-border">
              {recentPosts.map((post) => {
                const videoMedia = post.media?.find((m) => m.media_type === 'video');
                const thumb =
                  (videoMedia?.metadata?.client_preview_thumb as string) || videoMedia?.thumbnail_path;

                return (
                  <div key={post.id} className="flex items-center justify-between py-3 gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-12 w-12 rounded-lg bg-slate-950 shrink-0 overflow-hidden flex items-center justify-center">
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={thumb} alt={post.title} className="h-full w-full object-cover" />
                        ) : (
                          <FileVideo className="h-5 w-5 text-slate-500" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/content/${post.id}`}
                          className="font-medium text-sm hover:underline truncate block"
                        >
                          {post.title}
                        </Link>
                        <p className="text-xs text-muted-foreground truncate">
                          {post.caption || 'No caption'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <Badge variant="secondary" className="text-xs">
                        {post.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground hidden sm:inline">
                        {new Date(post.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <FileVideo className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium">No posts created yet</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                Upload your first video to start scheduling across your accounts.
              </p>
              <Link
                href="/content/new"
                className="inline-flex items-center justify-center rounded-lg bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground shadow transition-colors hover:bg-primary/80"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Create Content
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
