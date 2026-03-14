/**
 * Score-bump significance detection.
 *
 * Pure function that examines a SnapshotDiff and determines whether the
 * change is "significant" enough to warrant an email notification.
 *
 * Trigger priority (highest first):
 *   1. Tier change (e.g., Solid → High)
 *   2. Archetype change (e.g., Balanced → Builder)
 *   3. Adjusted composite increase ≥ threshold
 */

import type { SnapshotDiff } from "./diff";

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

/** Minimum adjusted composite increase to count as significant. */
const SCORE_BUMP_THRESHOLD = 5;

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

/**
 * Determine whether a snapshot diff represents a significant change worth notifying about.
 *
 * Checks three triggers in priority order (highest first):
 * 1. **Tier change** — e.g., Solid to High (rarest, biggest milestone)
 * 2. **Archetype change** — e.g., Balanced to Builder (identity shift)
 * 3. **Score bump** — adjusted composite increased by >= {@link SCORE_BUMP_THRESHOLD} points
 *
 * Multiple triggers can fire simultaneously; all are reported via `allReasons`,
 * with the highest-priority one as the primary `reason`.
 *
 * @param diff - The structured diff from {@link compareSnapshots}
 * @returns A {@link SignificanceResult} — either `{ significant: true, reason, allReasons }` or `{ significant: false }`
 */
export function isSignificantChange(diff: SnapshotDiff): SignificanceResult {
  const reasons: SignificantReason[] = [];

  // Tier change — always significant (rarest, biggest milestone)
  if (diff.tier !== null) {
    reasons.push("tier_change");
  }

  // Archetype change — identity shift
  if (diff.archetype !== null) {
    reasons.push("archetype_change");
  }

  // Score bump — adjusted composite increased by ≥ threshold
  if (diff.adjustedComposite >= SCORE_BUMP_THRESHOLD) {
    reasons.push("score_bump");
  }

  if (reasons.length === 0) {
    return { significant: false };
  }

  return {
    significant: true,
    reason: reasons[0]!, // highest-priority reason
    allReasons: reasons,
  };
}
