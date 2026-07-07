import type { RawContributionData, StatsData } from "@chapa/shared";

/**
 * Detects a GitHub fetch that lost merged-PR visibility relative to
 * last-known-good data. See #1002.
 *
 * The GitHub `contributionsCollection` GraphQL block is scoped to the
 * *authenticating* token: a token that cannot see a user's private-repo
 * merges (e.g. the server `GITHUB_TOKEN` used by the warm-cache cron, or an
 * anonymous badge request) returns `prsMergedCount: 0` even when the user has
 * hundreds of merged PRs. That zero-PR result looks structurally valid, so it
 * previously overwrote good cached stats — collapsing the Delivery dimension
 * (merged-PR weight is 70% of Delivery) and flipping `profileType` to
 * "collaborative" (`detectProfileType` divides by `max(prsMergedCount, 1)`).
 *
 * This predicate is intentionally conservative: it only flags the unambiguous
 * corruption signature — merged PRs collapsing to exactly zero while the fetch
 * still reports other activity (commits or issues) and last-known-good had
 * merged PRs. A genuinely new/empty account (no commits, no issues, no PRs)
 * and a legitimate no-PR reviewer (last-known-good also had zero PRs) are both
 * allowed through unchanged.
 *
 * @param fresh    The just-fetched (possibly merged) stats about to be cached.
 * @param lastGood The last-known-good stats (the `stats:stale:<handle>` value),
 *                 or null/undefined when no baseline exists.
 * @returns true when `fresh` should be rejected in favor of `lastGood`.
 */
export function isDegradedPrFetch(
  fresh: StatsData,
  lastGood: StatsData | null | undefined,
): boolean {
  // No baseline to compare against — cannot judge, so accept the fetch.
  if (!lastGood) return false;

  // Fresh fetch has merged PRs — not a collapse.
  if (fresh.prsMergedCount > 0) return false;

  // Baseline also had no merged PRs — a legitimate no-PR profile, not a loss.
  if (lastGood.prsMergedCount <= 0) return false;

  // Fresh reports zero merged PRs while last-known-good had them. Only treat
  // this as a degraded (partial-visibility) fetch when the fresh result still
  // shows other activity; a fetch that is entirely empty is indistinguishable
  // from a genuinely reset account and is left alone.
  return fresh.commitsTotal > 0 || fresh.issuesClosedCount > 0;
}

/**
 * Assesses whether a raw GitHub fetch is internally consistent enough to
 * trust, *without requiring a last-known-good baseline*. See #1002's
 * follow-up (the 2026-07-07 scoring-integrity-contract): the authoritative
 * `search(is:merged)` count (`raw.mergedPrTotalCount`) is fetched
 * independently of the token-scoped, 100-node-capped
 * `pullRequestContributions` sample, so a divergence between the two — the
 * search sees merged PRs but the sample came back empty — is the signature
 * of a degraded/partial fetch (token-scope loss or a partial GraphQL error),
 * not a genuinely empty account.
 *
 * This complements `isDegradedPrFetch`: that predicate needs a trusted prior
 * value to compare against and is blind on a cold or already-poisoned
 * baseline; this one judges the payload on its own internal consistency, so
 * it also catches the very first degraded fetch for a handle.
 *
 * @param raw The raw contribution payload, before `buildStatsFromRaw`.
 * @returns `{ ok: true }` when the payload is internally consistent, or
 *   `{ ok: false, reason }` when it should be rejected (caller serves stale).
 */
export function assessRawFetchIntegrity(
  raw: RawContributionData,
): { ok: true } | { ok: false; reason: string } {
  if (!raw.contributionCalendar || !raw.pullRequests) {
    return { ok: false, reason: "missing_required_block" };
  }

  const mergedNodeCount = raw.pullRequests.nodes.filter((n) => n.merged).length;

  // The juan294 signature: search sees merged PRs, but the sample came back
  // completely empty. Independent of whether pullRequestContributions was
  // null (defaulted to empty by queries.ts) or merely returned an empty
  // nodes array — either way, the sample cannot be trusted for this fetch.
  if (raw.mergedPrTotalCount > 0 && mergedNodeCount === 0) {
    return { ok: false, reason: "pr_nodes_empty_but_search_positive" };
  }

  // Internal inconsistency: the sample itself claims PR contributions exist
  // (totalCount > 0) but returned no nodes at all — a partial-payload shape
  // distinct from a genuinely empty account (which reports totalCount: 0).
  if (raw.pullRequests.totalCount > 0 && raw.pullRequests.nodes.length === 0) {
    return { ok: false, reason: "pr_totalcount_positive_but_nodes_empty" };
  }

  return { ok: true };
}

/**
 * The single source of truth for "does this stats payload look poisoned by
 * the #1002/#1004 degraded-fetch corruption?" — zero merged PRs while other
 * activity (commits or closed issues) is present. A genuinely empty account
 * reports zero for all three fields and is not poisoned.
 *
 * Used by `materializeProfile`'s persist-boundary gate (Phase 3) and by the
 * `heal-poisoned-stats` repair script (Phase 4) to identify already-corrupt
 * cached/persisted data written before this integrity contract existed.
 */
export function isPoisonedStats(s: {
  prsMergedCount: number;
  commitsTotal: number;
  issuesClosedCount: number;
}): boolean {
  return s.prsMergedCount === 0 && (s.commitsTotal > 0 || s.issuesClosedCount > 0);
}
