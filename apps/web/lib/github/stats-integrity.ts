import type { RawContributionData, StatsData } from "@chapa/shared";

/**
 * The fraction of a better-scoped baseline's merged-PR count below which a
 * lower-scoped fetch is treated as scope-blinded rather than as a real
 * decline. juan294's incident sat at 140/953 ≈ 0.15; a rolling 365-day window
 * advancing a day (or even the stale key's 7-day TTL) cannot evict half a
 * user's merged PRs at once, so anything under half is not a window effect.
 */
const SCOPE_SHORTFALL_RATIO = 0.5;

/**
 * Detects a GitHub fetch that lost merged-PR visibility relative to
 * last-known-good data. See #1002, extended by #1045.
 *
 * GitHub's `contributionsCollection` GraphQL block — *and* the `search()`
 * query #1004 added — are both scoped to the *authenticating* token. A token
 * that cannot see a user's private-repo merges (the server `GITHUB_TOKEN`, or
 * an anonymous badge request) reports only what is public. That result looks
 * structurally valid, so it previously overwrote good cached stats —
 * collapsing the Delivery dimension (merged-PR weight is 70% of Delivery) and
 * flipping `profileType` to "collaborative" (`detectProfileType` divides by
 * `max(prsMergedCount, 1)`).
 *
 * Two distinct signatures are flagged:
 *
 * 1. **Total collapse** (the original #1002 case): merged PRs fall to exactly
 *    zero while other activity remains.
 *
 * 2. **Scope shortfall** (#1045): a `public`-scope fetch reports a small
 *    *fraction* of an `authenticated` baseline. #1004 sourced the count from
 *    `search(is:merged)` believing it was not token-scoped — it is — so a
 *    blinded fetch began returning a plausible positive number (juan294: 140
 *    public vs 987 authenticated) instead of 0. That made signature (1)
 *    unreachable: #1004 disarmed the very tripwire it was built on top of.
 *
 * Both are gated on the fresh fetch still showing other activity, so a
 * genuinely reset account is left alone. Signature (2) additionally requires
 * the fresh fetch to be *lower-scoped* than the baseline. Comparing only
 * across a scope boundary is what keeps this precise: two equally-scoped
 * fetches disagreeing is a real decline (window eviction) and must write
 * through, because this guard also suppresses the stale write — blocking a
 * real decline would freeze that profile behind a stale value indefinitely.
 *
 * The guard is strictly good→bad: a fetch that *improves* on a poisoned
 * baseline always writes through, so the next authenticated fetch heals the
 * data and it sticks.
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

  // Baseline had no merged PRs — a legitimate no-PR profile, or a poisoned
  // baseline this fetch may be healing. Either way, nothing to protect.
  if (lastGood.prsMergedCount <= 0) return false;

  // A fetch that is entirely empty is indistinguishable from a genuinely
  // reset account, so it is left alone.
  const hasOtherActivity = fresh.commitsTotal > 0 || fresh.issuesClosedCount > 0;
  if (!hasOtherActivity) return false;

  // (1) The original #1002 signature: merged PRs collapsed to exactly zero.
  if (fresh.prsMergedCount === 0) return true;

  // (2) The #1045 signature: a lower-scoped fetch reporting a disproportionate
  // shortfall against a better-scoped baseline.
  const isLowerScoped =
    fresh.fetchScope === "public" && lastGood.fetchScope === "authenticated";

  return (
    isLowerScoped &&
    fresh.prsMergedCount < lastGood.prsMergedCount * SCOPE_SHORTFALL_RATIO
  );
}

/**
 * The GraphQL page size of the `pullRequestContributions` sample
 * (`packages/shared/src/github-query.ts:33`), so a payload reporting
 * `totalCount: N` yields at most `min(N, PR_SAMPLE_PAGE_SIZE)` nodes.
 */
const PR_SAMPLE_PAGE_SIZE = 100;

/**
 * The fraction of the expected page a sample must fill to be trusted.
 *
 * Not 1.0, because `queries.ts` legitimately drops nodes whose `pullRequest`
 * is null (deleted or otherwise unreadable repos), so a healthy sample can sit
 * a little under its page size — 96/100 against a totalCount of 143 is a real,
 * healthy juan294 payload.
 *
 * That same null-filter is what makes this check work: `totalCount` counts
 * contributions, but the nested `pullRequest` object is null for every repo the
 * token cannot read. Under scope loss the nodes are filtered away while
 * `totalCount` keeps counting them — which is precisely the 07-14 shape
 * (totalCount 143, ~2 surviving nodes, ratio 0.02). The threshold sits well
 * clear of both.
 */
const PR_SAMPLE_MIN_FILL_RATIO = 0.25;

/**
 * Assesses whether a raw GitHub fetch is internally consistent enough to
 * trust, *without requiring a last-known-good baseline*. See #1002's
 * follow-up (the 2026-07-07 scoring-integrity-contract), corrected by #1045.
 *
 * NOTE (#1045): the original contract was built on the premise that
 * `search(is:merged)` (`raw.mergedPrTotalCount`) is *not* token-scoped, and
 * could therefore serve as an authoritative cross-check against the
 * token-scoped `pullRequestContributions` sample. **That premise is false.**
 * GitHub's search only returns what the authenticating token can see, so a
 * blinded fetch under-reports *both* sides consistently and the cross-check
 * silently agrees with itself. Verified against the live API for juan294:
 * authenticated → 987 merged PRs, anonymous → 140.
 *
 * The checks below therefore never treat `mergedPrTotalCount` as ground truth.
 * They test only the payload's *internal* shape — specifically that the sample
 * carries as many nodes as its own `totalCount` claims — which holds
 * regardless of token scope and needs no baseline, so it also catches the very
 * first degraded fetch for a handle. Cross-scope comparison is
 * `isDegradedPrFetch`'s job, and it has a real baseline to do it with.
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

  // Search reports merged PRs but the sample came back completely empty.
  // Independent of whether pullRequestContributions was null (defaulted to
  // empty by queries.ts) or merely returned an empty nodes array — either way
  // the sample cannot be trusted for this fetch.
  if (raw.mergedPrTotalCount > 0 && mergedNodeCount === 0) {
    return { ok: false, reason: "pr_nodes_empty_but_search_positive" };
  }

  // Internal inconsistency: the sample itself claims PR contributions exist
  // (totalCount > 0) but returned no nodes at all — a partial-payload shape
  // distinct from a genuinely empty account (which reports totalCount: 0).
  if (raw.pullRequests.totalCount > 0 && raw.pullRequests.nodes.length === 0) {
    return { ok: false, reason: "pr_totalcount_positive_but_nodes_empty" };
  }

  // #1045: the sample returned *some* nodes, but far fewer than its own
  // totalCount says exist. This is what let juan294's 07-14 fetch through: the
  // sample carried ~2 tiny nodes against a totalCount of 143, so every
  // `=== 0` check above passed while prsMergedWeight (70% of Delivery)
  // collapsed 120 → 3.38 and linesAdded read 59 across 140 merged PRs.
  //
  // Keyed on node count vs totalCount — never on *merged*-node count vs the
  // search total, since the page is filled with PR contributions of any state:
  // a user with many open PRs can legitimately have few merged nodes.
  const expectedNodes = Math.min(raw.pullRequests.totalCount, PR_SAMPLE_PAGE_SIZE);
  if (raw.pullRequests.nodes.length < expectedNodes * PR_SAMPLE_MIN_FILL_RATIO) {
    return { ok: false, reason: "pr_sample_disproportionate_to_total" };
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

/**
 * Accounts below this merged-PR count are never flagged as scope-blinded:
 * with a handful of PRs the sample-derived fields are too noisy to prove
 * anything, and the cost of a false positive (destroying history) dwarfs the
 * cost of a false negative (self-heals via #1050 + the warm-cache cron).
 */
export const MIN_PRS_FOR_BLINDNESS_CHECK = 20;

/**
 * The provable floor for `prsMergedWeight` per sampled merged PR is ~0.169:
 * `computePrWeight` for the smallest non-empty PR (1 line, 1 file) is
 * `min(1, 2/10) · (0.5 + 0.25·ln2 + 0.25·ln2) ≈ 0.1693`. A FULL sample of n
 * merged nodes therefore cannot weigh less than 0.169·n, so total weight
 * below 0.15·n proves nodes were dropped — which is exactly what a
 * scope-blind fetch produces (`queries.ts` filters nodes whose `pullRequest`
 * is null for unreadable repos, while counts keep counting them).
 */
export const MIN_WEIGHT_PER_SAMPLED_PR = 0.15;

/**
 * Detects the #1045 corruption shape that `isPoisonedStats` structurally
 * cannot: a POSITIVE merged-PR count whose sample-derived fields collapsed.
 *
 * `isPoisonedStats` keys on `prsMergedCount === 0` — the #1002-era signature.
 * #1004 sourced the count from `search(is:merged)`, which is token-scoped, so
 * a scope-blind fetch began reporting a plausible-but-wrong positive count
 * (juan294: 140 public of 987 total) instead of 0. That disarmed the guard
 * (#1045) and the `heal-poisoned-stats` repair script alike, for the same
 * reason. The resulting stats carried `prsMergedWeight: 3.38` and
 * `linesAdded: 59` against 140 merged PRs — collapsing Delivery (weight is
 * 70% of it) from 100 to 58.
 *
 * Two corroborating signals are required, both bounded by the EXPECTED SAMPLE
 * size `min(count, PR_SAMPLE_PAGE_SIZE)` rather than the raw count — a
 * prolific user's weight legitimately sits at the 120 aggregation cap, far
 * below `count × 0.15` for count ≳ 800, so a count-based ratio would flag
 * every heavy user:
 *
 *  1. Total weight below the provable full-sample floor (see
 *     {@link MIN_WEIGHT_PER_SAMPLED_PR}) — mathematically impossible unless
 *     nodes were dropped.
 *  2. Fewer than one changed line per sampled merged PR — implausible for
 *     real merges and, more importantly, inconsistent with signal 1's
 *     alternative explanation (a legitimately tiny sample of LARGE PRs
 *     carries thousands of lines and is deliberately NOT flagged).
 *
 * This predicate gates a destructive history repair, so it is biased toward
 * false negatives: an evasive case (e.g. a blinded sample of two big public
 * PRs) is left alone and self-heals through the now-correct pipeline, whereas
 * a false positive would delete good history. Known residual: an account
 * whose sampled PRs are ALL zero-change (weight 0, lines 0) is flagged
 * despite being "real" — accepted, because such stats are meaningless anyway
 * and the heal script only ever touches handles an operator explicitly names.
 */
export function isScopeBlindedStats(s: {
  prsMergedCount: number;
  prsMergedWeight: number;
  linesAdded: number;
  linesDeleted: number;
}): boolean {
  if (s.prsMergedCount < MIN_PRS_FOR_BLINDNESS_CHECK) return false;

  const expectedSample = Math.min(s.prsMergedCount, PR_SAMPLE_PAGE_SIZE);
  const weightProvesTruncation =
    s.prsMergedWeight < expectedSample * MIN_WEIGHT_PER_SAMPLED_PR;
  const linesCorroborate = s.linesAdded + s.linesDeleted < expectedSample;

  return weightProvesTruncation && linesCorroborate;
}
