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
  if (cached) return _enrichWithLogins(cached, handle);

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

/**
 * Enrich cached stats with linkedPlatformLogins if missing.
 * Handles pre-deploy cached data that has linkedPlatforms but no logins.
 */
async function _enrichWithLogins(
  stats: StatsData,
  handle: string,
): Promise<StatsData> {
  const platforms = stats.linkedPlatforms;
  if (!platforms || platforms.length === 0 || stats.linkedPlatformLogins) {
    return stats;
  }

  const results = await Promise.all(
    platforms.map((p) => dbGetLinkedPlatform(handle, p)),
  );
  const logins: Record<string, string> = {};
  platforms.forEach((p, i) => {
    if (results[i]) logins[p] = results[i].remoteLogin;
  });

  return Object.keys(logins).length > 0
    ? { ...stats, linkedPlatformLogins: logins }
    : stats;
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

  // Fetch Bitbucket + Codeberg in parallel — error in one must not block the other
  const [bbResult, cbResult] = await Promise.allSettled([
    _fetchBitbucketIfLinked(handle, lowerHandle),
    _fetchCodebergIfLinked(handle, lowerHandle),
  ]);

  const bbStats = bbResult.status === "fulfilled" ? bbResult.value : null;
  const cbStats = cbResult.status === "fulfilled" ? cbResult.value : null;

  // Merge Bitbucket into primary (markAsSupplemental: false — linked platform, not EMU)
  let stats: StatsData = bbStats
    ? mergeStats(primary, bbStats, { markAsSupplemental: false })
    : primary;

  // Merge Codeberg into current stats
  if (cbStats) {
    stats = mergeStats(stats, cbStats, { markAsSupplemental: false });
  }

  // Check for supplemental data (e.g. EMU account)
  const supplemental = await cacheGet<SupplementalStats>(`supplemental:${lowerHandle}`);
  if (supplemental) {
    stats = mergeStats(stats, supplemental.stats);
  }

  // Build linkedPlatforms from DB link status (source of truth), not stats fetch
  // success. This ensures platforms appear in Data Sources and badge footer even
  // when their stats fetch temporarily fails (expired token, API error). Fixes #632.
  const linkedPlatforms: Platform[] = [];
  let bbDbLink: Awaited<ReturnType<typeof dbGetLinkedPlatform>> = null;
  let cbDbLink: Awaited<ReturnType<typeof dbGetLinkedPlatform>> = null;

  if (bbStats) {
    linkedPlatforms.push("bitbucket");
  } else if (await isBitbucketEnabled()) {
    bbDbLink = await dbGetLinkedPlatform(handle, "bitbucket");
    if (bbDbLink) linkedPlatforms.push("bitbucket");
  }
  if (cbStats) {
    linkedPlatforms.push("codeberg");
  } else if (await isCodebergEnabled()) {
    cbDbLink = await dbGetLinkedPlatform(handle, "codeberg");
    if (cbDbLink) linkedPlatforms.push("codeberg");
  }

  if (linkedPlatforms.length > 0) {
    // Fetch remote usernames for profile URLs (reuse DB results when available)
    const [bbLinked, cbLinked] = await Promise.all([
      linkedPlatforms.includes("bitbucket")
        ? (bbDbLink ?? dbGetLinkedPlatform(handle, "bitbucket"))
        : null,
      linkedPlatforms.includes("codeberg")
        ? (cbDbLink ?? dbGetLinkedPlatform(handle, "codeberg"))
        : null,
    ]);
    const linkedPlatformLogins: Record<string, string> = {};
    if (bbLinked) linkedPlatformLogins.bitbucket = bbLinked.remoteLogin;
    if (cbLinked) linkedPlatformLogins.codeberg = cbLinked.remoteLogin;

    stats = {
      ...stats,
      linkedPlatforms,
      ...(Object.keys(linkedPlatformLogins).length > 0 && { linkedPlatformLogins }),
    };
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
    const result = await refreshBitbucketToken(refreshToken, clientId, clientSecret);

    if (!result.ok) {
      if (result.reason === "revoked") {
        void dbDeleteLinkedPlatform(handle, "bitbucket");
      }
      // Transient: keep the link, skip stats this time
      return null;
    }

    accessToken = result.tokens.access_token;
    void dbUpdatePlatformTokens(
      handle,
      "bitbucket",
      result.tokens.access_token,
      result.tokens.refresh_token,
      new Date(Date.now() + result.tokens.expires_in * 1000),
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
      const result = await refreshCodebergToken(
        refreshToken,
        clientId,
        clientSecret,
      );

      if (!result.ok) {
        if (result.reason === "revoked") {
          void dbDeleteLinkedPlatform(handle, "codeberg");
        }
        // Transient: keep the link, skip stats this time
        return null;
      }

      accessToken = result.tokens.access_token;
      void dbUpdatePlatformTokens(
        handle,
        "codeberg",
        result.tokens.access_token,
        result.tokens.refresh_token ?? null,
        result.tokens.expires_in
          ? new Date(Date.now() + result.tokens.expires_in * 1000)
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
