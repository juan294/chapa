import { describe, it, expect } from "vitest";
import { applyRecencyWeight, computeRecencyRatio, recencyCutoff } from "./recency";
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

  it("returns 0.25 (neutral) for non-empty heatmap with all zero counts", () => {
    // heatmapData is non-empty but all counts are 0 → totalActivity = 0 → NEUTRAL_RATIO
    const zeroHeatmap: HeatmapDay[] = Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - i * 86400000).toISOString().slice(0, 10),
      count: 0,
    }));
    expect(computeRecencyRatio(zeroHeatmap)).toBe(0.25);
  });

  it("returns ratio between 0 and 1 for mixed recent and old activity", () => {
    // 50 days total: 30 recent (within 90 days), 20 old
    const heatmap: HeatmapDay[] = [];
    const today = new Date();
    // 30 recent days with 2 commits each
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      heatmap.push({ date: d.toISOString().slice(0, 10), count: 2 });
    }
    // 20 old days with 3 commits each
    for (let i = 0; i < 20; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - 200 - i);
      heatmap.push({ date: d.toISOString().slice(0, 10), count: 3 });
    }
    const ratio = computeRecencyRatio(heatmap);
    // 60 recent / (60 + 60) = 0.5
    expect(ratio).toBeCloseTo(0.5, 1);
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

describe("recencyCutoff", () => {
  it("normalizes to UTC midnight for a west-of-UTC timestamp", () => {
    const cutoff = recencyCutoff(new Date("2025-01-15T23:30:00-08:00"));
    expect(cutoff.toISOString()).toBe("2024-10-18T00:00:00.000Z");
    expect(cutoff.getUTCHours()).toBe(0);
  });

  it("normalizes to UTC midnight for an east-of-UTC timestamp", () => {
    const cutoff = recencyCutoff(new Date("2025-01-15T00:30:00+09:00"));
    expect(cutoff.toISOString()).toBe("2024-10-16T00:00:00.000Z");
    expect(cutoff.getUTCHours()).toBe(0);
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

  it("applies a partial penalty for ratio between 0 and 0.25", () => {
    // ratio = 0.125 (midpoint of penalty zone)
    // t = 0.125 / 0.25 = 0.5
    // multiplier = 0.98 + 0.5 * 0.02 = 0.99
    // 100 * 0.99 = 99
    expect(applyRecencyWeight(100, 0.125)).toBe(99);
  });

  it("applies a partial boost for ratio between 0.25 and 1.0", () => {
    // ratio = 0.625 (midpoint of boost zone)
    // t = (0.625 - 0.25) / 0.75 = 0.5
    // multiplier = 1.0 + 0.5 * 0.06 = 1.03
    // 50 * 1.03 = 51.5 → rounded to 52
    expect(applyRecencyWeight(50, 0.625)).toBe(52);
  });

  it("clamps score to 0 minimum", () => {
    // Even with penalty, score 0 stays 0
    expect(applyRecencyWeight(0, 0.0)).toBe(0);
  });

  it("handles very small scores with boost", () => {
    // 1 * 1.06 = 1.06 → rounded to 1
    expect(applyRecencyWeight(1, 1.0)).toBe(1);
  });

  it("handles score of 95 with maximum boost", () => {
    // 95 * 1.06 = 100.7 → clamped to 100
    expect(applyRecencyWeight(95, 1.0)).toBe(100);
  });
});
