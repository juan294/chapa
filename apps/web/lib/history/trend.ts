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
    building: DimensionTrend;
    guarding: DimensionTrend;
    consistency: DimensionTrend;
    breadth: DimensionTrend;
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

  return {
    direction,
    avgDelta,
    compositeValues,
    dimensions: {
      building: dimensionTrend(recent, "building"),
      guarding: dimensionTrend(recent, "guarding"),
      consistency: dimensionTrend(recent, "consistency"),
      breadth: dimensionTrend(recent, "breadth"),
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function averageDelta(values: number[]): number {
  if (values.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < values.length; i++) {
    sum += (values[i] ?? 0) - (values[i - 1] ?? 0);
  }
  return sum / (values.length - 1);
}

function dimensionTrend(
  snapshots: MetricsSnapshot[],
  key: "building" | "guarding" | "consistency" | "breadth",
): DimensionTrend {
  const values = snapshots.map((s) => ({ date: s.date, value: s[key] }));
  return {
    avgDelta: averageDelta(snapshots.map((s) => s[key])),
    values,
  };
}
