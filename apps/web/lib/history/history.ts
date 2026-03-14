import { dbGetSnapshots } from "@/lib/db/snapshots";
import { cacheGet, cacheSet, cacheDel } from "@/lib/cache/redis";
import { getCachedLatestSnapshot } from "@/lib/cache/snapshot-cache";
import type { MetricsSnapshot } from "./types";

const HISTORY_CACHE_TTL = 3600; // 1 hour

/**
 * Build a Redis cache key for history snapshots.
 *
 * Key pattern:
 *   - `history:<handle>` (no date filters)
 *   - `history:<handle>:<from>` (from only)
 *   - `history:<handle>:<from>:<to>` (both filters)
 *
 * Handle is lowercased for case-insensitive dedup.
 */
function historyCacheKey(handle: string, from?: string, to?: string): string {
  const base = `history:${handle.toLowerCase()}`;
  if (from && to) return `${base}:${from}:${to}`;
  if (from) return `${base}:${from}`;
  return base;
}

/**
 * Get all snapshots for a user, optionally filtered by date range.
 * Uses Redis cache (1h TTL) with Supabase fallback.
 *
 * - Cache hit: return from Redis (no DB call).
 * - Cache miss: fetch from Supabase, cache in Redis, return.
 * - Redis failure: fall back to Supabase directly (fail-open).
 *
 * Empty results are NOT cached to avoid caching "no data yet" state.
 *
 * @param handle - GitHub handle (case-insensitive)
 * @param from - Start date (YYYY-MM-DD), inclusive. Omit for all-time.
 * @param to - End date (YYYY-MM-DD), inclusive. Omit for all-time.
 */
export async function getSnapshots(
  handle: string,
  from?: string,
  to?: string,
): Promise<MetricsSnapshot[]> {
  const key = historyCacheKey(handle, from, to);

  // Try Redis first
  try {
    const cached = await cacheGet<MetricsSnapshot[]>(key);
    if (cached) return cached;
  } catch {
    // Redis failed — fall through to DB
  }

  // Cache miss or Redis error — fetch from Supabase
  const snapshots = await dbGetSnapshots(handle, from, to);

  // Cache the result (only if we got data — don't cache empty arrays)
  if (snapshots.length > 0) {
    // Fire-and-forget: don't block on cache write
    cacheSet(key, snapshots, HISTORY_CACHE_TTL).catch(() => {});
  }

  return snapshots;
}

/**
 * Invalidate the history cache for a user.
 *
 * Deletes the base cache key (`history:<handle>`). Date-filtered keys
 * (`history:<handle>:<from>:<to>`) are left to expire naturally via TTL
 * since they are short-lived (1h) and invalidating all permutations is
 * impractical.
 *
 * Call this after any action that changes snapshot data (refresh, recalculate).
 * Fire-and-forget safe — silently no-ops on Redis failure.
 */
export async function invalidateHistoryCache(handle: string): Promise<void> {
  const key = historyCacheKey(handle);
  try {
    await cacheDel(key);
  } catch {
    // Fire-and-forget — cache invalidation is non-critical
  }
}

/**
 * Get the most recent snapshot for a user.
 * Uses Redis cache (24h TTL) with Supabase fallback.
 * Returns `null` if no snapshots exist or on error.
 */
export async function getLatestSnapshot(
  handle: string,
): Promise<MetricsSnapshot | null> {
  return getCachedLatestSnapshot(handle);
}
