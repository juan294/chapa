import type { HeatmapDay } from "@chapa/shared";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const MIN_WEEKS_FOR_COVERAGE = 4;

export interface WeeklyBucket {
  startOfWeek: string;
  total: number;
}

function startOfSundayUTC(date: Date): Date {
  const start = new Date(date);
  start.setUTCDate(date.getUTCDate() - date.getUTCDay());
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length === 0) {
    return 0;
  }

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1]! + sorted[middle]!) / 2;
  }

  return sorted[middle]!;
}

/** Aggregate daily heatmap into calendar-week totals keyed by UTC Sunday. */
export function aggregateWeeklyTotals(heatmapData: HeatmapDay[]): WeeklyBucket[] {
  const totalsByWeek = new Map<string, number>();

  for (const entry of heatmapData) {
    const day = new Date(`${entry.date}T00:00:00Z`);
    const startOfWeek = startOfSundayUTC(day).toISOString().slice(0, 10);
    totalsByWeek.set(startOfWeek, (totalsByWeek.get(startOfWeek) ?? 0) + entry.count);
  }

  return [...totalsByWeek.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([startOfWeek, total]) => ({ startOfWeek, total }));
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

  const weeklyTotals = aggregateWeeklyTotals(heatmapData).map((bucket) => bucket.total);

  // If total activity is zero, evenness is 0
  const total = weeklyTotals.reduce((sum, w) => sum + w, 0);
  if (total === 0) return 0;

  // Clip outlier weeks at 3× median to prevent extreme weeks from
  // dominating the coefficient of variation.
  const medianTotal = median(weeklyTotals);
  const clipCap = Math.max(medianTotal * 3, 1);
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

  const weeklyTotals = aggregateWeeklyTotals(heatmapData).map((bucket) => bucket.total);
  const activeWeeks = weeklyTotals.filter((w) => w > 0).length;
  const totalWeeks = Math.max(weeklyTotals.length, MIN_WEEKS_FOR_COVERAGE);
  return activeWeeks / totalWeeks;
}
