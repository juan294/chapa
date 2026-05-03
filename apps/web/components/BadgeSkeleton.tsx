"use client";

import { useTranslation } from "@/lib/i18n";

/**
 * Skeleton placeholder displayed while the badge SVG loads via <img> fallback.
 * Matches badge proportions (1200x630) to prevent layout shift.
 * Pure CSS animation — no client JS required.
 */
export function BadgeSkeleton() {
  const { t } = useTranslation();

  return (
    <div
      role="img"
      aria-label={t('aria.loadingBadge') as string}
      className="relative w-full aspect-[1200/630] rounded-xl bg-card overflow-hidden"
    >
      {/* Shimmer overlay */}
      <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-stroke/30 to-transparent" />

      {/* Structural hints matching badge layout */}
      <div className="absolute inset-0 p-8 flex flex-col justify-between pointer-events-none">
        {/* Top: avatar + name area */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-stroke/20" />
          <div className="space-y-2">
            <div className="h-5 w-40 rounded bg-stroke/20" />
            <div className="h-3 w-24 rounded bg-stroke/15" />
          </div>
        </div>

        {/* Bottom-right: score circle hint */}
        <div className="flex justify-end">
          <div className="w-20 h-20 rounded-full bg-stroke/15" />
        </div>
      </div>
    </div>
  );
}
