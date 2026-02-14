import { fetchStats } from "./stats";
import { mergeStats } from "./merge";
import { cacheGet, cacheSet, registerUser } from "../cache/redis";
import type { StatsData, SupplementalStats } from "@chapa/shared";

const CACHE_TTL = 21600; // 6 hours
const STALE_TTL = 604800; // 7 days

// In-flight request deduplication map.
// Prevents concurrent calls for the same handle from making duplicate API calls.
const _inflight = new Map<string, Promise<StatsData | null>>();

/** @internal — exported for tests only. Resets the inflight map. */
export function _resetInflight(): void {
  _inflight.clear();
}

/**
 * Get StatsData for a user — cache-first, then GitHub API.
 * Returns cached data if available (within 6h).
 * Falls back to live fetch on cache miss.
 * If the API fails (e.g. rate limit 403), returns stale cached data (7d TTL) if available.
 * If supplemental data exists (e.g. from an EMU upload), merges it into the result.
 *
 * Concurrent calls for the same handle are deduplicated — only one GitHub API
 * call is made and all callers share the same promise.
 */
export async function getStats(
  handle: string,
  token?: string,
): Promise<StatsData | null> {
  const lowerHandle = handle.toLowerCase();
  const cacheKey = `stats:v2:${lowerHandle}`;

  // Try primary cache first (no dedup needed for cache hits)
  const cached = await cacheGet<StatsData>(cacheKey);
  if (cached) return cached;

  // Check if there's already an in-flight request for this handle
  const existing = _inflight.get(lowerHandle);
  if (existing) return existing;

  // Create the fetch promise and store it for deduplication
  const promise = _fetchAndCache(handle, lowerHandle, cacheKey, token);
  _inflight.set(lowerHandle, promise);

  // Clean up the inflight entry when done (success or failure)
  promise.finally(() => {
    _inflight.delete(lowerHandle);
  });

  return promise;
}

/** Internal: fetch from GitHub, apply stale fallback, merge supplemental, cache. */
async function _fetchAndCache(
  handle: string,
  lowerHandle: string,
  cacheKey: string,
  token?: string,
): Promise<StatsData | null> {
  const staleKey = `stats:stale:${lowerHandle}`;

  // Read stale fallback before fetch (so we have it if fetch fails)
  const stale = await cacheGet<StatsData>(staleKey);

  // Fetch from GitHub
  const primary = await fetchStats(handle, token);
  if (!primary) {
    // API failed (rate limit, network error, etc.) — serve stale if available
    if (stale) {
      console.warn(`[cache] serving stale data for ${lowerHandle} (API unavailable)`);
      return stale;
    }
    return null;
  }

  // Check for supplemental data (e.g. EMU account)
  const supplemental = await cacheGet<SupplementalStats>(`supplemental:${lowerHandle}`);
  const stats = supplemental ? mergeStats(primary, supplemental.stats) : primary;

  // Cache the (possibly merged) result — both primary and stale fallback
  await cacheSet(cacheKey, stats, CACHE_TTL);
  await cacheSet(staleKey, stats, STALE_TTL);

  // Record in permanent registry (fire-and-forget, no TTL)
  void registerUser(handle);

  return stats;
}
