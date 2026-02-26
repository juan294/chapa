import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PR_WEIGHT_AGG_CAP, REPO_DEPTH_THRESHOLD } from "@chapa/shared";
import type { RawCodebergData, CodebergPullRequest } from "./types";

// Import will fail until implementation exists (TDD RED)
import { buildStatsFromCodeberg } from "./stats-aggregation";

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeRaw(overrides: Partial<RawCodebergData> = {}): RawCodebergData {
  return {
    username: "cbuser",
    displayName: "CB User",
    avatarUrl: "https://codeberg.org/avatars/123",
    heatmap: [],
    mergedPRs: [],
    reviews: [],
    closedIssues: 0,
    repos: [],
    ...overrides,
  };
}

function makePR(
  id: number,
  overrides: Partial<CodebergPullRequest> = {},
): CodebergPullRequest {
  return {
    id,
    number: id,
    title: `PR #${id}`,
    state: "closed",
    merged: true,
    merged_at: "2026-02-01T12:00:00Z",
    additions: 50,
    deletions: 10,
    changed_files: 3,
    user: { login: "cbuser" },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("buildStatsFromCodeberg", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("converts heatmap timestamps to YYYY-MM-DD format", () => {
    const raw = makeRaw({
      heatmap: [
        { timestamp: 1740700800, contributions: 5 }, // 2025-02-28 00:00:00 UTC
      ],
    });

    const result = buildStatsFromCodeberg(raw);
    expect(result.heatmapData[0]!.date).toBe("2025-02-28");
    expect(result.heatmapData[0]!.count).toBe(5);
  });

  it("aggregates multiple timestamps on the same date", () => {
    // Two timestamps on the same day (2026-02-01)
    const dayStart = new Date("2026-02-01T00:00:00Z").getTime() / 1000;
    const dayMid = new Date("2026-02-01T12:00:00Z").getTime() / 1000;

    const raw = makeRaw({
      heatmap: [
        { timestamp: dayStart, contributions: 3 },
        { timestamp: dayMid, contributions: 7 },
      ],
    });

    const result = buildStatsFromCodeberg(raw);
    const feb1 = result.heatmapData.find((d) => d.date === "2026-02-01");
    expect(feb1).toBeDefined();
    expect(feb1!.count).toBe(10);
  });

  it("sorts heatmap chronologically", () => {
    const raw = makeRaw({
      heatmap: [
        { timestamp: new Date("2026-02-10T00:00:00Z").getTime() / 1000, contributions: 1 },
        { timestamp: new Date("2026-02-01T00:00:00Z").getTime() / 1000, contributions: 2 },
        { timestamp: new Date("2026-02-05T00:00:00Z").getTime() / 1000, contributions: 3 },
      ],
    });

    const result = buildStatsFromCodeberg(raw);
    expect(result.heatmapData[0]!.date).toBe("2026-02-01");
    expect(result.heatmapData[1]!.date).toBe("2026-02-05");
    expect(result.heatmapData[2]!.date).toBe("2026-02-10");
  });

  it("counts active days from heatmap", () => {
    const raw = makeRaw({
      heatmap: [
        { timestamp: new Date("2026-02-01T00:00:00Z").getTime() / 1000, contributions: 5 },
        { timestamp: new Date("2026-02-02T00:00:00Z").getTime() / 1000, contributions: 0 },
        { timestamp: new Date("2026-02-03T00:00:00Z").getTime() / 1000, contributions: 3 },
      ],
    });

    const result = buildStatsFromCodeberg(raw);
    expect(result.activeDays).toBe(2); // Days with count > 0
  });

  it("sums commits from heatmap contributions", () => {
    const raw = makeRaw({
      heatmap: [
        { timestamp: new Date("2026-02-01T00:00:00Z").getTime() / 1000, contributions: 5 },
        { timestamp: new Date("2026-02-02T00:00:00Z").getTime() / 1000, contributions: 3 },
      ],
    });

    const result = buildStatsFromCodeberg(raw);
    expect(result.commitsTotal).toBe(8);
  });

  it("computes PR weight using shared computePrWeight()", () => {
    const raw = makeRaw({
      mergedPRs: [makePR(1, { additions: 100, deletions: 50, changed_files: 5 })],
    });

    const result = buildStatsFromCodeberg(raw);
    expect(result.prsMergedCount).toBe(1);
    // Weight should be > 0 for a non-trivial PR
    expect(result.prsMergedWeight).toBeGreaterThan(0);
    expect(result.prsMergedWeight).toBeLessThanOrEqual(3.0); // Single PR max
  });

  it("caps prsMergedWeight at PR_WEIGHT_AGG_CAP", () => {
    // Create many large PRs to exceed the cap
    const prs = Array.from({ length: 80 }, (_, i) =>
      makePR(i, { additions: 5000, deletions: 1000, changed_files: 50 }),
    );

    const raw = makeRaw({ mergedPRs: prs });
    const result = buildStatsFromCodeberg(raw);
    expect(result.prsMergedWeight).toBe(PR_WEIGHT_AGG_CAP);
  });

  it("sums lines added/deleted from inline PR stats", () => {
    const raw = makeRaw({
      mergedPRs: [
        makePR(1, { additions: 100, deletions: 20 }),
        makePR(2, { additions: 50, deletions: 30 }),
      ],
    });

    const result = buildStatsFromCodeberg(raw);
    expect(result.linesAdded).toBe(150);
    expect(result.linesDeleted).toBe(50);
  });

  it("counts reviews", () => {
    const raw = makeRaw({
      reviews: [
        { id: 1, state: "APPROVED", user: { login: "cbuser" }, submitted_at: "2026-02-01T00:00:00Z" },
        { id: 2, state: "REQUEST_CHANGES", user: { login: "cbuser" }, submitted_at: "2026-02-02T00:00:00Z" },
      ],
    });

    const result = buildStatsFromCodeberg(raw);
    expect(result.reviewsSubmittedCount).toBe(2);
  });

  it("passes through closedIssues count", () => {
    const raw = makeRaw({ closedIssues: 7 });
    const result = buildStatsFromCodeberg(raw);
    expect(result.issuesClosedCount).toBe(7);
  });

  it("computes reposContributed using REPO_DEPTH_THRESHOLD", () => {
    const raw = makeRaw({
      repos: [
        { fullName: "owner/deep", commitCount: 10, isOwned: true, starsCount: 0, forksCount: 0, watchersCount: 0 },
        { fullName: "owner/shallow", commitCount: 1, isOwned: false, starsCount: 0, forksCount: 0, watchersCount: 0 },
        { fullName: "owner/exactly", commitCount: REPO_DEPTH_THRESHOLD, isOwned: false, starsCount: 0, forksCount: 0, watchersCount: 0 },
      ],
    });

    const result = buildStatsFromCodeberg(raw);
    expect(result.reposContributed).toBe(2); // deep + exactly (both >= threshold)
  });

  it("computes topRepoShare from commit distribution", () => {
    const raw = makeRaw({
      repos: [
        { fullName: "owner/main", commitCount: 80, isOwned: true, starsCount: 0, forksCount: 0, watchersCount: 0 },
        { fullName: "owner/side", commitCount: 20, isOwned: true, starsCount: 0, forksCount: 0, watchersCount: 0 },
      ],
    });

    const result = buildStatsFromCodeberg(raw);
    expect(result.topRepoShare).toBeCloseTo(0.8, 1); // 80/100
  });

  it("detects maxCommitsIn10Min from daily spikes (>=30)", () => {
    const raw = makeRaw({
      heatmap: [
        { timestamp: new Date("2026-02-01T00:00:00Z").getTime() / 1000, contributions: 35 },
      ],
    });

    const result = buildStatsFromCodeberg(raw);
    expect(result.maxCommitsIn10Min).toBe(35);
  });

  it("does not flag maxCommitsIn10Min for moderate days (<30)", () => {
    const raw = makeRaw({
      heatmap: [
        { timestamp: new Date("2026-02-01T00:00:00Z").getTime() / 1000, contributions: 25 },
      ],
    });

    const result = buildStatsFromCodeberg(raw);
    expect(result.maxCommitsIn10Min).toBe(0);
  });

  it("sums stars from owned repos", () => {
    const raw = makeRaw({
      repos: [
        { fullName: "me/a", commitCount: 5, isOwned: true, starsCount: 10, forksCount: 0, watchersCount: 0 },
        { fullName: "me/b", commitCount: 3, isOwned: true, starsCount: 20, forksCount: 0, watchersCount: 0 },
        { fullName: "other/c", commitCount: 2, isOwned: false, starsCount: 100, forksCount: 0, watchersCount: 0 },
      ],
    });

    const result = buildStatsFromCodeberg(raw);
    expect(result.totalStars).toBe(30); // Only owned: 10 + 20
  });

  it("sums forks from owned repos", () => {
    const raw = makeRaw({
      repos: [
        { fullName: "me/a", commitCount: 5, isOwned: true, starsCount: 0, forksCount: 5, watchersCount: 0 },
        { fullName: "other/b", commitCount: 2, isOwned: false, starsCount: 0, forksCount: 50, watchersCount: 0 },
      ],
    });

    const result = buildStatsFromCodeberg(raw);
    expect(result.totalForks).toBe(5); // Only owned
  });

  it("sums watchers from owned repos", () => {
    const raw = makeRaw({
      repos: [
        { fullName: "me/a", commitCount: 5, isOwned: true, starsCount: 0, forksCount: 0, watchersCount: 8 },
        { fullName: "me/b", commitCount: 3, isOwned: true, starsCount: 0, forksCount: 0, watchersCount: 12 },
      ],
    });

    const result = buildStatsFromCodeberg(raw);
    expect(result.totalWatchers).toBe(20);
  });

  it("handles empty data gracefully", () => {
    const raw = makeRaw();
    const result = buildStatsFromCodeberg(raw);

    expect(result.commitsTotal).toBe(0);
    expect(result.activeDays).toBe(0);
    expect(result.prsMergedCount).toBe(0);
    expect(result.prsMergedWeight).toBe(0);
    expect(result.reviewsSubmittedCount).toBe(0);
    expect(result.issuesClosedCount).toBe(0);
    expect(result.linesAdded).toBe(0);
    expect(result.linesDeleted).toBe(0);
    expect(result.reposContributed).toBe(0);
    expect(result.topRepoShare).toBe(0);
    expect(result.maxCommitsIn10Min).toBe(0);
    expect(result.totalStars).toBe(0);
    expect(result.totalForks).toBe(0);
    expect(result.totalWatchers).toBe(0);
    expect(result.heatmapData).toEqual([]);
  });

  it("sets handle and display name from raw data", () => {
    const raw = makeRaw({ username: "myuser", displayName: "My User" });
    const result = buildStatsFromCodeberg(raw);
    expect(result.handle).toBe("myuser");
    expect(result.displayName).toBe("My User");
  });

  it("falls back to username when displayName is empty", () => {
    const raw = makeRaw({ username: "myuser", displayName: "" });
    const result = buildStatsFromCodeberg(raw);
    expect(result.displayName).toBe("myuser");
  });

  it("sets fetchedAt to current ISO timestamp", () => {
    const raw = makeRaw();
    const result = buildStatsFromCodeberg(raw);
    expect(result.fetchedAt).toBe("2026-03-01T00:00:00.000Z");
  });

  it("sets avatarUrl from raw data", () => {
    const raw = makeRaw({ avatarUrl: "https://codeberg.org/avatars/456" });
    const result = buildStatsFromCodeberg(raw);
    expect(result.avatarUrl).toBe("https://codeberg.org/avatars/456");
  });
});
