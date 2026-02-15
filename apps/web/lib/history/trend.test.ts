import { describe, expect, it } from "vitest";
import type { MetricsSnapshot } from "./types";
import { computeTrend } from "./trend";

function makeSnapshot(overrides: Partial<MetricsSnapshot> = {}): MetricsSnapshot {
  return {
    date: "2025-06-15",
    capturedAt: "2025-06-15T14:30:00.000Z",
    commitsTotal: 150,
    prsMergedCount: 30,
    prsMergedWeight: 45,
    reviewsSubmittedCount: 20,
    issuesClosedCount: 10,
    reposContributed: 8,
    activeDays: 200,
    linesAdded: 5000,
    linesDeleted: 2000,
    totalStars: 100,
    totalForks: 25,
    totalWatchers: 50,
    topRepoShare: 0.4,
    maxCommitsIn10Min: 3,
    building: 75,
    guarding: 60,
    consistency: 80,
    breadth: 55,
    archetype: "Builder",
    profileType: "collaborative",
    compositeScore: 67.5,
    adjustedComposite: 60,
    confidence: 90,
    tier: "High",
    ...overrides,
  };
}

describe("computeTrend", () => {
  it("returns null when fewer than 2 snapshots", () => {
    expect(computeTrend([])).toBeNull();
    expect(computeTrend([makeSnapshot()])).toBeNull();
  });

  it("computes improving direction from rising adjustedComposite", () => {
    const snapshots = [
      makeSnapshot({ date: "2025-06-13", adjustedComposite: 50 }),
      makeSnapshot({ date: "2025-06-14", adjustedComposite: 52 }),
      makeSnapshot({ date: "2025-06-15", adjustedComposite: 55 }),
    ];
    const trend = computeTrend(snapshots);

    expect(trend).not.toBeNull();
    expect(trend!.direction).toBe("improving");
    expect(trend!.avgDelta).toBeGreaterThan(0);
  });

  it("computes declining direction from falling adjustedComposite", () => {
    const snapshots = [
      makeSnapshot({ date: "2025-06-13", adjustedComposite: 60 }),
      makeSnapshot({ date: "2025-06-14", adjustedComposite: 57 }),
      makeSnapshot({ date: "2025-06-15", adjustedComposite: 54 }),
    ];
    const trend = computeTrend(snapshots);

    expect(trend).not.toBeNull();
    expect(trend!.direction).toBe("declining");
    expect(trend!.avgDelta).toBeLessThan(0);
  });

  it("computes stable direction when changes are small", () => {
    const snapshots = [
      makeSnapshot({ date: "2025-06-13", adjustedComposite: 50 }),
      makeSnapshot({ date: "2025-06-14", adjustedComposite: 50.5 }),
      makeSnapshot({ date: "2025-06-15", adjustedComposite: 50.2 }),
    ];
    const trend = computeTrend(snapshots);

    expect(trend).not.toBeNull();
    expect(trend!.direction).toBe("stable");
  });

  it("includes compositeValues array", () => {
    const snapshots = [
      makeSnapshot({ date: "2025-06-13", adjustedComposite: 50 }),
      makeSnapshot({ date: "2025-06-14", adjustedComposite: 55 }),
      makeSnapshot({ date: "2025-06-15", adjustedComposite: 60 }),
    ];
    const trend = computeTrend(snapshots);

    expect(trend!.compositeValues).toEqual([
      { date: "2025-06-13", value: 50 },
      { date: "2025-06-14", value: 55 },
      { date: "2025-06-15", value: 60 },
    ]);
  });

  it("includes per-dimension value arrays", () => {
    const snapshots = [
      makeSnapshot({ date: "2025-06-13", building: 70, guarding: 50, consistency: 80, breadth: 40 }),
      makeSnapshot({ date: "2025-06-14", building: 75, guarding: 55, consistency: 75, breadth: 45 }),
    ];
    const trend = computeTrend(snapshots);

    expect(trend!.dimensions.building.values).toEqual([
      { date: "2025-06-13", value: 70 },
      { date: "2025-06-14", value: 75 },
    ]);
    expect(trend!.dimensions.building.avgDelta).toBe(5);
  });

  it("respects window parameter to limit recent snapshots", () => {
    const snapshots = [
      makeSnapshot({ date: "2025-06-10", adjustedComposite: 80 }),
      makeSnapshot({ date: "2025-06-11", adjustedComposite: 75 }),
      makeSnapshot({ date: "2025-06-12", adjustedComposite: 70 }),
      makeSnapshot({ date: "2025-06-13", adjustedComposite: 50 }),
      makeSnapshot({ date: "2025-06-14", adjustedComposite: 55 }),
      makeSnapshot({ date: "2025-06-15", adjustedComposite: 60 }),
    ];

    // Window of 3 = last 3 snapshots: 50 → 55 → 60 = improving
    const trend = computeTrend(snapshots, 3);

    expect(trend!.direction).toBe("improving");
    expect(trend!.compositeValues).toHaveLength(3);
  });

  it("clamps window to minimum of 2", () => {
    const snapshots = [
      makeSnapshot({ date: "2025-06-14", adjustedComposite: 50 }),
      makeSnapshot({ date: "2025-06-15", adjustedComposite: 55 }),
    ];
    const trend = computeTrend(snapshots, 1);

    expect(trend).not.toBeNull();
    expect(trend!.compositeValues).toHaveLength(2);
  });

  it("clamps window to maximum of 30", () => {
    const snapshots = Array.from({ length: 40 }, (_, i) =>
      makeSnapshot({
        date: `2025-05-${String(i + 1).padStart(2, "0")}`,
        adjustedComposite: 50 + i,
      }),
    );
    const trend = computeTrend(snapshots, 100);

    expect(trend!.compositeValues).toHaveLength(30);
  });

  it("defaults window to 7", () => {
    const snapshots = Array.from({ length: 10 }, (_, i) =>
      makeSnapshot({
        date: `2025-06-${String(i + 1).padStart(2, "0")}`,
        adjustedComposite: 50 + i,
      }),
    );
    const trend = computeTrend(snapshots);

    expect(trend!.compositeValues).toHaveLength(7);
  });

  it("uses all snapshots when fewer than window", () => {
    const snapshots = [
      makeSnapshot({ date: "2025-06-14", adjustedComposite: 50 }),
      makeSnapshot({ date: "2025-06-15", adjustedComposite: 55 }),
    ];
    const trend = computeTrend(snapshots, 7);

    expect(trend!.compositeValues).toHaveLength(2);
  });

  it("handles exactly 2 snapshots", () => {
    const snapshots = [
      makeSnapshot({ date: "2025-06-14", adjustedComposite: 50, building: 60 }),
      makeSnapshot({ date: "2025-06-15", adjustedComposite: 55, building: 70 }),
    ];
    const trend = computeTrend(snapshots);

    expect(trend!.avgDelta).toBe(5);
    expect(trend!.dimensions.building.avgDelta).toBe(10);
  });

  it("is a pure function — does not mutate input array", () => {
    const snapshots = [
      makeSnapshot({ date: "2025-06-14", adjustedComposite: 50 }),
      makeSnapshot({ date: "2025-06-15", adjustedComposite: 55 }),
    ];
    const copy = [...snapshots];

    computeTrend(snapshots);

    expect(snapshots).toEqual(copy);
    expect(snapshots.length).toBe(2);
  });
});
