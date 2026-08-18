// Server component (no client hooks) — a route loading.tsx is Next's
// Suspense fallback and must render without waiting on client JS. The i18n
// text is resolved at DEFAULT_LOCALE ('es'), matching this page's own ISR
// approach (`app/u/[handle]/page.tsx` deliberately avoids getServerLocale()'s
// cookies()/headers() reads to stay ISR-eligible, falling back to "es").
import { DEFAULT_LOCALE } from "@/lib/i18n/types";
import { getServerT } from "@/lib/i18n/server";

const t = getServerT(DEFAULT_LOCALE);

export default function SharePageLoading() {
  return (
    <main id="main-content" className="min-h-screen bg-bg" role="status" aria-label={t("aria.loading") as string}>
      <span className="sr-only">{t("common.loading") as string}</span>
      <div className="relative mx-auto max-w-4xl px-6 py-16">
        {/* Header skeleton */}
        <div className="mb-12">
          <div className="h-6 w-20 animate-pulse rounded bg-amber/10" />
        </div>

        {/* Handle skeleton */}
        <div className="mb-8">
          <div className="h-9 w-48 animate-pulse rounded bg-amber/10" />
        </div>

        {/* Badge preview skeleton */}
        <div className="mb-12">
          <div className="rounded-2xl border border-stroke bg-card p-4">
            <div className="aspect-[1200/630] w-full animate-pulse rounded-xl bg-amber/[0.06]" />
          </div>
        </div>

        {/* Impact breakdown skeleton */}
        <div className="mb-12">
          <div className="rounded-2xl border border-stroke bg-card p-8">
            <div className="mb-6 h-4 w-36 animate-pulse rounded bg-amber/10" />
            <div className="space-y-4">
              <div className="h-5 w-full animate-pulse rounded bg-amber/[0.06]" />
              <div className="h-5 w-3/4 animate-pulse rounded bg-amber/[0.06]" />
              <div className="h-5 w-5/6 animate-pulse rounded bg-amber/[0.06]" />
              <div className="h-5 w-2/3 animate-pulse rounded bg-amber/[0.06]" />
            </div>
          </div>
        </div>

        {/* Embed snippets skeleton */}
        <div className="mb-12">
          <div className="rounded-2xl border border-stroke bg-card p-8 space-y-6">
            <div className="h-4 w-32 animate-pulse rounded bg-amber/10" />
            <div className="space-y-2">
              <div className="h-4 w-20 animate-pulse rounded bg-amber/[0.06]" />
              <div className="h-12 w-full animate-pulse rounded-xl bg-amber/[0.04]" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-12 animate-pulse rounded bg-amber/[0.06]" />
              <div className="h-12 w-full animate-pulse rounded-xl bg-amber/[0.04]" />
            </div>
          </div>
        </div>

        {/* Share CTA skeleton */}
        <div className="flex items-center gap-4">
          <div className="h-10 w-32 animate-pulse rounded-full bg-amber/10" />
          <div className="h-10 w-32 animate-pulse rounded-full bg-card" />
        </div>
      </div>
    </main>
  );
}
