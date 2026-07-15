import { describe, it, expect } from "vitest";
import { computePlatformStats, type PlatformStatsInput } from "./platform-stats";
import { computePrWeight } from "./scoring";
import { PR_WEIGHT_AGG_CAP } from "./constants";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInput(
  overrides: Partial<PlatformStatsInput> = {},
): PlatformStatsInput {
  return {
    handle: "devuser",
    displayName: "Dev User",
    avatarUrl: "https://example.com/avatar.png",
    heatmapData: [],
    commitsTotal: 0,
    mergedPrs: [],
    reviewsSubmittedCount: 0,
    issuesClosedCount: 0,
    repos: [],
    totalStars: 0,
    totalForks: 0,
    totalWatchers: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// PR-metrics aggregation (the step extracted from the per-platform loops)
// ---------------------------------------------------------------------------

describe("computePlatformStats — PR metrics aggregation", () => {
  it("derives prsMergedCount from the normalized merged-PR array length", () => {
    const stats = computePlatformStats(
      makeInput({
        mergedPrs: [
          { additions: 10, deletions: 5, changedFiles: 2 },
          { additions: 20, deletions: 8, changedFiles: 3 },
        ],
      }),
    );

    expect(stats.prsMergedCount).toBe(2);
  });

  it("sums linesAdded and linesDeleted across merged PRs", () => {
    const stats = computePlatformStats(
      makeInput({
        mergedPrs: [
          { additions: 10, deletions: 5, changedFiles: 2 },
          { additions: 20, deletions: 8, changedFiles: 3 },
        ],
      }),
    );

    expect(stats.linesAdded).toBe(30);
    expect(stats.linesDeleted).toBe(13);
  });

  it("computes prsMergedWeight as the sum of computePrWeight over all PRs", () => {
    const prs = [
      { additions: 100, deletions: 40, changedFiles: 5 },
      { additions: 30, deletions: 12, changedFiles: 2 },
    ];
    const expectedWeight = prs.reduce((sum, pr) => sum + computePrWeight(pr), 0);

    const stats = computePlatformStats(makeInput({ mergedPrs: prs }));

    expect(stats.prsMergedWeight).toBeCloseTo(expectedWeight, 10);
  });

  it("caps aggregate prsMergedWeight at PR_WEIGHT_AGG_CAP", () => {
    // Many large PRs — uncapped sum would exceed the aggregate cap.
    const prs = Array.from({ length: 200 }, () => ({
      additions: 500,
      deletions: 200,
      changedFiles: 20,
    }));

    const stats = computePlatformStats(makeInput({ mergedPrs: prs }));

    expect(stats.prsMergedWeight).toBe(PR_WEIGHT_AGG_CAP);
  });

  it("reports zeroed PR metrics when there are no merged PRs", () => {
    const stats = computePlatformStats(makeInput({ mergedPrs: [] }));

    expect(stats.prsMergedCount).toBe(0);
    expect(stats.prsMergedWeight).toBe(0);
    expect(stats.linesAdded).toBe(0);
    expect(stats.linesDeleted).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Invariant steps still computed correctly alongside PR aggregation
// ---------------------------------------------------------------------------

describe("computePlatformStats — invariant steps", () => {
  it("counts active days from the heatmap", () => {
    const stats = computePlatformStats(
      makeInput({
        heatmapData: [
          { date: "2026-02-01", count: 3 },
          { date: "2026-02-02", count: 0 },
          { date: "2026-02-03", count: 5 },
        ],
      }),
    );

    expect(stats.activeDays).toBe(2);
  });

  it("passes identity, social, review and issue fields through", () => {
    const stats = computePlatformStats(
      makeInput({
        handle: "octocat",
        displayName: "The Octocat",
        reviewsSubmittedCount: 7,
        issuesClosedCount: 4,
        totalStars: 12,
        totalForks: 3,
        totalWatchers: 9,
      }),
    );

    expect(stats.handle).toBe("octocat");
    expect(stats.displayName).toBe("The Octocat");
    expect(stats.reviewsSubmittedCount).toBe(7);
    expect(stats.issuesClosedCount).toBe(4);
    expect(stats.totalStars).toBe(12);
    expect(stats.totalForks).toBe(3);
    expect(stats.totalWatchers).toBe(9);
  });
});
