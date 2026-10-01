import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';
import { BarChart3, TrendingUp, CheckCircle, AlertTriangle, Video, Globe } from 'lucide-react';

export const metadata = {
  title: 'Analytics | PostFlow',
  description: 'Performance metrics for your scheduled and published short-form content',
};

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let totalPosts = 0;
  let publishedPosts = 0;
  let failedPosts = 0;
  let scheduledPosts = 0;
  let tiktokCount = 0;
  let shopeeCount = 0;

  if (user) {
    // Fetch user's content stats
    const { data: contentData } = await supabase
      .from('content')
      .select('id, status, affiliate_platform')
      .eq('user_id', user.id);

    if (contentData) {
      totalPosts = contentData.length;
      publishedPosts = contentData.filter((c) => c.status === 'PUBLISHED').length;
      failedPosts = contentData.filter((c) => c.status === 'FAILED').length;
      scheduledPosts = contentData.filter((c) => c.status === 'SCHEDULED').length;
    }

    // Fetch scheduled jobs by platform
    const { data: jobsData } = await supabase
      .from('scheduled_posts')
      .select('platform, status')
      .eq('user_id', user.id);

    if (jobsData) {
      tiktokCount = jobsData.filter((j) => j.platform === 'tiktok').length;
      shopeeCount = jobsData.filter((j) => j.platform === 'shopee').length;
    }
  }

  const completedAttempts = publishedPosts + failedPosts;
  const successRate = completedAttempts > 0
    ? Math.round((publishedPosts / completedAttempts) * 100)
    : 100;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Publishing Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Track publishing throughput, platform distribution, and scheduling reliability.
        </p>
      </div>

      {/* Metrics Overview Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Publish Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{successRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {publishedPosts} of {completedAttempts} published without errors
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Media Assets</CardTitle>
            <Video className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPosts}</div>
            <p className="text-xs text-muted-foreground mt-1">Content items created</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active In Queue</CardTitle>
            <CheckCircle className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{scheduledPosts}</div>
            <p className="text-xs text-muted-foreground mt-1">Scheduled for automated delivery</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Failed Dispatches</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${failedPosts > 0 ? 'text-destructive' : 'text-slate-400'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${failedPosts > 0 ? 'text-destructive' : 'text-foreground'}`}>
              {failedPosts}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {failedPosts === 0 ? 'All jobs executing smoothly' : 'Requires retry or token review'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Platform Breakdown Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Platform Distribution</CardTitle>
                <CardDescription>Scheduled jobs segmented by social channel</CardDescription>
              </div>
              <Globe className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-900 inline-block" />
                  TikTok
                </span>
                <span className="text-muted-foreground">{tiktokCount} jobs</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="bg-slate-900 h-2 rounded-full"
                  style={{
                    width: `${tiktokCount + shopeeCount > 0 ? (tiktokCount / (tiktokCount + shopeeCount)) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block" />
                  Shopee
                </span>
                <span className="text-muted-foreground">{shopeeCount} jobs</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="bg-orange-500 h-2 rounded-full"
                  style={{
                    width: `${tiktokCount + shopeeCount > 0 ? (shopeeCount / (tiktokCount + shopeeCount)) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Affiliate Conversion Flow</CardTitle>
                <CardDescription>Post-level affiliate link generation & guidance</CardDescription>
              </div>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <p className="font-medium text-slate-800">Direct Video Posting (TikTok & Shopee Seller)</p>
              <p className="text-xs text-slate-500 mt-1">
                Automated publishing via official Open APIs with pre-flight creator compliance check.
              </p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <p className="font-medium text-slate-800">Assisted Affiliate Workflow (Shopee Affiliate)</p>
              <p className="text-xs text-slate-500 mt-1">
                Automated short-link generation with sub-IDs and 1-tap clipboard payload ready for the creator.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
