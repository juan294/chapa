import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFetchContribution, mockBuild } = vi.hoisted(() => ({
  mockFetchContribution: vi.fn(),
  mockBuild: vi.fn(),
}));

vi.mock("./queries", () => ({
  fetchGitlabContributionData: mockFetchContribution,
}));

vi.mock("./stats-aggregation", () => ({
  buildStatsFromGitlab: mockBuild,
}));

import { fetchGitlabStats } from "./stats";

const PROFILE = { displayName: "GL User", avatarUrl: "" };

describe("fetchGitlabStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when contribution data is null", async () => {
    mockFetchContribution.mockResolvedValue(null);

    const result = await fetchGitlabStats(42, "gluser", "tok", PROFILE);

    expect(result).toBeNull();
    expect(mockBuild).not.toHaveBeenCalled();
  });

  it("delegates to buildStatsFromGitlab with the raw data", async () => {
    const raw = { username: "gluser" };
    const stats = { handle: "gluser" };
    mockFetchContribution.mockResolvedValue(raw);
    mockBuild.mockReturnValue(stats);

    const result = await fetchGitlabStats(42, "gluser", "tok", PROFILE);

    expect(mockFetchContribution).toHaveBeenCalledWith(42, "gluser", "tok", PROFILE);
    expect(mockBuild).toHaveBeenCalledWith(raw);
    expect(result).toBe(stats);
  });
});
