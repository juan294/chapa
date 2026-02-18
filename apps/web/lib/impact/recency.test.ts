import { describe, it, expect } from "vitest";
import { computeRecencyRatio, applyRecencyWeight } from "./recency";
import type { HeatmapDay } from "@chapa/shared";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a heatmap with `total` contributions spread evenly across `numDays` days,
 *  starting from `startDaysAgo` days before today. */
function makeHeatmap(numDays: number, countPerDay: number, startDaysAgo: number): HeatmapDay[] {
  const days: HeatmapDay[] = [];
  const today = new Date();
  for (let i = 0; i < numDays; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - startDaysAgo + i);
    days.push({
      date: d.toISOString().slice(0, 10),
      count: countPerDay,
    });
  }
  return days;
}

// ---------------------------------------------------------------------------
// computeRecencyRatio(heatmapData)
// ---------------------------------------------------------------------------

describe("computeRecencyRatio(heatmapData)", () => {
  it("returns 0.25 (neutral) for empty heatmap", () => {
    expect(computeRecencyRatio([])).toBe(0.25);
  });

  it("returns 0.25 for perfectly uniform activity across 365 days", () => {
    // 365 days of 1 commit each: 90 recent out of 365 total = 24.7% ≈ 0.25
    const heatmap = makeHeatmap(365, 1, 364);
    const ratio = computeRecencyRatio(heatmap);
    expect(ratio).toBeCloseTo(90 / 365, 1);
  });

  it("returns 1.0 when all activity is in the last 90 days", () => {
    const heatmap = makeHeatmap(90, 5, 89);
    const ratio = computeRecencyRatio(heatmap);
    expect(ratio).toBe(1.0);
  });

  it("returns 0.0 when no activity is in the last 90 days", () => {
    const heatmap = makeHeatmap(90, 5, 200);
    const ratio = computeRecencyRatio(heatmap);
    expect(ratio).toBe(0.0);
  });

  it("is bounded 0.0 to 1.0", () => {
    const scenarios = [
      [],
      makeHeatmap(10, 1, 9),
      makeHeatmap(365, 3, 364),
      makeHeatmap(30, 10, 300),
    ];
    for (const heatmap of scenarios) {
      const ratio = computeRecencyRatio(heatmap);
      expect(ratio).toBeGreaterThanOrEqual(0);
      expect(ratio).toBeLessThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// applyRecencyWeight(score, recencyRatio)
// ---------------------------------------------------------------------------

describe("applyRecencyWeight(score, recencyRatio)", () => {
  it("returns neutral (1.0x) when recencyRatio = 0.25", () => {
    expect(applyRecencyWeight(50, 0.25)).toBe(50);
  });

  it("returns max boost (1.06x) when recencyRatio = 1.0", () => {
    // 50 * 1.06 = 53
    expect(applyRecencyWeight(50, 1.0)).toBe(53);
  });

  it("returns min penalty (0.98x) when recencyRatio = 0.0", () => {
    // 50 * 0.98 = 49
    expect(applyRecencyWeight(50, 0.0)).toBe(49);
  });

  it("returns 100 * 1.06 clamped to 100", () => {
    expect(applyRecencyWeight(100, 1.0)).toBe(100);
  });

  it("returns 0 regardless of ratio", () => {
    expect(applyRecencyWeight(0, 1.0)).toBe(0);
    expect(applyRecencyWeight(0, 0.0)).toBe(0);
  });

  it("returns an integer", () => {
    expect(Number.isInteger(applyRecencyWeight(73, 0.5))).toBe(true);
  });

  it("multiplier is between 0.98 and 1.06 for any ratio", () => {
    for (const ratio of [0, 0.1, 0.25, 0.5, 0.75, 1.0]) {
      const result = applyRecencyWeight(100, ratio);
      expect(result).toBeGreaterThanOrEqual(98);
      expect(result).toBeLessThanOrEqual(100); // clamped
    }
  });
});
