/**
 * Score-bump significance detection.
 *
 * #1335 phase 5 — the v6 `isSignificantChange` (SnapshotDiff-based) is
 * retired along with `metrics_snapshots`. `isSignificantScoringChange`
 * below is the only remaining detector, over a `ScoringComparison`.
 */

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

/** Minimum adjusted composite increase to count as significant. */
const SCORE_BUMP_THRESHOLD = 10;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SignificantReason = "tier_change" | "archetype_change" | "score_bump";

export interface SignificantChange {
  significant: true;
  reason: SignificantReason;
  /** All reasons that fired (there can be multiple). */
  allReasons: SignificantReason[];
}

export interface InsignificantChange {
  significant: false;
}

export type SignificanceResult = SignificantChange | InsignificantChange;

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/** Current-policy significance is defined only inside the same scoring window.
 * A receipt correction is a score change; a policy/window transition is not. */
export function isSignificantScoringChange(comparison: import("./scoring-observations").ScoringComparison): SignificanceResult {
  if (comparison.status !== "comparable" || comparison.current.policyVersion !== "v7.2") return { significant: false };
  const reasons: SignificantReason[] = [];
  if (comparison.previous.tier !== comparison.current.tier) reasons.push("tier_change");
  if (comparison.previous.archetype !== comparison.current.archetype) reasons.push("archetype_change");
  if (comparison.composite.exact >= SCORE_BUMP_THRESHOLD) reasons.push("score_bump");
  return reasons.length ? { significant: true, reason: reasons[0]!, allReasons: reasons } : { significant: false };
}
