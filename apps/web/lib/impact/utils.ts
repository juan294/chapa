import type {
  StatsData,
  ImpactTier,
  ConfidencePenalty,
  ConfidenceFlag,
  ProfileType,
} from "@chapa/shared";
import {
  BURST_ACTIVITY_THRESHOLD,
  MICRO_COMMIT_THRESHOLD,
  SINGLE_REPO_CONCENTRATION,
  TIER_THRESHOLDS,
} from "@chapa/shared";

// ---------------------------------------------------------------------------
// Clamp + round a raw score to 0–100 integer
// ---------------------------------------------------------------------------

/**
 * Clamp and round a raw score to an integer in the 0--100 range.
 *
 * Every dimension, composite, and adjusted score passes through this
 * function to guarantee consistent bounds across the scoring pipeline.
 *
 * @param raw - The unrounded score (may exceed 0--100)
 * @returns An integer between 0 and 100 inclusive
 */
export function clampScore(raw: number): number {
  return Math.round(Math.max(0, Math.min(100, raw)));
}

// ---------------------------------------------------------------------------
// Normalization: f(x, cap) = ln(1 + min(x, cap)) / ln(1 + cap)
// ---------------------------------------------------------------------------

/**
 * Logarithmic normalization: maps a raw count to 0--1 with diminishing returns.
 *
 * Formula: `ln(1 + min(x, cap)) / ln(1 + cap)`.
 * This gives strong credit for early activity and progressively less credit
 * as the value approaches the cap, preventing outliers from dominating.
 *
 * @param x - The raw metric value (e.g. commits, PRs merged)
 * @param cap - The saturation point beyond which additional activity has no effect
 * @returns A value between 0 and 1 inclusive; returns 0 when x or cap is non-positive
 */
export function normalize(x: number, cap: number): number {
  if (x <= 0 || cap <= 0) return 0;
  const clamped = Math.min(x, cap);
  return Math.log(1 + clamped) / Math.log(1 + cap);
}

// ---------------------------------------------------------------------------
// Confidence (50–100)
// ---------------------------------------------------------------------------

const CONFIDENCE_REASONS: Record<ConfidenceFlag, string> = {
  burst_activity:
    "Some activity appears in short bursts, which reduces timing confidence.",
  micro_commit_pattern:
    "Many very small changes in this period reduce signal clarity.",
  generated_change_pattern:
    "Large change volume with limited review signals reduces confidence.",
  low_collaboration_signal:
    "Limited review and collaboration signals detected in this period.",
  single_repo_concentration:
    "Most activity is concentrated in one repo (not bad\u2014just less cross-repo signal).",
  supplemental_unverified:
    "Includes activity from a linked account that cannot be independently verified.",
  low_activity_signal:
    "Very limited activity in this period reduces the signal available for scoring.",
  review_volume_imbalance:
    "High review volume with very few merged changes reduces confidence in the activity mix.",
  platform_linked:
    "Includes verified data from a linked platform account.",
};

/**
 * Compute a confidence score (50--100) for a developer's Impact profile.
 *
 * Confidence reflects how reliable the scoring data is -- not the developer's
 * skill. A lower confidence means less signal was available, not that the
 * developer did anything wrong. The messaging must remain non-accusatory.
 *
 * Starts at 100 and subtracts penalties for detected patterns:
 *
 * | Flag                        | Penalty | Condition (collaborative)                      |
 * |-----------------------------|---------|------------------------------------------------|
 * | `burst_activity`            | -15     | >= 100 commits in a 10-minute window           |
 * | `micro_commit_pattern`      | -10     | >= 60% of commits are micro-commits            |
 * | `generated_change_pattern`  | -15     | >= 20k lines changed with <= 2 reviews         |
 * | `low_collaboration_signal`  | -10     | >= 10 PRs merged with <= 1 review submitted    |
 * | `single_repo_concentration` | -5      | >= 95% activity in 1 repo, <= 1 repo total     |
 * | `supplemental_unverified`   | -5      | Includes unverified supplemental account data   |
 * | `low_activity_signal`       | -10     | < 30 active days OR < 50 total commits         |
 * | `review_volume_imbalance`   | -10     | >= 50 reviews submitted with < 3 PRs merged    |
 * | `platform_linked`           | 0       | Verified linked platform (informational only)   |
 *
 * The `generated_change_pattern` and `low_collaboration_signal` penalties are
 * skipped for `"solo"` profile types, since solo developers are not expected
 * to have review activity.
 *
 * The final score is clamped to a minimum of 50 -- confidence never drops
 * below that floor regardless of how many penalties apply.
 *
 * @param stats - Aggregated GitHub activity statistics for the scoring period.
 * @param profileType - Whether the developer works collaboratively (default) or
 *   solo. Solo profiles skip collaboration-dependent penalties.
 * @returns An object with `confidence` (50--100, integer) and `penalties` (an
 *   array of {@link ConfidencePenalty} objects describing each applied deduction).
 *
 * @example
 * ```ts
 * const { confidence, penalties } = computeConfidence(stats, "solo");
 * // confidence: 85
 * // penalties: [{ flag: "burst_activity", penalty: 15, reason: "..." }]
 * ```
 */
export function computeConfidence(
  stats: StatsData,
  profileType: ProfileType = "collaborative",
): {
  confidence: number;
  penalties: ConfidencePenalty[];
} {
  const isSolo = profileType === "solo";
  const penalties: ConfidencePenalty[] = [];
  let score = 100;

  if (stats.maxCommitsIn10Min >= BURST_ACTIVITY_THRESHOLD) {
    penalties.push({
      flag: "burst_activity",
      penalty: 15,
      reason: CONFIDENCE_REASONS.burst_activity,
    });
    score -= 15;
  }

  if (
    stats.microCommitRatio !== undefined &&
    stats.microCommitRatio >= MICRO_COMMIT_THRESHOLD
  ) {
    penalties.push({
      flag: "micro_commit_pattern",
      penalty: 10,
      reason: CONFIDENCE_REASONS.micro_commit_pattern,
    });
    score -= 10;
  }

  const totalLines = stats.linesAdded + stats.linesDeleted;
  if (!isSolo && totalLines >= 20000 && stats.reviewsSubmittedCount <= 2) {
    penalties.push({
      flag: "generated_change_pattern",
      penalty: 15,
      reason: CONFIDENCE_REASONS.generated_change_pattern,
    });
    score -= 15;
  }

  if (!isSolo && stats.prsMergedCount >= 10 && stats.reviewsSubmittedCount <= 1) {
    penalties.push({
      flag: "low_collaboration_signal",
      penalty: 10,
      reason: CONFIDENCE_REASONS.low_collaboration_signal,
    });
    score -= 10;
  }

  if (
    stats.topRepoShare >= SINGLE_REPO_CONCENTRATION &&
    stats.reposContributed <= 1
  ) {
    penalties.push({
      flag: "single_repo_concentration",
      penalty: 5,
      reason: CONFIDENCE_REASONS.single_repo_concentration,
    });
    score -= 5;
  }

  if (stats.hasSupplementalData) {
    penalties.push({
      flag: "supplemental_unverified",
      penalty: 5,
      reason: CONFIDENCE_REASONS.supplemental_unverified,
    });
    score -= 5;
  }

  if (stats.activeDays < 30 || stats.commitsTotal < 50) {
    penalties.push({
      flag: "low_activity_signal",
      penalty: 10,
      reason: CONFIDENCE_REASONS.low_activity_signal,
    });
    score -= 10;
  }

  if (stats.reviewsSubmittedCount >= 50 && stats.prsMergedCount < 3) {
    penalties.push({
      flag: "review_volume_imbalance",
      penalty: 10,
      reason: CONFIDENCE_REASONS.review_volume_imbalance,
    });
    score -= 10;
  }

  // Platform-linked data: informational only (0 penalty).
  // Distinguished from supplemental_unverified — platform data is server-verified via OAuth.
  if (stats.linkedPlatforms && stats.linkedPlatforms.length > 0 && !stats.hasSupplementalData) {
    penalties.push({
      flag: "platform_linked",
      penalty: 0,
      reason: CONFIDENCE_REASONS.platform_linked,
    });
  }

  return { confidence: Math.max(50, score), penalties };
}

// ---------------------------------------------------------------------------
// Adjusted score (0–100)
// ---------------------------------------------------------------------------

/**
 * Apply confidence adjustment to a composite score.
 *
 * Formula: `base * (0.85 + 0.15 * confidence / 100)`.
 * At 100% confidence the score is unchanged; at 50% confidence (the floor)
 * the score is reduced by ~7.5%. This ensures low-signal profiles are
 * penalised proportionally without zeroing them out.
 *
 * @param base - The raw composite score (0--100) before adjustment
 * @param confidence - The confidence score (50--100) from {@link computeConfidence}
 * @returns The adjusted composite score, clamped to 0--100
 */
export function computeAdjustedScore(
  base: number,
  confidence: number,
): number {
  const adjusted = base * (0.85 + 0.15 * (confidence / 100));
  return clampScore(adjusted);
}

// ---------------------------------------------------------------------------
// Tier mapping
// ---------------------------------------------------------------------------

/**
 * Map an adjusted composite score to an Impact tier label.
 *
 * Thresholds: Elite >= 85, High >= 70, Solid >= 30, Emerging < 30.
 *
 * @param adjustedScore - The confidence-adjusted composite score (0--100)
 * @returns The corresponding {@link ImpactTier} label
 */
export function getTier(adjustedScore: number): ImpactTier {
  if (adjustedScore >= TIER_THRESHOLDS.S) return "Elite";
  if (adjustedScore >= TIER_THRESHOLDS.A) return "High";
  if (adjustedScore >= TIER_THRESHOLDS.C) return "Solid";
  return "Emerging";
}
