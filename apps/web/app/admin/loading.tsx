export default function AdminLoading() {
  return (
    <main
      className="mx-auto min-h-screen max-w-7xl bg-bg px-6 pt-24 pb-24"
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading admin dashboard...</span>

      {/* Header skeleton */}
      <div className="mb-8">
        <div className="h-8 w-56 animate-pulse rounded bg-amber/10" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-amber/[0.06]" />
      </div>

      {/* Stats cards skeleton */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-stroke bg-card p-6"
          >
            <div className="mb-3 h-3 w-20 animate-pulse rounded bg-amber/[0.06]" />
            <div className="h-7 w-16 animate-pulse rounded bg-amber/10" />
          </div>
        ))}
      </div>

      {/* Search bar skeleton */}
      <div className="mb-6">
        <div className="h-10 w-full max-w-sm animate-pulse rounded-lg bg-amber/[0.06]" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-xl border border-stroke bg-card overflow-hidden">
        {/* Table header */}
        <div className="flex gap-4 border-b border-stroke px-6 py-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-3 w-24 animate-pulse rounded bg-amber/[0.06]"
            />
          ))}
        </div>
        {/* Table rows */}
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex gap-4 border-b border-stroke px-6 py-4 last:border-b-0"
          >
            <div className="h-4 w-8 animate-pulse rounded bg-amber/[0.06]" />
            <div className="h-4 w-32 animate-pulse rounded bg-amber/10" />
            <div className="h-4 w-20 animate-pulse rounded bg-amber/[0.06]" />
            <div className="h-4 w-16 animate-pulse rounded bg-amber/[0.06]" />
            <div className="h-4 w-24 animate-pulse rounded bg-amber/[0.06]" />
          </div>
        ))}
      </div>
    </main>
  );
}
