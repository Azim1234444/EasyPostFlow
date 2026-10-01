import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

export const metadata = {
  title: 'Terms of Service | PostFlow',
  description: 'Terms of Service and Platform Usage Agreement for PostFlow.',
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-8 sm:p-12 space-y-8">
        {/* Navigation & Header */}
        <div>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to PostFlow
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                Terms of Service
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Last updated: October 1, 2026 • Effective Date: October 1, 2026
              </p>
            </div>
          </div>
        </div>

        <div className="prose prose-slate max-w-none text-sm leading-relaxed space-y-6">
          <section>
            <h2 className="text-lg font-semibold text-slate-900">1. Acceptance of Terms</h2>
            <p>
              By accessing or using PostFlow (&quot;the Service&quot;), operated as an affiliate content
              scheduling platform, you agree to be bound by these Terms of Service. If you do not
              agree, do not access or use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">2. Description of Service</h2>
            <p>
              PostFlow is a software-as-a-service application that allows content creators, affiliate
              marketers, and e-commerce sellers to manage, schedule, and publish short-form video
              content to supported third-party platforms, including TikTok and Shopee.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">3. Third-Party Platform Policies</h2>
            <p>
              PostFlow connects with third-party social media and e-commerce platforms using official
              APIs (including the TikTok Content Posting API and the Shopee Open Platform). By using
              PostFlow to publish to these platforms, you agree to comply with:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>TikTok:</strong> TikTok Terms of Service, Community Guidelines, and Developer
                Terms.
              </li>
              <li>
                <strong>Shopee:</strong> Shopee Terms of Service, Open Platform Developer Terms, and
                Affiliate Program Terms.
              </li>
            </ul>
            <p className="mt-2">
              You acknowledge that PostFlow does not scrape, bypass CAPTCHAs, or harvest credentials.
              PostFlow is not responsible for actions taken by third-party platforms, including account
              suspensions or content removals resulting from your violation of platform policies.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">4. User Account & Security</h2>
            <p>
              You are responsible for safeguarding your login credentials. You agree to notify PostFlow
              immediately if you discover any unauthorized use of your account. Social platform access
              tokens connected through OAuth are encrypted using industry-standard AES-256-GCM.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">5. Content & Conduct</h2>
            <p>
              You retain all ownership of the videos, thumbnails, captions, and links you upload to
              PostFlow. You represent and warrant that:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>You own or have necessary licenses for all uploaded content.</li>
              <li>Your content does not infringe upon intellectual property, privacy, or publicity rights.</li>
              <li>
                Your affiliate links and sponsored content comply with applicable advertising
                regulations (including FTC disclosure guidelines and local affiliate disclosure laws).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">6. Termination & Account Deletion</h2>
            <p>
              You may terminate your account at any time via your account Settings. Upon deletion, your
              personal profile, uploaded media, scheduled jobs, and encrypted tokens are permanently
              deleted from our servers within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">7. Disclaimer of Warranties</h2>
            <p>
              The Service is provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis without warranties of
              any kind, either express or implied, including fitness for a particular purpose or
              uninterrupted uptime.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">8. Contact Information</h2>
            <p>
              For legal inquiries regarding these Terms, contact us at:{' '}
              <a href="mailto:support@postflow.app" className="text-indigo-600 hover:underline">
                support@postflow.app
              </a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
