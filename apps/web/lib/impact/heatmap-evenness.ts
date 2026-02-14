import type { HeatmapDay } from "@chapa/shared";

/**
 * Measures how evenly activity is distributed across weeks.
 *
 * Uses inverted coefficient of variation (CV) of weekly totals:
 * - Perfectly uniform weekly activity → ~1.0
 * - All activity in a single burst → ~0.0
 * - No activity at all → 0
 *
 * Formula: evenness = 1 − (stdDev / mean), clamped to [0, 1].
 * When all weeks have the same total, stdDev = 0 → evenness = 1.
 */
export function computeHeatmapEvenness(heatmapData: HeatmapDay[]): number {
  if (heatmapData.length === 0) return 0;

  // Aggregate into weekly totals
  const numWeeks = Math.ceil(heatmapData.length / 7);
  const weeklyTotals: number[] = new Array(numWeeks).fill(0);

  for (let i = 0; i < heatmapData.length; i++) {
    const week = Math.floor(i / 7);
    weeklyTotals[week] = (weeklyTotals[week] ?? 0) + heatmapData[i]!.count;
  }

  // If total activity is zero, evenness is 0
  const total = weeklyTotals.reduce((sum, w) => sum + w, 0);
  if (total === 0) return 0;

  const mean = total / weeklyTotals.length;

  // Standard deviation
  const variance =
    weeklyTotals.reduce((sum, w) => sum + (w - mean) ** 2, 0) /
    weeklyTotals.length;
  const stdDev = Math.sqrt(variance);

  // CV = stdDev / mean; evenness = 1 / (1 + CV)
  // Perfectly uniform → CV=0 → 1.0; Single burst → CV high → ~0
  const cv = stdDev / mean;
  return 1 / (1 + cv);
}
