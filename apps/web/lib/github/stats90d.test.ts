import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchStats90d } from "./stats90d";
import * as queries from "./queries";

vi.mock("./queries");

const mockedQueries = vi.mocked(queries);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContribData(
  overrides: Partial<queries.RawContributionData> = {},
): queries.RawContributionData {
  return {
    login: "test-user",
    name: "Test User",
    avatarUrl: "https://avatars.githubusercontent.com/u/1",
    contributionCalendar: {
      totalContributions: 120,
      weeks: Array.from({ length: 13 }, (_, w) => ({
        contributionDays: Array.from({ length: 7 }, (_, d) => ({
          date: `2026-0${Math.floor((w * 7 + d) / 30) + 1}-${String(((w * 7 + d) % 30) + 1).padStart(2, "0")}`,
          contributionCount: w === 0 && d === 0 ? 0 : Math.floor(Math.random() * 5),
        })),
      })),
    },
    pullRequests: {
      totalCount: 8,
      nodes: [
        { additions: 100, deletions: 20, changedFiles: 5, merged: true },
        { additions: 50, deletions: 10, changedFiles: 3, merged: true },
        { additions: 200, deletions: 50, changedFiles: 8, merged: true },
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
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// fetchStats90d
// ---------------------------------------------------------------------------

describe("fetchStats90d", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("transforms raw data into Stats90d shape", async () => {
    mockedQueries.fetchContributionData.mockResolvedValue(makeContribData());

    const stats = await fetchStats90d("test-user", "gho_token");
    expect(stats).not.toBeNull();
    expect(stats!.handle).toBe("test-user");
    expect(stats!.commitsTotal).toBeGreaterThanOrEqual(0);
    expect(stats!.activeDays).toBeGreaterThanOrEqual(0);
    expect(stats!.activeDays).toBeLessThanOrEqual(91);
    expect(stats!.prsMergedCount).toBe(3);
    expect(stats!.reviewsSubmittedCount).toBe(15);
    expect(stats!.issuesClosedCount).toBe(5);
    expect(stats!.reposContributed).toBe(4);
    expect(stats!.heatmapData).toHaveLength(91);
    expect(stats!.fetchedAt).toBeTruthy();
  });

  it("computes PR weight with log formula, capped at 3.0 per PR", async () => {
    const data = makeContribData({
      pullRequests: {
        totalCount: 1,
        nodes: [
          { additions: 1000, deletions: 500, changedFiles: 20, merged: true },
        ],
      },
    });
    mockedQueries.fetchContributionData.mockResolvedValue(data);

    const stats = await fetchStats90d("test-user", "gho_token");
    // w = 0.5 + 0.25*ln(1+20) + 0.25*ln(1+1500) = 0.5 + 0.76 + 1.83 = 3.09 → capped at 3.0
    expect(stats!.prsMergedWeight).toBeCloseTo(3.0, 1);
  });

  it("excludes unmerged PRs from weight calculation", async () => {
    const data = makeContribData({
      pullRequests: {
        totalCount: 2,
        nodes: [
          { additions: 100, deletions: 20, changedFiles: 5, merged: true },
          { additions: 200, deletions: 50, changedFiles: 10, merged: false },
        ],
      },
    });
    mockedQueries.fetchContributionData.mockResolvedValue(data);

    const stats = await fetchStats90d("test-user", "gho_token");
    expect(stats!.prsMergedCount).toBe(1);
  });

  it("computes topRepoShare as proportion of top repo commits", async () => {
    const data = makeContribData({
      repositories: {
        totalCount: 2,
        nodes: [
          { nameWithOwner: "user/main", defaultBranchRef: { target: { history: { totalCount: 90 } } } },
          { nameWithOwner: "user/side", defaultBranchRef: { target: { history: { totalCount: 10 } } } },
        ],
      },
    });
    mockedQueries.fetchContributionData.mockResolvedValue(data);

    const stats = await fetchStats90d("test-user", "gho_token");
    expect(stats!.topRepoShare).toBeCloseTo(0.9, 2);
  });

  it("sets topRepoShare to 0 when no repos", async () => {
    const data = makeContribData({
      repositories: { totalCount: 0, nodes: [] },
    });
    mockedQueries.fetchContributionData.mockResolvedValue(data);

    const stats = await fetchStats90d("test-user", "gho_token");
    expect(stats!.topRepoShare).toBe(0);
  });

  it("returns null when the query fails", async () => {
    mockedQueries.fetchContributionData.mockResolvedValue(null);

    const stats = await fetchStats90d("test-user", "gho_token");
    expect(stats).toBeNull();
  });

  it("counts active days from heatmap (days with count > 0)", async () => {
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
    const data = makeContribData({
      contributionCalendar: { totalContributions: 30, weeks },
    });
    mockedQueries.fetchContributionData.mockResolvedValue(data);

    const stats = await fetchStats90d("test-user", "gho_token");
    expect(stats!.activeDays).toBe(10);
  });
});
