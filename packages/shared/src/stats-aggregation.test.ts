import { describe, it, expect, vi, afterEach } from "vitest";
import type { RawContributionData, StatsData } from "./types";
import { buildStatsFromRaw } from "./stats-aggregation";

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

function makeRaw(overrides: Partial<RawContributionData> = {}): RawContributionData {
  return {
    login: "test-user",
    name: "Test User",
    avatarUrl: "https://avatars.githubusercontent.com/u/1",
    contributionCalendar: {
      totalContributions: 120,
      weeks: Array.from({ length: 13 }, (_, w) => ({
        contributionDays: Array.from({ length: 7 }, (_, d) => ({
          date: `2026-0${Math.floor((w * 7 + d) / 30) + 1}-${String(((w * 7 + d) % 30) + 1).padStart(2, "0")}`,
          contributionCount: 2, // all days active
        })),
      })),
    },
    pullRequests: {
      totalCount: 3,
      nodes: [
        { additions: 100, deletions: 20, changedFiles: 5, merged: true },
        { additions: 50, deletions: 10, changedFiles: 3, merged: true },
        { additions: 200, deletions: 50, changedFiles: 8, merged: false },
      ],
    },
    reviews: { totalCount: 15 },
    issues: { totalCount: 5 },
    repositories: {
      totalCount: 4,
      nodes: [
        { nameWithOwner: "user/repo1", defaultBranchRef: { target: { history: { totalCount: 50 } } } },
        { nameWithOwner: "user/repo2", defaultBranchRef: { target: { history: { totalCount: 30 } } } },
        { nameWithOwner: "user/repo3", defaultBranchRef: { target: { history: { totalCount: 15 } } } },
        { nameWithOwner: "user/repo4", defaultBranchRef: { target: { history: { totalCount: 5 } } } },
      ],
    },
    ownedRepoStars: {
      nodes: [
        { stargazerCount: 100, forkCount: 20, watchers: { totalCount: 30 } },
        { stargazerCount: 50, forkCount: 10, watchers: { totalCount: 15 } },
        { stargazerCount: 10, forkCount: 2, watchers: { totalCount: 5 } },
      ],
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("buildStatsFromRaw", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- Basic shape ---

  it("returns a StatsData object with correct handle", () => {
    const result = buildStatsFromRaw(makeRaw());
    expect(result.handle).toBe("test-user");
  });

  it("passes displayName from raw data", () => {
    const result = buildStatsFromRaw(makeRaw({ name: "Juan Garcia" }));
    expect(result.displayName).toBe("Juan Garcia");
  });

  it("sets displayName to undefined when name is null", () => {
    const result = buildStatsFromRaw(makeRaw({ name: null }));
    expect(result.displayName).toBeUndefined();
  });

  it("passes avatarUrl from raw data", () => {
    const result = buildStatsFromRaw(makeRaw({ avatarUrl: "https://example.com/avatar.png" }));
    expect(result.avatarUrl).toBe("https://example.com/avatar.png");
  });

  it("includes a fetchedAt ISO timestamp", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00Z"));
    const result = buildStatsFromRaw(makeRaw());
    expect(result.fetchedAt).toBe("2026-01-15T12:00:00.000Z");
    vi.useRealTimers();
  });

  // --- Heatmap ---

  it("flattens weeks into heatmapData (13 weeks * 7 days = 91 entries)", () => {
    const result = buildStatsFromRaw(makeRaw());
    expect(result.heatmapData).toHaveLength(91);
    expect(result.heatmapData[0]).toHaveProperty("date");
    expect(result.heatmapData[0]).toHaveProperty("count");
  });

  it("handles fewer than 13 weeks gracefully", () => {
    const raw = makeRaw({
      contributionCalendar: {
        totalContributions: 10,
        weeks: [
          {
            contributionDays: [
              { date: "2026-01-01", contributionCount: 5 },
              { date: "2026-01-02", contributionCount: 3 },
            ],
          },
        ],
      },
    });
    const result = buildStatsFromRaw(raw);
    expect(result.heatmapData).toHaveLength(2);
  });

  // --- Active days ---

  it("counts active days (days with count > 0)", () => {
    const weeks = Array.from({ length: 13 }, () => ({
      contributionDays: Array.from({ length: 7 }, () => ({
        date: "2026-01-01",
        contributionCount: 0,
      })),
    }));
    // Set exactly 10 days as active
    for (let i = 0; i < 10; i++) {
      weeks[Math.floor(i / 7)].contributionDays[i % 7].contributionCount = 3;
    }
    const raw = makeRaw({
      contributionCalendar: { totalContributions: 30, weeks },
    });
    const result = buildStatsFromRaw(raw);
    expect(result.activeDays).toBe(10);
  });

  it("returns 0 active days when all counts are 0", () => {
    const weeks = Array.from({ length: 13 }, () => ({
      contributionDays: Array.from({ length: 7 }, () => ({
        date: "2026-01-01",
        contributionCount: 0,
      })),
    }));
    const raw = makeRaw({
      contributionCalendar: { totalContributions: 0, weeks },
    });
    const result = buildStatsFromRaw(raw);
    expect(result.activeDays).toBe(0);
  });

  // --- Commits total ---

  it("uses totalContributions from calendar as commitsTotal", () => {
    const raw = makeRaw();
    raw.contributionCalendar.totalContributions = 42;
    const result = buildStatsFromRaw(raw);
    expect(result.commitsTotal).toBe(42);
  });

  // --- PRs ---

  it("counts only merged PRs", () => {
    const result = buildStatsFromRaw(makeRaw());
    // 2 merged, 1 unmerged in default test data
    expect(result.prsMergedCount).toBe(2);
  });

  it("computes PR weight with log formula, capped at 3.0 per PR", () => {
    const raw = makeRaw({
      pullRequests: {
        totalCount: 1,
        nodes: [
          { additions: 1000, deletions: 500, changedFiles: 20, merged: true },
        ],
      },
    });
    const result = buildStatsFromRaw(raw);
    // w = 0.5 + 0.25*ln(1+20) + 0.25*ln(1+1500) = capped at 3.0
    expect(result.prsMergedWeight).toBeCloseTo(3.0, 1);
  });

  it("caps total PR weight at 120", () => {
    // 60 large PRs: each has weight 3.0 -> raw sum = 180 -> capped at 120
    const nodes = Array.from({ length: 60 }, () => ({
      additions: 5000,
      deletions: 5000,
      changedFiles: 100,
      merged: true,
    }));
    const raw = makeRaw({
      pullRequests: { totalCount: 60, nodes },
    });
    const result = buildStatsFromRaw(raw);
    expect(result.prsMergedWeight).toBe(120);
  });

  it("excludes unmerged PRs from weight and line counts", () => {
    const raw = makeRaw({
      pullRequests: {
        totalCount: 2,
        nodes: [
          { additions: 100, deletions: 20, changedFiles: 5, merged: true },
          { additions: 999, deletions: 999, changedFiles: 50, merged: false },
        ],
      },
    });
    const result = buildStatsFromRaw(raw);
    expect(result.prsMergedCount).toBe(1);
    expect(result.linesAdded).toBe(100);
    expect(result.linesDeleted).toBe(20);
  });

  // --- Lines ---

  it("sums linesAdded and linesDeleted from merged PRs", () => {
    const raw = makeRaw({
      pullRequests: {
        totalCount: 2,
        nodes: [
          { additions: 100, deletions: 20, changedFiles: 5, merged: true },
          { additions: 50, deletions: 10, changedFiles: 3, merged: true },
        ],
      },
    });
    const result = buildStatsFromRaw(raw);
    expect(result.linesAdded).toBe(150);
    expect(result.linesDeleted).toBe(30);
  });

  // --- Reviews and issues ---

  it("passes reviews and issues counts from raw data", () => {
    const raw = makeRaw({
      reviews: { totalCount: 25 },
      issues: { totalCount: 12 },
    });
    const result = buildStatsFromRaw(raw);
    expect(result.reviewsSubmittedCount).toBe(25);
    expect(result.issuesClosedCount).toBe(12);
  });

  // --- Repositories ---

  it("counts repos with commits > 0 as reposContributed", () => {
    const raw = makeRaw({
      repositories: {
        totalCount: 3,
        nodes: [
          { nameWithOwner: "u/a", defaultBranchRef: { target: { history: { totalCount: 10 } } } },
          { nameWithOwner: "u/b", defaultBranchRef: { target: { history: { totalCount: 0 } } } },
          { nameWithOwner: "u/c", defaultBranchRef: null },
        ],
      },
    });
    const result = buildStatsFromRaw(raw);
    expect(result.reposContributed).toBe(1);
  });

  it("computes topRepoShare as proportion of top repo commits", () => {
    const raw = makeRaw({
      repositories: {
        totalCount: 2,
        nodes: [
          { nameWithOwner: "u/main", defaultBranchRef: { target: { history: { totalCount: 90 } } } },
          { nameWithOwner: "u/side", defaultBranchRef: { target: { history: { totalCount: 10 } } } },
        ],
      },
    });
    const result = buildStatsFromRaw(raw);
    expect(result.topRepoShare).toBeCloseTo(0.9, 2);
  });

  it("sets topRepoShare to 0 when no repos have commits", () => {
    const raw = makeRaw({
      repositories: { totalCount: 0, nodes: [] },
    });
    const result = buildStatsFromRaw(raw);
    expect(result.topRepoShare).toBe(0);
  });

  it("handles repos with null defaultBranchRef", () => {
    const raw = makeRaw({
      repositories: {
        totalCount: 2,
        nodes: [
          { nameWithOwner: "u/a", defaultBranchRef: null },
          { nameWithOwner: "u/b", defaultBranchRef: { target: { history: { totalCount: 20 } } } },
        ],
      },
    });
    const result = buildStatsFromRaw(raw);
    expect(result.reposContributed).toBe(1);
    expect(result.topRepoShare).toBe(1); // only 1 repo, so it has 100%
  });

  // --- maxCommitsIn10Min approximation ---

  it("sets maxCommitsIn10Min to maxDailyCount when >= 30", () => {
    const weeks = Array.from({ length: 13 }, () => ({
      contributionDays: Array.from({ length: 7 }, () => ({
        date: "2026-01-01",
        contributionCount: 1,
      })),
    }));
    weeks[0].contributionDays[0].contributionCount = 35;
    const raw = makeRaw({
      contributionCalendar: { totalContributions: 100, weeks },
    });
    const result = buildStatsFromRaw(raw);
    expect(result.maxCommitsIn10Min).toBe(35);
  });

  it("sets maxCommitsIn10Min to 0 when no daily count >= 30", () => {
    const weeks = Array.from({ length: 13 }, () => ({
      contributionDays: Array.from({ length: 7 }, () => ({
        date: "2026-01-01",
        contributionCount: 5,
      })),
    }));
    const raw = makeRaw({
      contributionCalendar: { totalContributions: 100, weeks },
    });
    const result = buildStatsFromRaw(raw);
    expect(result.maxCommitsIn10Min).toBe(0);
  });

  // --- Edge cases ---

  it("handles empty PR nodes array", () => {
    const raw = makeRaw({
      pullRequests: { totalCount: 0, nodes: [] },
    });
    const result = buildStatsFromRaw(raw);
    expect(result.prsMergedCount).toBe(0);
    expect(result.prsMergedWeight).toBe(0);
    expect(result.linesAdded).toBe(0);
    expect(result.linesDeleted).toBe(0);
  });

  it("handles empty weeks array", () => {
    const raw = makeRaw({
      contributionCalendar: { totalContributions: 0, weeks: [] },
    });
    const result = buildStatsFromRaw(raw);
    expect(result.heatmapData).toHaveLength(0);
    expect(result.activeDays).toBe(0);
    expect(result.maxCommitsIn10Min).toBe(0);
  });

  // --- Total stars ---

  it("sums stargazerCount across owned repos", () => {
    const result = buildStatsFromRaw(makeRaw());
    // Default test data: 100 + 50 + 10 = 160
    expect(result.totalStars).toBe(160);
  });

  it("returns 0 totalStars when no owned repos", () => {
    const raw = makeRaw({
      ownedRepoStars: { nodes: [] },
    });
    const result = buildStatsFromRaw(raw);
    expect(result.totalStars).toBe(0);
  });

  it("handles single repo with many stars", () => {
    const raw = makeRaw({
      ownedRepoStars: { nodes: [{ stargazerCount: 5000, forkCount: 200, watchers: { totalCount: 50 } }] },
    });
    const result = buildStatsFromRaw(raw);
    expect(result.totalStars).toBe(5000);
  });

  // --- Total forks ---

  it("sums forkCount across owned repos", () => {
    const result = buildStatsFromRaw(makeRaw());
    // Default test data: 20 + 10 + 2 = 32
    expect(result.totalForks).toBe(32);
  });

  it("returns 0 totalForks when no owned repos", () => {
    const raw = makeRaw({
      ownedRepoStars: { nodes: [] },
    });
    const result = buildStatsFromRaw(raw);
    expect(result.totalForks).toBe(0);
  });

  // --- Total watchers ---

  it("sums watchers totalCount across owned repos", () => {
    const result = buildStatsFromRaw(makeRaw());
    // Default test data: 30 + 15 + 5 = 50
    expect(result.totalWatchers).toBe(50);
  });

  it("returns 0 totalWatchers when no owned repos", () => {
    const raw = makeRaw({
      ownedRepoStars: { nodes: [] },
    });
    const result = buildStatsFromRaw(raw);
    expect(result.totalWatchers).toBe(0);
  });
});
