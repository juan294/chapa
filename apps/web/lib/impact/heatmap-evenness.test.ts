import { describe, it, expect } from "vitest";
import { computeHeatmapEvenness } from "./heatmap-evenness";
import type { HeatmapDay } from "@chapa/shared";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build heatmap data from weekly totals (13 weeks × 7 days). */
function makeHeatmap(weeklyTotals: number[]): HeatmapDay[] {
  const days: HeatmapDay[] = [];
  for (let w = 0; w < 13; w++) {
    const weekTotal = weeklyTotals[w] ?? 0;
    for (let d = 0; d < 7; d++) {
      // Spread weekly total evenly across days (remainder goes to first days)
      const perDay = Math.floor(weekTotal / 7);
      const extra = d < weekTotal % 7 ? 1 : 0;
      days.push({
        date: `2025-01-${String(w * 7 + d + 1).padStart(2, "0")}`,
        count: perDay + extra,
      });
    }
  }
  return days;
}

/** Build heatmap from raw daily counts (91 entries). */
function makeHeatmapFromDays(dailyCounts: number[]): HeatmapDay[] {
  return dailyCounts.map((count, i) => ({
    date: `2025-01-${String(i + 1).padStart(2, "0")}`,
    count,
  }));
}

// ---------------------------------------------------------------------------
// computeHeatmapEvenness(heatmapData)
// ---------------------------------------------------------------------------

describe("computeHeatmapEvenness(heatmapData)", () => {
  it("returns 0 for empty heatmap", () => {
    expect(computeHeatmapEvenness([])).toBe(0);
  });

  it("returns 0 for all-zero heatmap", () => {
    const heatmap = makeHeatmap([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(computeHeatmapEvenness(heatmap)).toBe(0);
  });

  it("returns ~1.0 for perfectly uniform weekly activity", () => {
    // Every week has exactly the same total
    const heatmap = makeHeatmap([10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10]);
    expect(computeHeatmapEvenness(heatmap)).toBeCloseTo(1.0, 1);
  });

  it("returns low score for single-burst activity", () => {
    // All activity in week 1, nothing else
    const heatmap = makeHeatmap([50, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(computeHeatmapEvenness(heatmap)).toBeLessThan(0.3);
  });

  it("returns moderate score for two-burst activity", () => {
    const heatmap = makeHeatmap([25, 0, 0, 0, 0, 0, 25, 0, 0, 0, 0, 0, 0]);
    const score = computeHeatmapEvenness(heatmap);
    expect(score).toBeGreaterThan(0.1);
    expect(score).toBeLessThan(0.6);
  });

  it("returns higher score for mostly-uniform with one gap", () => {
    const heatmap = makeHeatmap([10, 10, 10, 10, 0, 10, 10, 10, 10, 10, 10, 10, 10]);
    const score = computeHeatmapEvenness(heatmap);
    expect(score).toBeGreaterThan(0.7);
  });

  it("is always between 0 and 1 (inclusive)", () => {
    const scenarios = [
      makeHeatmap([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
      makeHeatmap([5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5]),
      makeHeatmap([100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
      makeHeatmap([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]),
      makeHeatmap([50, 50, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
    ];
    for (const h of scenarios) {
      const score = computeHeatmapEvenness(h);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });

  it("handles heatmap shorter than 91 days", () => {
    const short = makeHeatmapFromDays([5, 5, 5, 5, 5, 5, 5]);
    const score = computeHeatmapEvenness(short);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("handles heatmap with only 1 active week", () => {
    const heatmap = makeHeatmap([7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const score = computeHeatmapEvenness(heatmap);
    expect(score).toBeLessThan(0.3);
  });

  it("scores more-even distributions higher than less-even ones", () => {
    const even = makeHeatmap([10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10]);
    const uneven = makeHeatmap([50, 20, 5, 0, 0, 0, 30, 0, 0, 0, 0, 20, 5]);
    expect(computeHeatmapEvenness(even)).toBeGreaterThan(computeHeatmapEvenness(uneven));
  });

  it("is monotonically better as distribution becomes more uniform", () => {
    // single burst < two bursts < mostly even < perfectly even
    const single = computeHeatmapEvenness(makeHeatmap([91, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
    const two = computeHeatmapEvenness(makeHeatmap([45, 0, 0, 0, 0, 0, 46, 0, 0, 0, 0, 0, 0]));
    const mostly = computeHeatmapEvenness(makeHeatmap([7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7]));
    expect(single).toBeLessThan(two);
    expect(two).toBeLessThan(mostly);
  });

  it("treats gradual ramp-up as moderately even", () => {
    // 1, 2, 3, ..., 13 — ascending
    const ramp = makeHeatmap([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    const score = computeHeatmapEvenness(ramp);
    expect(score).toBeGreaterThan(0.3);
    expect(score).toBeLessThan(0.9);
  });

  it("handles single-day heatmap", () => {
    const single = makeHeatmapFromDays([10]);
    const score = computeHeatmapEvenness(single);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("returns same score regardless of which weeks are active (position-independent)", () => {
    // Same pattern, shifted — should give same evenness
    const a = makeHeatmap([10, 10, 10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const b = makeHeatmap([0, 0, 0, 0, 0, 10, 10, 10, 0, 0, 0, 0, 0]);
    expect(computeHeatmapEvenness(a)).toBeCloseTo(computeHeatmapEvenness(b), 1);
  });

  it("handles heatmap with exactly 7 days (1 week)", () => {
    const oneWeek = makeHeatmapFromDays([3, 3, 3, 3, 3, 3, 3]);
    const score = computeHeatmapEvenness(oneWeek);
    // Single week with uniform activity = perfectly even (1 week, stddev = 0)
    expect(score).toBeCloseTo(1.0, 1);
  });

  it("handles non-multiple-of-7 length (partial last week)", () => {
    // 10 days = 1 full week + 3 days in second week
    const partial = makeHeatmapFromDays([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
    const score = computeHeatmapEvenness(partial);
    // Two weeks: week 1 = 7, week 2 = 3 — somewhat uneven
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  it("handles very large counts without issues", () => {
    const large = makeHeatmap([1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000]);
    const score = computeHeatmapEvenness(large);
    expect(score).toBeCloseTo(1.0, 1);
  });

  it("handles exactly 2 days (partial single week)", () => {
    const tiny = makeHeatmapFromDays([5, 0]);
    const score = computeHeatmapEvenness(tiny);
    // 1 week with total of 5; stddev = 0 since there's only 1 week
    expect(score).toBeCloseTo(1.0, 1);
  });

  it("handles all activity on a single day only", () => {
    const days = new Array(91).fill(0).map((_, i) => ({
      date: `2025-01-${String(i + 1).padStart(2, "0")}`,
      count: i === 0 ? 100 : 0,
    }));
    const score = computeHeatmapEvenness(days);
    expect(score).toBeLessThan(0.3);
  });
});
