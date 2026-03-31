import { describe, expect, it } from "vitest";
import { computeTrend } from "./trend";
import { makeSnapshot } from "../test-helpers/fixtures";

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
      makeSnapshot({ date: "2025-06-13", delivery: 70, quality: 50, consistency: 80, breadth: 40 }),
      makeSnapshot({ date: "2025-06-14", delivery: 75, quality: 55, consistency: 75, breadth: 45 }),
    ];
    const trend = computeTrend(snapshots);

    expect(trend!.dimensions.delivery.values).toEqual([
      { date: "2025-06-13", value: 70 },
      { date: "2025-06-14", value: 75 },
    ]);
    expect(trend!.dimensions.delivery.avgDelta).toBe(5);
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
      makeSnapshot({ date: "2025-06-14", adjustedComposite: 50, delivery: 60 }),
      makeSnapshot({ date: "2025-06-15", adjustedComposite: 55, delivery: 70 }),
    ];
    const trend = computeTrend(snapshots);

    expect(trend!.avgDelta).toBe(5);
    expect(trend!.dimensions.delivery.avgDelta).toBe(10);
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

  it("includes craft trend when snapshots have craft dimension", () => {
    const snapshots = [
      makeSnapshot({ date: "2025-06-14", craft: 30 }),
      makeSnapshot({ date: "2025-06-15", craft: 40 }),
    ];
    const trend = computeTrend(snapshots);

    expect(trend).not.toBeNull();
    expect(trend!.dimensions.craft).toBeDefined();
    expect(trend!.dimensions.craft!.avgDelta).toBe(10);
    expect(trend!.dimensions.craft!.values).toEqual([
      { date: "2025-06-14", value: 30 },
      { date: "2025-06-15", value: 40 },
    ]);
  });

  it("excludes craft trend when snapshots lack craft dimension", () => {
    const snapshots = [
      makeSnapshot({ date: "2025-06-14" }),
      makeSnapshot({ date: "2025-06-15" }),
    ];
    const trend = computeTrend(snapshots);

    expect(trend).not.toBeNull();
    expect(trend!.dimensions.craft).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // Window boundary clamping
  // ---------------------------------------------------------------------------

  it("clamps window=1 up to minimum of 2", () => {
    const snapshots = [
      makeSnapshot({ date: "2025-06-14", adjustedComposite: 50 }),
      makeSnapshot({ date: "2025-06-15", adjustedComposite: 55 }),
      makeSnapshot({ date: "2025-06-16", adjustedComposite: 60 }),
    ];
    const trend = computeTrend(snapshots, 1);

    // window clamped to 2 → takes last 2 snapshots
    expect(trend!.compositeValues).toHaveLength(2);
    expect(trend!.compositeValues[0]!.value).toBe(55);
    expect(trend!.compositeValues[1]!.value).toBe(60);
  });

  it("accepts window=2 without clamping (exact minimum)", () => {
    const snapshots = [
      makeSnapshot({ date: "2025-06-14", adjustedComposite: 50 }),
      makeSnapshot({ date: "2025-06-15", adjustedComposite: 55 }),
      makeSnapshot({ date: "2025-06-16", adjustedComposite: 60 }),
    ];
    const trend = computeTrend(snapshots, 2);

    expect(trend!.compositeValues).toHaveLength(2);
  });

  it("accepts window=30 without clamping (exact maximum)", () => {
    const snapshots = Array.from({ length: 35 }, (_, i) =>
      makeSnapshot({
        date: `2025-06-${String(i + 1).padStart(2, "0")}`,
        adjustedComposite: 50 + i,
      }),
    );
    const trend = computeTrend(snapshots, 30);

    expect(trend!.compositeValues).toHaveLength(30);
  });

  it("clamps window=31 down to maximum of 30", () => {
    const snapshots = Array.from({ length: 35 }, (_, i) =>
      makeSnapshot({
        date: `2025-06-${String(i + 1).padStart(2, "0")}`,
        adjustedComposite: 50 + i,
      }),
    );
    const trend = computeTrend(snapshots, 31);

    expect(trend!.compositeValues).toHaveLength(30);
  });

  // ---------------------------------------------------------------------------
  // Direction threshold boundaries
  // ---------------------------------------------------------------------------

  it("returns stable when avgDelta is exactly +1.0 (at threshold)", () => {
    // With 2 snapshots, avgDelta = (v2 - v1) / 1 = v2 - v1
    // avgDelta of exactly 1.0 is NOT > 1.0, so direction should be "stable"
    const snapshots = [
      makeSnapshot({ date: "2025-06-14", adjustedComposite: 50 }),
      makeSnapshot({ date: "2025-06-15", adjustedComposite: 51 }),
    ];
    const trend = computeTrend(snapshots);

    expect(trend!.avgDelta).toBe(1.0);
    expect(trend!.direction).toBe("stable");
  });

  it("returns stable when avgDelta is exactly -1.0 (at threshold)", () => {
    const snapshots = [
      makeSnapshot({ date: "2025-06-14", adjustedComposite: 51 }),
      makeSnapshot({ date: "2025-06-15", adjustedComposite: 50 }),
    ];
    const trend = computeTrend(snapshots);

    expect(trend!.avgDelta).toBe(-1.0);
    expect(trend!.direction).toBe("stable");
  });

  it("returns improving when avgDelta is just above +1.0", () => {
    const snapshots = [
      makeSnapshot({ date: "2025-06-14", adjustedComposite: 50 }),
      makeSnapshot({ date: "2025-06-15", adjustedComposite: 51.01 }),
    ];
    const trend = computeTrend(snapshots);

    expect(trend!.avgDelta).toBeCloseTo(1.01);
    expect(trend!.direction).toBe("improving");
  });

  it("returns declining when avgDelta is just below -1.0", () => {
    const snapshots = [
      makeSnapshot({ date: "2025-06-14", adjustedComposite: 51.01 }),
      makeSnapshot({ date: "2025-06-15", adjustedComposite: 50 }),
    ];
    const trend = computeTrend(snapshots);

    expect(trend!.avgDelta).toBeCloseTo(-1.01);
    expect(trend!.direction).toBe("declining");
  });

  // ---------------------------------------------------------------------------
  // Craft dimension: null vs present on latest snapshot
  // ---------------------------------------------------------------------------

  it("includes craft dimension when latest snapshot has craft !== null", () => {
    const snapshots = [
      makeSnapshot({ date: "2025-06-14", craft: 20 }),
      makeSnapshot({ date: "2025-06-15", craft: 35 }),
    ];
    const trend = computeTrend(snapshots);

    expect(trend!.dimensions.craft).toBeDefined();
    expect(trend!.dimensions.craft!.avgDelta).toBe(15);
  });

  it("excludes craft dimension when latest snapshot has craft === null", () => {
    // Explicit null on the latest snapshot
    const snapshots = [
      makeSnapshot({ date: "2025-06-14", craft: 20 }),
      makeSnapshot({ date: "2025-06-15", craft: undefined }),
    ];
    const trend = computeTrend(snapshots);

    // latest.craft is undefined (== null), so craft should be excluded
    expect(trend!.dimensions.craft).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // dimensionTrend with null/undefined values (uses ?? 0)
  // ---------------------------------------------------------------------------

  it("treats missing dimension values as 0 via nullish coalescing", () => {
    const snapshots = [
      makeSnapshot({ date: "2025-06-14", craft: undefined }),
      makeSnapshot({ date: "2025-06-15", craft: 40 }),
    ];
    // Force craft to be included by making the latest have craft
    const trend = computeTrend(snapshots);

    expect(trend!.dimensions.craft).toBeDefined();
    // First snapshot craft=undefined → 0, second=40, delta=40
    expect(trend!.dimensions.craft!.values[0]!.value).toBe(0);
    expect(trend!.dimensions.craft!.values[1]!.value).toBe(40);
    expect(trend!.dimensions.craft!.avgDelta).toBe(40);
  });

  // ---------------------------------------------------------------------------
  // averageDelta edge cases (via compositeValues)
  // ---------------------------------------------------------------------------

  it("returns avgDelta=0 when all snapshots have equal adjustedComposite", () => {
    const snapshots = [
      makeSnapshot({ date: "2025-06-14", adjustedComposite: 50 }),
      makeSnapshot({ date: "2025-06-15", adjustedComposite: 50 }),
      makeSnapshot({ date: "2025-06-16", adjustedComposite: 50 }),
    ];
    const trend = computeTrend(snapshots);

    expect(trend!.avgDelta).toBe(0);
    expect(trend!.direction).toBe("stable");
  });

  it("computes correct avgDelta with exactly 2 values", () => {
    const snapshots = [
      makeSnapshot({ date: "2025-06-14", adjustedComposite: 40 }),
      makeSnapshot({ date: "2025-06-15", adjustedComposite: 50 }),
    ];
    const trend = computeTrend(snapshots);

    // avgDelta = (50 - 40) / 1 = 10
    expect(trend!.avgDelta).toBe(10);
  });
});
