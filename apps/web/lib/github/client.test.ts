import { describe, it, expect, vi, beforeEach } from "vitest";
import type { StatsData, SupplementalStats } from "@chapa/shared";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const {
  mockFetchStatsData,
  mockCacheGet,
  mockCacheSet,
  mockDbUpsertUser,
  mockIsBitbucketEnabled,
  mockDbGetLinkedPlatform,
  mockDbDeleteLinkedPlatform,
  mockDbUpdatePlatformTokens,
  mockIsTokenExpired,
  mockRefreshBitbucketToken,
  mockFetchBitbucketStats,
} = vi.hoisted(() => ({
  mockFetchStatsData: vi.fn(),
  mockCacheGet: vi.fn(),
  mockCacheSet: vi.fn(),
  mockDbUpsertUser: vi.fn(() => Promise.resolve()),
  mockIsBitbucketEnabled: vi.fn(),
  mockDbGetLinkedPlatform: vi.fn(),
  mockDbDeleteLinkedPlatform: vi.fn(),
  mockDbUpdatePlatformTokens: vi.fn(),
  mockIsTokenExpired: vi.fn(),
  mockRefreshBitbucketToken: vi.fn(),
  mockFetchBitbucketStats: vi.fn(),
}));

vi.mock("./stats", () => ({
  fetchStats: mockFetchStatsData,
}));

vi.mock("../cache/redis", () => ({
  cacheGet: mockCacheGet,
  cacheSet: mockCacheSet,
}));

vi.mock("@/lib/db/users", () => ({
  dbUpsertUser: mockDbUpsertUser,
}));

vi.mock("@/lib/feature-flags", () => ({
  isBitbucketEnabled: mockIsBitbucketEnabled,
}));

vi.mock("@/lib/db/user-platforms", () => ({
  dbGetLinkedPlatform: mockDbGetLinkedPlatform,
  dbDeleteLinkedPlatform: mockDbDeleteLinkedPlatform,
  dbUpdatePlatformTokens: mockDbUpdatePlatformTokens,
}));

vi.mock("@/lib/auth/bitbucket", () => ({
  isTokenExpired: mockIsTokenExpired,
  refreshBitbucketToken: mockRefreshBitbucketToken,
}));

vi.mock("@/lib/bitbucket/stats", () => ({
  fetchBitbucketStats: mockFetchBitbucketStats,
}));

import { getStats, _resetInflight } from "./client";
import { makeStats as _makeStats } from "../test-helpers/fixtures";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStats(overrides: Partial<StatsData> = {}): StatsData {
  return _makeStats({
    handle: "test-user",
    activeDays: 20,
    reviewsSubmittedCount: 8,
    linesAdded: 1000,
    reposContributed: 3,
    topRepoShare: 0.5,
    heatmapData: [{ date: "2025-01-01", count: 5 }],
    ...overrides,
  });
}

/** Set up mocks for a standard cache miss → GitHub fetch scenario. */
function setupCacheMiss(githubStats: StatsData) {
  mockCacheGet
    .mockResolvedValueOnce(null) // stats:v2:merged:test-user (primary)
    .mockResolvedValueOnce(null) // stats:stale:test-user (stale fallback)
    .mockResolvedValueOnce(null) // stats:v2:bitbucket:test-user (bitbucket cache)
    .mockResolvedValueOnce(null); // supplemental:test-user
  mockFetchStatsData.mockResolvedValue(githubStats);
  mockIsBitbucketEnabled.mockResolvedValue(false);
}

function setupBitbucketLinked(bbStats: StatsData | null) {
  mockIsBitbucketEnabled.mockResolvedValue(true);
  mockDbGetLinkedPlatform.mockResolvedValue({
    remoteLogin: "bb-user",
    tokens: {
      accessToken: "bb-token",
      refreshToken: "bb-refresh",
      expiresAt: new Date("2025-12-31"),
    },
  });
  mockIsTokenExpired.mockReturnValue(false);
  mockFetchBitbucketStats.mockResolvedValue(bbStats);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCacheSet.mockResolvedValue(undefined);
    mockIsBitbucketEnabled.mockResolvedValue(false);
    mockDbGetLinkedPlatform.mockResolvedValue(null);
    mockDbDeleteLinkedPlatform.mockResolvedValue(true);
    mockDbUpdatePlatformTokens.mockResolvedValue(true);
    _resetInflight();
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
    setupCacheMiss(fresh);

    const result = await getStats("test-user");
    expect(result).toEqual(fresh);
    expect(mockCacheSet).toHaveBeenCalledWith(
      "stats:v2:merged:test-user",
      fresh,
      21600,
    );
    expect(mockCacheSet).toHaveBeenCalledWith(
      "stats:stale:test-user",
      fresh,
      604800,
    );
  });

  it("normalizes handle to lowercase for cache keys", async () => {
    const fresh = makeStats();
    mockCacheGet
      .mockResolvedValueOnce(null) // merged
      .mockResolvedValueOnce(null) // stale
      .mockResolvedValueOnce(null) // bitbucket cache
      .mockResolvedValueOnce(null); // supplemental
    mockFetchStatsData.mockResolvedValue(fresh);
    mockIsBitbucketEnabled.mockResolvedValue(false);

    await getStats("Test-User");
    expect(mockCacheGet).toHaveBeenCalledWith("stats:v2:merged:test-user");
    expect(mockCacheGet).toHaveBeenCalledWith("stats:stale:test-user");
    expect(mockCacheSet).toHaveBeenCalledWith(
      "stats:v2:merged:test-user",
      fresh,
      21600,
    );
  });

  it("returns null when GitHub returns null and no stale cache", async () => {
    mockCacheGet
      .mockResolvedValueOnce(null) // merged
      .mockResolvedValueOnce(null); // stale
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

    mockCacheGet
      .mockResolvedValueOnce(null) // merged
      .mockResolvedValueOnce(null) // stale
      .mockResolvedValueOnce(null) // bitbucket cache
      .mockResolvedValueOnce(supplemental); // supplemental hit
    mockFetchStatsData.mockResolvedValue(primary);
    mockIsBitbucketEnabled.mockResolvedValue(false);

    const result = await getStats("test-user");
    expect(result).not.toBeNull();
    expect(result!.commitsTotal).toBe(80); // 50 + 30
    expect(result!.prsMergedCount).toBe(8); // 5 + 3
    expect(result!.hasSupplementalData).toBe(true);
    expect(result!.handle).toBe("test-user"); // preserves primary identity
  });

  it("returns primary stats when supplemental lookup fails", async () => {
    const primary = makeStats({ commitsTotal: 50 });
    setupCacheMiss(primary);

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
      .mockResolvedValueOnce(null) // merged
      .mockResolvedValueOnce(null) // stale
      .mockResolvedValueOnce(null) // bitbucket cache
      .mockResolvedValueOnce(supplemental);
    mockFetchStatsData.mockResolvedValue(primary);
    mockIsBitbucketEnabled.mockResolvedValue(false);

    await getStats("test-user");

    expect(mockCacheSet).toHaveBeenCalledWith(
      "stats:v2:merged:test-user",
      expect.objectContaining({ commitsTotal: 80, hasSupplementalData: true }),
      21600,
    );
    expect(mockCacheSet).toHaveBeenCalledWith(
      "stats:stale:test-user",
      expect.objectContaining({ commitsTotal: 80, hasSupplementalData: true }),
      604800,
    );
  });

  it("upserts user in Supabase on successful fetch", async () => {
    const fresh = makeStats();
    setupCacheMiss(fresh);

    await getStats("Test-User");

    expect(mockDbUpsertUser).toHaveBeenCalledWith("Test-User");
  });

  it("does NOT upsert user when serving from cache", async () => {
    const cached = makeStats();
    mockCacheGet.mockResolvedValue(cached);

    await getStats("test-user");

    expect(mockDbUpsertUser).not.toHaveBeenCalled();
  });

  it("does NOT upsert user when API fails", async () => {
    mockCacheGet
      .mockResolvedValueOnce(null) // merged
      .mockResolvedValueOnce(null); // stale
    mockFetchStatsData.mockResolvedValue(null);

    await getStats("test-user");

    expect(mockDbUpsertUser).not.toHaveBeenCalled();
  });

  it("passes token argument through to fetchStats", async () => {
    setupCacheMiss(makeStats());

    await getStats("test-user", "abc");

    expect(mockFetchStatsData).toHaveBeenCalledWith("test-user", "abc");
  });

  // -----------------------------------------------------------------------
  // Stale cache fallback on API failure (#273)
  // -----------------------------------------------------------------------

  describe("stale cache fallback on API failure", () => {
    it("returns stale data when API fails and stale cache exists", async () => {
      const stale = makeStats({ commitsTotal: 42 });
      mockCacheGet
        .mockResolvedValueOnce(null) // merged miss
        .mockResolvedValueOnce(stale); // stale hit
      mockFetchStatsData.mockResolvedValue(null); // API failure

      const result = await getStats("test-user");
      expect(result).toEqual(stale);
    });

    it("returns null when API fails and no stale cache exists", async () => {
      mockCacheGet
        .mockResolvedValueOnce(null) // merged miss
        .mockResolvedValueOnce(null); // stale miss
      mockFetchStatsData.mockResolvedValue(null);

      const result = await getStats("test-user");
      expect(result).toBeNull();
    });

    it("writes both primary and stale cache on successful fetch", async () => {
      const fresh = makeStats();
      setupCacheMiss(fresh);

      await getStats("test-user");

      expect(mockCacheSet).toHaveBeenCalledWith(
        "stats:v2:merged:test-user",
        fresh,
        21600,
      );
      expect(mockCacheSet).toHaveBeenCalledWith(
        "stats:stale:test-user",
        fresh,
        604800,
      );
    });

    it("does NOT re-cache stale data with a fresh TTL", async () => {
      const stale = makeStats({ commitsTotal: 42 });
      mockCacheGet
        .mockResolvedValueOnce(null) // merged miss
        .mockResolvedValueOnce(stale); // stale hit
      mockFetchStatsData.mockResolvedValue(null); // API failure

      await getStats("test-user");

      // cacheSet should NOT have been called — stale data stays as-is
      expect(mockCacheSet).not.toHaveBeenCalled();
    });

    it("prefers fresh API data over stale cache", async () => {
      const stale = makeStats({ commitsTotal: 42 });
      const fresh = makeStats({ commitsTotal: 99 });
      mockCacheGet
        .mockResolvedValueOnce(null) // merged miss
        .mockResolvedValueOnce(stale) // stale exists
        .mockResolvedValueOnce(null) // bitbucket cache
        .mockResolvedValueOnce(null); // no supplemental
      mockFetchStatsData.mockResolvedValue(fresh); // API succeeds
      mockIsBitbucketEnabled.mockResolvedValue(false);

      const result = await getStats("test-user");
      expect(result).toEqual(fresh);
      expect(result!.commitsTotal).toBe(99);
    });

    it("uses lowercase handle for stale cache key", async () => {
      const stale = makeStats();
      mockCacheGet
        .mockResolvedValueOnce(null) // merged miss
        .mockResolvedValueOnce(stale); // stale hit
      mockFetchStatsData.mockResolvedValue(null);

      await getStats("Test-User");

      expect(mockCacheGet).toHaveBeenCalledWith("stats:stale:test-user");
    });

    it("logs when serving stale data", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const stale = makeStats();
      mockCacheGet
        .mockResolvedValueOnce(null) // merged miss
        .mockResolvedValueOnce(stale); // stale hit
      mockFetchStatsData.mockResolvedValue(null);

      await getStats("test-user");

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("[cache] serving stale data for test-user"),
      );
      warnSpy.mockRestore();
    });
  });

  // -----------------------------------------------------------------------
  // Request deduplication (#272)
  // -----------------------------------------------------------------------

  describe("request deduplication", () => {
    it("deduplicates concurrent calls for the same handle into one fetchStats call", async () => {
      const fresh = makeStats();

      let resolveFetch!: (value: StatsData) => void;
      mockFetchStatsData.mockReturnValue(
        new Promise<StatsData>((r) => {
          resolveFetch = r;
        }),
      );
      mockCacheGet.mockResolvedValue(null);
      mockIsBitbucketEnabled.mockResolvedValue(false);

      const p1 = getStats("test-user");
      const p2 = getStats("test-user");
      const p3 = getStats("test-user");

      resolveFetch(fresh);

      const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

      expect(r1).toEqual(fresh);
      expect(r2).toEqual(fresh);
      expect(r3).toEqual(fresh);

      expect(mockFetchStatsData).toHaveBeenCalledTimes(1);
    });

    it("makes separate fetchStats calls for different handles", async () => {
      const statsA = makeStats({ handle: "alice" });
      const statsB = makeStats({ handle: "bob" });

      mockCacheGet.mockResolvedValue(null);
      mockIsBitbucketEnabled.mockResolvedValue(false);
      mockFetchStatsData
        .mockResolvedValueOnce(statsA)
        .mockResolvedValueOnce(statsB);

      const [rA, rB] = await Promise.all([
        getStats("alice"),
        getStats("bob"),
      ]);

      expect(rA).toEqual(statsA);
      expect(rB).toEqual(statsB);
      expect(mockFetchStatsData).toHaveBeenCalledTimes(2);
    });

    it("cleans up the inflight map after the promise resolves", async () => {
      const fresh = makeStats();
      mockCacheGet.mockResolvedValue(null);
      mockIsBitbucketEnabled.mockResolvedValue(false);
      mockFetchStatsData.mockResolvedValue(fresh);

      // First call: fetches
      await getStats("test-user");
      expect(mockFetchStatsData).toHaveBeenCalledTimes(1);

      // Second call after first resolves: should fetch again (not deduped)
      mockFetchStatsData.mockResolvedValue(makeStats({ commitsTotal: 99 }));
      const result = await getStats("test-user");
      expect(mockFetchStatsData).toHaveBeenCalledTimes(2);
      expect(result!.commitsTotal).toBe(99);
    });

    it("does not use the inflight map when cache hits (no dedup needed)", async () => {
      const cached = makeStats();
      mockCacheGet.mockResolvedValue(cached);

      const [r1, r2] = await Promise.all([
        getStats("test-user"),
        getStats("test-user"),
      ]);

      expect(r1).toEqual(cached);
      expect(r2).toEqual(cached);
      expect(mockFetchStatsData).not.toHaveBeenCalled();
    });

    it("normalizes handle case for deduplication", async () => {
      const fresh = makeStats();

      let resolveFetch!: (value: StatsData) => void;
      mockFetchStatsData.mockReturnValue(
        new Promise<StatsData>((r) => {
          resolveFetch = r;
        }),
      );
      mockCacheGet.mockResolvedValue(null);
      mockIsBitbucketEnabled.mockResolvedValue(false);

      const p1 = getStats("Test-User");
      const p2 = getStats("test-user");
      const p3 = getStats("TEST-USER");

      resolveFetch(fresh);

      const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

      expect(r1).toEqual(fresh);
      expect(r2).toEqual(fresh);
      expect(r3).toEqual(fresh);
      expect(mockFetchStatsData).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // Bitbucket integration
  // -----------------------------------------------------------------------

  describe("Bitbucket integration", () => {
    it("fetches and merges Bitbucket data when platform is linked", async () => {
      const github = makeStats({ commitsTotal: 50 });
      const bb = makeStats({ commitsTotal: 30 });

      mockCacheGet
        .mockResolvedValueOnce(null) // merged
        .mockResolvedValueOnce(null) // stale
        .mockResolvedValueOnce(null) // bitbucket cache
        .mockResolvedValueOnce(null); // supplemental
      mockFetchStatsData.mockResolvedValue(github);
      setupBitbucketLinked(bb);

      const result = await getStats("test-user");

      expect(result).not.toBeNull();
      expect(result!.commitsTotal).toBe(80); // 50 + 30
    });

    it("skips Bitbucket when feature flag is disabled", async () => {
      const github = makeStats({ commitsTotal: 50 });
      setupCacheMiss(github);
      // isBitbucketEnabled already returns false from setupCacheMiss

      const result = await getStats("test-user");

      expect(result!.commitsTotal).toBe(50);
      expect(mockDbGetLinkedPlatform).not.toHaveBeenCalled();
    });

    it("skips Bitbucket when not linked", async () => {
      const github = makeStats({ commitsTotal: 50 });
      mockCacheGet
        .mockResolvedValueOnce(null) // merged
        .mockResolvedValueOnce(null) // stale
        .mockResolvedValueOnce(null) // bitbucket cache
        .mockResolvedValueOnce(null); // supplemental
      mockFetchStatsData.mockResolvedValue(github);
      mockIsBitbucketEnabled.mockResolvedValue(true);
      mockDbGetLinkedPlatform.mockResolvedValue(null);

      const result = await getStats("test-user");

      expect(result!.commitsTotal).toBe(50);
      expect(mockFetchBitbucketStats).not.toHaveBeenCalled();
    });

    it("uses cached Bitbucket data when available", async () => {
      const github = makeStats({ commitsTotal: 50 });
      const cachedBb = makeStats({ commitsTotal: 30 });

      mockCacheGet
        .mockResolvedValueOnce(null) // merged
        .mockResolvedValueOnce(null) // stale
        .mockResolvedValueOnce(cachedBb) // bitbucket cache HIT
        .mockResolvedValueOnce(null); // supplemental
      mockFetchStatsData.mockResolvedValue(github);
      mockIsBitbucketEnabled.mockResolvedValue(true);

      const result = await getStats("test-user");

      expect(result!.commitsTotal).toBe(80);
      // Should NOT have called the DB or fetch — used cache
      expect(mockDbGetLinkedPlatform).not.toHaveBeenCalled();
      expect(mockFetchBitbucketStats).not.toHaveBeenCalled();
    });

    it("refreshes expired token before fetching", async () => {
      const github = makeStats({ commitsTotal: 50 });
      const bb = makeStats({ commitsTotal: 30 });

      mockCacheGet
        .mockResolvedValueOnce(null) // merged
        .mockResolvedValueOnce(null) // stale
        .mockResolvedValueOnce(null) // bitbucket cache
        .mockResolvedValueOnce(null); // supplemental
      mockFetchStatsData.mockResolvedValue(github);
      mockIsBitbucketEnabled.mockResolvedValue(true);
      mockDbGetLinkedPlatform.mockResolvedValue({
        remoteLogin: "bb-user",
        tokens: {
          accessToken: "expired-token",
          refreshToken: "bb-refresh",
          expiresAt: new Date("2020-01-01"), // expired
        },
      });
      mockIsTokenExpired.mockReturnValue(true);
      mockRefreshBitbucketToken.mockResolvedValue({
        access_token: "new-token",
        refresh_token: "new-refresh",
        expires_in: 7200,
        token_type: "bearer",
        scopes: "repository",
      });
      mockFetchBitbucketStats.mockResolvedValue(bb);

      // Stub env vars
      vi.stubEnv("BITBUCKET_CLIENT_ID", "test-client-id");
      vi.stubEnv("BITBUCKET_CLIENT_SECRET", "test-client-secret");

      const result = await getStats("test-user");

      expect(mockRefreshBitbucketToken).toHaveBeenCalledWith(
        "bb-refresh",
        "test-client-id",
        "test-client-secret",
      );
      expect(mockDbUpdatePlatformTokens).toHaveBeenCalled();
      expect(mockFetchBitbucketStats).toHaveBeenCalledWith(
        "bb-user",
        "new-token",
        { displayName: "bb-user", avatarUrl: "" },
      );
      expect(result!.commitsTotal).toBe(80);

      vi.unstubAllEnvs();
    });

    it("unlinks platform when refresh fails (token revoked)", async () => {
      const github = makeStats({ commitsTotal: 50 });

      mockCacheGet
        .mockResolvedValueOnce(null) // merged
        .mockResolvedValueOnce(null) // stale
        .mockResolvedValueOnce(null) // bitbucket cache
        .mockResolvedValueOnce(null); // supplemental
      mockFetchStatsData.mockResolvedValue(github);
      mockIsBitbucketEnabled.mockResolvedValue(true);
      mockDbGetLinkedPlatform.mockResolvedValue({
        remoteLogin: "bb-user",
        tokens: {
          accessToken: "expired-token",
          refreshToken: "bb-refresh",
          expiresAt: new Date("2020-01-01"),
        },
      });
      mockIsTokenExpired.mockReturnValue(true);
      mockRefreshBitbucketToken.mockResolvedValue(null); // refresh failed

      vi.stubEnv("BITBUCKET_CLIENT_ID", "test-client-id");
      vi.stubEnv("BITBUCKET_CLIENT_SECRET", "test-client-secret");

      const result = await getStats("test-user");

      expect(mockDbDeleteLinkedPlatform).toHaveBeenCalledWith(
        "test-user",
        "bitbucket",
      );
      // Should still return GitHub-only stats
      expect(result!.commitsTotal).toBe(50);

      vi.unstubAllEnvs();
    });

    it("sets linkedPlatforms: ['bitbucket'] on merged result", async () => {
      const github = makeStats({ commitsTotal: 50 });
      const bb = makeStats({ commitsTotal: 30 });

      mockCacheGet
        .mockResolvedValueOnce(null) // merged
        .mockResolvedValueOnce(null) // stale
        .mockResolvedValueOnce(null) // bitbucket cache
        .mockResolvedValueOnce(null); // supplemental
      mockFetchStatsData.mockResolvedValue(github);
      setupBitbucketLinked(bb);

      const result = await getStats("test-user");

      expect(result!.linkedPlatforms).toEqual(["bitbucket"]);
    });

    it("does NOT set hasSupplementalData when only Bitbucket is merged", async () => {
      const github = makeStats({ commitsTotal: 50 });
      const bb = makeStats({ commitsTotal: 30 });

      mockCacheGet
        .mockResolvedValueOnce(null) // merged
        .mockResolvedValueOnce(null) // stale
        .mockResolvedValueOnce(null) // bitbucket cache
        .mockResolvedValueOnce(null); // no supplemental
      mockFetchStatsData.mockResolvedValue(github);
      setupBitbucketLinked(bb);

      const result = await getStats("test-user");

      expect(result!.hasSupplementalData).toBe(false);
      expect(result!.linkedPlatforms).toEqual(["bitbucket"]);
    });

    it("sets hasSupplementalData when EMU is also merged", async () => {
      const github = makeStats({ commitsTotal: 50 });
      const bb = makeStats({ commitsTotal: 20 });
      const supplemental: SupplementalStats = {
        targetHandle: "test-user",
        sourceHandle: "corp-user",
        stats: makeStats({ commitsTotal: 10 }),
        uploadedAt: new Date().toISOString(),
      };

      mockCacheGet
        .mockResolvedValueOnce(null) // merged
        .mockResolvedValueOnce(null) // stale
        .mockResolvedValueOnce(null) // bitbucket cache
        .mockResolvedValueOnce(supplemental); // supplemental hit
      mockFetchStatsData.mockResolvedValue(github);
      setupBitbucketLinked(bb);

      const result = await getStats("test-user");

      expect(result!.commitsTotal).toBe(80); // 50 + 20 + 10
      expect(result!.hasSupplementalData).toBe(true);
      expect(result!.linkedPlatforms).toEqual(["bitbucket"]);
    });

    it("uses merged cache key (stats:v2:merged:{handle})", async () => {
      const cached = makeStats();
      mockCacheGet.mockResolvedValueOnce(cached); // merged cache hit

      const result = await getStats("test-user");

      expect(mockCacheGet).toHaveBeenCalledWith("stats:v2:merged:test-user");
      expect(result).toEqual(cached);
    });

    it("caches Bitbucket stats separately", async () => {
      const github = makeStats({ commitsTotal: 50 });
      const bb = makeStats({ commitsTotal: 30 });

      mockCacheGet
        .mockResolvedValueOnce(null) // merged
        .mockResolvedValueOnce(null) // stale
        .mockResolvedValueOnce(null) // bitbucket cache
        .mockResolvedValueOnce(null); // supplemental
      mockFetchStatsData.mockResolvedValue(github);
      setupBitbucketLinked(bb);

      await getStats("test-user");

      expect(mockCacheSet).toHaveBeenCalledWith(
        "stats:v2:bitbucket:test-user",
        bb,
        21600,
      );
    });
  });
});
