import type { BadgeConfig } from "@chapa/shared";
import { DEFAULT_BADGE_CONFIG } from "@chapa/shared";
import { dbGetStudioConfig } from "@/lib/db/studio";

export type ResolvedBadgeConfigSnapshot = {
  config: BadgeConfig;
  /** `null` identifies the stable absence of a persisted config. */
  revision: number | null;
  /** False when storage could not provide a revision suitable for fencing. */
  cacheable: boolean;
};

/**
 * Resolve the badge configuration for a handle (#1191).
 *
 * EVERY surface that renders a badge must resolve config through here. They all
 * write to the same `buildBadgeSvgCacheKey` slot, so if one of them rendered
 * with a different config it would overwrite the others' work — the warm-cache
 * cron rendering with the default would silently replace a user's configured
 * badge, and nothing would report an error.
 *
 * Failure is never fatal. A missing row, a disabled database, or a read error
 * all resolve to `DEFAULT_BADGE_CONFIG`, which renders the pre-#1191 badge
 * byte-for-byte. A badge that renders in its default look is a far better
 * outcome than a badge that fails to render.
 *
 * This is deliberately called on the RENDER path only, never before a cache
 * lookup: the cache-hit path is a single Redis read against a p95 budget of
 * 800ms, and resolving config there would put a Supabase round-trip in front of
 * the warmest path in the product. Freshness comes from invalidation instead —
 * see `invalidateBadgeSvgCacheForHandle`.
 */
export async function resolveBadgeConfigSnapshot(
  handle: string,
): Promise<ResolvedBadgeConfigSnapshot> {
  try {
    const result = await dbGetStudioConfig(handle);
    if (result.status === "found") {
      return { config: result.config, revision: result.revision, cacheable: true };
    }
    if (result.status === "not_found") {
      return { config: DEFAULT_BADGE_CONFIG, revision: null, cacheable: true };
    }
    return { config: DEFAULT_BADGE_CONFIG, revision: null, cacheable: false };
  } catch {
    return { config: DEFAULT_BADGE_CONFIG, revision: null, cacheable: false };
  }
}

export async function resolveBadgeConfig(handle: string): Promise<BadgeConfig> {
  return (await resolveBadgeConfigSnapshot(handle)).config;
}
