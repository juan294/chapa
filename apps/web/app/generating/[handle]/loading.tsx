export default function GeneratingLoading() {
  return (
    <main
      id="main-content"
      className="flex min-h-screen items-center justify-center bg-bg px-6"
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
      <div className="w-full max-w-md">
        {/* Terminal header skeleton */}
        <div className="mb-8">
          <div className="h-3 w-32 animate-pulse rounded bg-amber/10" />
          <div className="mt-3 h-5 w-56 animate-pulse rounded bg-amber/10" />
        </div>

        {/* Progress steps skeleton */}
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg border border-stroke bg-card/50 px-4 py-3"
            >
              <span className="h-5 w-5 flex-shrink-0 animate-pulse rounded-full bg-amber/10" />
              <span
                className="h-3.5 animate-pulse rounded bg-amber/[0.06]"
                style={{ width: `${60 + i * 10}%` }}
              />
            </div>
          ))}
        </div>

        {/* Subtitle skeleton */}
        <div className="mt-6">
          <div className="h-3 w-44 animate-pulse rounded bg-amber/[0.06] font-heading" />
        </div>
      </div>
    </main>
  );
}
