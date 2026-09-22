import "server-only";
import { createScoringWindow } from "@chapa/shared";
import type { StatsData, SupplementalStats, Platform } from "@chapa/shared";
import { fetchStats } from "./stats";
import { mergeStats } from "./merge";
import { getGithubToken } from "@/lib/env";
import { dbGetSupplemental } from "@/lib/db/supplemental";
import { fetchBitbucketIfLinked } from "@/lib/bitbucket/client";
import { fetchCodebergIfLinked } from "@/lib/codeberg/client";
import { fetchGitlabIfLinked } from "@/lib/gitlab/client";
import { createSourceContext } from "@/lib/platform/source-context";
import { readSourceAuthorization, sameSourceAuthorization } from "@/lib/platform/source-authorization";
import { refreshSourceLink } from "@/lib/platform/source-refresh";
import { withTimeout } from "@/lib/async/with-timeout";
import { statsCacheBinding, readCachedStats, writeCachedStats, readStatsNotFound, writeStatsNotFound } from "@/lib/cache/stats-cache";
import { githubUserNotFound, isGitHubUserNotFound, type GitHubUserNotFound } from "./not-found";
/** @public Compatibility export for v7 evidence consumers. */
export { selectSourceEvidence } from "@/lib/platform/source-collectors";

type StatsOutcome = StatsData | GitHubUserNotFound | null;
const inflight = new Map<string, Promise<StatsOutcome>>();
export function _resetInflight(): void { inflight.clear(); }
interface StatsOverlays {
  bitbucket: StatsData | null; codeberg: StatsData | null; gitlab: StatsData | null;
  supplemental: SupplementalStats | null; linkedPlatforms: Platform[]; linkedPlatformLogins: Record<string, string>;
}
const platforms = ["bitbucket", "codeberg", "gitlab"] as const;

/** Legacy v6 collection. Old handle-only cache rows carry no authorization
 * binding and are never read or written; the bound `stats:v3:` record is the
 * only cache. A read-only caller (`/api/profile/:handle`, the remote MCP tools)
 * is served that record when it was written under the caller's own binding,
 * and gets an honest miss otherwise: it never fetches, writes, refreshes a
 * grant, or joins the in-flight map. Scalars never become v7 source
 * observations.
 *
 * LE-8-2 — a handle GitHub says nobody owns comes back as the
 * `GitHubUserNotFound` sentinel rather than `null`. It is never written under
 * `stats:v3:` (that key holds stats only); a short `stats:notfound:` marker
 * spares GitHub the repeat hits, and reading it is a read, so the read-only
 * path sees it too. Every other failure is still `null`.
 */
export async function getStats(handle: string, token?: string, options: { readOnly?: boolean; referenceTime?: string } = {}): Promise<StatsOutcome> {
  try {
    const owner = handle.toLowerCase();
    const effectiveToken = token ?? getGithubToken();
    const window = createScoringWindow(options.referenceTime ?? new Date().toISOString());
    const context = createSourceContext({ owner, requestedSource: { provider: "github", host: "github.com", login: owner }, window,
      scope: { discovery: "legacy_upload", repositoryIds: [], eventKinds: [] } }, { kind: "github", token: effectiveToken ?? "" });
    const initial = await Promise.all(platforms.map(async provider => {
      const auth = await readSourceAuthorization(owner, provider, false);
      // A token refresh is a write. Read-only binds to the row as it is; an
      // expired grant is then a miss until the live path has refreshed it.
      return auth.status === "authorized" && !options.readOnly ? refreshSourceLink(auth, { owner, provider }, false) : auth;
    }));
    if (initial.some(source => source.status === "unavailable")) return null;
    const current = async () => {
      const after = await Promise.all(platforms.map(provider => readSourceAuthorization(owner, provider, false)));
      return initial.every((source, i) => source.status === "authorized" ? sameSourceAuthorization(source, after[i]!) : source.status === after[i]!.status);
    };
    // Each linked token is part of the private key through its exact row version.
    const links = initial.map(source => source.status === "authorized" ? [source.link?.id, source.link?.updatedAt].join(":") : source.status).join("|");
    // `selectionId` is an HMAC over the exact reference *instant*, so it is
    // unique per call and made both this map and any cache derived from it
    // dead. The binding below is stable for the same grant on the same scoring
    // day, which is what lets concurrent renders of one handle share a single
    // GitHub fetch instead of each paying ~10s for the same answer.
    const binding = statsCacheBinding({ accessContextId: context.accessContextId, links, referenceDate: window.referenceDate });
    if (options.readOnly) {
      // The same hit and the same `current()` re-check as the live path, and
      // nothing else. Not through `inflight`: a read-only entry there would
      // hand a live caller a miss without the fetch it came for.
      const cached = binding ? await readCachedStats(owner, binding, window.referenceDate) : null;
      if (cached) return await current() ? structuredClone(cached) : null;
      return await readStatsNotFound(owner) ? githubUserNotFound(owner) : null;
    }
    const key = binding ?? context.selectionId + ":" + links;
    let work = inflight.get(key);
    if (!work) {
      work = withTimeout((async () => {
        // A hit is still re-checked against `current()` below, exactly as a
        // live fetch is: the binding proves which grant produced the data, not
        // that the grant is still in force.
        const cached = binding ? await readCachedStats(owner, binding, window.referenceDate) : null;
        if (cached) return cached;
        if (await readStatsNotFound(owner)) return githubUserNotFound(owner);
        const primary = await context.collect(captured => fetchStats(owner, undefined, { resolvedCredential: { token: captured || null }, referenceTime: window.referenceTime }));
        if (isGitHubUserNotFound(primary)) { await writeStatsNotFound(owner); return primary; }
        if (!primary || !await current()) return null;
        const fetchers = [fetchBitbucketIfLinked, fetchCodebergIfLinked, fetchGitlabIfLinked];
        const linked = await Promise.all(fetchers.map((fetcher, i) => initial[i]!.status === "authorized" ? fetcher!(owner, owner) : null));
        // Connected but inaccessible sources cannot disappear from an aggregate.
        if (linked.some((stats, i) => initial[i]!.status === "authorized" && !stats)) return null;
        const supplemental = await dbGetSupplemental(owner);
        if (!await current()) return null;
        const linkedPlatforms: Platform[] = []; const linkedPlatformLogins: Record<string, string> = {};
        initial.forEach((source, i) => { if (source.status === "authorized" && source.link) { linkedPlatforms.push(platforms[i]!); linkedPlatformLogins[platforms[i]!] = source.link.remoteLogin; } });
        const composed = _compose(primary, { bitbucket: linked[0] ?? null, codeberg: linked[1] ?? null, gitlab: linked[2] ?? null, supplemental, linkedPlatforms, linkedPlatformLogins });
        // Best-effort: a cache write that fails must not fail the fetch that
        // already succeeded. `cacheSet` swallows its own errors already.
        if (binding) await writeCachedStats(owner, binding, window.referenceDate, composed);
        return composed;
      })(), 30_000, "Legacy source collection").catch(() => null);
      inflight.set(key, work);
      void work.finally(() => { if (inflight.get(key) === work) inflight.delete(key); }).catch(() => undefined);
    }
    const result = await work;
    if (isGitHubUserNotFound(result)) return result;
    return result && await current() ? structuredClone(result) : null;
  } catch { return null; }
}

export function _compose(
  githubDerived: StatsData,
  overlays: StatsOverlays,
): StatsData {
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

  // The identity of the GitHub-derived source, restated from the ORIGINAL
  // operand rather than inherited through the fold. Only when something
  // actually merged: with no overlays `stats` IS `githubDerived`, the fields
  // are trivially correct, and restating them would add keys that a
  // never-merged value does not carry.
  if (
    overlays.bitbucket ||
    overlays.codeberg ||
    overlays.gitlab ||
    overlays.supplemental
  ) {
    stats = {
      ...stats,
      fetchScope: githubDerived.fetchScope,
      primaryReviewsSubmittedCount:
        githubDerived.primaryReviewsSubmittedCount ??
        githubDerived.reviewsSubmittedCount,
      hasSupplementalData:
        Boolean(overlays.supplemental) ||
        (githubDerived.hasSupplementalData ?? false),
    };
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
