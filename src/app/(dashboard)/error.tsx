'use client';

import React, { useEffect } from 'react';
import { AlertCircle, RotateCcw, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard Sub-route Error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-4">
        <AlertCircle className="w-6 h-6" />
      </div>

      <h2 className="text-xl font-semibold text-slate-900 mb-2">
        Failed to load this section
      </h2>
      <p className="text-sm text-slate-500 max-w-md mb-6">
        We encountered an error loading this dashboard view. Your session and other sections remain intact.
      </p>

      {error?.digest && (
        <span className="text-xs font-mono text-slate-400 bg-slate-100 py-1 px-2 rounded mb-6">
          Digest: {error.digest}
        </span>
      )}

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          onClick={() => reset()}
          className="inline-flex items-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Retry
        </Button>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
        >
          <LayoutDashboard className="w-4 h-4" />
          Dashboard Home
        </Link>
      </div>
    </div>
  );
}
