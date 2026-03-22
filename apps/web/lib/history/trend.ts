import type { MetricsSnapshot } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DateValue {
  date: string;
  value: number;
}

export interface DimensionTrend {
  avgDelta: number;
  values: DateValue[];
}

export interface TrendSummary {
  direction: "improving" | "declining" | "stable";
  avgDelta: number;
  compositeValues: DateValue[];
  dimensions: {
    delivery: DimensionTrend;
    quality: DimensionTrend;
    consistency: DimensionTrend;
    breadth: DimensionTrend;
    craft?: DimensionTrend;
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_WINDOW = 7;
const MIN_WINDOW = 2;
const MAX_WINDOW = 30;
const DIRECTION_THRESHOLD = 1.0;

// ---------------------------------------------------------------------------
// computeTrend — pure function
// ---------------------------------------------------------------------------

/**
 * Compute a trend summary from an ordered sequence of metric snapshots.
 *
 * Pure function — deterministic for a given input. Analyzes the most recent
 * `window` snapshots (default 7, clamped to 2..30) and computes:
 * - Overall direction based on average delta of the adjusted composite score
 *   (improving if avg delta > {@link DIRECTION_THRESHOLD}, declining if < negative threshold, else stable)
 * - Per-dimension trends (delivery, quality, consistency, breadth, and optionally craft)
 * - Composite score time series for sparkline rendering
 *
 * Returns `null` when fewer than 2 snapshots are available (trend is meaningless
 * without at least two data points).
 *
 * @param snapshots - Chronologically ordered metric snapshots (oldest first)
 * @param window - Number of recent snapshots to analyze (default: 7, min: 2, max: 30)
 * @returns A {@link TrendSummary} with direction, deltas, and per-dimension breakdowns, or `null` if insufficient data
 */
export function computeTrend(
  snapshots: MetricsSnapshot[],
  window?: number,
): TrendSummary | null {
  if (snapshots.length < 2) return null;

  const w = Math.min(MAX_WINDOW, Math.max(MIN_WINDOW, window ?? DEFAULT_WINDOW));
  const recent = snapshots.slice(-w);

  const compositeValues = recent.map((s) => ({ date: s.date, value: s.adjustedComposite }));
  const avgDelta = averageDelta(recent.map((s) => s.adjustedComposite));

  let direction: TrendSummary["direction"];
  if (avgDelta > DIRECTION_THRESHOLD) {
    direction = "improving";
  } else if (avgDelta < -DIRECTION_THRESHOLD) {
    direction = "declining";
  } else {
    direction = "stable";
  }

  const latest = recent[recent.length - 1]!;
  const dimensions: TrendSummary["dimensions"] = {
    delivery: dimensionTrend(recent, "delivery"),
    quality: dimensionTrend(recent, "quality"),
    consistency: dimensionTrend(recent, "consistency"),
    breadth: dimensionTrend(recent, "breadth"),
  };

  if (latest.craft != null) {
    dimensions.craft = dimensionTrend(recent, "craft");
  }

  return {
    direction,
    avgDelta,
    compositeValues,
    dimensions,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compute the average step-to-step delta across a sequence of numeric values.
 *
 * For a sequence [a, b, c], computes `((b-a) + (c-b)) / 2`. Returns 0 when
 * fewer than 2 values are provided.
 *
 * @param values - Ordered numeric values to compute deltas between
 * @returns The mean of all consecutive deltas
 */
function averageDelta(values: number[]): number {
  if (values.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < values.length; i++) {
    sum += (values[i] ?? 0) - (values[i - 1] ?? 0);
  }
  return sum / (values.length - 1);
}

/**
 * Extract a single dimension's trend from a set of snapshots.
 *
 * Builds a time series of `{date, value}` pairs and computes the average
 * step-to-step delta for the specified dimension. Missing values (e.g., craft
 * on older snapshots) are treated as 0.
 *
 * @param snapshots - Chronologically ordered snapshots
 * @param key - The dimension key to extract (delivery, quality, consistency, breadth, or craft)
 * @returns A {@link DimensionTrend} with the average delta and value time series
 */
function dimensionTrend(
  snapshots: MetricsSnapshot[],
  key: "delivery" | "quality" | "consistency" | "breadth" | "craft",
): DimensionTrend {
  const values = snapshots.map((s) => ({ date: s.date, value: s[key] ?? 0 }));
  return {
    avgDelta: averageDelta(snapshots.map((s) => s[key] ?? 0)),
    values,
  };
}
