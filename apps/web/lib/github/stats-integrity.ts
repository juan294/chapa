import type { StatsData } from "@chapa/shared";

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
