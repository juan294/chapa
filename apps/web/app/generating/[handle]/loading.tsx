// Server component (no client hooks) — a route loading.tsx is Next's
// Suspense fallback. `app/generating/[handle]/page.tsx` is `force-dynamic`
// and resolves the real per-request locale via getServerLocale(); this
// fallback mirrors that (matching apps/web/app/coming-soon/loading.tsx's
// established pattern) rather than assuming DEFAULT_LOCALE like the
// static-route loaders.
import { getServerLocale, getServerT } from "@/lib/i18n/server";

export default async function GeneratingLoading() {
  const t = getServerT(await getServerLocale());
  return (
    <main
      id="main-content"
      className="flex min-h-screen items-center justify-center bg-bg px-6"
      role="status"
      aria-label={t("aria.loading") as string}
    >
      <span className="sr-only">{t("common.loading") as string}</span>
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
