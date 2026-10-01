import React from 'react';

export default function AccountsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-52 bg-slate-200 rounded-md" />
          <div className="h-4 w-80 bg-slate-200 rounded-md" />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-xl bg-white border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-slate-200" />
              <div className="space-y-2 flex-1">
                <div className="h-5 w-32 bg-slate-200 rounded" />
                <div className="h-4 w-48 bg-slate-200 rounded" />
              </div>
            </div>
            <div className="h-10 w-full bg-slate-200 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
