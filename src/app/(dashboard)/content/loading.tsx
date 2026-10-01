import React from 'react';

export default function ContentLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-slate-200 rounded-md" />
          <div className="h-4 w-64 bg-slate-200 rounded-md" />
        </div>
        <div className="h-9 w-36 bg-slate-200 rounded-md" />
      </div>

      {/* Filter and search bar skeleton */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="h-10 flex-1 bg-slate-200 rounded-lg" />
        <div className="h-10 w-36 bg-slate-200 rounded-lg" />
      </div>

      {/* Grid of cards skeleton */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="rounded-xl bg-white border border-slate-200 overflow-hidden">
            <div className="h-48 bg-slate-200" />
            <div className="p-4 space-y-3">
              <div className="h-5 w-3/4 bg-slate-200 rounded" />
              <div className="h-4 w-full bg-slate-200 rounded" />
              <div className="flex justify-between pt-2">
                <div className="h-5 w-20 bg-slate-200 rounded-full" />
                <div className="h-5 w-16 bg-slate-200 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
