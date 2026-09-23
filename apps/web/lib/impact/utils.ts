import type { ImpactTier } from "@chapa/shared";
import { TIER_THRESHOLDS } from "@chapa/shared";

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
// Tier mapping
// ---------------------------------------------------------------------------

/**
 * Map an adjusted composite score to an Impact tier label.
 *
 * Thresholds: Elite >= 85, High >= 70, Solid >= 30, Emerging < 30.
 *
 * Kept here (rather than deleted with the rest of the v6 pipeline in #1335
 * phase 5) because it is a generic tier-mapping helper still used by
 * non-scoring display code (`lib/dashboard/dimension-sub-metrics.ts`,
 * `lib/insights/scoring.ts`, `lib/render/landing-demo-data.ts` also still
 * import `normalize` from this module) — neither function computes a v6
 * aggregate or confidence value on its own.
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
