import { getServerT } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/types";
import type { BadgeI18nStrings } from "./BadgeSvg";
import { buildBadgeI18nStrings } from "./badge-i18n-strings";
import { buildBadgeSvgCacheKey, buildBadgeSvgRenderLockKey } from "./badge-svg-cache";

/**
 * Bundles one resolved locale with its `renderBadgeSvg` strings AND its
 * cache-key builders, so both can only ever come from the SAME locale value.
 *
 * #1181 (UX-H3) follow-up — this module exists because of a real bug: two
 * call sites (the share page, the warm-cache cron) independently built
 * `renderBadgeSvg`'s `strings` option and `buildBadgeSvgCacheKey`'s `locale`
 * argument, each relying on its own default when the caller forgot to pass
 * one explicitly. `renderBadgeSvg` defaults to ENGLISH when `strings` is
 * omitted; `buildBadgeSvgCacheKey` defaults to `DEFAULT_LOCALE`, which is
 * SPANISH, when `locale` is omitted. Both call sites hit exactly that
 * mismatch: they wrote an English-rendered badge into the Spanish-keyed
 * cache slot, so the default-locale (Spanish) majority of real traffic —
 * the audience this feature exists to serve — read back an English badge.
 *
 * The fix is structural, not just "remember to pass locale everywhere":
 * ANY call site that both renders/reads badge content and builds a cache
 * key for it MUST get both from ONE call to `resolveBadgeLocale`, never
 * from independent calls to `getServerT` and `buildBadgeSvgCacheKey`. There
 * is only one locale input here, and every derived value (`stringsFor`,
 * `cacheKey`, `renderLockKey`) is computed from that same input — so it is
 * no longer possible for the key's locale to disagree with the content's.
 *
 * `apps/web/app/u/[handle]/badge.svg/route.ts`, `apps/web/app/u/[handle]/page.tsx`
 * (the share page), and `apps/web/app/api/cron/warm-cache/route.ts` all use
 * this as their sole source of locale-derived badge values.
 */
export interface ResolvedBadgeLocale {
  locale: Locale;
  /**
   * Complete `BadgeI18nStrings` bundle for `renderBadgeSvg`'s `strings`
   * option, including the tier-specific label for `tier` (an `ImpactTier`
   * value, e.g. "Solid" — resolved fresh per call since it varies per render).
   */
  stringsFor: (tier: string) => BadgeI18nStrings;
  /** `buildBadgeSvgCacheKey` bound to this locale — never call the unbound version alongside `stringsFor`. */
  cacheKey: (handle: string, date: string) => string;
  /** `buildBadgeSvgRenderLockKey` bound to this locale. */
  renderLockKey: (handle: string, date: string) => string;
}

export function resolveBadgeLocale(locale: Locale): ResolvedBadgeLocale {
  const t = getServerT(locale);

  return {
    locale,
    // The key list lives in `buildBadgeI18nStrings` because Creator Studio's
    // in-browser preview needs the same bundle and cannot reach `getServerT`
    // (#1191 step 6).
    stringsFor: (tier: string): BadgeI18nStrings =>
      buildBadgeI18nStrings(t, tier),
    cacheKey: (handle, date) => buildBadgeSvgCacheKey(handle, date, locale),
    renderLockKey: (handle, date) => buildBadgeSvgRenderLockKey(handle, date, locale),
  };
}
