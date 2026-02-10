import { fetchStats90d } from "./stats90d";
import { cacheGet, cacheSet } from "../cache/redis";
import type { Stats90d } from "@chapa/shared";

const CACHE_TTL = 86400; // 24 hours

/**
 * Get Stats90d for a user — cache-first, then GitHub API.
 * Returns cached data if available (within 24h).
 * Falls back to live fetch on cache miss.
 */
export async function getStats90d(
  handle: string,
  token?: string,
): Promise<Stats90d | null> {
  const cacheKey = `stats:${handle}`;

  // Try cache first
  const cached = await cacheGet<Stats90d>(cacheKey);
  if (cached) return cached;

  // Fetch from GitHub
  const stats = await fetchStats90d(handle, token);
  if (!stats) return null;

  // Cache the result
  await cacheSet(cacheKey, stats, CACHE_TTL);
  return stats;
}
