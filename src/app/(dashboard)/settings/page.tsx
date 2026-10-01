import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DeleteAccountDialog } from '@/components/settings/delete-account-dialog';
import { Shield, FileText, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Settings | PostFlow',
  description: 'Manage your PostFlow account profile, data, and compliance settings',
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your account profile, compliance policies, and data controls.
        </p>
      </div>

      <div className="space-y-6 max-w-3xl">
        {/* Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle>Profile Details</CardTitle>
            <CardDescription>Your registered creator credentials and email.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <p className="text-xs font-medium text-slate-500 mb-1">Email Address</p>
                <p className="text-sm font-semibold text-slate-800">{user?.email || 'Not available'}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <p className="text-xs font-medium text-slate-500 mb-1">Creator Name</p>
                <p className="text-sm font-semibold text-slate-800">
                  {user?.user_metadata?.full_name || 'Creator'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Legal & Compliance Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-600" />
              <CardTitle>Compliance &amp; Platform Policies</CardTitle>
            </div>
            <CardDescription>
              Legal agreements and data protection terms for connected TikTok &amp; Shopee integrations.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 text-slate-500" />
                <div>
                  <p className="text-sm font-medium text-slate-800">Terms of Service</p>
                  <p className="text-xs text-slate-500">Platform usage agreement and publisher obligations</p>
                </div>
              </div>
              <Link
                href="/terms"
                target="_blank"
                className="text-xs font-medium text-indigo-600 hover:underline flex items-center gap-1"
              >
                View Terms <ExternalLink className="w-3 h-3" />
              </Link>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3">
                <Shield className="w-4 h-4 text-emerald-600" />
                <div>
                  <p className="text-sm font-medium text-slate-800">Privacy Policy</p>
                  <p className="text-xs text-slate-500">AES-256 token encryption and user data protection notice</p>
                </div>
              </div>
              <Link
                href="/privacy"
                target="_blank"
                className="text-xs font-medium text-emerald-600 hover:underline flex items-center gap-1"
              >
                View Policy <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>
              Irreversible account actions and complete data erasure.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-red-50/50 border border-red-100">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">Delete Account &amp; Stored Media</p>
                <p className="text-xs text-slate-600">
                  Permanently erase your account, all uploaded videos, thumbnails, and connected platform accounts.
                </p>
              </div>
              <DeleteAccountDialog />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
