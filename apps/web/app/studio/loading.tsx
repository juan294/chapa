export default function StudioLoading() {
  return (
    <main className="min-h-screen bg-bg">
      {/* Nav placeholder */}
      <div className="fixed top-0 z-50 w-full border-b border-stroke bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="h-6 w-20 animate-pulse rounded bg-amber/10" />
          <div className="h-9 w-28 animate-pulse rounded-full bg-amber/10" />
        </div>
      </div>

      <div className="pt-[73px] grid grid-cols-1 lg:grid-cols-[1fr_400px]">
        {/* Preview skeleton */}
        <div className="flex items-center justify-center px-8 py-12">
          <div className="w-full max-w-xl">
            <div className="rounded-2xl border border-stroke bg-card p-6 space-y-5">
              {/* Header skeleton */}
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full animate-pulse bg-amber/10" />
                <div className="space-y-1.5">
                  <div className="h-4 w-24 animate-pulse rounded bg-amber/10" />
                  <div className="h-3 w-16 animate-pulse rounded bg-amber/[0.06]" />
                </div>
              </div>
              {/* Heatmap skeleton */}
              <div className="h-24 w-full animate-pulse rounded-lg bg-amber/[0.04]" />
              {/* Stats skeleton */}
              <div className="flex justify-center gap-4 pt-4 border-t border-stroke">
                <div className="h-4 w-20 animate-pulse rounded bg-amber/[0.06]" />
                <div className="h-4 w-16 animate-pulse rounded bg-amber/[0.06]" />
                <div className="h-4 w-20 animate-pulse rounded bg-amber/[0.06]" />
              </div>
            </div>
          </div>
        </div>

        {/* Controls skeleton */}
        <div className="border-t lg:border-t-0 lg:border-l border-stroke bg-card/50">
          {/* Presets skeleton */}
          <div className="px-4 pt-4 pb-3 space-y-2">
            <div className="h-3 w-14 animate-pulse rounded bg-amber/[0.06]" />
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-9 w-24 animate-pulse rounded-full bg-card"
                />
              ))}
            </div>
          </div>

          <div className="mx-4 border-t border-stroke" />

          {/* Accordion skeletons */}
          <div className="space-y-0">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between px-4 py-3.5 border-b border-stroke last:border-b-0"
              >
                <div className="flex items-center gap-3">
                  <div className="h-4 w-24 animate-pulse rounded bg-amber/10" />
                  <div className="h-3 w-16 animate-pulse rounded bg-amber/[0.06]" />
                </div>
                <div className="h-4 w-4 animate-pulse rounded bg-amber/[0.06]" />
              </div>
            ))}
          </div>

          {/* Save button skeleton */}
          <div className="border-t border-stroke px-4 py-4 flex items-center gap-3">
            <div className="flex-1 h-11 animate-pulse rounded-full bg-amber/10" />
            <div className="h-11 w-20 animate-pulse rounded-full bg-card" />
          </div>
        </div>
      </div>
    </main>
  );
}
