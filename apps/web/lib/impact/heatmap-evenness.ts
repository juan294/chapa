import type { HeatmapDay } from "@chapa/shared";

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

/** Aggregate daily heatmap into weekly totals. */
function aggregateWeeklyTotals(heatmapData: HeatmapDay[], numWeeks: number): number[] {
  const weeklyTotals: number[] = new Array(numWeeks).fill(0);
  for (let i = 0; i < heatmapData.length; i++) {
    const week = Math.floor(i / 7);
    weeklyTotals[week]! += heatmapData[i]!.count;
  }
  return weeklyTotals;
}

// ---------------------------------------------------------------------------
// Heatmap evenness
// ---------------------------------------------------------------------------

/**
 * Measures how evenly activity is distributed across weeks.
 *
 * Uses inverted coefficient of variation (CV) of weekly totals with
 * outlier clipping — weekly totals are capped at 3× median before
 * computing CV. This preserves the "are you spread across weeks?"
 * signal while tolerating productive bursts.
 *
 * - Perfectly uniform weekly activity → ~1.0
 * - All activity in a single burst → ~0.0
 * - No activity at all → 0
 */
export function computeHeatmapEvenness(heatmapData: HeatmapDay[]): number {
  if (heatmapData.length === 0) return 0;

  const numWeeks = Math.ceil(heatmapData.length / 7);
  const weeklyTotals = aggregateWeeklyTotals(heatmapData, numWeeks);

  // If total activity is zero, evenness is 0
  const total = weeklyTotals.reduce((sum, w) => sum + w, 0);
  if (total === 0) return 0;

  // Clip outlier weeks at 3× median to prevent extreme weeks from
  // dominating the coefficient of variation.
  const sorted = [...weeklyTotals].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const clipCap = Math.max(median * 3, 1);
  const clipped = weeklyTotals.map((w) => Math.min(w, clipCap));

  const clippedTotal = clipped.reduce((sum, w) => sum + w, 0);
  const mean = clippedTotal / clipped.length;

  // Standard deviation on clipped data
  const variance =
    clipped.reduce((sum, w) => sum + (w - mean) ** 2, 0) / clipped.length;
  const stdDev = Math.sqrt(variance);

  // CV = stdDev / mean; evenness = 1 / (1 + CV)
  // Perfectly uniform → CV=0 → 1.0; Single burst → CV high → ~0
  const cv = stdDev / mean;
  return 1 / (1 + cv);
}

// ---------------------------------------------------------------------------
// Week coverage
// ---------------------------------------------------------------------------

/**
 * Fraction of weeks with at least one contribution.
 * Captures "sustainable cadence" — did you show up regularly?
 *
 * - Activity every week → 1.0
 * - Half the weeks active → 0.5
 * - No activity → 0
 */
export function computeWeekCoverage(heatmapData: HeatmapDay[]): number {
  if (heatmapData.length === 0) return 0;

  const numWeeks = Math.ceil(heatmapData.length / 7);
  const weeklyTotals = aggregateWeeklyTotals(heatmapData, numWeeks);
  const activeWeeks = weeklyTotals.filter((w) => w > 0).length;
  return activeWeeks / numWeeks;
}
