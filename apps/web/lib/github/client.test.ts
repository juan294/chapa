import { describe, it, expect, vi, beforeEach } from "vitest";
import type { StatsData, SupplementalStats } from "@chapa/shared";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockFetchStatsData, mockCacheGet, mockCacheSet } = vi.hoisted(() => ({
  mockFetchStatsData: vi.fn(),
  mockCacheGet: vi.fn(),
  mockCacheSet: vi.fn(),
}));

vi.mock("./stats", () => ({
  fetchStats: mockFetchStatsData,
}));

vi.mock("../cache/redis", () => ({
  cacheGet: mockCacheGet,
  cacheSet: mockCacheSet,
}));

import { getStats } from "./client";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStats(overrides: Partial<StatsData> = {}): StatsData {
  return {
    handle: "test-user",
    commitsTotal: 50,
    activeDays: 20,
    prsMergedCount: 5,
    prsMergedWeight: 10,
    reviewsSubmittedCount: 8,
    issuesClosedCount: 3,
    linesAdded: 1000,
    linesDeleted: 500,
    reposContributed: 3,
    topRepoShare: 0.5,
    maxCommitsIn10Min: 3,
    totalStars: 0,
    totalForks: 0,
    totalWatchers: 0,
    heatmapData: [{ date: "2025-01-01", count: 5 }],
    fetchedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCacheSet.mockResolvedValue(undefined);
  });

  it("returns cached stats when available (no supplemental)", async () => {
    const cached = makeStats();
    mockCacheGet.mockResolvedValue(cached);

    const result = await getStats("test-user");
    expect(result).toEqual(cached);
    expect(mockFetchStatsData).not.toHaveBeenCalled();
  });

  it("fetches from GitHub on cache miss and caches result", async () => {
    const fresh = makeStats();
    mockCacheGet.mockResolvedValue(null);
    mockFetchStatsData.mockResolvedValue(fresh);

    const result = await getStats("test-user");
    expect(result).toEqual(fresh);
    expect(mockCacheSet).toHaveBeenCalledWith("stats:v2:test-user", fresh, 21600);
  });

  it("returns null when GitHub returns null", async () => {
    mockCacheGet.mockResolvedValue(null);
    mockFetchStatsData.mockResolvedValue(null);

    const result = await getStats("test-user");
    expect(result).toBeNull();
  });

  it("merges supplemental data when present in Redis", async () => {
    const primary = makeStats({ commitsTotal: 50, prsMergedCount: 5 });
    const supplementalStats = makeStats({
      handle: "corp-user",
      commitsTotal: 30,
      prsMergedCount: 3,
    });
    const supplemental: SupplementalStats = {
      targetHandle: "test-user",
      sourceHandle: "corp-user",
      stats: supplementalStats,
      uploadedAt: new Date().toISOString(),
    };

    // First call: stats cache miss; second call: supplemental hit
    mockCacheGet
      .mockResolvedValueOnce(null) // stats:test-user
      .mockResolvedValueOnce(supplemental); // supplemental:test-user
    mockFetchStatsData.mockResolvedValue(primary);

    const result = await getStats("test-user");
    expect(result).not.toBeNull();
    expect(result!.commitsTotal).toBe(80); // 50 + 30
    expect(result!.prsMergedCount).toBe(8); // 5 + 3
    expect(result!.hasSupplementalData).toBe(true);
    expect(result!.handle).toBe("test-user"); // preserves primary identity
  });

  it("returns primary stats when supplemental lookup fails", async () => {
    const primary = makeStats({ commitsTotal: 50 });

    mockCacheGet
      .mockResolvedValueOnce(null) // stats cache miss
      .mockResolvedValueOnce(null); // no supplemental
    mockFetchStatsData.mockResolvedValue(primary);

    const result = await getStats("test-user");
    expect(result).not.toBeNull();
    expect(result!.commitsTotal).toBe(50);
    expect(result!.hasSupplementalData).toBeUndefined();
  });

  it("caches the merged result (not just primary)", async () => {
    const primary = makeStats({ commitsTotal: 50 });
    const supplemental: SupplementalStats = {
      targetHandle: "test-user",
      sourceHandle: "corp-user",
      stats: makeStats({ commitsTotal: 30 }),
      uploadedAt: new Date().toISOString(),
    };

    mockCacheGet
      .mockResolvedValueOnce(null) // stats cache miss
      .mockResolvedValueOnce(supplemental);
    mockFetchStatsData.mockResolvedValue(primary);

    await getStats("test-user");

    // The cached value should be the merged stats
    expect(mockCacheSet).toHaveBeenCalledWith(
      "stats:v2:test-user",
      expect.objectContaining({ commitsTotal: 80, hasSupplementalData: true }),
      21600,
    );
  });

  it("passes token argument through to fetchStats", async () => {
    mockCacheGet.mockResolvedValue(null);
    mockFetchStatsData.mockResolvedValue(makeStats());

    await getStats("test-user", "abc");

    expect(mockFetchStatsData).toHaveBeenCalledWith("test-user", "abc");
  });
});
