import { fetchStats } from "./stats";
import { mergeStats } from "./merge";
import { isDegradedPrFetch } from "./stats-integrity";
import { captureServerEvent } from "@/lib/analytics/server-errors";
import { cacheGet, cacheSet } from "../cache/redis";
import { dbUpsertUser } from "@/lib/db/users";
import { dbGetSupplemental } from "@/lib/db/supplemental";
import { isBitbucketEnabled, isCodebergEnabled, isGitlabEnabled } from "@/lib/feature-flags";
import { dbGetLinkedPlatform } from "@/lib/db/user-platforms";
import { fetchBitbucketIfLinked } from "@/lib/bitbucket/client";
import { fetchCodebergIfLinked } from "@/lib/codeberg/client";
import { fetchGitlabIfLinked } from "@/lib/gitlab/client";
import { fireAndForget } from "@/lib/async/fire-and-forget";
import { withTimeout } from "@/lib/async/with-timeout";
import type { StatsData, SupplementalStats, Platform } from "@chapa/shared";

const CACHE_TTL = 21600; // 6 hours
const STALE_TTL = 604800; // 7 days
const SUPPLEMENTAL_TTL = 86400; // 24h — must match POST /api/supplemental
// Maximum time an in-flight fetch is allowed to hang before it is abandoned.
// Without this limit, a fetch that hangs (e.g. GitHub API never responds) would
// occupy the _inflight slot forever, blocking all subsequent requests for that
// handle from ever retrying. The timeout causes the promise to reject, the
// finally() cleanup fires, and future callers get a fresh attempt.
const INFLIGHT_TIMEOUT_MS = 30_000;

// In-flight request deduplication map.
// Prevents concurrent calls for the same handle/auth context from making
// duplicate API calls. Public callers may reuse an authenticated in-flight
// fetch because it produces a safe superset of the public result.
const _inflight = new Map<string, Promise<StatsData | null>>();

/** @internal — exported for tests only. Resets the inflight map. */
export function _resetInflight(): void {
  _inflight.clear();
}

/**
 * Get StatsData for a user — cache-first, then GitHub + linked platforms.
 * Returns cached data if available (within 6h).
 * Falls back to live fetch on cache miss.
 * If the API fails (e.g. rate limit 403), returns stale cached data (7d TTL) if available.
 * If Bitbucket / Codeberg / GitLab are linked, fetches and merges their data.
 * If supplemental data exists (e.g. from an EMU upload), merges it into the result.
 *
 * Concurrent calls for the same handle are deduplicated — only one GitHub API
 * call is made and all callers share the same promise.
 */
export async function getStats(
  handle: string,
  token?: string,
  options: { readOnly?: boolean } = {},
): Promise<StatsData | null> {
  const lowerHandle = handle.toLowerCase();
  const cacheKey = `stats:v2:merged:${lowerHandle}`;
  const mode = options.readOnly ? "readonly" : "write";
  const publicInflightKey = `${lowerHandle}:public:${mode}`;
  const authenticatedInflightKey = `${lowerHandle}:authenticated:${mode}`;
  const inflightKey = token ? authenticatedInflightKey : publicInflightKey;

  // Try primary cache first (no dedup needed for cache hits)
  const cached = await cacheGet<StatsData>(cacheKey);
  if (cached) {
    return _enrichWithLogins(
      cached,
      handle,
      options.readOnly ? undefined : cacheKey,
    );
  }

  // Public callers can share an authenticated fetch. Authenticated callers
  // must not reuse a weaker public fetch.
  const existing = token
    ? _inflight.get(authenticatedInflightKey)
    : _inflight.get(authenticatedInflightKey) ?? _inflight.get(publicInflightKey);
  if (existing) return existing;

  // Create the fetch promise, wrap it with a timeout, and store it for
  // deduplication. The timeout ensures the _inflight slot is always cleaned up
  // even if the underlying fetch hangs indefinitely (e.g. GitHub never responds).
  // A timed-out promise resolves to null via the catch below, which causes the
  // caller to fall back to stale cache exactly as a failed API call would.
  const rawPromise = _fetchAndCache(handle, lowerHandle, cacheKey, token, {
    readOnly: options.readOnly,
  });
  const promise = withTimeout(rawPromise, INFLIGHT_TIMEOUT_MS, `getStats(${handle})`).catch(
    (err) => {
      console.error(`[github] inflight fetch timed out for ${handle}:`, err);
      return null;
    },
  );
  _inflight.set(inflightKey, promise);

  // Clean up the inflight entry when done (success, failure, or timeout)
  promise.finally(() => {
    _inflight.delete(inflightKey);
  });

  return promise;
}

/**
 * Enrich cached stats with linkedPlatformLogins if missing.
 * Handles pre-deploy cached data that has linkedPlatforms but no logins.
 *
 * PE-L2: When enrichment produces logins, write the enriched stats back to
 * the stats cache key so subsequent hits skip the N DB reads entirely.
 * The write is fire-and-forget — it must not block the response.
 *
 * @param cacheKey - The Redis key to backfill on enrichment (omit to skip backfill)
 */
async function _enrichWithLogins(
  stats: StatsData,
  handle: string,
  cacheKey?: string,
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

  if (Object.keys(logins).length === 0) {
    return stats;
  }

  const enriched = { ...stats, linkedPlatformLogins: logins };

  // PE-L2: Backfill the enriched stats into the cache so subsequent hits
  // return pre-enriched data and skip the DB reads. Fire-and-forget.
  if (cacheKey) {
    fireAndForget(
      () => cacheSet(cacheKey, enriched, CACHE_TTL),
      () => undefined,
    );
  }

  return enriched;
}

/** Internal: fetch from GitHub, merge Bitbucket + Codeberg + supplemental, cache. */
async function _fetchAndCache(
  handle: string,
  lowerHandle: string,
  cacheKey: string,
  token?: string,
  options: { readOnly?: boolean } = {},
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

  // Fetch Bitbucket + Codeberg + GitLab in parallel — error in one must not block the others
  const [bbResult, cbResult, glResult] = options.readOnly
    ? [
        { status: "fulfilled", value: null },
        { status: "fulfilled", value: null },
        { status: "fulfilled", value: null },
      ] as const
    : await Promise.allSettled([
        fetchBitbucketIfLinked(handle, lowerHandle),
        fetchCodebergIfLinked(handle, lowerHandle),
        fetchGitlabIfLinked(handle, lowerHandle),
      ]);

  const bbStats = bbResult.status === "fulfilled" ? bbResult.value : null;
  const cbStats = cbResult.status === "fulfilled" ? cbResult.value : null;
  const glStats = glResult.status === "fulfilled" ? glResult.value : null;

  // Merge Bitbucket into primary (markAsSupplemental: false — linked platform, not EMU)
  let stats: StatsData = bbStats
    ? mergeStats(primary, bbStats, { markAsSupplemental: false })
    : primary;

  // Merge Codeberg into current stats
  if (cbStats) {
    stats = mergeStats(stats, cbStats, { markAsSupplemental: false });
  }

  // Merge GitLab into current stats
  if (glStats) {
    stats = mergeStats(stats, glStats, { markAsSupplemental: false });
  }

  // Check for supplemental data (e.g. EMU account). Redis is the hot path
  // with a 24h TTL; Supabase (#825) is the durable fallback so a missed CLI
  // upload day no longer silently drops EMU stats from scores. On a Redis
  // miss + DB hit, we rehydrate Redis so subsequent reads stay fast.
  const supplementalKey = `supplemental:${lowerHandle}`;
  const cachedSupplemental = await cacheGet<SupplementalStats>(supplementalKey);
  let supplemental: SupplementalStats | null = cachedSupplemental;
  if (!supplemental) {
    const persisted = await dbGetSupplemental(lowerHandle);
    if (persisted) {
      supplemental = persisted;
      if (!options.readOnly) {
        fireAndForget(
          () => cacheSet(supplementalKey, persisted, SUPPLEMENTAL_TTL),
          () => undefined,
        );
      }
    }
  }
  if (supplemental) {
    stats = mergeStats(stats, supplemental.stats);
  }

  // Build linkedPlatforms from DB link status (source of truth), not stats fetch
  // success. Platforms appear in Data Sources even when their stats fetch
  // temporarily fails (expired token, API error). Fixes #632.
  const [bbDbLink, cbDbLink, glDbLink] = await Promise.all([
    bbStats ? null : isBitbucketEnabled().then((ok) =>
      ok ? dbGetLinkedPlatform(handle, "bitbucket") : null,
    ),
    cbStats ? null : isCodebergEnabled().then((ok) =>
      ok ? dbGetLinkedPlatform(handle, "codeberg") : null,
    ),
    glStats ? null : isGitlabEnabled().then((ok) =>
      ok ? dbGetLinkedPlatform(handle, "gitlab") : null,
    ),
  ]);

  const linkedPlatforms: Platform[] = [];
  if (bbStats || bbDbLink) linkedPlatforms.push("bitbucket");
  if (cbStats || cbDbLink) linkedPlatforms.push("codeberg");
  if (glStats || glDbLink) linkedPlatforms.push("gitlab");

  if (linkedPlatforms.length > 0) {
    // bbDbLink/cbDbLink/glDbLink already have remoteLogin; only re-fetch for stats-path
    const [bbLogin, cbLogin, glLogin] = await Promise.all([
      bbDbLink ?? (bbStats ? dbGetLinkedPlatform(handle, "bitbucket") : null),
      cbDbLink ?? (cbStats ? dbGetLinkedPlatform(handle, "codeberg") : null),
      glDbLink ?? (glStats ? dbGetLinkedPlatform(handle, "gitlab") : null),
    ]);
    const linkedPlatformLogins: Record<string, string> = {};
    if (bbLogin) linkedPlatformLogins.bitbucket = bbLogin.remoteLogin;
    if (cbLogin) linkedPlatformLogins.codeberg = cbLogin.remoteLogin;
    if (glLogin) linkedPlatformLogins.gitlab = glLogin.remoteLogin;

    stats = {
      ...stats,
      linkedPlatforms,
      ...(Object.keys(linkedPlatformLogins).length > 0 && { linkedPlatformLogins }),
    };
  }

  // #1002 — Guard against a viewer-scoped fetch that lost merged-PR visibility.
  // The GitHub contributionsCollection is scoped to the authenticating token:
  // a token that cannot see a user's private-repo merges (server GITHUB_TOKEN
  // in the warm-cache cron, or an anonymous badge request) returns
  // prsMergedCount=0 even when the user has hundreds of merged PRs. Caching
  // that result collapses Delivery (PR weight is 70% of it) and flips
  // profileType to "collaborative". If the fresh result lost PR data relative
  // to last-known-good, serve the good stale data and do NOT overwrite the
  // stale key — otherwise a corrupt zero poisons the very fallback meant to
  // protect against it.
  if (isDegradedPrFetch(stats, stale)) {
    console.warn(
      `[github] degraded PR fetch for ${lowerHandle} ` +
        `(prsMergedCount 0, last-known-good ${stale!.prsMergedCount}) — ` +
        `serving last-known-good, not overwriting stale cache`,
    );
    fireAndForget(
      () =>
        captureServerEvent("github_degraded_pr_fetch", {
          handle: lowerHandle,
          freshPrsMergedCount: stats.prsMergedCount,
          stalePrsMergedCount: stale!.prsMergedCount,
          freshCommitsTotal: stats.commitsTotal,
          authenticated: Boolean(token),
        }),
      () => undefined,
    );
    if (!options.readOnly) {
      // Refresh only the primary key with the good data so we serve fast and
      // avoid refetch-thrash while upstream stays degraded. The stale key —
      // the protected last-known-good — is left untouched.
      await cacheSet(cacheKey, stale!, CACHE_TTL);
    }
    return stale!;
  }

  if (options.readOnly) {
    return stats;
  }

  // Cache the final (possibly merged) result — both primary and stale fallback
  await cacheSet(cacheKey, stats, CACHE_TTL);
  await cacheSet(staleKey, stats, STALE_TTL);

  // Record in permanent user registry (fire-and-forget)
  fireAndForget(() => dbUpsertUser(handle), () => undefined);

  return stats;
}
