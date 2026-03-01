/**
 * Exponential Moving Average (EMA) for score smoothing.
 *
 * Applied as the LAST step in the badge/share page pipeline,
 * after computeImpactV4. Uses the previous day's smoothed score
 * from MetricsSnapshot to dampen daily fluctuations.
 *
 * Alpha = 0.15 → half-life ~4.3 days.
 * A 10-point raw drop manifests as ~1.5/day.
 */

import { toDateString } from "@/lib/utils/date";

const EMA_ALPHA = 0.15;

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
  return Math.round(Math.max(0, Math.min(100, smoothed)));
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
  latestSnapshot: { date: string; adjustedComposite: number } | null | undefined,
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
