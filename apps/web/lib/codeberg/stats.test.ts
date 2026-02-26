import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchCodebergStats } from "./stats";

vi.mock("./queries", () => ({
  fetchCodebergContributionData: vi.fn(),
}));

vi.mock("./stats-aggregation", () => ({
  buildStatsFromCodeberg: vi.fn(),
}));

import { fetchCodebergContributionData } from "./queries";
import { buildStatsFromCodeberg } from "./stats-aggregation";

const mockedFetch = vi.mocked(fetchCodebergContributionData);
const mockedBuild = vi.mocked(buildStatsFromCodeberg);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("fetchCodebergStats", () => {
  const profile = { displayName: "Test", avatarUrl: "https://example.com/avatar.png" };

  it("returns null when fetchCodebergContributionData returns null", async () => {
    mockedFetch.mockResolvedValue(null);
    const result = await fetchCodebergStats("user", "token", profile);
    expect(result).toBeNull();
    expect(mockedFetch).toHaveBeenCalledWith("user", "token", profile);
    expect(mockedBuild).not.toHaveBeenCalled();
  });

  it("returns StatsData when raw data is available", async () => {
    const rawData = { login: "user", name: "Test" } as never;
    const stats = { handle: "user", commitsTotal: 100 } as never;
    mockedFetch.mockResolvedValue(rawData);
    mockedBuild.mockReturnValue(stats);

    const result = await fetchCodebergStats("user", "token", profile);
    expect(result).toBe(stats);
    expect(mockedFetch).toHaveBeenCalledWith("user", "token", profile);
    expect(mockedBuild).toHaveBeenCalledWith(rawData);
  });
});
