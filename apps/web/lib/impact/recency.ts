import type { HeatmapDay } from "@chapa/shared";
import { clampScore } from "./utils";

const RECENCY_WINDOW_DAYS = 90;
const NEUTRAL_RATIO = 0.25; // 90/365 ≈ proportional share
const MAX_BOOST = 1.06;
const MIN_PENALTY = 0.98;

/**
 * Compute what fraction of total heatmap activity occurred in the last 90 days.
 * Returns 0.0–1.0. Returns NEUTRAL_RATIO (0.25) for empty heatmaps.
 */
export function computeRecencyRatio(heatmapData: HeatmapDay[]): number {
  if (heatmapData.length === 0) return NEUTRAL_RATIO;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - RECENCY_WINDOW_DAYS);

  let totalActivity = 0;
  let recentActivity = 0;

  for (const day of heatmapData) {
    totalActivity += day.count;
    const d = new Date(day.date);
    if (d >= cutoff) {
      recentActivity += day.count;
    }
  }

  if (totalActivity === 0) return NEUTRAL_RATIO;
  return recentActivity / totalActivity;
}

/**
 * Apply a gentle recency multiplier to a composite score.
 * - ratio = 0.25 (proportional) → 1.0x (neutral)
 * - ratio = 1.0 (all recent) → 1.06x (+6% max boost)
 * - ratio = 0.0 (all old) → 0.98x (-2% max penalty)
 *
 * Linear interpolation between MIN_PENALTY and MAX_BOOST,
 * with NEUTRAL_RATIO as the pivot point.
 */
export function applyRecencyWeight(score: number, recencyRatio: number): number {
  let multiplier: number;

  if (recencyRatio <= NEUTRAL_RATIO) {
    // Interpolate between MIN_PENALTY (at 0) and 1.0 (at NEUTRAL_RATIO)
    const t = recencyRatio / NEUTRAL_RATIO;
    multiplier = MIN_PENALTY + t * (1.0 - MIN_PENALTY);
  } else {
    // Interpolate between 1.0 (at NEUTRAL_RATIO) and MAX_BOOST (at 1.0)
    const t = (recencyRatio - NEUTRAL_RATIO) / (1.0 - NEUTRAL_RATIO);
    multiplier = 1.0 + t * (MAX_BOOST - 1.0);
  }

  return clampScore(Math.round(score * multiplier));
}
