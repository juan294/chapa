import { fetchStats } from "./stats";
import { mergeStats } from "./merge";
import { cacheGet, cacheSet } from "../cache/redis";
import type { StatsData, SupplementalStats } from "@chapa/shared";

const CACHE_TTL = 21600; // 6 hours
const STALE_TTL = 604800; // 7 days

/**
 * Get StatsData for a user — cache-first, then GitHub API.
 * Returns cached data if available (within 6h).
 * Falls back to live fetch on cache miss.
 * If the API fails (e.g. rate limit 403), returns stale cached data (7d TTL) if available.
 * If supplemental data exists (e.g. from an EMU upload), merges it into the result.
 */
export async function getStats(
  handle: string,
  token?: string,
): Promise<StatsData | null> {
  const lowerHandle = handle.toLowerCase();
  const cacheKey = `stats:v2:${lowerHandle}`;
  const staleKey = `stats:stale:${lowerHandle}`;

  // Try primary cache first
  const cached = await cacheGet<StatsData>(cacheKey);
  if (cached) return cached;

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
  return stats;
}
