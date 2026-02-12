import { describe, it, expect } from "vitest";
import { mergeStats } from "./merge";
import type { Stats90d } from "@chapa/shared";

function makeStats(overrides: Partial<Stats90d> = {}): Stats90d {
  return {
    handle: "primary-user",
    displayName: "Primary User",
    avatarUrl: "https://avatars.githubusercontent.com/u/1",
    commitsTotal: 0,
    activeDays: 0,
    prsMergedCount: 0,
    prsMergedWeight: 0,
    reviewsSubmittedCount: 0,
    issuesClosedCount: 0,
    linesAdded: 0,
    linesDeleted: 0,
    reposContributed: 0,
    topRepoShare: 0,
    maxCommitsIn10Min: 0,
    totalStars: 0,
    heatmapData: [],
    fetchedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("mergeStats", () => {
  describe("numeric sums", () => {
    it("sums commitsTotal, prsMergedCount, reviewsSubmittedCount, issuesClosedCount, linesAdded, linesDeleted", () => {
      const primary = makeStats({
        commitsTotal: 50,
        prsMergedCount: 5,
        reviewsSubmittedCount: 10,
        issuesClosedCount: 3,
        linesAdded: 1000,
        linesDeleted: 500,
      });
      const supplemental = makeStats({
        commitsTotal: 30,
        prsMergedCount: 3,
        reviewsSubmittedCount: 5,
        issuesClosedCount: 2,
        linesAdded: 800,
        linesDeleted: 300,
      });

      const merged = mergeStats(primary, supplemental);
      expect(merged.commitsTotal).toBe(80);
      expect(merged.prsMergedCount).toBe(8);
      expect(merged.reviewsSubmittedCount).toBe(15);
      expect(merged.issuesClosedCount).toBe(5);
      expect(merged.linesAdded).toBe(1800);
      expect(merged.linesDeleted).toBe(800);
    });
  });

  describe("prsMergedWeight cap", () => {
    it("sums prsMergedWeight and caps at 40", () => {
      const primary = makeStats({ prsMergedWeight: 25 });
      const supplemental = makeStats({ prsMergedWeight: 20 });
      const merged = mergeStats(primary, supplemental);
      expect(merged.prsMergedWeight).toBe(40);
    });

    it("sums prsMergedWeight when below cap", () => {
      const primary = makeStats({ prsMergedWeight: 10 });
      const supplemental = makeStats({ prsMergedWeight: 15 });
      const merged = mergeStats(primary, supplemental);
      expect(merged.prsMergedWeight).toBe(25);
    });
  });

  describe("reposContributed", () => {
    it("sums reposContributed", () => {
      const primary = makeStats({ reposContributed: 3 });
      const supplemental = makeStats({ reposContributed: 4 });
      const merged = mergeStats(primary, supplemental);
      expect(merged.reposContributed).toBe(7);
    });
  });

  describe("heatmap merge", () => {
    it("merges heatmapData by date (same date sums counts)", () => {
      const primary = makeStats({
        heatmapData: [
          { date: "2025-01-01", count: 3 },
          { date: "2025-01-02", count: 5 },
        ],
      });
      const supplemental = makeStats({
        heatmapData: [
          { date: "2025-01-01", count: 2 },
          { date: "2025-01-03", count: 4 },
        ],
      });

      const merged = mergeStats(primary, supplemental);
      expect(merged.heatmapData).toHaveLength(3);

      const byDate = new Map(merged.heatmapData.map((d) => [d.date, d.count]));
      expect(byDate.get("2025-01-01")).toBe(5);
      expect(byDate.get("2025-01-02")).toBe(5);
      expect(byDate.get("2025-01-03")).toBe(4);
    });

    it("sorts merged heatmap chronologically", () => {
      const primary = makeStats({
        heatmapData: [{ date: "2025-01-03", count: 1 }],
      });
      const supplemental = makeStats({
        heatmapData: [{ date: "2025-01-01", count: 1 }],
      });

      const merged = mergeStats(primary, supplemental);
      expect(merged.heatmapData[0].date).toBe("2025-01-01");
      expect(merged.heatmapData[1].date).toBe("2025-01-03");
    });
  });

  describe("activeDays", () => {
    it("counts days with count > 0 in merged heatmap", () => {
      const primary = makeStats({
        activeDays: 1,
        heatmapData: [
          { date: "2025-01-01", count: 3 },
          { date: "2025-01-02", count: 0 },
        ],
      });
      const supplemental = makeStats({
        activeDays: 1,
        heatmapData: [
          { date: "2025-01-02", count: 2 },
          { date: "2025-01-03", count: 0 },
        ],
      });

      const merged = mergeStats(primary, supplemental);
      // Jan 1: 3, Jan 2: 0+2=2, Jan 3: 0 → 2 active days
      expect(merged.activeDays).toBe(2);
    });
  });

  describe("topRepoShare approximation", () => {
    it("approximates topRepoShare from weighted averages", () => {
      const primary = makeStats({
        commitsTotal: 60,
        topRepoShare: 0.5, // 30 commits in top repo
      });
      const supplemental = makeStats({
        commitsTotal: 40,
        topRepoShare: 0.8, // 32 commits in top repo
      });

      const merged = mergeStats(primary, supplemental);
      // max(60*0.5, 40*0.8) / (60+40) = max(30, 32) / 100 = 0.32
      expect(merged.topRepoShare).toBeCloseTo(0.32, 2);
    });

    it("returns 0 when both have 0 commits", () => {
      const primary = makeStats({ commitsTotal: 0, topRepoShare: 0 });
      const supplemental = makeStats({ commitsTotal: 0, topRepoShare: 0 });
      const merged = mergeStats(primary, supplemental);
      expect(merged.topRepoShare).toBe(0);
    });
  });

  describe("totalStars", () => {
    it("takes the max of both (avoids double-counting overlapping repos)", () => {
      const primary = makeStats({ totalStars: 200 });
      const supplemental = makeStats({ totalStars: 150 });
      const merged = mergeStats(primary, supplemental);
      expect(merged.totalStars).toBe(200);
    });

    it("takes supplemental if higher", () => {
      const primary = makeStats({ totalStars: 50 });
      const supplemental = makeStats({ totalStars: 300 });
      const merged = mergeStats(primary, supplemental);
      expect(merged.totalStars).toBe(300);
    });
  });

  describe("maxCommitsIn10Min", () => {
    it("takes the max of both", () => {
      const primary = makeStats({ maxCommitsIn10Min: 15 });
      const supplemental = makeStats({ maxCommitsIn10Min: 25 });
      const merged = mergeStats(primary, supplemental);
      expect(merged.maxCommitsIn10Min).toBe(25);
    });
  });

  describe("optional ratios", () => {
    it("takes max of microCommitRatio when both defined", () => {
      const primary = makeStats({ microCommitRatio: 0.3 });
      const supplemental = makeStats({ microCommitRatio: 0.5 });
      const merged = mergeStats(primary, supplemental);
      expect(merged.microCommitRatio).toBe(0.5);
    });

    it("takes max of docsOnlyPrRatio when both defined", () => {
      const primary = makeStats({ docsOnlyPrRatio: 0.2 });
      const supplemental = makeStats({ docsOnlyPrRatio: 0.1 });
      const merged = mergeStats(primary, supplemental);
      expect(merged.docsOnlyPrRatio).toBe(0.2);
    });

    it("uses the defined value when only one is defined", () => {
      const primary = makeStats({ microCommitRatio: 0.4 });
      const supplemental = makeStats({});
      const merged = mergeStats(primary, supplemental);
      expect(merged.microCommitRatio).toBe(0.4);
    });

    it("leaves undefined when neither is defined", () => {
      const primary = makeStats({});
      const supplemental = makeStats({});
      const merged = mergeStats(primary, supplemental);
      expect(merged.microCommitRatio).toBeUndefined();
    });
  });

  describe("identity preservation", () => {
    it("preserves primary handle, displayName, avatarUrl, fetchedAt", () => {
      const primary = makeStats({
        handle: "juan294",
        displayName: "Juan García",
        avatarUrl: "https://avatars.example.com/juan",
        fetchedAt: "2025-01-15T00:00:00Z",
      });
      const supplemental = makeStats({
        handle: "juan_corp",
        displayName: "Juan Corp",
        avatarUrl: "https://avatars.example.com/corp",
        fetchedAt: "2025-01-14T00:00:00Z",
      });

      const merged = mergeStats(primary, supplemental);
      expect(merged.handle).toBe("juan294");
      expect(merged.displayName).toBe("Juan García");
      expect(merged.avatarUrl).toBe("https://avatars.example.com/juan");
      expect(merged.fetchedAt).toBe("2025-01-15T00:00:00Z");
    });
  });

  describe("hasSupplementalData flag", () => {
    it("sets hasSupplementalData to true", () => {
      const merged = mergeStats(makeStats(), makeStats());
      expect(merged.hasSupplementalData).toBe(true);
    });
  });

  describe("determinism", () => {
    it("produces the same output for the same inputs", () => {
      const primary = makeStats({ commitsTotal: 50, prsMergedWeight: 15 });
      const supplemental = makeStats({ commitsTotal: 30, prsMergedWeight: 10 });
      const result1 = mergeStats(primary, supplemental);
      const result2 = mergeStats(primary, supplemental);
      expect(result1).toEqual(result2);
    });
  });
});
