import { fetchStats } from "./stats";
import { mergeStats } from "./merge";
import { isDegradedPrFetch } from "./stats-integrity";
import { OAUTH_GRANTS_PRIVATE_REPO_ACCESS } from "@/lib/auth/github";
import { getGithubToken } from "@/lib/env";
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
// duplicate API calls. Lower-visibility callers may reuse a private-inclusive
// in-flight fetch because it produces a safe superset of their result.
const _inflight = new Map<string, Promise<StatsData | null>>();

/**
 * Rank a fetch's effective visibility for the non-downgrading cache-write
 * rule (#1004, phase 2). `authenticated` means private-inclusive (currently
 * the repo-scoped server `GITHUB_TOKEN`), while `public` includes the user's
 * scope-blind OAuth session token. An untagged legacy entry is treated as the
 * weakest scope so it never blocks a fresh write.
 */
function scopeRank(scope: StatsData["fetchScope"]): number {
  return scope === "authenticated" ? 2 : 1;
}

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
 *
 * `readOnly: true` never writes to the cache AND (#1083) never issues a live
 * GitHub fetch on a cold key either — it serves the protected last-known-good
 * baseline (or null if none exists yet). Without this, a public, rate-limited-
 * only-by-IP caller (`/api/profile/:handle`) would repeat the same live
 * GitHub GraphQL call on every request past the 6h primary TTL, since a
 * readOnly fetch could never populate the cache to stop the next one.
 */
export async function getStats(
  handle: string,
  token?: string,
  options: { readOnly?: boolean } = {},
): Promise<StatsData | null> {
  const lowerHandle = handle.toLowerCase();
  const cacheKey = `stats:v2:merged:${lowerHandle}`;

  // Try primary cache first (no dedup needed for cache hits)
  const cached = await cacheGet<StatsData>(cacheKey);
  if (cached) {
    return _enrichWithLogins(
      cached,
      handle,
      options.readOnly ? undefined : cacheKey,
    );
  }

  if (options.readOnly) {
    return _composeFromBaselineOnly(handle, lowerHandle);
  }

  const publicInflightKey = `${lowerHandle}:public`;
  const authenticatedInflightKey = `${lowerHandle}:authenticated`;
  const isPrivateInclusive =
    (token && OAUTH_GRANTS_PRIVATE_REPO_ACCESS) || (!token && Boolean(getGithubToken()));
  const inflightKey = isPrivateInclusive ? authenticatedInflightKey : publicInflightKey;

  // Lower-visibility callers can share a private-inclusive fetch. A
  // private-inclusive caller must not reuse a scope-blind fetch.
  const existing = isPrivateInclusive
    ? _inflight.get(authenticatedInflightKey)
    : _inflight.get(authenticatedInflightKey) ?? _inflight.get(publicInflightKey);
  if (existing) return existing;

  // Create the fetch promise, wrap it with a timeout, and store it for
  // deduplication. The timeout ensures the _inflight slot is always cleaned up
  // even if the underlying fetch hangs indefinitely (e.g. GitHub never responds).
  // A timed-out promise resolves to null via the catch below, which causes the
  // caller to fall back to stale cache exactly as a failed API call would.
  const rawPromise = _fetchAndCache(handle, lowerHandle, cacheKey, token);
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
 * #1083 — Serve a read-only caller's cold-key request from the protected
 * baseline only, with no live GitHub call. `_loadOverlays(..., true)` is the
 * same readOnly-safe overlay path already used by the write path's readOnly
 * short-circuit before this fix: Redis/DB reads only, no linked-platform
 * network calls. Returns null when no baseline exists yet (a handle that has
 * never been fetched by a write-mode caller — badge route, warm-cache cron,
 * refresh) — callers of a readOnly fetch already tolerate a null result.
 */
async function _composeFromBaselineOnly(
  handle: string,
  lowerHandle: string,
): Promise<StatsData | null> {
  const baselineKey = `stats:stale:v2:${lowerHandle}`;
  const baseline = await cacheGet<StatsData>(baselineKey);
  if (!baseline) return null;
  const overlays = await _loadOverlays(handle, lowerHandle, true);
  return _compose(baseline, overlays);
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

// ---------------------------------------------------------------------------
// GitHub-derived vs composed stats (#1060, #1061)
//
// Two distinct roles, deliberately never conflated:
//
//   GitHub-derived — the raw `fetchStats` output. Its completeness depends on
//     the authenticating token's scope, so it is the ONLY thing the integrity
//     guards may inspect or use as a baseline. Stored at `stats:stale:v2:`.
//
//   Composed — GitHub-derived with linked platforms (Bitbucket/Codeberg/GitLab)
//     and EMU supplemental layered on top. What callers receive, and what
//     `stats:v2:merged:` stores.
//
// The invariant: the guards only ever see `primary`; everything else composes
// onto whichever GitHub-derived value wins. Before #1060 the supplemental was
// merged *before* the guards, which meant (a) a rejected fetch re-cached a
// baseline that had never seen the current supplemental, silently dropping an
// EMU merge for 6h, and (b) a large supplemental could lift a scope-blinded
// GitHub fetch over both of `isDegradedPrFetch`'s detection signatures.
//
// A future fourth data source belongs in `_compose`, never in the guard input.
// ---------------------------------------------------------------------------

/** Sources that are NOT GitHub-token-scoped, and therefore never guard inputs. */
interface StatsOverlays {
  bitbucket: StatsData | null;
  codeberg: StatsData | null;
  gitlab: StatsData | null;
  supplemental: SupplementalStats | null;
  linkedPlatforms: Platform[];
  linkedPlatformLogins: Record<string, string>;
}

/**
 * Classify what the fetch could actually see (#1004, corrected by #1050).
 *
 * `fetchScope` means "was this fetch private-inclusive?", NOT "was a token
 * object present?". #1004 conflated the two — `token ? "authenticated" :
 * "public"` — and that inverted the ranking against reality:
 *
 *   anonymous badge hit -> no session token -> queries.ts falls back to the
 *     server GITHUB_TOKEN, which holds `repo` scope -> sees private merges
 *     -> was labelled "public"        (rank 1)
 *   user's own refresh -> session OAuth token, scoped `read:user user:email`
 *     with NO `repo` -> cannot see private repos at all
 *     -> was labelled "authenticated" (rank 2)
 *
 * Since scopeRank ranks authenticated above public, the blinded fetch
 * outranked the complete one and overwrote it. Verified against the live API:
 * 987 merged PRs with `repo`, 140 without. A user clicking Refresh on their
 * own profile collapsed their own Delivery 100 -> 58.
 *
 * Corrected mapping — label by what the fetch could actually see:
 *
 *   session token + OAuth grants `repo`  -> private-inclusive
 *     Today OAUTH_SCOPES omits `repo`, so this is false. Derived from the same
 *     constant rather than restated, so adding `repo` to the OAuth app updates
 *     this in the same edit instead of drifting.
 *
 *   no session token + server GITHUB_TOKEN configured -> private-inclusive
 *     queries.ts resolves `token ?? getGithubToken()`, so a tokenless call
 *     authenticates as the server PAT, which holds `repo`. GitHub's GraphQL
 *     API rejects unauthenticated requests outright (403), so a fetch that
 *     returned data without a session token necessarily used this token.
 *     `/api/health` asserts that token still carries `repo` (#1047), so this
 *     assumption is monitored rather than assumed silently.
 *
 *   neither -> public
 */
function _classifyScope(token?: string): StatsData["fetchScope"] {
  const usedPrivateInclusiveServerToken = !token && Boolean(getGithubToken());
  return (token && OAUTH_GRANTS_PRIVATE_REPO_ACCESS) || usedPrivateInclusiveServerToken
    ? "authenticated"
    : "public";
}

/**
 * Load supplemental (e.g. EMU account) data for a handle. Redis is the hot
 * path with a 24h TTL; Supabase (#825) is the durable fallback so a missed
 * CLI upload day no longer silently drops EMU stats from scores. On a Redis
 * miss + DB hit, we rehydrate Redis so subsequent reads stay fast.
 *
 * Extracted from `_loadOverlays` (#1087 / PE-H2) so it can run concurrently
 * with the platform fetches — the two have no data dependency on each other.
 */
async function _loadSupplemental(
  lowerHandle: string,
  readOnly: boolean | undefined,
): Promise<SupplementalStats | null> {
  const supplementalKey = `supplemental:${lowerHandle}`;
  const cached = await cacheGet<SupplementalStats>(supplementalKey);
  if (cached) return cached;

  const persisted = await dbGetSupplemental(lowerHandle);
  if (persisted && !readOnly) {
    fireAndForget(
      () => cacheSet(supplementalKey, persisted, SUPPLEMENTAL_TTL),
      () => undefined,
    );
  }
  return persisted;
}

/**
 * Load every non-GitHub source for a handle. Called on every path — including
 * total GitHub-fetch failure — so that whichever GitHub-derived value is served
 * is always composed from the same, current overlay inputs. Serving a
 * GitHub-derived baseline without re-composition would drop EMU and linked
 * platform data during a GitHub outage.
 */
async function _loadOverlays(
  handle: string,
  lowerHandle: string,
  readOnly: boolean | undefined,
): Promise<StatsOverlays> {
  // Platform fetches and the supplemental lookup have zero data dependency on
  // each other (#1087 / PE-H2) — kick both waves off together rather than
  // sequencing the supplemental lookup strictly after the platform fetches
  // settle. An error in one platform fetch must not block the others.
  const platformFetches: Promise<
    readonly [
      PromiseSettledResult<StatsData | null>,
      PromiseSettledResult<StatsData | null>,
      PromiseSettledResult<StatsData | null>,
    ]
  > = readOnly
    ? Promise.resolve([
        { status: "fulfilled", value: null },
        { status: "fulfilled", value: null },
        { status: "fulfilled", value: null },
      ] as const)
    : Promise.allSettled([
        fetchBitbucketIfLinked(handle, lowerHandle),
        fetchCodebergIfLinked(handle, lowerHandle),
        fetchGitlabIfLinked(handle, lowerHandle),
      ]);

  const [[bbResult, cbResult, glResult], supplemental] = await Promise.all([
    platformFetches,
    _loadSupplemental(lowerHandle, readOnly),
  ]);

  const bitbucket = bbResult.status === "fulfilled" ? bbResult.value : null;
  const codeberg = cbResult.status === "fulfilled" ? cbResult.value : null;
  const gitlab = glResult.status === "fulfilled" ? glResult.value : null;

  // Build linkedPlatforms from DB link status (source of truth), not stats
  // fetch success. Platforms appear in Data Sources even when their stats fetch
  // temporarily fails (expired token, API error). Fixes #632.
  //
  // #1093 (PE-L2): fetch the link row exactly once per platform, in this one
  // wave. A platform whose stats fetch already succeeded fetches its link row
  // unconditionally (no enabled-flag gate — a successful fetch already proves
  // it's linked) and needs it anyway to resolve the login below; a platform
  // whose stats fetch failed still gates on the enabled flag first. Either way
  // the query starts here, concurrently with every other platform's lookup —
  // previously the succeeded-fetch branch skipped this wave and re-queried in
  // a second, strictly-later wave that serialized behind the other platforms'
  // (unrelated) enabled-flag checks for no reason.
  const [bbDbLink, cbDbLink, glDbLink] = await Promise.all([
    bitbucket
      ? dbGetLinkedPlatform(handle, "bitbucket")
      : isBitbucketEnabled().then((ok) =>
          ok ? dbGetLinkedPlatform(handle, "bitbucket") : null,
        ),
    codeberg
      ? dbGetLinkedPlatform(handle, "codeberg")
      : isCodebergEnabled().then((ok) =>
          ok ? dbGetLinkedPlatform(handle, "codeberg") : null,
        ),
    gitlab
      ? dbGetLinkedPlatform(handle, "gitlab")
      : isGitlabEnabled().then((ok) =>
          ok ? dbGetLinkedPlatform(handle, "gitlab") : null,
        ),
  ]);

  const linkedPlatforms: Platform[] = [];
  if (bitbucket || bbDbLink) linkedPlatforms.push("bitbucket");
  if (codeberg || cbDbLink) linkedPlatforms.push("codeberg");
  if (gitlab || glDbLink) linkedPlatforms.push("gitlab");

  const linkedPlatformLogins: Record<string, string> = {};
  if (bbDbLink) linkedPlatformLogins.bitbucket = bbDbLink.remoteLogin;
  if (cbDbLink) linkedPlatformLogins.codeberg = cbDbLink.remoteLogin;
  if (glDbLink) linkedPlatformLogins.gitlab = glDbLink.remoteLogin;

  return {
    bitbucket,
    codeberg,
    gitlab,
    supplemental,
    linkedPlatforms,
    linkedPlatformLogins,
  };
}

/**
 * Layer every non-GitHub source onto a GitHub-derived value.
 *
 * `mergeStats` preserves the left operand's identity fields — including
 * `fetchScope` (merge.ts) — so the composed result always carries the scope of
 * the GitHub-derived value it was built from, with no post-hoc mutation.
 */
function _compose(githubDerived: StatsData, overlays: StatsOverlays): StatsData {
  let stats = githubDerived;

  // markAsSupplemental: false — a linked platform is a first-party source, not
  // an EMU merge, and must not set `hasSupplementalData`.
  if (overlays.bitbucket) {
    stats = mergeStats(stats, overlays.bitbucket, { markAsSupplemental: false });
  }
  if (overlays.codeberg) {
    stats = mergeStats(stats, overlays.codeberg, { markAsSupplemental: false });
  }
  if (overlays.gitlab) {
    stats = mergeStats(stats, overlays.gitlab, { markAsSupplemental: false });
  }
  if (overlays.supplemental) {
    stats = mergeStats(stats, overlays.supplemental.stats);
  }

  if (overlays.linkedPlatforms.length > 0) {
    stats = {
      ...stats,
      linkedPlatforms: overlays.linkedPlatforms,
      ...(Object.keys(overlays.linkedPlatformLogins).length > 0 && {
        linkedPlatformLogins: overlays.linkedPlatformLogins,
      }),
    };
  }

  return stats;
}

/**
 * Internal: fetch from GitHub, guard, compose overlays, cache.
 *
 * Write-mode only (#1083) — `getStats` short-circuits `readOnly` callers to
 * `_composeFromBaselineOnly` before ever reaching this function, so every
 * write here is safe to perform unconditionally.
 */
async function _fetchAndCache(
  handle: string,
  lowerHandle: string,
  cacheKey: string,
  token?: string,
): Promise<StatsData | null> {
  // #1060 — the protected baseline holds GitHub-derived data ONLY, so that the
  // guards below compare like against like. Versioned to `v2` because pre-#1060
  // entries at `stats:stale:` held fully composed data; judging a GitHub-derived
  // fetch against one of those would misfire on exactly the EMU users this
  // change is meant to protect.
  const baselineKey = `stats:stale:v2:${lowerHandle}`;

  // Read the baseline before the fetch, so it is available if the fetch fails.
  const baseline = await cacheGet<StatsData>(baselineKey);

  // #1087 (PE-H2) — `_loadOverlays` has zero data dependency on `primary`, so
  // the two most expensive network legs on this path (GitHub GraphQL and the
  // linked-platform fetches) run concurrently rather than back-to-back. This
  // is safe for the integrity contract precisely because every guard below
  // (`isDegradedPrFetch`, the scope-rank comparison) closes over `primary` and
  // `baseline` only — never `overlays` — and `_compose` still runs strictly
  // after both legs have settled, onto whichever GitHub-derived value the
  // guards select. Overlay data is never visible to the guards, regardless of
  // how quickly or slowly it resolves relative to the GitHub fetch.
  const [primary, overlays] = await Promise.all([
    fetchStats(handle, token),
    _loadOverlays(handle, lowerHandle, false),
  ]);

  if (!primary) {
    // API failed (rate limit, network error, etc.) — serve the baseline,
    // re-composed with current overlays so an outage never drops EMU or
    // linked-platform data. The baseline key itself is left untouched.
    if (!baseline) return null;
    console.warn(`[cache] serving stale data for ${lowerHandle} (API unavailable)`);
    const composed = _compose(baseline, overlays);
    // Refresh only the primary key (6h TTL) so a sustained upstream problem
    // doesn't cause a refetch on every subsequent request.
    await cacheSet(cacheKey, composed, CACHE_TTL);
    return composed;
  }

  primary.fetchScope = _classifyScope(token);

  let rejected = false;

  // #1002/#1045 — Guard against a viewer-scoped fetch that lost merged-PR
  // visibility. GitHub's contributionsCollection is scoped to the
  // authenticating token: a token that cannot see a user's private-repo merges
  // (per #1050 that's the user's own session token — OAUTH_SCOPES omits `repo`
  // — not the server GITHUB_TOKEN) can return zero or a severe shortfall
  // relative to the private-inclusive baseline. Caching that collapses Delivery
  // (PR weight is 70% of it) and may flip profileType to "collaborative".
  //
  // Both operands are GitHub-derived: composing the supplemental first would
  // let an EMU contribution mask the shortfall (#1061).
  if (isDegradedPrFetch(primary, baseline)) {
    console.warn(
      `[github] degraded PR fetch for ${lowerHandle} ` +
        `(prsMergedCount ${primary.prsMergedCount}, last-known-good ${baseline!.prsMergedCount}) — ` +
        `serving last-known-good, not overwriting the baseline`,
    );
    fireAndForget(
      () =>
        captureServerEvent("github_degraded_pr_fetch", {
          handle: lowerHandle,
          freshPrsMergedCount: primary.prsMergedCount,
          stalePrsMergedCount: baseline!.prsMergedCount,
          freshCommitsTotal: primary.commitsTotal,
          // The classified scope of this fetch, not merely whether a token
          // object was present — the pre-#1050 notion mislabelled which
          // fetches were private-inclusive.
          fetchScope: primary.fetchScope,
        }),
      () => undefined,
    );
    rejected = true;
  }

  // #1004 phase 2 — a lower-scope fetch must never downgrade a better-scoped
  // entry. `getStats` already confirmed a miss on `cacheKey`, but the public and
  // authenticated fetch paths for the same handle dedup under separate inflight
  // keys, so both scopes can run concurrently; re-reading `cacheKey` here
  // catches an authenticated write that landed in the meantime. #1046: that
  // re-read alone cannot carry the rule (it is null by construction on every
  // non-racing call), so the durable baseline is consulted too — whichever is
  // better-scoped wins.
  const existingComposed = await cacheGet<StatsData>(cacheKey);
  const bestKnownScopeRank = Math.max(
    scopeRank(existingComposed?.fetchScope),
    scopeRank(baseline?.fetchScope),
  );
  if (scopeRank(primary.fetchScope) < bestKnownScopeRank) {
    rejected = true;
  }

  // A rejected fetch falls back to the protected baseline; overlays are layered
  // onto whichever value wins, so a rejection is never destructive for a
  // non-GitHub source (#1060).
  const accepted = !rejected;
  const base = accepted ? primary : (baseline ?? primary);
  const composed = _compose(base, overlays);

  // A rejected fetch with no baseline to fall back on has nothing better to
  // offer the shared cache, so it writes nothing rather than persisting a
  // downgrade — the caller still receives its own composed data below.
  if (accepted || baseline != null) {
    await cacheSet(cacheKey, composed, CACHE_TTL);
  }

  // Only a fetch accepted on its own merits may become the new baseline, and
  // only its GitHub-derived half is stored there.
  if (accepted) {
    await cacheSet(baselineKey, primary, STALE_TTL);
  }

  // Record in permanent user registry (fire-and-forget)
  fireAndForget(() => dbUpsertUser(handle), () => undefined);

  return composed;
}
