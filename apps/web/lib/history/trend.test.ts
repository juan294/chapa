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
});
