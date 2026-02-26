import { fetchStats } from "./stats";
import { mergeStats } from "./merge";
import { cacheGet, cacheSet } from "../cache/redis";
import { dbUpsertUser } from "@/lib/db/users";
import { isBitbucketEnabled, isCodebergEnabled } from "@/lib/feature-flags";
import {
  dbGetLinkedPlatform,
  dbDeleteLinkedPlatform,
  dbUpdatePlatformTokens,
} from "@/lib/db/user-platforms";
import { isTokenExpired, refreshBitbucketToken } from "@/lib/auth/bitbucket";
import { refreshCodebergToken } from "@/lib/auth/codeberg";
import { fetchBitbucketStats } from "@/lib/bitbucket/stats";
import { fetchCodebergStats } from "@/lib/codeberg/stats";
import type { StatsData, SupplementalStats, Platform } from "@chapa/shared";

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
 * Get StatsData for a user — cache-first, then GitHub + Bitbucket.
 * Returns cached data if available (within 6h).
 * Falls back to live fetch on cache miss.
 * If the API fails (e.g. rate limit 403), returns stale cached data (7d TTL) if available.
 * If Bitbucket is linked, fetches and merges Bitbucket data.
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
  const cacheKey = `stats:v2:merged:${lowerHandle}`;

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

/** Internal: fetch from GitHub, merge Bitbucket + supplemental, cache. */
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

  // Fetch Bitbucket data (from cache or live)
  const bbStats = await _fetchBitbucketIfLinked(handle, lowerHandle);

  // Merge Bitbucket into primary (markAsSupplemental: false — linked platform, not EMU)
  let stats: StatsData = bbStats
    ? mergeStats(primary, bbStats, { markAsSupplemental: false })
    : primary;

  // Fetch Codeberg data (from cache or live)
  const cbStats = await _fetchCodebergIfLinked(handle, lowerHandle);

  // Merge Codeberg into current stats
  if (cbStats) {
    stats = mergeStats(stats, cbStats, { markAsSupplemental: false });
  }

  // Check for supplemental data (e.g. EMU account)
  const supplemental = await cacheGet<SupplementalStats>(`supplemental:${lowerHandle}`);
  if (supplemental) {
    stats = mergeStats(stats, supplemental.stats);
  }

  // Set linkedPlatforms after all merges (so it survives EMU merge)
  const linkedPlatforms: Platform[] = [];
  if (bbStats) linkedPlatforms.push("bitbucket");
  if (cbStats) linkedPlatforms.push("codeberg");
  if (linkedPlatforms.length > 0) {
    stats = { ...stats, linkedPlatforms };
  }

  // Cache the final (possibly merged) result — both primary and stale fallback
  await cacheSet(cacheKey, stats, CACHE_TTL);
  await cacheSet(staleKey, stats, STALE_TTL);

  // Record in permanent user registry (fire-and-forget)
  void dbUpsertUser(handle).catch(() => {});

  return stats;
}

/** Fetch Bitbucket stats from cache or live API. Returns null if not linked/disabled. */
async function _fetchBitbucketIfLinked(
  handle: string,
  lowerHandle: string,
): Promise<StatsData | null> {
  const bbCacheKey = `stats:v2:bitbucket:${lowerHandle}`;

  // Check Bitbucket cache first (cheap Redis read, always available)
  const cached = await cacheGet<StatsData>(bbCacheKey);
  if (cached) return cached;

  // Check feature flag — only make live API calls if enabled
  const enabled = await isBitbucketEnabled();
  if (!enabled) return null;

  // Check if user has linked Bitbucket
  const linked = await dbGetLinkedPlatform(handle, "bitbucket");
  if (!linked) return null;

  let { accessToken } = linked.tokens;
  const { refreshToken, expiresAt } = linked.tokens;

  // Refresh token if expired
  if (isTokenExpired(expiresAt)) {
    if (!refreshToken) {
      void dbDeleteLinkedPlatform(handle, "bitbucket");
      return null;
    }

    const clientId = process.env.BITBUCKET_CLIENT_ID?.trim() ?? "";
    const clientSecret = process.env.BITBUCKET_CLIENT_SECRET?.trim() ?? "";
    const refreshed = await refreshBitbucketToken(refreshToken, clientId, clientSecret);

    if (!refreshed) {
      // Token revoked — unlink platform
      void dbDeleteLinkedPlatform(handle, "bitbucket");
      return null;
    }

    accessToken = refreshed.access_token;
    void dbUpdatePlatformTokens(
      handle,
      "bitbucket",
      refreshed.access_token,
      refreshed.refresh_token,
      new Date(Date.now() + refreshed.expires_in * 1000),
    );
  }

  // Fetch Bitbucket stats
  const bbStats = await fetchBitbucketStats(
    linked.remoteLogin,
    accessToken,
    { displayName: linked.remoteLogin, avatarUrl: "" },
  );

  if (bbStats) {
    await cacheSet(bbCacheKey, bbStats, CACHE_TTL);
  }

  return bbStats;
}

/** Fetch Codeberg stats from cache or live API. Returns null if not linked/disabled. */
async function _fetchCodebergIfLinked(
  handle: string,
  lowerHandle: string,
): Promise<StatsData | null> {
  const cbCacheKey = `stats:v2:codeberg:${lowerHandle}`;

  // Check Codeberg cache first (cheap Redis read, always available)
  const cached = await cacheGet<StatsData>(cbCacheKey);
  if (cached) return cached;

  // Check feature flag — only make live API calls if enabled
  const enabled = await isCodebergEnabled();
  if (!enabled) return null;

  // Check if user has linked Codeberg
  const linked = await dbGetLinkedPlatform(handle, "codeberg");
  if (!linked) return null;

  let { accessToken } = linked.tokens;
  const { refreshToken, expiresAt } = linked.tokens;

  // Refresh token if expired (only if refresh_token exists)
  if (isTokenExpired(expiresAt)) {
    if (!refreshToken) {
      // No refresh token and token expired — can't recover
      // If expiresAt is null, token may be long-lived — try anyway
      if (expiresAt !== null) {
        void dbDeleteLinkedPlatform(handle, "codeberg");
        return null;
      }
      // expiresAt is null → token might be long-lived, proceed with current token
    } else {
      const clientId = process.env.CODEBERG_CLIENT_ID?.trim() ?? "";
      const clientSecret = process.env.CODEBERG_CLIENT_SECRET?.trim() ?? "";
      const refreshed = await refreshCodebergToken(
        refreshToken,
        clientId,
        clientSecret,
      );

      if (!refreshed) {
        void dbDeleteLinkedPlatform(handle, "codeberg");
        return null;
      }

      accessToken = refreshed.access_token;
      void dbUpdatePlatformTokens(
        handle,
        "codeberg",
        refreshed.access_token,
        refreshed.refresh_token ?? null,
        refreshed.expires_in
          ? new Date(Date.now() + refreshed.expires_in * 1000)
          : null,
      );
    }
  }

  // Fetch Codeberg stats
  const cbStats = await fetchCodebergStats(
    linked.remoteLogin,
    accessToken,
    { displayName: linked.remoteLogin, avatarUrl: "" },
  );

  if (cbStats) {
    await cacheSet(cbCacheKey, cbStats, CACHE_TTL);
  }

  return cbStats;
}
