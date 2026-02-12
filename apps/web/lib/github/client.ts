import { fetchStats } from "./stats";
import { mergeStats } from "./merge";
import { cacheGet, cacheSet } from "../cache/redis";
import type { StatsData, SupplementalStats } from "@chapa/shared";

const CACHE_TTL = 21600; // 6 hours

/**
 * Get StatsData for a user — cache-first, then GitHub API.
 * Returns cached data if available (within 6h).
 * Falls back to live fetch on cache miss.
 * If supplemental data exists (e.g. from an EMU upload), merges it into the result.
 */
export async function getStats(
  handle: string,
  token?: string,
): Promise<StatsData | null> {
  const cacheKey = `stats:${handle}`;

  // Try cache first
  const cached = await cacheGet<StatsData>(cacheKey);
  if (cached) return cached;

  // Fetch from GitHub
  const primary = await fetchStats(handle, token);
  if (!primary) return null;

  // Check for supplemental data (e.g. EMU account)
  const supplemental = await cacheGet<SupplementalStats>(`supplemental:${handle}`);
  const stats = supplemental ? mergeStats(primary, supplemental.stats) : primary;

  // Cache the (possibly merged) result
  await cacheSet(cacheKey, stats, CACHE_TTL);
  return stats;
}
