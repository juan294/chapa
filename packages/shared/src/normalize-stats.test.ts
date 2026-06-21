import { describe, it, expect } from "vitest";
import { normalizeStats } from "./stats-aggregation";
import { STATS_DATA_KEYS, CLIENT_INJECTED_KEYS } from "./stats-schema";
import type { StatsData } from "./types";

describe("normalizeStats", () => {
  it("fills every required field with a canonical default from an empty partial", () => {
    const stats = normalizeStats({});

    expect(stats.handle).toBe("");
    expect(stats.commitsTotal).toBe(0);
    expect(stats.activeDays).toBe(0);
    expect(stats.prsMergedCount).toBe(0);
    expect(stats.prsMergedWeight).toBe(0);
    expect(stats.reviewsSubmittedCount).toBe(0);
    expect(stats.issuesClosedCount).toBe(0);
    expect(stats.linesAdded).toBe(0);
    expect(stats.linesDeleted).toBe(0);
    expect(stats.reposContributed).toBe(0);
    expect(stats.topRepoShare).toBe(0);
    expect(stats.maxCommitsIn10Min).toBe(0);
    expect(stats.totalStars).toBe(0);
    expect(stats.totalForks).toBe(0);
    expect(stats.totalWatchers).toBe(0);
    expect(stats.heatmapData).toEqual([]);
    expect(typeof stats.fetchedAt).toBe("string");
    expect(stats.fetchedAt.length).toBeGreaterThan(0);
  });

  it("preserves provided required values", () => {
    const stats = normalizeStats({
      handle: "octocat",
      commitsTotal: 42,
      linesAdded: 100,
      heatmapData: [{ date: "2026-06-20", count: 3 }],
    });

    expect(stats.handle).toBe("octocat");
    expect(stats.commitsTotal).toBe(42);
    expect(stats.linesAdded).toBe(100);
    expect(stats.heatmapData).toEqual([{ date: "2026-06-20", count: 3 }]);
  });

  it("omits optional fields when not provided", () => {
    const stats = normalizeStats({ handle: "octocat" });

    expect("batchSizeScore" in stats).toBe(false);
    expect("microCommitRatio" in stats).toBe(false);
    expect("medianPrLeadTimeHours" in stats).toBe(false);
    expect("displayName" in stats).toBe(false);
    expect("linkedPlatforms" in stats).toBe(false);
  });

  it("includes optional fields when explicitly provided (even falsy ones)", () => {
    const stats = normalizeStats({
      handle: "octocat",
      batchSizeScore: 0,
      microCommitRatio: 0.5,
      displayName: "The Octocat",
      linkedPlatforms: ["gitlab"],
    });

    expect(stats.batchSizeScore).toBe(0);
    expect(stats.microCommitRatio).toBe(0.5);
    expect(stats.displayName).toBe("The Octocat");
    expect(stats.linkedPlatforms).toEqual(["gitlab"]);
  });

  it("drops keys whose value is explicitly undefined", () => {
    const stats = normalizeStats({
      handle: "octocat",
      batchSizeScore: undefined,
      displayName: undefined,
    });

    expect("batchSizeScore" in stats).toBe(false);
    expect("displayName" in stats).toBe(false);
  });

  it("honors a provided fetchedAt instead of defaulting to now", () => {
    const stats = normalizeStats({ fetchedAt: "2020-01-01T00:00:00.000Z" });
    expect(stats.fetchedAt).toBe("2020-01-01T00:00:00.000Z");
  });

  it("never emits a key outside the canonical StatsData schema", () => {
    const stats = normalizeStats({ handle: "octocat" }) as unknown as Record<string, unknown>;
    for (const key of Object.keys(stats)) {
      expect(STATS_DATA_KEYS).toContain(key);
    }
  });

  it("produces an object assignable to StatsData with all merge-expected keys defaulted", () => {
    const stats: StatsData = normalizeStats({});
    const expectedRequired = STATS_DATA_KEYS.filter(
      (k) => !CLIENT_INJECTED_KEYS.includes(k) && k !== "displayName" && k !== "avatarUrl",
    );
    // every required (non-optional, non-client-injected) key is present
    const numericRequired = [
      "commitsTotal",
      "activeDays",
      "prsMergedCount",
      "prsMergedWeight",
      "reviewsSubmittedCount",
      "issuesClosedCount",
      "linesAdded",
      "linesDeleted",
      "reposContributed",
      "topRepoShare",
      "maxCommitsIn10Min",
      "totalStars",
      "totalForks",
      "totalWatchers",
    ];
    for (const key of numericRequired) {
      expect(expectedRequired).toContain(key);
      expect(stats).toHaveProperty(key);
    }
  });
});
