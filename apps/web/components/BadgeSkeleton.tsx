"use client";

import { BadgeLoadingPlate } from "@/components/BadgeLoadingPlate";
import { useTranslation } from "@/lib/i18n";

/**
 * Suspense fallback for the share page's badge, shown while the profile
 * materializes. Matches badge proportions (1200x630) to prevent layout shift,
 * and draws the same plate as the route's `loading.tsx` so the two fallbacks
 * read as one continuous state rather than an animation followed by a blank.
 */
export function BadgeSkeleton() {
  const { t } = useTranslation();

  return (
    <div role="img" aria-label={t("aria.loadingBadge") as string}>
      <BadgeLoadingPlate caption={t("common.buildingBadge") as string} />
    </div>
  );
}
