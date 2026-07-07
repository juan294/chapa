import { describe, it, expect } from "vitest";
import { mergeStats } from "./merge";
import type { StatsData } from "@chapa/shared";
import { MERGE_EXPECTED_KEYS } from "@chapa/shared";
import { makeStats as _makeStats, makeFullStats } from "../test-helpers/fixtures";

/** Zero-based StatsData — merge tests need a blank slate to verify addition. */
function makeStats(overrides: Partial<StatsData> = {}): StatsData {
  return _makeStats({
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
    totalForks: 0,
    totalWatchers: 0,
    heatmapData: [],
    ...overrides,
  });
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
    it("sums prsMergedWeight and caps at 120", () => {
      const primary = makeStats({ prsMergedWeight: 70 });
      const supplemental = makeStats({ prsMergedWeight: 60 });
      const merged = mergeStats(primary, supplemental);
      expect(merged.prsMergedWeight).toBe(120);
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
      expect(merged.heatmapData[0]!.date).toBe("2025-01-01");
      expect(merged.heatmapData[1]!.date).toBe("2025-01-03");
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

  describe("fetchScope preservation (#1004 phase 2)", () => {
    it("preserves fetchScope from primary, ignoring supplemental's", () => {
      const primary = makeStats({ fetchScope: "authenticated" });
      const supplemental = makeStats({ fetchScope: "public" });
      const merged = mergeStats(primary, supplemental);
      expect(merged.fetchScope).toBe("authenticated");
    });

    it("leaves fetchScope undefined when primary does not have it", () => {
      const primary = makeStats({});
      const supplemental = makeStats({ fetchScope: "authenticated" });
      const merged = mergeStats(primary, supplemental);
      expect(merged.fetchScope).toBeUndefined();
    });
  });

  describe("primaryReviewsSubmittedCount", () => {
    it("stores primary's review count for profile type detection", () => {
      const primary = makeStats({ reviewsSubmittedCount: 0 });
      const supplemental = makeStats({ reviewsSubmittedCount: 6 });
      const merged = mergeStats(primary, supplemental);

      // Total reviews are summed (for quality formula)
      expect(merged.reviewsSubmittedCount).toBe(6);
      // Primary reviews stored separately (for profile type detection)
      expect(merged.primaryReviewsSubmittedCount).toBe(0);
    });

    it("stores primary reviews when both have reviews", () => {
      const primary = makeStats({ reviewsSubmittedCount: 10 });
      const supplemental = makeStats({ reviewsSubmittedCount: 5 });
      const merged = mergeStats(primary, supplemental);

      expect(merged.reviewsSubmittedCount).toBe(15);
      expect(merged.primaryReviewsSubmittedCount).toBe(10);
    });
  });

  describe("hasSupplementalData flag", () => {
    it("sets hasSupplementalData to true by default (backward compat)", () => {
      const merged = mergeStats(makeStats(), makeStats());
      expect(merged.hasSupplementalData).toBe(true);
    });

    it("sets hasSupplementalData to false when markAsSupplemental is false", () => {
      const merged = mergeStats(makeStats(), makeStats(), {
        markAsSupplemental: false,
      });
      expect(merged.hasSupplementalData).toBe(false);
    });

    it("sets hasSupplementalData to true when markAsSupplemental is true", () => {
      const merged = mergeStats(makeStats(), makeStats(), {
        markAsSupplemental: true,
      });
      expect(merged.hasSupplementalData).toBe(true);
    });
  });

  describe("solo quality fields (prDescriptionRate, featureBranchRate, issueLinkageRate)", () => {
    it("merges solo quality fields by weighted average", () => {
      const primary = makeStats({
        prsMergedCount: 10,
        prDescriptionRate: 0.8,
        featureBranchRate: 0.9,
        issueLinkageRate: 0.6,
      });
      const supplemental = makeStats({
        prsMergedCount: 5,
        prDescriptionRate: 0.4,
        featureBranchRate: 0.6,
        issueLinkageRate: 0.0,
      });

      const merged = mergeStats(primary, supplemental);
      // weighted avg: (10*0.8 + 5*0.4) / 15 = 10/15 ≈ 0.667
      expect(merged.prDescriptionRate).toBeCloseTo(0.667, 2);
      // (10*0.9 + 5*0.6) / 15 = 12/15 = 0.8
      expect(merged.featureBranchRate).toBeCloseTo(0.8, 2);
      // (10*0.6 + 5*0.0) / 15 = 6/15 = 0.4
      expect(merged.issueLinkageRate).toBeCloseTo(0.4, 2);
    });

    it("preserves solo quality fields when only primary has them", () => {
      const primary = makeStats({
        prsMergedCount: 10,
        prDescriptionRate: 0.7,
        featureBranchRate: 0.85,
        issueLinkageRate: 0.5,
      });
      const supplemental = makeStats({ prsMergedCount: 0 });

      const merged = mergeStats(primary, supplemental);
      expect(merged.prDescriptionRate).toBeCloseTo(0.7, 2);
      expect(merged.featureBranchRate).toBeCloseTo(0.85, 2);
      expect(merged.issueLinkageRate).toBeCloseTo(0.5, 2);
    });

    it("returns undefined when neither side has solo quality fields", () => {
      const primary = makeStats({});
      const supplemental = makeStats({});
      const merged = mergeStats(primary, supplemental);
      expect(merged.prDescriptionRate).toBeUndefined();
      expect(merged.featureBranchRate).toBeUndefined();
      expect(merged.issueLinkageRate).toBeUndefined();
    });

    it("does NOT dilute primary quality rates when supplemental has undefined rates but many PRs", () => {
      // Bug regression: supplemental with 21 PRs but no quality rates
      // was diluting primary rates by treating undefined as 0 in weighted avg.
      // e.g. featureBranchRate: (0.9 * 10 + 0 * 21) / 31 = 0.29 instead of 0.9
      const primary = makeStats({
        prsMergedCount: 10,
        prDescriptionRate: 0.8,
        featureBranchRate: 0.9,
        issueLinkageRate: 0.5,
        batchSizeScore: 0.6,
        medianPrLeadTimeHours: 4.0,
      });
      const supplemental = makeStats({
        prsMergedCount: 21,
        // All quality rates intentionally omitted (undefined)
      });

      const merged = mergeStats(primary, supplemental);

      // Primary rates must be preserved — not diluted by supplemental's undefined values
      expect(merged.prDescriptionRate).toBeCloseTo(0.8, 2);
      expect(merged.featureBranchRate).toBeCloseTo(0.9, 2);
      expect(merged.issueLinkageRate).toBeCloseTo(0.5, 2);
      expect(merged.batchSizeScore).toBeCloseTo(0.6, 2);
      expect(merged.medianPrLeadTimeHours).toBeCloseTo(4.0, 2);
    });

    it("does NOT dilute supplemental quality rates when primary has undefined rates but many PRs", () => {
      const primary = makeStats({
        prsMergedCount: 15,
        // Quality rates omitted
      });
      const supplemental = makeStats({
        prsMergedCount: 8,
        featureBranchRate: 0.75,
        prDescriptionRate: 0.5,
      });

      const merged = mergeStats(primary, supplemental);

      expect(merged.featureBranchRate).toBeCloseTo(0.75, 2);
      expect(merged.prDescriptionRate).toBeCloseTo(0.5, 2);
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

  describe("field completeness", () => {
    it("output contains every StatsData field when both inputs are fully populated", () => {
      const primary = makeFullStats({ handle: "primary" });
      const supplemental = makeFullStats({ handle: "supplemental" });
      const merged = mergeStats(primary, supplemental);
      const mergedKeys = Object.keys(merged).sort();

      for (const key of MERGE_EXPECTED_KEYS) {
        expect(mergedKeys, `missing field: ${key}`).toContain(key);
        expect(
          merged[key as keyof StatsData],
          `field ${key} is undefined`,
        ).not.toBeUndefined();
      }
    });
  });
});
