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
