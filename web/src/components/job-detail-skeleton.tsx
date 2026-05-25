"use client";

export function JobDetailSkeleton() {
  return (
    <div className="animate-pulse p-6 space-y-6">
      <div className="space-y-2">
        <div className="h-5 bg-surface rounded w-3/4" />
        <div className="h-4 bg-surface rounded w-1/2" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-14 bg-surface rounded-lg" />
        ))}
      </div>

      <div className="space-y-2">
        <div className="h-3 bg-surface rounded w-1/4" />
        <div className="h-3 bg-surface rounded w-full" />
        <div className="h-3 bg-surface rounded w-full" />
        <div className="h-3 bg-surface rounded w-5/6" />
      </div>

      <div className="space-y-2">
        <div className="h-3 bg-surface rounded w-1/4" />
        <div className="h-3 bg-surface rounded w-full" />
        <div className="h-3 bg-surface rounded w-3/4" />
      </div>
    </div>
  );
}
