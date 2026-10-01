'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Link as LinkIcon,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Video,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ShopeeConnectDialog } from './shopee-connect-dialog';
import { disconnectAccount, refreshAccountToken, type SafePlatformAccount } from '@/lib/actions/accounts';

interface AccountsViewProps {
  initialAccounts: SafePlatformAccount[];
  successMessage?: string | null;
  errorMessage?: string | null;
}

export function AccountsView({
  initialAccounts,
  successMessage,
  errorMessage: initialErrorMessage,
}: AccountsViewProps) {
  const router = useRouter();

  const [accounts, setAccounts] = useState<SafePlatformAccount[]>(initialAccounts);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [isShopeeModalOpen, setIsShopeeModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(initialErrorMessage || null);
  const [bannerSuccess, setBannerSuccess] = useState<string | null>(successMessage || null);

  const tiktokAccount = accounts.find((a) => a.platform === 'tiktok');
  const shopeeAccount = accounts.find((a) => a.platform === 'shopee');

  const handleDisconnectConfirm = async () => {
    if (!disconnectingId) return;
    setIsProcessing(true);
    setBannerError(null);

    try {
      const res = await disconnectAccount(disconnectingId);
      if (res.error) throw new Error(res.error);
      setAccounts((prev) => prev.filter((a) => a.id !== disconnectingId));
      setDisconnectingId(null);
      setBannerSuccess('Account disconnected successfully.');
      router.refresh();
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Failed to disconnect account');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRefreshToken = async (accountId: string) => {
    setRefreshingId(accountId);
    setBannerError(null);

    try {
      const res = await refreshAccountToken(accountId);
      if (res.error) throw new Error(res.error);
      setBannerSuccess('TikTok access token refreshed successfully.');
      router.refresh();
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Token refresh failed');
    } finally {
      setRefreshingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Connected Accounts</h1>
        <p className="text-sm text-muted-foreground">
          Manage OAuth integrations for direct video publishing to TikTok and Shopee
        </p>
      </div>

      {/* Status Notifications */}
      {bannerError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{bannerError}</span>
        </div>
      )}

      {bannerSuccess && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{bannerSuccess}</span>
        </div>
      )}

      {/* Grid of Platform Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* TikTok Card */}
        <Card className="flex flex-col border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-black text-white font-bold text-sm">
                  TT
                </div>
                <div>
                  <CardTitle className="text-base font-bold">TikTok</CardTitle>
                  <CardDescription className="text-xs">
                    Content Posting API v2 & Direct Video Publishing
                  </CardDescription>
                </div>
              </div>

              {tiktokAccount ? (
                <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Connected
                </Badge>
              ) : (
                <Badge variant="outline">Not Connected</Badge>
              )}
            </div>
          </CardHeader>

          <CardContent className="flex-1 space-y-4">
            {tiktokAccount ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 rounded-lg border border-border p-3 bg-muted/30">
                  <div className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                    {tiktokAccount.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={tiktokAccount.avatar_url}
                        alt="Avatar"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="font-bold text-sm">
                        {tiktokAccount.display_name?.[0] || 'T'}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {tiktokAccount.display_name || 'TikTok Creator'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      ID: {tiktokAccount.platform_user_id}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg bg-muted/60 p-3 text-xs space-y-1.5 text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Authorized Scopes:</span>
                    <span className="font-medium text-foreground">
                      {tiktokAccount.scopes?.length || 3} active permissions
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Token Expiry:</span>
                    <span className="text-foreground">
                      {tiktokAccount.token_expires_at
                        ? new Date(tiktokAccount.token_expires_at).toLocaleDateString()
                        : 'Active'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-muted-foreground">
                <p>
                  Connect your TikTok account to automatically publish scheduled short-form videos
                  directly using official TikTok APIs.
                </p>
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Official OAuth 2.0 with PKCE authorization</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Video className="h-3.5 w-3.5 text-blue-500" />
                    <span>Direct video publishing via Content Posting API</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>

          <CardFooter className="p-4 bg-muted/20 border-t border-border flex items-center justify-between">
            {tiktokAccount ? (
              <div className="flex items-center justify-between w-full">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={refreshingId === tiktokAccount.id}
                  onClick={() => handleRefreshToken(tiktokAccount.id)}
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 mr-1.5 ${
                      refreshingId === tiktokAccount.id ? 'animate-spin' : ''
                    }`}
                  />
                  Refresh Token
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => setDisconnectingId(tiktokAccount.id)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Disconnect
                </Button>
              </div>
            ) : (
              <a
                href="/api/platforms/tiktok/connect"
                className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/80"
              >
                <LinkIcon className="h-4 w-4 mr-2" /> Connect TikTok Account
              </a>
            )}
          </CardFooter>
        </Card>

        {/* Shopee Card */}
        <Card className="flex flex-col border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-600 text-white font-bold text-sm">
                  SH
                </div>
                <div>
                  <CardTitle className="text-base font-bold">Shopee</CardTitle>
                  <CardDescription className="text-xs">
                    Open Platform Video API & Affiliate Workflow
                  </CardDescription>
                </div>
              </div>

              {shopeeAccount ? (
                <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Connected
                </Badge>
              ) : (
                <Badge variant="outline">Not Connected</Badge>
              )}
            </div>
          </CardHeader>

          <CardContent className="flex-1 space-y-4">
            {shopeeAccount ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 rounded-lg border border-border p-3 bg-muted/30">
                  <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-950/50 text-orange-600 flex items-center justify-center font-bold text-sm shrink-0">
                    {shopeeAccount.display_name?.[0] || 'S'}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {shopeeAccount.display_name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      Role: {shopeeAccount.account_type === 'seller' ? 'Shopee Seller (Automated)' : 'Affiliate Creator (Assisted)'}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg bg-muted/60 p-3 text-xs space-y-1.5 text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Publishing Mode:</span>
                    <span className="font-medium text-foreground">
                      {shopeeAccount.account_type === 'seller' ? 'Open Platform v2 Video' : 'Assisted Manual Action'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Connected Since:</span>
                    <span className="text-foreground">
                      {new Date(shopeeAccount.connected_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-muted-foreground">
                <p>
                  Connect your Shopee account to publish short-form video content. Supports both
                  Shopee Seller Open Platform video publishing and affiliate creator workflows.
                </p>
                <div className="rounded-lg bg-muted/60 p-3 text-xs space-y-1">
                  <span className="font-semibold text-foreground">Dual-Mode Architecture:</span>
                  <p>
                    Automated direct video publishing for registered Shopee Sellers; 1-click caption
                    & tracking link preparation for affiliate creators.
                  </p>
                </div>
              </div>
            )}
          </CardContent>

          <CardFooter className="p-4 bg-muted/20 border-t border-border">
            {shopeeAccount ? (
              <div className="flex justify-end w-full">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => setDisconnectingId(shopeeAccount.id)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full border-orange-600/30 text-orange-600 hover:bg-orange-50 hover:text-orange-700 dark:hover:bg-orange-950/20"
                onClick={() => setIsShopeeModalOpen(true)}
              >
                <LinkIcon className="h-4 w-4 mr-2" /> Connect Shopee Account
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>

      {/* Disconnect Confirmation Dialog */}
      <Dialog open={!!disconnectingId} onOpenChange={(open) => !open && setDisconnectingId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Disconnect Account</DialogTitle>
            <DialogDescription>
              Are you sure you want to disconnect this platform account? Any upcoming scheduled posts
              for this account will need to be cancelled or rescheduled.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              disabled={isProcessing}
              onClick={() => setDisconnectingId(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isProcessing}
              onClick={handleDisconnectConfirm}
            >
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shopee Connect Dialog */}
      <ShopeeConnectDialog
        open={isShopeeModalOpen}
        onOpenChange={setIsShopeeModalOpen}
        onSuccess={() => {
          setIsShopeeModalOpen(false);
          setBannerSuccess('Shopee account connected successfully!');
          router.refresh();
        }}
      />
    </div>
  );
}
