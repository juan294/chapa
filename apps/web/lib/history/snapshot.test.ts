import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { StatsData, ImpactV4Result } from "@chapa/shared";
import { buildSnapshot } from "./snapshot";
import {
  makeStats as _makeStats,
  makeImpact as _makeImpact,
} from "../test-helpers/fixtures";

// ---------------------------------------------------------------------------
// Local wrappers — snapshot tests need specific field values for assertions
// ---------------------------------------------------------------------------

function makeStats(overrides: Partial<StatsData> = {}): StatsData {
  return _makeStats({
    handle: "TestUser",
    displayName: "Test User",
    avatarUrl: "https://avatars.githubusercontent.com/u/12345",
    commitsTotal: 150,
    activeDays: 200,
    prsMergedCount: 30,
    prsMergedWeight: 45,
    reviewsSubmittedCount: 20,
    issuesClosedCount: 10,
    linesAdded: 5000,
    linesDeleted: 2000,
    reposContributed: 8,
    maxCommitsIn10Min: 3,
    microCommitRatio: 0.05,
    docsOnlyPrRatio: 0.1,
    totalStars: 100,
    totalForks: 25,
    totalWatchers: 50,
    heatmapData: [{ date: "2025-01-01", count: 5 }],
    fetchedAt: "2025-06-15T12:00:00.000Z",
    ...overrides,
  });
}

function makeImpact(overrides: Partial<ImpactV4Result> = {}): ImpactV4Result {
  return _makeImpact({
    handle: "TestUser",
    dimensions: {
      building: 75,
      guarding: 60,
      consistency: 80,
      breadth: 55,
    },
    compositeScore: 67.5,
    confidence: 90,
    adjustedComposite: 60.75,
    tier: "High",
    computedAt: "2025-06-15T12:00:00.000Z",
    ...overrides,
  });
}

describe("buildSnapshot", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-15T14:30:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("extracts all stats fields from StatsData", () => {
    const stats = makeStats();
    const impact = makeImpact();
    const snapshot = buildSnapshot(stats, impact);

    expect(snapshot.commitsTotal).toBe(150);
    expect(snapshot.prsMergedCount).toBe(30);
    expect(snapshot.prsMergedWeight).toBe(45);
    expect(snapshot.reviewsSubmittedCount).toBe(20);
    expect(snapshot.issuesClosedCount).toBe(10);
    expect(snapshot.reposContributed).toBe(8);
    expect(snapshot.activeDays).toBe(200);
    expect(snapshot.linesAdded).toBe(5000);
    expect(snapshot.linesDeleted).toBe(2000);
    expect(snapshot.totalStars).toBe(100);
    expect(snapshot.totalForks).toBe(25);
    expect(snapshot.totalWatchers).toBe(50);
    expect(snapshot.topRepoShare).toBe(0.4);
  });

  it("extracts all impact fields from ImpactV4Result", () => {
    const stats = makeStats();
    const impact = makeImpact();
    const snapshot = buildSnapshot(stats, impact);

    expect(snapshot.building).toBe(75);
    expect(snapshot.guarding).toBe(60);
    expect(snapshot.consistency).toBe(80);
    expect(snapshot.breadth).toBe(55);
    expect(snapshot.archetype).toBe("Builder");
    expect(snapshot.profileType).toBe("collaborative");
    expect(snapshot.compositeScore).toBe(67.5);
    expect(snapshot.adjustedComposite).toBe(60.75);
    expect(snapshot.confidence).toBe(90);
    expect(snapshot.tier).toBe("High");
  });

  it("sets date to today in YYYY-MM-DD format (UTC)", () => {
    const snapshot = buildSnapshot(makeStats(), makeImpact());
    expect(snapshot.date).toBe("2025-06-15");
  });

  it("sets capturedAt to current ISO timestamp", () => {
    const snapshot = buildSnapshot(makeStats(), makeImpact());
    expect(snapshot.capturedAt).toBe("2025-06-15T14:30:00.000Z");
  });

  it("excludes heatmapData, displayName, avatarUrl, handle, fetchedAt, computedAt", () => {
    const snapshot = buildSnapshot(makeStats(), makeImpact());
    const keys = Object.keys(snapshot);

    expect(keys).not.toContain("heatmapData");
    expect(keys).not.toContain("displayName");
    expect(keys).not.toContain("avatarUrl");
    expect(keys).not.toContain("handle");
    expect(keys).not.toContain("fetchedAt");
    expect(keys).not.toContain("computedAt");
  });

  it("includes explanatory stats fields", () => {
    const snapshot = buildSnapshot(
      makeStats({ maxCommitsIn10Min: 25, microCommitRatio: 0.7, docsOnlyPrRatio: 0.3 }),
      makeImpact(),
    );

    expect(snapshot.maxCommitsIn10Min).toBe(25);
    expect(snapshot.microCommitRatio).toBe(0.7);
    expect(snapshot.docsOnlyPrRatio).toBe(0.3);
  });

  it("includes confidence penalties when present", () => {
    const snapshot = buildSnapshot(
      makeStats(),
      makeImpact({
        confidencePenalties: [
          { flag: "burst_activity", penalty: 15, reason: "Some activity appears in short bursts" },
          { flag: "micro_commit_pattern", penalty: 10, reason: "Many small changes" },
        ],
      }),
    );

    expect(snapshot.confidencePenalties).toEqual([
      { flag: "burst_activity", penalty: 15 },
      { flag: "micro_commit_pattern", penalty: 10 },
    ]);
  });

  it("omits confidencePenalties when empty", () => {
    const snapshot = buildSnapshot(
      makeStats(),
      makeImpact({ confidencePenalties: [] }),
    );

    expect(snapshot.confidencePenalties).toBeUndefined();
    expect(Object.keys(snapshot)).not.toContain("confidencePenalties");
  });

  it("is a pure function — same input produces same output", () => {
    const stats = makeStats();
    const impact = makeImpact();
    const a = buildSnapshot(stats, impact);
    const b = buildSnapshot(stats, impact);
    expect(a).toEqual(b);
  });

  it("does not mutate input objects", () => {
    const stats = makeStats();
    const impact = makeImpact();
    const statsCopy = JSON.parse(JSON.stringify(stats));
    const impactCopy = JSON.parse(JSON.stringify(impact));

    buildSnapshot(stats, impact);

    expect(stats).toEqual(statsCopy);
    expect(impact).toEqual(impactCopy);
  });

  it("has exactly 28 keys when all explanatory fields present", () => {
    const snapshot = buildSnapshot(
      makeStats({ maxCommitsIn10Min: 5, microCommitRatio: 0.1, docsOnlyPrRatio: 0.2 }),
      makeImpact({
        confidencePenalties: [{ flag: "burst_activity", penalty: 15, reason: "burst" }],
      }),
    );
    // 25 original + 3 explanatory stats + 1 confidencePenalties = 29
    // But confidencePenalties is only present when non-empty, so 28 + 1 = 29
    // Wait: maxCommitsIn10Min, microCommitRatio, docsOnlyPrRatio = 3 new stats fields
    // confidencePenalties = 1 new field (when non-empty)
    // 25 + 3 + 1 = 29
    expect(Object.keys(snapshot)).toHaveLength(29);
  });

  it("has exactly 28 keys when no penalties", () => {
    const snapshot = buildSnapshot(makeStats(), makeImpact({ confidencePenalties: [] }));
    // 25 original + 3 explanatory stats = 28 (no confidencePenalties key)
    expect(Object.keys(snapshot)).toHaveLength(28);
  });
});
