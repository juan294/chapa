import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchStats } from "./stats";
import * as queries from "./queries";
import * as serverErrors from "@/lib/analytics/server-errors";

vi.mock("./queries");
vi.mock("@/lib/analytics/server-errors");

const mockedQueries = vi.mocked(queries);
const mockedServerErrors = vi.mocked(serverErrors);

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
    mergedPrTotalCount: 3,
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
        { additions: 100, deletions: 20, changedFiles: 5, merged: true, body: null, headRefName: "feat/a", closingIssuesCount: 0 },
        { additions: 50, deletions: 10, changedFiles: 3, merged: true, body: null, headRefName: "feat/b", closingIssuesCount: 0 },
        { additions: 200, deletions: 50, changedFiles: 8, merged: true, body: null, headRefName: "feat/c", closingIssuesCount: 0 },
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
    ownedRepoStars: { nodes: [] as { stargazerCount: number; forkCount: number; watchers: { totalCount: number } }[] },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// fetchStats
// ---------------------------------------------------------------------------

describe("fetchStats", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockedServerErrors.captureServerEvent.mockReset();
    mockedServerErrors.captureServerEvent.mockResolvedValue(undefined);
  });

  it("transforms raw data into StatsData shape", async () => {
    mockedQueries.fetchContributionData.mockResolvedValue(makeContribData());

    const stats = await fetchStats("test-user", "gho_token");
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
          { additions: 1000, deletions: 500, changedFiles: 20, merged: true, body: null, headRefName: "feat/big", closingIssuesCount: 0 },
        ],
      },
    });
    mockedQueries.fetchContributionData.mockResolvedValue(data);

    const stats = await fetchStats("test-user", "gho_token");
    // w = 0.5 + 0.25*ln(1+20) + 0.25*ln(1+1500) = 0.5 + 0.76 + 1.83 = 3.09 → capped at 3.0
    expect(stats!.prsMergedWeight).toBeCloseTo(3.0, 1);
  });

  it("excludes unmerged PRs from weight calculation", async () => {
    const data = makeContribData({
      mergedPrTotalCount: 1,
      pullRequests: {
        totalCount: 2,
        nodes: [
          { additions: 100, deletions: 20, changedFiles: 5, merged: true, body: null, headRefName: "feat/x", closingIssuesCount: 0 },
          { additions: 200, deletions: 50, changedFiles: 10, merged: false, body: null, headRefName: "feat/y", closingIssuesCount: 0 },
        ],
      },
    });
    mockedQueries.fetchContributionData.mockResolvedValue(data);

    const stats = await fetchStats("test-user", "gho_token");
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

    const stats = await fetchStats("test-user", "gho_token");
    expect(stats!.topRepoShare).toBeCloseTo(0.9, 2);
  });

  it("sets topRepoShare to 0 when no repos", async () => {
    const data = makeContribData({
      repositories: { totalCount: 0, nodes: [] },
    });
    mockedQueries.fetchContributionData.mockResolvedValue(data);

    const stats = await fetchStats("test-user", "gho_token");
    expect(stats!.topRepoShare).toBe(0);
  });

  it("passes displayName and avatarUrl from raw data", async () => {
    mockedQueries.fetchContributionData.mockResolvedValue(
      makeContribData({ name: "Juan García", avatarUrl: "https://avatars.githubusercontent.com/u/42" }),
    );

    const stats = await fetchStats("test-user", "gho_token");
    expect(stats!.displayName).toBe("Juan García");
    expect(stats!.avatarUrl).toBe("https://avatars.githubusercontent.com/u/42");
  });

  it("sets displayName to undefined when GitHub name is null", async () => {
    mockedQueries.fetchContributionData.mockResolvedValue(
      makeContribData({ name: null }),
    );

    const stats = await fetchStats("test-user", "gho_token");
    expect(stats!.displayName).toBeUndefined();
  });

  it("returns null when the query fails", async () => {
    mockedQueries.fetchContributionData.mockResolvedValue(null);

    const stats = await fetchStats("test-user", "gho_token");
    expect(stats).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Scoring-integrity contract (2026-07-07): reject a degraded fetch at the
  // source instead of ever building a corrupt StatsData.
  // ---------------------------------------------------------------------------

  it("rejects a degraded fetch (search sees merged PRs, sample is empty) and returns null", async () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const data = makeContribData({
      mergedPrTotalCount: 904,
      pullRequests: { totalCount: 143, nodes: [] },
    });
    mockedQueries.fetchContributionData.mockResolvedValue(data);

    const stats = await fetchStats("test-user", "gho_token");

    expect(stats).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("rejecting degraded fetch for test-user"),
    );
    await vi.waitFor(() => {
      expect(mockedServerErrors.captureServerEvent).toHaveBeenCalledWith(
        "stats_fetch_rejected",
        {
          handle: "test-user",
          reason: "pr_nodes_empty_but_search_positive",
          mergedPrTotalCount: 904,
          mergedNodeCount: 0,
          authenticated: true,
        },
      );
    });
    consoleSpy.mockRestore();
  });

  it("accepts a healthy fetch where the sample is a non-empty subset of the authoritative count", async () => {
    const data = makeContribData({ mergedPrTotalCount: 904 });
    mockedQueries.fetchContributionData.mockResolvedValue(data);

    const stats = await fetchStats("test-user", "gho_token");

    expect(stats).not.toBeNull();
    expect(stats!.prsMergedCount).toBe(904);
    expect(mockedServerErrors.captureServerEvent).not.toHaveBeenCalled();
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
      weeks[Math.floor(i / 7)]!.contributionDays[i % 7]!.contributionCount = 3;
    }
    const data = makeContribData({
      contributionCalendar: { totalContributions: 30, weeks },
    });
    mockedQueries.fetchContributionData.mockResolvedValue(data);

    const stats = await fetchStats("test-user", "gho_token");
    expect(stats!.activeDays).toBe(10);
  });
});
