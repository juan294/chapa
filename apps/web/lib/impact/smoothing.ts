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
 * Bypass (#826): when the inputs themselves have legitimately changed mid-day
 * (e.g. a supplemental EMU upload added new PR/review data), pass
 * `bypassSameDayLock: true` to apply EMA against today's snapshot anyway. The
 * result is anchored to today's already-smoothed value but absorbs partial
 * credit for the new score, preventing the user from being stuck on a stale
 * snapshot until tomorrow's cron run.
 *
 * @param currentAdjusted - Today's raw adjusted composite (pre-EMA)
 * @param latestSnapshot - Most recent snapshot (may be from today or earlier)
 * @param today - Override for current date (YYYY-MM-DD), for testing
 * @param options - Bypass flag for legitimate same-day input changes
 * @returns Smoothed score as integer 0-100
 */
export function smoothScore(
  currentAdjusted: number,
  latestSnapshot: SnapshotScoreInput | null | undefined,
  today?: string,
  options?: { bypassSameDayLock?: boolean },
): number {
  if (!latestSnapshot) {
    return Math.round(currentAdjusted);
  }

  const todayStr = today ?? toDateString(new Date());
  const sameDay = latestSnapshot.date === todayStr;
  const bypass = options?.bypassSameDayLock === true;

  if (sameDay && !bypass) {
    // Snapshot is from today — EMA was already applied on the first request.
    // Return the already-smoothed value to prevent feedback loop.
    return latestSnapshot.adjustedComposite;
  }

  // Same-day with bypass, or different day: apply EMA normally.
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
  options: {
    policy?: ScorePolicy;
    today?: string;
    /**
     * #826 — Set when the inputs to scoring have legitimately changed mid-day
     * (e.g. a supplemental EMU upload added PR/review data). Bypasses the
     * same-day lock in {@link smoothScore} so the user sees a fresh score
     * instead of the snapshot taken before the upload.
     */
    inputsChanged?: boolean;
  } = {},
): ImpactV6Result {
  switch (options.policy ?? "public-display") {
    case "public-display":
    case "explicit-recalculate": {
      const adjustedComposite = smoothScore(
        rawImpact.adjustedComposite,
        latestSnapshot,
        options.today,
        { bypassSameDayLock: options.inputsChanged ?? false },
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
