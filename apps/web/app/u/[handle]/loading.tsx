// Server component (no client hooks) — a route loading.tsx is Next's
// Suspense fallback and must render without waiting on client JS. The i18n
// text is resolved at DEFAULT_LOCALE ('es'), matching this page's own ISR
// approach (`app/u/[handle]/page.tsx` deliberately avoids getServerLocale()'s
// cookies()/headers() reads to stay ISR-eligible, falling back to "es").
import { DEFAULT_LOCALE } from "@/lib/i18n/types";
import { getServerT } from "@/lib/i18n/server";
import { BadgeLoadingPlate } from "@/components/BadgeLoadingPlate";

const t = getServerT(DEFAULT_LOCALE);

/** Visible skeleton fill. `bg-track` is a real neutral rule token, unlike the
 * 6%-alpha accent this used to paint with, which was invisible on the dark
 * ground and made a multi-second wait look like a blank page. */
const BAR = "animate-pulse rounded bg-track";

export default function SharePageLoading() {
  return (
    <div className="min-h-screen bg-bg" role="status" aria-label={t("aria.loading") as string}>
      <span className="sr-only">{t("common.loading") as string}</span>
      <div className="relative mx-auto max-w-4xl px-6 py-16">
        {/* The wait is the product working, so say so in its own voice rather
            than showing silent grey boxes. */}
        <p className="font-heading text-xs text-amber-text">
          % chapa /badge
          <span className="animate-cursor-blink" aria-hidden="true"> ▌</span>
        </p>

        <div className={`mt-6 mb-10 h-9 w-48 ${BAR}`} />

        {/* Badge frame: a sweep crossing the empty plate, the Chapa mark
            breathing at its centre, and a caption naming what is happening. */}
        <div className="mb-12 overflow-hidden rounded-[3px] border border-stroke bg-card p-4">
          <BadgeLoadingPlate caption={t("common.buildingBadge") as string} />
        </div>

        {/* Impact breakdown skeleton */}
        <div className="mb-12">
          <div className="rounded-[3px] border border-stroke bg-card p-8">
            <div className={`mb-6 h-4 w-36 ${BAR}`} />
            <div className="space-y-4">
              <div className={`h-5 w-full ${BAR}`} />
              <div className={`h-5 w-3/4 ${BAR}`} />
              <div className={`h-5 w-5/6 ${BAR}`} />
              <div className={`h-5 w-2/3 ${BAR}`} />
            </div>
          </div>
        </div>

        {/* Embed snippets skeleton */}
        <div className="mb-12">
          <div className="space-y-6 rounded-[3px] border border-stroke bg-card p-8">
            <div className={`h-4 w-32 ${BAR}`} />
            <div className="space-y-2">
              <div className={`h-4 w-20 ${BAR}`} />
              <div className={`h-12 w-full ${BAR}`} />
            </div>
            <div className="space-y-2">
              <div className={`h-4 w-12 ${BAR}`} />
              <div className={`h-12 w-full ${BAR}`} />
            </div>
          </div>
        </div>

        {/* Share CTA skeleton */}
        <div className="flex items-center gap-4">
          <div className={`h-11 w-32 rounded-[3px] ${BAR}`} />
          <div className="h-11 w-32 animate-pulse rounded-[3px] bg-card" />
        </div>
      </div>
    </div>
  );
}
