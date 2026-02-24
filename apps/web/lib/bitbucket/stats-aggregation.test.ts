import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RawBitbucketData } from "./types";
import { buildStatsFromBitbucket } from "./stats-aggregation";
import { PR_WEIGHT_AGG_CAP, REPO_DEPTH_THRESHOLD } from "@chapa/shared";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRaw(overrides: Partial<RawBitbucketData> = {}): RawBitbucketData {
  return {
    username: "bbuser",
    displayName: "BB User",
    avatarUrl: "https://bitbucket.org/avatar.png",
    commits: [],
    mergedPRs: [],
    reviewActivities: [],
    closedIssues: 0,
    repos: [],
    ...overrides,
  };
}

function makeCommit(date: string, hash?: string) {
  return {
    hash: hash ?? `abc${date}`,
    date: `${date}T12:00:00.000Z`,
    message: "test commit",
    author: { raw: "BB User <bb@example.com>", user: { username: "bbuser" } },
  };
}

function makeMergedPR(
  id: number,
  diffstat: { lines_added: number; lines_removed: number }[] = [],
) {
  return {
    pr: {
      id,
      title: `PR #${id}`,
      state: "MERGED" as const,
      author: { username: "bbuser" },
      created_on: "2025-06-01T00:00:00.000Z",
      updated_on: "2025-06-01T00:00:00.000Z",
    },
    diffstat: diffstat.map((d, i) => ({
      status: "modified",
      lines_added: d.lines_added,
      lines_removed: d.lines_removed,
      new: { path: `file-${i}.ts` },
    })),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("buildStatsFromBitbucket", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-07-01T00:00:00.000Z"));
  });

  it("transforms commits into heatmap aggregated by date", () => {
    const raw = makeRaw({
      commits: [
        makeCommit("2025-06-01"),
        makeCommit("2025-06-01", "def1"),
        makeCommit("2025-06-02"),
      ],
    });

    const stats = buildStatsFromBitbucket(raw);

    expect(stats.heatmapData).toEqual([
      { date: "2025-06-01", count: 2 },
      { date: "2025-06-02", count: 1 },
    ]);
  });

  it("sorts heatmap data chronologically", () => {
    const raw = makeRaw({
      commits: [makeCommit("2025-06-15"), makeCommit("2025-06-01")],
    });

    const stats = buildStatsFromBitbucket(raw);

    expect(stats.heatmapData[0]!.date).toBe("2025-06-01");
    expect(stats.heatmapData[1]!.date).toBe("2025-06-15");
  });

  it("counts active days from heatmap", () => {
    const raw = makeRaw({
      commits: [
        makeCommit("2025-06-01"),
        makeCommit("2025-06-01", "def1"),
        makeCommit("2025-06-02"),
        makeCommit("2025-06-03"),
      ],
    });

    const stats = buildStatsFromBitbucket(raw);

    expect(stats.activeDays).toBe(3);
  });

  it("counts total commits", () => {
    const raw = makeRaw({
      commits: [
        makeCommit("2025-06-01"),
        makeCommit("2025-06-02"),
        makeCommit("2025-06-03"),
      ],
    });

    const stats = buildStatsFromBitbucket(raw);

    expect(stats.commitsTotal).toBe(3);
  });

  it("computes PR weight using shared computePrWeight()", () => {
    const raw = makeRaw({
      mergedPRs: [
        makeMergedPR(1, [{ lines_added: 100, lines_removed: 50 }]),
      ],
    });

    const stats = buildStatsFromBitbucket(raw);

    // computePrWeight with additions=100, deletions=50, changedFiles=1
    // totalChanges = 1 + 100 + 50 = 151 → sizeMultiplier = 1
    // raw = 0.5 + 0.25*ln(2) + 0.25*ln(151) = 0.5 + 0.1733 + 1.2539 ≈ 1.927
    expect(stats.prsMergedWeight).toBeGreaterThan(1.9);
    expect(stats.prsMergedWeight).toBeLessThan(2.0);
    expect(stats.prsMergedCount).toBe(1);
  });

  it("caps prsMergedWeight at PR_WEIGHT_AGG_CAP (120)", () => {
    // Create many large PRs to exceed the cap
    const mergedPRs = Array.from({ length: 80 }, (_, i) =>
      makeMergedPR(i, [{ lines_added: 5000, lines_removed: 2000 }]),
    );

    const raw = makeRaw({ mergedPRs });
    const stats = buildStatsFromBitbucket(raw);

    expect(stats.prsMergedWeight).toBe(PR_WEIGHT_AGG_CAP);
  });

  it("sums lines added and deleted from merged PRs", () => {
    const raw = makeRaw({
      mergedPRs: [
        makeMergedPR(1, [
          { lines_added: 100, lines_removed: 20 },
          { lines_added: 50, lines_removed: 10 },
        ]),
        makeMergedPR(2, [{ lines_added: 200, lines_removed: 30 }]),
      ],
    });

    const stats = buildStatsFromBitbucket(raw);

    expect(stats.linesAdded).toBe(350);
    expect(stats.linesDeleted).toBe(60);
  });

  it("counts reviews from approvals and change requests", () => {
    const raw = makeRaw({
      reviewActivities: [
        { approval: { user: { username: "bbuser" }, date: "2025-06-01" } },
        {
          changes_requested: {
            user: { username: "bbuser" },
            date: "2025-06-02",
          },
        },
        {
          comment: {
            user: { username: "bbuser" },
            content: { raw: "looks good" },
          },
        },
      ],
    });

    const stats = buildStatsFromBitbucket(raw);

    // Only approvals + changes_requested count, not comments
    expect(stats.reviewsSubmittedCount).toBe(2);
  });

  it("passes through closedIssues count", () => {
    const raw = makeRaw({ closedIssues: 7 });
    const stats = buildStatsFromBitbucket(raw);

    expect(stats.issuesClosedCount).toBe(7);
  });

  it("applies REPO_DEPTH_THRESHOLD to reposContributed", () => {
    const raw = makeRaw({
      repos: [
        { fullName: "ws/deep", commitCount: 10, isOwned: true, forkCount: 0 },
        {
          fullName: "ws/shallow",
          commitCount: REPO_DEPTH_THRESHOLD - 1,
          isOwned: false,
          forkCount: 0,
        },
        {
          fullName: "ws/exactly",
          commitCount: REPO_DEPTH_THRESHOLD,
          isOwned: false,
          forkCount: 0,
        },
      ],
    });

    const stats = buildStatsFromBitbucket(raw);

    // deep (10) and exactly (3) pass threshold; shallow (2) does not
    expect(stats.reposContributed).toBe(2);
  });

  it("computes topRepoShare from commit distribution", () => {
    const raw = makeRaw({
      repos: [
        {
          fullName: "ws/main",
          commitCount: 80,
          isOwned: true,
          forkCount: 0,
        },
        { fullName: "ws/side", commitCount: 20, isOwned: false, forkCount: 0 },
      ],
    });

    const stats = buildStatsFromBitbucket(raw);

    // top = 80, total = 100 → share = 0.8
    expect(stats.topRepoShare).toBeCloseTo(0.8);
  });

  it("sets totalStars to 0 (Bitbucket has no stars)", () => {
    const raw = makeRaw();
    const stats = buildStatsFromBitbucket(raw);

    expect(stats.totalStars).toBe(0);
  });

  it("sets totalWatchers to 0", () => {
    const raw = makeRaw();
    const stats = buildStatsFromBitbucket(raw);

    expect(stats.totalWatchers).toBe(0);
  });

  it("sums fork counts from owned repos only", () => {
    const raw = makeRaw({
      repos: [
        {
          fullName: "ws/owned-a",
          commitCount: 5,
          isOwned: true,
          forkCount: 10,
        },
        {
          fullName: "ws/owned-b",
          commitCount: 3,
          isOwned: true,
          forkCount: 5,
        },
        {
          fullName: "ws/contrib",
          commitCount: 8,
          isOwned: false,
          forkCount: 20,
        },
      ],
    });

    const stats = buildStatsFromBitbucket(raw);

    // Only owned repos: 10 + 5 = 15 (ignore contrib's 20)
    expect(stats.totalForks).toBe(15);
  });

  it("handles empty data gracefully", () => {
    const raw = makeRaw();
    const stats = buildStatsFromBitbucket(raw);

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
  });

  it("handles user with no owned repos (totalForks = 0)", () => {
    const raw = makeRaw({
      repos: [
        {
          fullName: "ws/contrib",
          commitCount: 5,
          isOwned: false,
          forkCount: 0,
        },
      ],
    });

    const stats = buildStatsFromBitbucket(raw);

    expect(stats.totalForks).toBe(0);
  });

  it("detects maxCommitsIn10Min from daily spikes (≥30)", () => {
    // 35 commits on one day should trigger the spike detector
    const commits = Array.from({ length: 35 }, (_, i) =>
      makeCommit("2025-06-01", `spike${i}`),
    );
    const raw = makeRaw({ commits });

    const stats = buildStatsFromBitbucket(raw);

    expect(stats.maxCommitsIn10Min).toBe(35);
  });

  it("does not flag maxCommitsIn10Min for moderate days (<30)", () => {
    const commits = Array.from({ length: 20 }, (_, i) =>
      makeCommit("2025-06-01", `mod${i}`),
    );
    const raw = makeRaw({ commits });

    const stats = buildStatsFromBitbucket(raw);

    expect(stats.maxCommitsIn10Min).toBe(0);
  });

  it("sets handle and display name from raw data", () => {
    const raw = makeRaw({
      username: "mybbuser",
      displayName: "My BB User",
      avatarUrl: "https://bitbucket.org/my-avatar.png",
    });

    const stats = buildStatsFromBitbucket(raw);

    expect(stats.handle).toBe("mybbuser");
    expect(stats.displayName).toBe("My BB User");
    expect(stats.avatarUrl).toBe("https://bitbucket.org/my-avatar.png");
  });

  it("sets fetchedAt to current ISO timestamp", () => {
    const raw = makeRaw();
    const stats = buildStatsFromBitbucket(raw);

    expect(stats.fetchedAt).toBe("2025-07-01T00:00:00.000Z");
  });
});
