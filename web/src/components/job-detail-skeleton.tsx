"use client";

export function JobDetailSkeleton() {
  return (
    <div className="animate-pulse px-5 sm:px-7 pt-6 space-y-6" aria-label="Loading job">
      <div className="space-y-2">
        <div className="h-5 bg-surface rounded w-3/4" />
        <div className="h-4 bg-surface rounded w-1/2" />
      </div>

      <div className="h-[58px] bg-surface-soft border border-hairline-soft rounded-[10px]" />

      <div className="flex gap-6 border-b border-hairline-soft pb-3">
        <div className="h-3 bg-surface rounded w-16" />
        <div className="h-3 bg-surface rounded w-24" />
      </div>

      <div className="grid grid-cols-2 gap-x-7 gap-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-3 bg-surface rounded" />
        ))}
      </div>

      <div className="space-y-2">
        <div className="h-3 bg-surface rounded w-1/4" />
        <div className="h-3 bg-surface rounded w-full" />
        <div className="h-3 bg-surface rounded w-5/6" />
      </div>
    </div>
  );
}
