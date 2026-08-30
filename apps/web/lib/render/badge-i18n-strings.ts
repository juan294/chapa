import type { BadgeI18nStrings } from "./BadgeSvg";

/**
 * Minimal shape of a translation lookup, satisfied by both `getServerT`'s
 * return value and the client `useTranslation()` hook's `t`.
 *
 * Deliberately not imported from either: this module must stay client-safe,
 * and typing against the server helper would drag `@/lib/i18n/server` — and
 * with it `getServerT` — into the browser bundle.
 */
export type BadgeTranslate = (key: string) => unknown;

/**
 * Build the complete `BadgeI18nStrings` bundle for `renderBadgeSvg`.
 *
 * #1191 step 6: Creator Studio now renders the real badge SVG in the browser,
 * so it needs the same strings the server routes pass. It cannot call
 * `resolveBadgeLocale` for them — that module imports `getServerT` and is
 * server-only. Rather than spell the ~11 keys out a second time in client
 * code and let the two lists drift, both callers share this pure function.
 *
 * Pure and synchronous, matching `renderBadgeSvg` itself. Returns a fresh
 * object (including a fresh `radarLabels`) on every call, so no caller can
 * mutate another's bundle.
 */
export function buildBadgeI18nStrings(
  t: BadgeTranslate,
  tier: string,
): BadgeI18nStrings {
  return {
    metricsSimulated: t("badge.metricsSimulated") as string,
    metricsVerified: t("badge.metricsVerified") as string,
    metricsPublic: t("badge.metricsPublic") as string,
    radarLabels: {
      delivery: t("dimensions.delivery.label") as string,
      quality: t("dimensions.quality.label") as string,
      consistency: t("dimensions.consistency.label") as string,
      breadth: t("dimensions.breadth.label") as string,
      craft: t("dimensions.craft.label") as string,
    },
    radarNoData: t("badge.radarNoData") as string,
    verifiedLabel: t("badge.verifiedLabel") as string,
    sampleDisclosure: t("badge.sampleDisclosure") as string,
    tierLabel: t(`tiers.${tier.toLowerCase()}`) as string,
  };
}
