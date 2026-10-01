'use client';

import React, { useState } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { connectShopeeAccount } from '@/lib/actions/accounts';
import { Store, UserCheck, AlertCircle, Loader2, Info } from 'lucide-react';

interface ShopeeConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ShopeeConnectDialog({ open, onOpenChange, onSuccess }: ShopeeConnectDialogProps) {
  const router = useRouter();

  const [mode, setMode] = useState<'seller' | 'affiliate'>('affiliate');
  const [displayName, setDisplayName] = useState('');
  const [shopId, setShopId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [appId, setAppId] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!displayName.trim()) {
      setErrorMessage('Please provide an account name or shop name.');
      return;
    }

    if (mode === 'seller' && !shopId.trim()) {
      setErrorMessage('Shopee Shop ID is required for seller accounts.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await connectShopeeAccount({
        accountType: mode,
        displayName: displayName.trim(),
        shopId: shopId.trim() || undefined,
        accessToken: accessToken.trim() || undefined,
        appId: appId.trim() || undefined,
        appSecret: appSecret.trim() || undefined,
      });

      if (res.error) throw new Error(res.error);

      onOpenChange(false);
      router.refresh();
      if (onSuccess) onSuccess();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to connect Shopee account');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-orange-600">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-600 text-white font-bold text-xs">
              SH
            </div>
            <DialogTitle>Connect Shopee Account</DialogTitle>
          </div>
          <DialogDescription>
            Choose your account role to configure automated or assisted publishing
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <Tabs value={mode} onValueChange={(val) => setMode(val as 'seller' | 'affiliate')}>
          <TabsList className="grid grid-cols-2 w-full mb-3">
            <TabsTrigger value="affiliate" className="flex items-center gap-1.5 text-xs">
              <UserCheck className="h-3.5 w-3.5" /> Affiliate Creator
            </TabsTrigger>
            <TabsTrigger value="seller" className="flex items-center gap-1.5 text-xs">
              <Store className="h-3.5 w-3.5" /> Shopee Seller
            </TabsTrigger>
          </TabsList>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Affiliate Tab */}
            <TabsContent value="affiliate" className="space-y-3 m-0">
              <div className="rounded-lg bg-muted/60 p-3 text-xs space-y-1.5 text-muted-foreground">
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <Info className="h-3.5 w-3.5 text-primary shrink-0" />
                  Assisted Manual Workflow
                </div>
                <p>
                  Official Shopee APIs only support short link tracking generation for affiliates.
                  PostFlow formats your video, caption, and tracking links for 1-click mobile posting.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="aff-display-name">Affiliate Creator Name / Handle *</Label>
                <Input
                  id="aff-display-name"
                  placeholder="e.g. @fashion_deals"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="aff-app-id">Shopee Affiliate App ID (Optional)</Label>
                <Input
                  id="aff-app-id"
                  placeholder="Shopee Open Platform App ID"
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="aff-app-secret">Shopee Affiliate Secret (Optional)</Label>
                <Input
                  id="aff-app-secret"
                  type="password"
                  placeholder="Shopee Open Platform Secret"
                  value={appSecret}
                  onChange={(e) => setAppSecret(e.target.value)}
                />
              </div>
            </TabsContent>

            {/* Seller Tab */}
            <TabsContent value="seller" className="space-y-3 m-0">
              <div className="rounded-lg bg-muted/60 p-3 text-xs space-y-1.5 text-muted-foreground">
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <Info className="h-3.5 w-3.5 text-orange-600 shrink-0" />
                  Seller Assisted Publishing
                </div>
                <p>
                  Shopee does not offer an automated API for the Shopee Video consumer feed. Connecting your Seller Shop prepares formatted captions, hashtags, and tracked links with 1-click mobile app publishing.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="seller-name">Shop Name *</Label>
                <Input
                  id="seller-name"
                  placeholder="e.g. Official Lifestyle Store"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="seller-shop-id">Shopee Shop ID *</Label>
                <Input
                  id="seller-shop-id"
                  placeholder="Numeric Shop ID from Seller Center"
                  value={shopId}
                  onChange={(e) => setShopId(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="seller-access-token">Shopee Open Platform Access Token</Label>
                <Input
                  id="seller-access-token"
                  type="password"
                  placeholder="OAuth access token from Shopee Partner Portal"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                />
              </div>
            </TabsContent>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Connect Shopee
              </Button>
            </DialogFooter>
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
