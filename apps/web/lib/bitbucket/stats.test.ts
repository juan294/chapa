import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFetchContributionData, mockBuildStats } = vi.hoisted(() => ({
  mockFetchContributionData: vi.fn(),
  mockBuildStats: vi.fn(),
}));

vi.mock("./queries", () => ({
  fetchBitbucketContributionData: mockFetchContributionData,
}));

vi.mock("./stats-aggregation", () => ({
  buildStatsFromBitbucket: mockBuildStats,
}));

import { fetchBitbucketStats } from "./stats";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fetchBitbucketStats", () => {
  it("returns null when contribution data fetch fails", async () => {
    mockFetchContributionData.mockResolvedValue(null);

    const result = await fetchBitbucketStats("bbuser", "token", {
      displayName: "BB User",
      avatarUrl: "https://bb.org/avatar.png",
    });

    expect(result).toBeNull();
    expect(mockBuildStats).not.toHaveBeenCalled();
  });

  it("transforms raw data into StatsData on success", async () => {
    const rawData = { username: "bbuser", commits: [] };
    const statsData = { handle: "bbuser", commitsTotal: 0 };

    mockFetchContributionData.mockResolvedValue(rawData);
    mockBuildStats.mockReturnValue(statsData);

    const result = await fetchBitbucketStats("bbuser", "token", {
      displayName: "BB User",
      avatarUrl: "https://bb.org/avatar.png",
    });

    expect(mockFetchContributionData).toHaveBeenCalledWith(
      "bbuser",
      "token",
      { displayName: "BB User", avatarUrl: "https://bb.org/avatar.png" },
    );
    expect(mockBuildStats).toHaveBeenCalledWith(rawData);
    expect(result).toBe(statsData);
  });
});
