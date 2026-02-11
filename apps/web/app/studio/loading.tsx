export default function StudioLoading() {
  return (
    <main id="main-content" className="min-h-screen bg-bg">
      {/* Nav placeholder */}
      <div className="fixed top-0 z-50 w-full border-b border-stroke bg-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="h-5 w-20 animate-pulse rounded bg-amber/10" />
          <div className="h-5 w-16 animate-pulse rounded bg-amber/10" />
        </div>
      </div>

      <div className="pt-[57px] grid grid-cols-1 lg:grid-cols-2">
        {/* Preview skeleton */}
        <div className="flex items-center justify-center px-8 py-12 border-b lg:border-b-0 lg:border-r border-stroke">
          <div className="w-full max-w-xl">
            <div className="rounded-2xl border border-stroke bg-card p-6 space-y-5">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full animate-pulse bg-amber/10" />
                <div className="space-y-1.5">
                  <div className="h-4 w-24 animate-pulse rounded bg-amber/10" />
                  <div className="h-3 w-16 animate-pulse rounded bg-amber/[0.06]" />
                </div>
              </div>
              <div className="h-24 w-full animate-pulse rounded-lg bg-amber/[0.04]" />
              <div className="flex justify-center gap-4 pt-4 border-t border-stroke">
                <div className="h-4 w-20 animate-pulse rounded bg-amber/[0.06]" />
                <div className="h-4 w-16 animate-pulse rounded bg-amber/[0.06]" />
                <div className="h-4 w-20 animate-pulse rounded bg-amber/[0.06]" />
              </div>
            </div>
          </div>
        </div>

        {/* Terminal skeleton */}
        <div className="flex flex-col bg-bg p-4 space-y-3">
          <div className="h-4 w-64 animate-pulse rounded bg-amber/[0.06]" />
          <div className="h-3 w-48 animate-pulse rounded bg-amber/[0.04]" />
          <div className="flex-1" />
          <div className="h-10 w-full animate-pulse rounded-lg bg-card border border-stroke" />
        </div>
      </div>
    </main>
  );
}
