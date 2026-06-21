import { cacheGet, cacheSet } from "@/lib/cache/redis";
import { withTimeout } from "@/lib/async/with-timeout";
import type { StatsData } from "@chapa/shared";

/**
 * Positive cache TTL for fetched platform stats (6 hours).
 * Shared verbatim across bitbucket/codeberg/gitlab clients.
 */
export const CACHE_TTL = 21600;
/**
 * Negative-result cache TTL (1h). Short-circuits "not linked/disabled"
 * on the next request so we don't re-hit the flag + DB every embed.
 */
export const NEG_CACHE_TTL = 3600;
export const PLATFORM_FETCH_DEADLINE_MS = 8_000;

/**
 * The shape returned by `dbGetLinkedPlatform` — the linked account record
 * with decrypted tokens. Re-declared here (rather than imported from the db
 * module) so the platform helper stays dependency-light and the db module
 * can keep this type private.
 */
export interface LinkedPlatformRecord {
  remoteLogin: string;
  tokens: {
    accessToken: string;
    refreshToken: string | null;
    expiresAt: Date | null;
  };
}

/**
 * Per-platform configuration for {@link fetchLinkedPlatformStats}.
 *
 * The skeleton (positive cache → neg cache → enabled → linked → token
 * resolution → fetch → cache set) is identical across all three platforms.
 * Everything that *diverges* between Bitbucket / Codeberg / GitLab is expressed
 * through these callbacks:
 *
 * - `resolveAccessToken` encapsulates each platform's divergent token-refresh
 *   semantics (simple expiry→refresh, long-lived null-expiresAt path, GitLab's
 *   client-credential short-circuit, delete-on-no-refresh-token,
 *   delete-on-revoked). It returns a usable access token, or `null` to bail out
 *   without fetching. All `void dbUpdatePlatformTokens(...)` /
 *   `void dbDeleteLinkedPlatform(...)` fire-and-forget side effects live inside
 *   each platform's implementation of this callback, exactly as before.
 * - `fetchStats` wraps the platform-specific stats call (and, for GitLab, the
 *   numeric user-id resolution from the access token). Returns `null` on
 *   failure so the helper skips caching.
 */
export interface FetchLinkedPlatformConfig {
  /** Platform identifier, e.g. "bitbucket". Used for the cache key. */
  platform: string;
  /** Lowercased handle — used to build the cache key. */
  lowerHandle: string;
  /** Feature-flag check. On `false` the helper sets the neg cache and returns null. */
  isEnabled: () => Promise<boolean>;
  /** Look up the linked account. On `null` the helper sets the neg cache and returns null. */
  getLinkedPlatform: () => Promise<LinkedPlatformRecord | null>;
  /**
   * Resolve a usable access token from the linked record, performing any
   * platform-specific token refresh + fire-and-forget side effects.
   * Return `null` to short-circuit (the helper returns null without fetching).
   */
  resolveAccessToken: (linked: LinkedPlatformRecord) => Promise<string | null>;
  /**
   * Fetch the platform stats with the resolved token. Returns `null` on
   * failure (the helper skips caching in that case).
   */
  fetchStats: (
    linked: LinkedPlatformRecord,
    accessToken: string,
  ) => Promise<StatsData | null>;
}

/**
 * Shared skeleton for "fetch a linked platform's stats from cache or live API".
 * Returns `null` when the platform is disabled, not linked, the token can't be
 * resolved, or the live fetch fails.
 *
 * Ordering, cache keys, TTLs, and neg-cache semantics are preserved exactly as
 * the original per-platform clients (#744).
 */
export async function fetchLinkedPlatformStats(
  config: FetchLinkedPlatformConfig,
): Promise<StatsData | null> {
  const cacheKey = `stats:v2:${config.platform}:${config.lowerHandle}`;
  const negKey = `${cacheKey}:neg`;

  const cached = await cacheGet<StatsData>(cacheKey);
  if (cached) return cached;

  const neg = await cacheGet<boolean>(negKey);
  if (neg) return null;

  const enabled = await config.isEnabled();
  if (!enabled) {
    void cacheSet(negKey, true, NEG_CACHE_TTL);
    return null;
  }

  const linked = await config.getLinkedPlatform();
  if (!linked) {
    void cacheSet(negKey, true, NEG_CACHE_TTL);
    return null;
  }

  const accessToken = await config.resolveAccessToken(linked);
  if (accessToken === null) return null;

  const stats = await withTimeout(
    config.fetchStats(linked, accessToken),
    PLATFORM_FETCH_DEADLINE_MS,
    `${config.platform} stats fetch`,
  ).catch(() => null);

  if (stats) {
    await cacheSet(cacheKey, stats, CACHE_TTL);
  }

  return stats;
}
