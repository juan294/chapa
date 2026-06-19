import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PR_WEIGHT_AGG_CAP, REPO_DEPTH_THRESHOLD } from "@chapa/shared";
import type { RawGitlabData } from "./types";
import { buildStatsFromGitlab } from "./stats-aggregation";

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeRaw(overrides: Partial<RawGitlabData> = {}): RawGitlabData {
  return {
    username: "gluser",
    displayName: "GL User",
    avatarUrl: "https://gitlab.com/avatars/123",
    heatmap: [],
    mergedPRs: [],
    reviewsCount: 0,
    closedIssues: 0,
    repos: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("buildStatsFromGitlab", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-19T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sums commits and active days from the pre-bucketed heatmap", () => {
    const raw = makeRaw({
      heatmap: [
        { date: "2026-06-10", count: 3 },
        { date: "2026-06-11", count: 0 },
        { date: "2026-06-12", count: 5 },
      ],
    });

    const stats = buildStatsFromGitlab(raw);
    expect(stats.commitsTotal).toBe(8);
    expect(stats.activeDays).toBe(2);
  });

  it("sorts heatmap days ascending by date", () => {
    const raw = makeRaw({
      heatmap: [
        { date: "2026-06-12", count: 5 },
        { date: "2026-06-10", count: 3 },
      ],
    });

    const stats = buildStatsFromGitlab(raw);
    expect(stats.heatmapData.map((d) => d.date)).toEqual([
      "2026-06-10",
      "2026-06-12",
    ]);
  });

  it("computes PR metrics from parsed diffstats", () => {
    const raw = makeRaw({
      mergedPRs: [
        { additions: 50, deletions: 10, changed_files: 3 },
        { additions: 20, deletions: 5, changed_files: 2 },
      ],
    });

    const stats = buildStatsFromGitlab(raw);
    expect(stats.prsMergedCount).toBe(2);
    expect(stats.linesAdded).toBe(70);
    expect(stats.linesDeleted).toBe(15);
    expect(stats.prsMergedWeight).toBeGreaterThan(0);
  });

  it("caps prsMergedWeight at PR_WEIGHT_AGG_CAP", () => {
    const manyPRs = Array.from({ length: 200 }, () => ({
      additions: 100,
      deletions: 50,
      changed_files: 5,
    }));
    const raw = makeRaw({ mergedPRs: manyPRs });

    const stats = buildStatsFromGitlab(raw);
    expect(stats.prsMergedWeight).toBeLessThanOrEqual(PR_WEIGHT_AGG_CAP);
  });

  it("passes reviewsCount through to reviewsSubmittedCount", () => {
    const raw = makeRaw({ reviewsCount: 7 });
    expect(buildStatsFromGitlab(raw).reviewsSubmittedCount).toBe(7);
  });

  it("passes closedIssues through to issuesClosedCount", () => {
    const raw = makeRaw({ closedIssues: 4 });
    expect(buildStatsFromGitlab(raw).issuesClosedCount).toBe(4);
  });

  it("counts only repos with >= REPO_DEPTH_THRESHOLD merged MRs as contributed", () => {
    const raw = makeRaw({
      repos: [
        { fullName: "a/x", commitCount: REPO_DEPTH_THRESHOLD, isOwned: true, starsCount: 0, forksCount: 0, watchersCount: 0 },
        { fullName: "a/y", commitCount: REPO_DEPTH_THRESHOLD - 1, isOwned: false, starsCount: 0, forksCount: 0, watchersCount: 0 },
        { fullName: "a/z", commitCount: 0, isOwned: false, starsCount: 0, forksCount: 0, watchersCount: 0 },
      ],
    });

    expect(buildStatsFromGitlab(raw).reposContributed).toBe(1);
  });

  it("sums stars and forks from owned repos only; watchers always 0", () => {
    const raw = makeRaw({
      repos: [
        { fullName: "me/a", commitCount: 2, isOwned: true, starsCount: 10, forksCount: 3, watchersCount: 0 },
        { fullName: "other/b", commitCount: 1, isOwned: false, starsCount: 99, forksCount: 99, watchersCount: 0 },
      ],
    });

    const stats = buildStatsFromGitlab(raw);
    expect(stats.totalStars).toBe(10);
    expect(stats.totalForks).toBe(3);
    expect(stats.totalWatchers).toBe(0);
  });

  it("returns a zeroed StatsData for empty input", () => {
    const stats = buildStatsFromGitlab(makeRaw());
    expect(stats.commitsTotal).toBe(0);
    expect(stats.activeDays).toBe(0);
    expect(stats.prsMergedCount).toBe(0);
    expect(stats.prsMergedWeight).toBe(0);
    expect(stats.reposContributed).toBe(0);
    expect(stats.topRepoShare).toBe(0);
    expect(stats.totalStars).toBe(0);
    expect(stats.heatmapData).toEqual([]);
  });

  it("falls back to username when displayName is empty", () => {
    const stats = buildStatsFromGitlab(makeRaw({ displayName: "" }));
    expect(stats.displayName).toBe("gluser");
  });

  it("sets maxCommitsIn10Min only when a day has >= 30 contributions", () => {
    expect(
      buildStatsFromGitlab(makeRaw({ heatmap: [{ date: "2026-06-10", count: 29 }] }))
        .maxCommitsIn10Min,
    ).toBe(0);
    expect(
      buildStatsFromGitlab(makeRaw({ heatmap: [{ date: "2026-06-10", count: 35 }] }))
        .maxCommitsIn10Min,
    ).toBe(35);
  });
});
