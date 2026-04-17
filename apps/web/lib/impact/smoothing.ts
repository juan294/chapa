/**
 * Exponential Moving Average (EMA) for score smoothing.
 *
 * Applied after computeImpactV6 using the previous day's persisted
 * public score from MetricsSnapshot to dampen daily fluctuations.
 *
 * Alpha = 0.15 → half-life ~4.3 days.
 * A 10-point raw drop manifests as ~1.5/day.
 */

import type { ImpactV6Result } from "@chapa/shared";
import type { MetricsSnapshot } from "@/lib/history/types";
import { toDateString } from "@/lib/utils/date";
import { clampScore, getTier } from "./utils";

const EMA_ALPHA = 0.15;

export type ScorePolicy = "public-display" | "explicit-recalculate";
export type SnapshotScoreInput = Pick<MetricsSnapshot, "date" | "adjustedComposite">;

/**
 * Apply EMA smoothing to a score.
 *
 * @param currentScore - Today's raw adjusted composite score (0-100)
 * @param previousSmoothedScore - Yesterday's smoothed score from MetricsSnapshot.
 *   If undefined/null (first visit), the raw score passes through unchanged.
 * @returns Smoothed score as integer 0-100
 */
export function applyEMA(
  currentScore: number,
  previousSmoothedScore?: number | null,
): number {
  if (previousSmoothedScore == null) {
    return Math.round(currentScore);
  }

  const smoothed = EMA_ALPHA * currentScore + (1 - EMA_ALPHA) * previousSmoothedScore;
  return clampScore(smoothed);
}

/**
 * Day-aware EMA smoothing that prevents the feedback loop bug.
 *
 * EMA should only be applied ONCE per day — comparing today's raw score
 * against yesterday's smoothed score. If the latest snapshot is from today,
 * its `adjustedComposite` already has EMA baked in, so we return it directly
 * instead of re-smoothing (which would cause the score to spiral toward raw
 * on every page refresh).
 *
 * @param currentAdjusted - Today's raw adjusted composite (pre-EMA)
 * @param latestSnapshot - Most recent snapshot (may be from today or earlier)
 * @param today - Override for current date (YYYY-MM-DD), for testing
 * @returns Smoothed score as integer 0-100
 */
export function smoothScore(
  currentAdjusted: number,
  latestSnapshot: SnapshotScoreInput | null | undefined,
  today?: string,
): number {
  if (!latestSnapshot) {
    return Math.round(currentAdjusted);
  }

  const todayStr = today ?? toDateString(new Date());

  if (latestSnapshot.date === todayStr) {
    // Snapshot is from today — EMA was already applied on the first request.
    // Return the already-smoothed value to prevent feedback loop.
    return latestSnapshot.adjustedComposite;
  }

  // Snapshot is from a previous day — apply EMA normally.
  return applyEMA(currentAdjusted, latestSnapshot.adjustedComposite);
}

/**
 * Apply Chapa's public score policy to a raw impact result.
 *
 * Both current policies expose the EMA-adjusted public score. The distinction is
 * semantic: `explicit-recalculate` callers may still choose to return `rawImpact`
 * separately for diagnostics, but persisted snapshots must stay aligned with the
 * public display score.
 */
export function applyImpactScorePolicy(
  rawImpact: ImpactV6Result,
  latestSnapshot: SnapshotScoreInput | null | undefined,
  options: { policy?: ScorePolicy; today?: string } = {},
): ImpactV6Result {
  switch (options.policy ?? "public-display") {
    case "public-display":
    case "explicit-recalculate": {
      const adjustedComposite = smoothScore(
        rawImpact.adjustedComposite,
        latestSnapshot,
        options.today,
      );

      if (adjustedComposite === rawImpact.adjustedComposite) {
        return rawImpact;
      }

      return {
        ...rawImpact,
        adjustedComposite,
        tier: getTier(adjustedComposite),
      };
    }
  }
}
