/**
 * Redis cache layer for craft score (tool insights) lookups.
 *
 * Wraps dbGetToolInsights() with a Redis cache (1h TTL) to avoid
 * hitting Supabase on every badge/share-page request.
 *
 * Fail-open design: if Redis is unavailable, falls back to Supabase.
 * When a new craft score is uploaded or recalculated, call
 * invalidateCraftCache() to keep the cache fresh.
 */

import type { CraftResult } from "@chapa/shared";
import { cacheGet, cacheSet, cacheDel } from "./redis";
import { dbGetToolInsights } from "@/lib/db/tool-insights";

/** 1 hour — craft scores change rarely (only on insights upload). */
const CRAFT_CACHE_TTL = 3600;

function craftCacheKey(handle: string): string {
  return `craft:${handle.toLowerCase()}`;
}

/**
 * Get the active craft score for a user, with Redis caching.
 *
 * - Cache hit: return from Redis (no DB call).
 * - Cache miss: fetch from Supabase, cache in Redis, return.
 * - Redis failure: fall back to Supabase directly.
 *
 * Returns null if no insights uploaded or Supabase unavailable.
 */
export async function getCachedCraftScore(
  handle: string,
): Promise<CraftResult | null> {
  const key = craftCacheKey(handle);

  // Try Redis first
  try {
    const cached = await cacheGet<CraftResult>(key);
    if (cached) return cached;
  } catch {
    // Redis failed — fall through to DB
  }

  // Cache miss or Redis error — fetch from Supabase
  const result = await dbGetToolInsights(handle);

  // Cache the result (only if we got data — don't cache nulls)
  if (result) {
    // Fire-and-forget: don't block on cache write
    cacheSet(key, result, CRAFT_CACHE_TTL).catch(() => {});
  }

  return result;
}

/**
 * Update the craft cache after recording a new craft score.
 *
 * Call this after dbUpsertToolInsights() succeeds to keep the cache fresh.
 * Fire-and-forget safe — silently no-ops on Redis failure.
 */
export async function updateCraftCache(
  handle: string,
  result: CraftResult,
): Promise<void> {
  const key = craftCacheKey(handle);
  try {
    await cacheSet(key, result, CRAFT_CACHE_TTL);
  } catch {
    // Fire-and-forget — cache update is non-critical
  }
}

/**
 * Delete the cached craft score for a user.
 *
 * Call this after any action that changes the user's craft score
 * (insights upload, recalculate) so the next badge/share-page
 * request fetches a fresh score from DB.
 *
 * Fire-and-forget safe — silently no-ops on Redis failure.
 */
export async function invalidateCraftCache(
  handle: string,
): Promise<void> {
  const key = craftCacheKey(handle);
  try {
    await cacheDel(key);
  } catch {
    // Fire-and-forget — cache invalidation is non-critical
  }
}
