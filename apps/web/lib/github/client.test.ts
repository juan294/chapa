import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Stats90d, SupplementalStats } from "@chapa/shared";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockFetchStats90d, mockCacheGet, mockCacheSet } = vi.hoisted(() => ({
  mockFetchStats90d: vi.fn(),
  mockCacheGet: vi.fn(),
  mockCacheSet: vi.fn(),
}));

vi.mock("./stats90d", () => ({
  fetchStats90d: mockFetchStats90d,
}));

vi.mock("../cache/redis", () => ({
  cacheGet: mockCacheGet,
  cacheSet: mockCacheSet,
}));

import { getStats90d } from "./client";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStats(overrides: Partial<Stats90d> = {}): Stats90d {
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
    heatmapData: [{ date: "2025-01-01", count: 5 }],
    fetchedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getStats90d", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCacheSet.mockResolvedValue(undefined);
  });

  it("returns cached stats when available (no supplemental)", async () => {
    const cached = makeStats();
    mockCacheGet.mockResolvedValue(cached);

    const result = await getStats90d("test-user");
    expect(result).toEqual(cached);
    expect(mockFetchStats90d).not.toHaveBeenCalled();
  });

  it("fetches from GitHub on cache miss and caches result", async () => {
    const fresh = makeStats();
    mockCacheGet.mockResolvedValue(null);
    mockFetchStats90d.mockResolvedValue(fresh);

    const result = await getStats90d("test-user");
    expect(result).toEqual(fresh);
    expect(mockCacheSet).toHaveBeenCalledWith("stats:test-user", fresh, 86400);
  });

  it("returns null when GitHub returns null", async () => {
    mockCacheGet.mockResolvedValue(null);
    mockFetchStats90d.mockResolvedValue(null);

    const result = await getStats90d("test-user");
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
    mockFetchStats90d.mockResolvedValue(primary);

    const result = await getStats90d("test-user");
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
    mockFetchStats90d.mockResolvedValue(primary);

    const result = await getStats90d("test-user");
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
    mockFetchStats90d.mockResolvedValue(primary);

    await getStats90d("test-user");

    // The cached value should be the merged stats
    expect(mockCacheSet).toHaveBeenCalledWith(
      "stats:test-user",
      expect.objectContaining({ commitsTotal: 80, hasSupplementalData: true }),
      86400,
    );
  });
});
