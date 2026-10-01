import React from 'react';

export default function CalendarLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-44 bg-slate-200 rounded-md" />
          <div className="h-4 w-72 bg-slate-200 rounded-md" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-24 bg-slate-200 rounded-md" />
          <div className="h-9 w-24 bg-slate-200 rounded-md" />
        </div>
      </div>

      <div className="rounded-xl bg-white border border-slate-200 p-6 space-y-4">
        {/* Days of week skeleton */}
        <div className="grid grid-cols-7 gap-2 pb-2">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="h-6 bg-slate-200 rounded text-center" />
          ))}
        </div>
        {/* Calendar days grid skeleton */}
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="h-24 bg-slate-100 rounded-lg p-2 space-y-1">
              <div className="h-4 w-4 bg-slate-200 rounded" />
              {i % 4 === 0 && <div className="h-4 w-full bg-slate-200 rounded" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
