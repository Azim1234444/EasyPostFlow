import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Lock } from 'lucide-react';

export const metadata = {
  title: 'Privacy Policy | PostFlow',
  description: 'Privacy Policy and Data Protection Notice for PostFlow.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-8 sm:p-12 space-y-8">
        <div>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to PostFlow
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                Privacy Policy
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Last updated: October 1, 2026 • Effective Date: October 1, 2026
              </p>
            </div>
          </div>
        </div>

        <div className="prose prose-slate max-w-none text-sm leading-relaxed space-y-6">
          <section>
            <h2 className="text-lg font-semibold text-slate-900">1. Information We Collect</h2>
            <p>
              PostFlow collects minimal information required to operate our social media scheduling
              service:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Account Information:</strong> Your email address, encrypted password, and
                profile name upon account creation.
              </li>
              <li>
                <strong>Social Media Account Data:</strong> When you connect TikTok or Shopee, we
                receive your public account identifier, username, display name, avatar, and OAuth
                access tokens. We never receive or store your third-party account password.
              </li>
              <li>
                <strong>Uploaded Media:</strong> Video files, thumbnail images, captions, hashtags, and
                affiliate URLs that you upload or schedule.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">2. How We Protect Your Data</h2>
            <p>
              Security is core to our architecture:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Token Encryption:</strong> All OAuth access and refresh tokens are encrypted at
                rest using authenticated AES-256-GCM encryption with randomized initialization vectors.
              </li>
              <li>
                <strong>Transmission Security:</strong> All data transmitted between your browser, our
                servers, and third-party APIs is encrypted using TLS 1.3.
              </li>
              <li>
                <strong>No Client Leakage:</strong> Sensitive tokens and API credentials are kept
                strictly server-side and are never exposed to browser client bundles.
              </li>
              <li>
                <strong>Access Control:</strong> Row-Level Security (RLS) policies ensure that each
                creator can only view and manage their own content and social accounts.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">3. Use of Official Third-Party APIs</h2>
            <p>
              PostFlow integrates with platforms exclusively via their documented official APIs:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>TikTok Content Posting API:</strong> Video uploads and status queries are
                performed exclusively via TikTok Content Posting API v2 with explicit user consent
                granted during OAuth authorization.
              </li>
              <li>
                <strong>Shopee Open Platform:</strong> Video dispatches and affiliate tracking link
                generation use authenticated HMAC-SHA256 signatures and official GraphQL interfaces.
              </li>
            </ul>
            <p className="mt-2">
              PostFlow strictly prohibits and does not engage in web scraping, CAPTCHA bypassing, or
              credential harvesting.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">4. User Rights & Data Deletion</h2>
            <p>
              Under global privacy frameworks (including GDPR, CCPA, and platform developer terms), you
              possess the right to:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Access all personal data and content stored in PostFlow.</li>
              <li>Disconnect social accounts at any time from the Accounts dashboard.</li>
              <li>
                <strong>Permanently Delete Your Account & Data:</strong> You may trigger account
                erasure directly inside PostFlow under Settings &gt; Danger Zone, or by emailing{' '}
                <a href="mailto:privacy@postflow.app" className="text-indigo-600 hover:underline">
                  privacy@postflow.app
                </a>
                .
              </li>
            </ul>
            <p className="mt-2">
              Upon account deletion, all database records, encrypted credentials, scheduled jobs, and
              video files in object storage are permanently deleted.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">5. Updates to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. When changes occur, we will revise the
              &quot;Last updated&quot; date at the top of this page.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
