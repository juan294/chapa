// Server component (no client hooks) — a route loading.tsx is Next's
// Suspense fallback. `app/studio/page.tsx` is `force-dynamic` and resolves
// the real per-request locale via getServerLocale(); this fallback mirrors
// that (matching apps/web/app/coming-soon/loading.tsx's established
// pattern) rather than assuming DEFAULT_LOCALE like the static-route loaders.
import { getServerLocale, getServerT } from "@/lib/i18n/server";

export default async function StudioLoading() {
  const t = getServerT(await getServerLocale());
  return (
    <main id="main-content" className="min-h-screen bg-bg" role="status" aria-label={t("aria.loading") as string}>
      <span className="sr-only">{t("common.loading") as string}</span>
      {/* Nav placeholder */}
      <div className="fixed top-0 z-50 w-full border-b border-stroke bg-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="h-5 w-20 animate-pulse rounded bg-amber/10" />
          <div className="h-5 w-16 animate-pulse rounded bg-amber/10" />
        </div>
      </div>

      {/* #1241 — mirrors StudioClient's shape: a full-width stage over a
          tools band that splits on its own width. A fallback with the old
          two-column shape made the real page look like it jumped on load. */}
      <div className="flex flex-col pt-[57px]">
        {/* Stage skeleton */}
        <div className="border-b border-stroke px-3 py-4 sm:px-6 sm:py-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="h-4 w-56 animate-pulse rounded bg-amber/[0.06]" />
            <div className="h-9 w-48 animate-pulse rounded-lg bg-amber/[0.06]" />
          </div>
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-forest-line bg-forest p-4 sm:p-6">
            <div className="aspect-[1200/630] w-[min(720px,100%)] animate-pulse rounded-xl bg-forest-card" />
            <div className="h-3 w-72 max-w-full animate-pulse rounded bg-forest-card" />
          </div>
        </div>

        {/* Tools band skeleton */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,460px),1fr))]">
          <div className="space-y-3 border-r border-b border-stroke p-4">
            <div className="h-5 w-40 animate-pulse rounded bg-amber/10" />
            <div className="h-3 w-64 max-w-full animate-pulse rounded bg-amber/[0.06]" />
            <div className="h-10 w-full animate-pulse rounded-lg bg-amber/[0.04]" />
            <div className="h-32 w-full animate-pulse rounded-lg bg-amber/[0.04]" />
          </div>
          <div className="flex flex-col gap-3 border-b border-stroke bg-card p-4">
            <div className="h-3 w-20 animate-pulse rounded bg-amber/[0.06]" />
            <div className="h-24 w-full animate-pulse rounded bg-amber/[0.04]" />
            <div className="flex-1" />
            <div className="h-11 w-full animate-pulse rounded-lg border border-stroke bg-bg" />
            <div className="h-11 w-full animate-pulse rounded-lg bg-amber/10" />
          </div>
        </div>
      </div>

    </main>
  );
}
