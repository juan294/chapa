/** Skeleton loader for the admin users table — shown while data is being fetched. */
export function AdminTableSkeleton({ rowCount = 8 }: { rowCount?: number }) {
  return (
    <div className="space-y-6">
      {/* Stat card shimmer blocks */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl border border-stroke bg-card p-4"
          >
            <div className="mb-2 h-3 w-16 rounded bg-amber/10" />
            <div className="h-6 w-12 rounded bg-amber/10" />
          </div>
        ))}
      </div>

      {/* Search bar shimmer */}
      <div className="rounded-xl border border-stroke bg-card overflow-hidden">
        <div className="flex items-center gap-3 border-b border-stroke px-4 py-3">
          <div className="h-4 w-4 animate-pulse rounded bg-amber/10" />
          <div className="h-4 flex-1 animate-pulse rounded bg-amber/[0.06]" />
        </div>

        {/* Table shimmer rows */}
        <div aria-hidden="true">
          {/* Header row */}
          <div className="flex gap-4 border-b border-stroke px-4 py-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                className="h-3 animate-pulse rounded bg-amber/[0.06]"
                style={{ width: `${60 + i * 12}px` }}
              />
            ))}
          </div>

          {/* Data rows */}
          {Array.from({ length: rowCount }, (_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b border-stroke px-4 py-3 last:border-b-0"
            >
              {/* Avatar circle */}
              <div className="h-8 w-8 animate-pulse rounded-full bg-amber/10" />
              {/* Text bars */}
              <div className="flex flex-1 items-center gap-4">
                <div className="h-3 w-24 animate-pulse rounded bg-amber/10" />
                <div className="h-3 w-16 animate-pulse rounded bg-amber/[0.06]" />
                <div className="hidden h-3 w-12 animate-pulse rounded bg-amber/[0.06] sm:block" />
                <div className="hidden h-3 w-14 animate-pulse rounded bg-amber/[0.06] lg:block" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
