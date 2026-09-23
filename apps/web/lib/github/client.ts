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
import { readSourceAuthorization, sameSourceAuthorization, type SourceAuthorization } from "@/lib/platform/source-authorization";
import { refreshSourceLink } from "@/lib/platform/source-refresh";
import { withTimeout } from "@/lib/async/with-timeout";
import { statsCacheBinding, readCachedStats, type CachedStatsRead, writeCachedStats, readStatsNotFound, writeStatsNotFound } from "@/lib/cache/stats-cache";
import { githubUserNotFound, isGitHubUserNotFound, type GitHubUserNotFound } from "./not-found";
/** @public Compatibility export for v7 evidence consumers. */
export { selectSourceEvidence } from "@/lib/platform/source-collectors";

type StatsOutcome = StatsData | GitHubUserNotFound | null;

/**
 * The detailed result behind `getStats`. The profile materializer
 * (`lib/profile/materialize-profile.ts`) reads this directly (rather than
 * the collapsed `StatsOutcome`) so it can carry `current`/`stale` through
 * publication gates instead of treating a last-known-good serve the same as
 * a fresh one.
 */
export type StatsRead =
  | { readonly status: "current" | "stale"; readonly stats: StatsData; readonly capturedAt: string }
  | { readonly status: "not_found"; readonly value: GitHubUserNotFound }
  | { readonly status: "unavailable" };

type CollectOutcome =
  | { readonly kind: "current"; readonly stats: StatsData; readonly capturedAt: string }
  | { readonly kind: "not_found"; readonly value: GitHubUserNotFound }
  | { readonly kind: "failed" };

const inflight = new Map<string, Promise<CollectOutcome>>();
export function _resetInflight(): void { inflight.clear(); }
interface StatsOverlays {
  bitbucket: StatsData | null; codeberg: StatsData | null; gitlab: StatsData | null;
  supplemental: SupplementalStats | null; linkedPlatforms: Platform[]; linkedPlatformLogins: Record<string, string>;
}
const platforms = ["bitbucket", "codeberg", "gitlab"] as const;

/**
 * Legacy v6 collection, exact-bound with a fresh/stale last-known-good
 * fallback (badge-source-outage-resilience, 2026-09-22).
 *
 * The production incident this fixes: one linked source's token refresh hit
 * an ambiguous, durably-claimed "busy" outcome (`refreshSourceLink` mapping
 * a concurrent/unknown provider result to `unavailable` rather than ever
 * retrying it — see `source-refresh.ts`). The old single-pass shape read and
 * refreshed authorization together *before* ever consulting the cache, so
 * that one ambiguous refresh turned a handle with a perfectly good aggregate
 * from minutes earlier into a hard `null` — the badge's generic load-error
 * artifact — even though nothing about the underlying grants had actually
 * changed.
 *
 * The fix reorders the seam into three phases:
 *
 * 1. Read every linked source's authorization RAW — never refreshing — and
 *    bind the cache key to that raw state. A `fresh` hit under that binding
 *    is returned immediately with no provider call at all.
 * 2. Only a live (non-read-only) caller with no fresh hit proceeds to refresh
 *    each raw-authorized link. If refresh fails for any of them, the raw
 *    binding's cache entry is tried again as `stale` — served only when the
 *    raw authorization is still EXACTLY what it was — rather than discarding
 *    a connected source or returning nothing.
 * 3. A successful refresh may change a link's `updatedAt` (and so the
 *    binding); the binding is rebuilt from the refreshed state and re-read
 *    for a `fresh` hit before falling through to live collection. Collection
 *    failures follow the identical last-known-good rule, keyed to whichever
 *    binding the collection actually ran under.
 *
 * A `readOnly` caller (`/api/profile/:handle`, the remote MCP tools) never
 * reaches step 2 or 3: it is served a `fresh` or `stale` hit under its own
 * raw binding, or an honest miss — no refresh, no provider/GitHub fetch, no
 * cache write, no inflight join, exactly as before this change.
 *
 * LE-8-2 — a handle GitHub says nobody owns comes back as the
 * `GitHubUserNotFound` sentinel rather than `null`. It is never written under
 * `stats:v3:` (that key holds stats only); a short `stats:notfound:` marker
 * spares GitHub the repeat hits, and reading it is a read, so the read-only
 * path sees it too. Every other failure is still `unavailable`.
 */
export async function readStats(handle: string, token?: string, options: { readOnly?: boolean; referenceTime?: string } = {}): Promise<StatsRead> {
  try {
    const owner = handle.toLowerCase();
    const effectiveToken = token ?? getGithubToken();
    const window = createScoringWindow(options.referenceTime ?? new Date().toISOString());
    const context = createSourceContext({ owner, requestedSource: { provider: "github", host: "github.com", login: owner }, window,
      scope: { discovery: "legacy_upload", repositoryIds: [], eventKinds: [] } }, { kind: "github", token: effectiveToken ?? "" });

    // Each linked token is part of the private key through its exact row version.
    const linksFor = (sources: readonly SourceAuthorization[]) =>
      sources.map(source => source.status === "authorized" ? [source.link?.id, source.link?.updatedAt].join(":") : source.status).join("|");
    const currentAgainst = (basis: readonly SourceAuthorization[]) => async () => {
      const after = await Promise.all(platforms.map(provider => readSourceAuthorization(owner, provider, false)));
      return basis.every((source, i) => source.status === "authorized" ? sameSourceAuthorization(source, after[i]!) : source.status === after[i]!.status);
    };
    /** A matching stale envelope, served only after an exact recheck against `basis`. */
    const staleUnder = async (binding: string | null, basis: readonly SourceAuthorization[], known?: CachedStatsRead): Promise<StatsRead> => {
      if (!binding) return { status: "unavailable" };
      const entry = known ?? await readCachedStats(owner, binding, window.referenceDate);
      if (entry.status === "miss") return { status: "unavailable" };
      if (!await currentAgainst(basis)()) return { status: "unavailable" };
      return { status: "stale", stats: entry.stats, capturedAt: entry.capturedAt };
    };

    // Phase 1 — raw authorization, never refreshed. Lets a fresh hit skip
    // every provider entirely, and lets a later refresh failure still find
    // the entry written under this exact (pre-refresh) grant state.
    const raw = await Promise.all(platforms.map(provider => readSourceAuthorization(owner, provider, false)));
    if (raw.some(source => source.status === "unavailable")) return { status: "unavailable" };
    const rawCurrent = currentAgainst(raw);
    const rawBinding = statsCacheBinding({ accessContextId: context.accessContextId, links: linksFor(raw) });

    const cached = rawBinding ? await readCachedStats(owner, rawBinding, window.referenceDate) : { status: "miss" as const };
    if (cached.status === "fresh" && await rawCurrent()) {
      return { status: "current", stats: cached.stats, capturedAt: cached.capturedAt };
    }

    if (options.readOnly) {
      // The same hit and the same exact-authorization recheck as the live
      // path, and nothing else. Not through `inflight`: a read-only entry
      // there would hand a live caller a miss without the fetch it came for.
      if (cached.status === "stale" && await rawCurrent()) {
        return { status: "stale", stats: cached.stats, capturedAt: cached.capturedAt };
      }
      return await readStatsNotFound(owner) ? { status: "not_found", value: githubUserNotFound(owner) } : { status: "unavailable" };
    }

    // Phase 2 — refresh each raw-authorized link. An ambiguous outcome (a
    // durably-claimed "busy" refresh, a consent/flag change mid-flight, …)
    // must never be retried and must never silently drop a connected source
    // — the last-known-good raw-bound aggregate is the only fallback.
    const ready = await Promise.all(raw.map((source, i) =>
      source.status === "authorized" ? refreshSourceLink(source, { owner, provider: platforms[i]! }, false) : source,
    ));
    if (ready.some(source => source.status === "unavailable")) {
      return await staleUnder(rawBinding, raw, cached);
    }

    // Phase 3 — a successful refresh may have changed a link's version, and
    // so the binding. Rebuild it and try once more for a fresh hit before
    // falling through to live collection.
    const readyCurrent = currentAgainst(ready);
    const readyBinding = statsCacheBinding({ accessContextId: context.accessContextId, links: linksFor(ready) });
    if (readyBinding && readyBinding !== rawBinding) {
      const rebound = await readCachedStats(owner, readyBinding, window.referenceDate);
      if (rebound.status === "fresh" && await readyCurrent()) {
        return { status: "current", stats: rebound.stats, capturedAt: rebound.capturedAt };
      }
    }

    // `selectionId` is an HMAC over the exact reference *instant*, so it is
    // unique per call and made both this map and any cache derived from it
    // dead. `readyBinding` alone is no longer day-scoped (the cache envelope
    // carries `referenceDate` separately, so the same grant stays exactly
    // bound across a UTC-day rollover) — the inflight key adds
    // `window.referenceDate` explicitly, so two concurrent calls for the same
    // grant but different scoring days still collect two independent 365-day
    // windows instead of one caller silently receiving the other's window.
    // Same grant, same day, different instants still share one fetch, which
    // is what makes concurrent renders of one handle pay ~10s once instead of
    // once each.
    const key = (readyBinding ?? context.selectionId + ":" + linksFor(ready)) + ":" + window.referenceDate;
    let work = inflight.get(key);
    if (!work) {
      work = withTimeout((async (): Promise<CollectOutcome> => {
        // A hit is still re-checked against `readyCurrent()` below, exactly as
        // a live fetch is: the binding proves which grant produced the data,
        // not that the grant is still in force.
        const hit = readyBinding ? await readCachedStats(owner, readyBinding, window.referenceDate) : { status: "miss" as const };
        if (hit.status === "fresh") return { kind: "current", stats: hit.stats, capturedAt: hit.capturedAt };
        if (await readStatsNotFound(owner)) return { kind: "not_found", value: githubUserNotFound(owner) };
        const primary = await context.collect(captured => fetchStats(owner, undefined, { resolvedCredential: { token: captured || null }, referenceTime: window.referenceTime }));
        if (isGitHubUserNotFound(primary)) { await writeStatsNotFound(owner); return { kind: "not_found", value: primary }; }
        if (!primary || !await readyCurrent()) return { kind: "failed" };
        const fetchers = [fetchBitbucketIfLinked, fetchCodebergIfLinked, fetchGitlabIfLinked];
        const linked = await Promise.all(fetchers.map((fetcher, i) => ready[i]!.status === "authorized" ? fetcher!(owner, owner) : null));
        // Connected but inaccessible sources cannot disappear from an aggregate.
        if (linked.some((stats, i) => ready[i]!.status === "authorized" && !stats)) return { kind: "failed" };
        const supplemental = await dbGetSupplemental(owner);
        if (!await readyCurrent()) return { kind: "failed" };
        const linkedPlatforms: Platform[] = []; const linkedPlatformLogins: Record<string, string> = {};
        ready.forEach((source, i) => { if (source.status === "authorized" && source.link) { linkedPlatforms.push(platforms[i]!); linkedPlatformLogins[platforms[i]!] = source.link.remoteLogin; } });
        const composed = _compose(primary, { bitbucket: linked[0] ?? null, codeberg: linked[1] ?? null, gitlab: linked[2] ?? null, supplemental, linkedPlatforms, linkedPlatformLogins });
        const capturedAt = new Date().toISOString();
        // Best-effort: a cache write that fails must not fail the fetch that
        // already succeeded. `cacheSet` swallows its own errors already. Only
        // written once the grant is still exactly current, mirroring the
        // final check below.
        if (readyBinding && await readyCurrent()) await writeCachedStats(owner, readyBinding, window.referenceDate, composed);
        return { kind: "current", stats: composed, capturedAt };
      })(), 30_000, "Legacy source collection").catch((): CollectOutcome => ({ kind: "failed" }));
      inflight.set(key, work);
      void work.finally(() => { if (inflight.get(key) === work) inflight.delete(key); }).catch(() => undefined);
    }
    const outcome = await work;
    if (outcome.kind === "not_found") return { status: "not_found", value: outcome.value };
    if (outcome.kind === "current" && await readyCurrent()) {
      // `outcome.stats` may be shared with another caller awaiting the same
      // in-flight collection; clone at this boundary so concurrent callers
      // never hand each other a mutable reference.
      return { status: "current", stats: structuredClone(outcome.stats), capturedAt: outcome.capturedAt };
    }
    // Collection failed outright, timed out, or the grant moved mid-flight —
    // the exact-bound stale aggregate (if any) is still the honest fallback.
    return await staleUnder(readyBinding, ready);
  } catch { return { status: "unavailable" }; }
}

/**
 * The compatibility wrapper every existing caller keeps using:
 * `StatsData | GitHubUserNotFound | null`. `current` and `stale` both
 * collapse to the stats object — a caller that needs the distinction (only
 * the profile materializer does, so it can gate publication on it) calls
 * {@link readStats} directly.
 */
export async function getStats(handle: string, token?: string, options: { readOnly?: boolean; referenceTime?: string } = {}): Promise<StatsOutcome> {
  const result = await readStats(handle, token, options);
  if (result.status === "unavailable") return null;
  if (result.status === "not_found") return result.value;
  return result.stats;
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
