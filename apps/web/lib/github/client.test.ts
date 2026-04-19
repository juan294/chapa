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
  mockIsCodebergEnabled,
  mockDbGetLinkedPlatform,
  mockDbDeleteLinkedPlatform,
  mockDbUpdatePlatformTokens,
  mockIsTokenExpired,
  mockRefreshBitbucketToken,
  mockFetchBitbucketStats,
  mockRefreshCodebergToken,
  mockFetchCodebergStats,
} = vi.hoisted(() => ({
  mockFetchStatsData: vi.fn(),
  mockCacheGet: vi.fn(),
  mockCacheSet: vi.fn(),
  mockDbUpsertUser: vi.fn(() => Promise.resolve()),
  mockIsBitbucketEnabled: vi.fn(),
  mockIsCodebergEnabled: vi.fn(),
  mockDbGetLinkedPlatform: vi.fn(),
  mockDbDeleteLinkedPlatform: vi.fn(),
  mockDbUpdatePlatformTokens: vi.fn(),
  mockIsTokenExpired: vi.fn(),
  mockRefreshBitbucketToken: vi.fn(),
  mockFetchBitbucketStats: vi.fn(),
  mockRefreshCodebergToken: vi.fn(),
  mockFetchCodebergStats: vi.fn(),
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
  isCodebergEnabled: mockIsCodebergEnabled,
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

vi.mock("@/lib/auth/codeberg", () => ({
  refreshCodebergToken: mockRefreshCodebergToken,
}));

vi.mock("@/lib/codeberg/stats", () => ({
  fetchCodebergStats: mockFetchCodebergStats,
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
    .mockResolvedValueOnce(null) // stats:v2:codeberg:test-user (codeberg cache)
    .mockResolvedValueOnce(null); // supplemental:test-user
  mockFetchStatsData.mockResolvedValue(githubStats);
  mockIsBitbucketEnabled.mockResolvedValue(false);
  mockIsCodebergEnabled.mockResolvedValue(false);
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
    mockIsCodebergEnabled.mockResolvedValue(false);
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

  it("enriches cached stats with linkedPlatformLogins when missing", async () => {
    // Simulate pre-deploy cached data: has linkedPlatforms but no linkedPlatformLogins
    const cached = makeStats({
      linkedPlatforms: ["bitbucket", "codeberg"],
    });
    mockCacheGet.mockResolvedValue(cached);
    mockDbGetLinkedPlatform.mockImplementation(
      (_handle: string, platform: string) => {
        if (platform === "bitbucket") {
          return Promise.resolve({
            remoteLogin: "bb-user",
            tokens: { accessToken: "t", refreshToken: null, expiresAt: null },
          });
        }
        if (platform === "codeberg") {
          return Promise.resolve({
            remoteLogin: "cb-user",
            tokens: { accessToken: "t", refreshToken: null, expiresAt: null },
          });
        }
        return Promise.resolve(null);
      },
    );

    const result = await getStats("test-user");

    expect(result!.linkedPlatformLogins).toEqual({
      bitbucket: "bb-user",
      codeberg: "cb-user",
    });
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
      .mockResolvedValueOnce(null) // codeberg cache
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
      .mockResolvedValueOnce(null) // codeberg cache
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
      .mockResolvedValueOnce(null) // codeberg cache
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
        .mockResolvedValueOnce(null) // codeberg cache
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

    it("does not let an authenticated request reuse a public inflight fetch", async () => {
      const publicStats = makeStats({ commitsTotal: 11 });
      const authedStats = makeStats({ commitsTotal: 22 });

      let resolvePublicFetch!: (value: StatsData) => void;
      let resolveAuthedFetch!: (value: StatsData) => void;
      mockFetchStatsData
        .mockReturnValueOnce(
          new Promise<StatsData>((resolve) => {
            resolvePublicFetch = resolve;
          }),
        )
        .mockReturnValueOnce(
          new Promise<StatsData>((resolve) => {
            resolveAuthedFetch = resolve;
          }),
        );
      mockCacheGet.mockResolvedValue(null);
      mockIsBitbucketEnabled.mockResolvedValue(false);
      mockIsCodebergEnabled.mockResolvedValue(false);

      const publicPromise = getStats("test-user");
      const authedPromise = getStats("test-user", "auth-token");

      resolvePublicFetch(publicStats);
      resolveAuthedFetch(authedStats);

      const [publicResult, authedResult] = await Promise.all([
        publicPromise,
        authedPromise,
      ]);

      expect(publicResult).toEqual(publicStats);
      expect(authedResult).toEqual(authedStats);
      expect(mockFetchStatsData).toHaveBeenCalledTimes(2);
      expect(mockFetchStatsData).toHaveBeenNthCalledWith(1, "test-user", undefined);
      expect(mockFetchStatsData).toHaveBeenNthCalledWith(2, "test-user", "auth-token");
    });

    // -----------------------------------------------------------------------
    // BE-M14: inflight timeout + cleanup (#701)
    // -----------------------------------------------------------------------

    it("cleans up the inflight map after a timeout so subsequent requests can proceed", async () => {
      // Simulate a hanging fetch that never resolves — the withTimeout wrapper
      // should reject it after 30s, remove it from _inflight, and allow future
      // calls to retry.  In tests we use vi.useFakeTimers to advance time.
      vi.useFakeTimers();

      // Hanging promise — never resolves
      const hangingPromise = new Promise<never>(() => { /* intentionally hangs */ });
      mockFetchStatsData.mockReturnValueOnce(hangingPromise);
      mockCacheGet.mockResolvedValue(null);
      mockIsBitbucketEnabled.mockResolvedValue(false);
      mockIsCodebergEnabled.mockResolvedValue(false);

      const p1 = getStats("test-user");

      // Advance timers past the 30s inflight timeout
      await vi.advanceTimersByTimeAsync(31_000);

      // p1 should have resolved to null (timeout → stale fallback → null)
      const result1 = await p1;
      expect(result1).toBeNull();

      // The inflight entry should now be gone — a second call must attempt a fresh fetch
      vi.useRealTimers();

      const fresh = makeStats({ commitsTotal: 77 });
      mockCacheGet.mockResolvedValue(null);
      mockFetchStatsData.mockResolvedValue(fresh);
      mockIsBitbucketEnabled.mockResolvedValue(false);
      mockIsCodebergEnabled.mockResolvedValue(false);

      const result2 = await getStats("test-user");
      // fetchStats was called twice — once for hanging, once for fresh
      expect(mockFetchStatsData).toHaveBeenCalledTimes(2);
      expect(result2).not.toBeNull();
      expect(result2!.commitsTotal).toBe(77);
    });

    it("a hanging inflight promise does not block subsequent fresh requests after timeout", async () => {
      vi.useFakeTimers();

      const hangingPromise = new Promise<never>(() => { /* hangs */ });
      mockFetchStatsData.mockReturnValueOnce(hangingPromise);
      mockCacheGet.mockResolvedValue(null);
      mockIsBitbucketEnabled.mockResolvedValue(false);
      mockIsCodebergEnabled.mockResolvedValue(false);

      // Start first call — it will hang
      const p1 = getStats("hanging-user");

      // Advance past timeout
      await vi.advanceTimersByTimeAsync(31_000);
      const result1 = await p1;
      expect(result1).toBeNull();

      vi.useRealTimers();

      // Now the second call for a different user should work independently
      const fresh = makeStats({ handle: "other-user", commitsTotal: 55 });
      mockCacheGet.mockResolvedValue(null);
      mockFetchStatsData.mockResolvedValue(fresh);
      mockIsBitbucketEnabled.mockResolvedValue(false);
      mockIsCodebergEnabled.mockResolvedValue(false);

      const result2 = await getStats("other-user");
      expect(result2).not.toBeNull();
      expect(result2!.commitsTotal).toBe(55);
    });

    it("lets public callers reuse an authenticated inflight fetch", async () => {
      const authedStats = makeStats({ commitsTotal: 22 });

      let resolveAuthedFetch!: (value: StatsData) => void;
      mockFetchStatsData.mockReturnValueOnce(
        new Promise<StatsData>((resolve) => {
          resolveAuthedFetch = resolve;
        }),
      );
      mockCacheGet.mockResolvedValue(null);
      mockIsBitbucketEnabled.mockResolvedValue(false);
      mockIsCodebergEnabled.mockResolvedValue(false);

      const authedPromise = getStats("test-user", "auth-token");
      const publicPromise = getStats("test-user");

      resolveAuthedFetch(authedStats);

      const [authedResult, publicResult] = await Promise.all([
        authedPromise,
        publicPromise,
      ]);

      expect(authedResult).toEqual(authedStats);
      expect(publicResult).toEqual(authedStats);
      expect(mockFetchStatsData).toHaveBeenCalledTimes(1);
      expect(mockFetchStatsData).toHaveBeenCalledWith("test-user", "auth-token");
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
        .mockResolvedValueOnce(null) // codeberg cache
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
        .mockResolvedValueOnce(null) // codeberg cache
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
        .mockResolvedValueOnce(null) // codeberg cache
        .mockResolvedValueOnce(null); // supplemental
      mockFetchStatsData.mockResolvedValue(github);
      mockIsBitbucketEnabled.mockResolvedValue(true);
      mockDbGetLinkedPlatform.mockResolvedValue({
        remoteLogin: "bb-user",
        tokens: { accessToken: "t", refreshToken: null, expiresAt: null },
      });

      const result = await getStats("test-user");

      expect(result!.commitsTotal).toBe(80);
      // Should NOT have called fetch — used cache for stats
      expect(mockFetchBitbucketStats).not.toHaveBeenCalled();
      // DB is called once to resolve the remote username for profile URL
      expect(mockDbGetLinkedPlatform).toHaveBeenCalledWith("test-user", "bitbucket");
      expect(result!.linkedPlatformLogins).toEqual({ bitbucket: "bb-user" });
    });

    it("refreshes expired token before fetching", async () => {
      const github = makeStats({ commitsTotal: 50 });
      const bb = makeStats({ commitsTotal: 30 });

      mockCacheGet
        .mockResolvedValueOnce(null) // merged
        .mockResolvedValueOnce(null) // stale
        .mockResolvedValueOnce(null) // bitbucket cache
        .mockResolvedValueOnce(null) // codeberg cache
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
        ok: true,
        tokens: {
          access_token: "new-token",
          refresh_token: "new-refresh",
          expires_in: 7200,
          token_type: "bearer",
          scopes: "repository",
        },
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
        .mockResolvedValueOnce(null) // codeberg cache
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
      mockRefreshBitbucketToken.mockResolvedValue({ ok: false, reason: "revoked" });

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

    it("keeps link on transient refresh failure (Bitbucket)", async () => {
      const github = makeStats({ commitsTotal: 50 });

      mockCacheGet
        .mockResolvedValueOnce(null) // merged
        .mockResolvedValueOnce(null) // stale
        .mockResolvedValueOnce(null) // bitbucket cache
        .mockResolvedValueOnce(null) // codeberg cache
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
      mockRefreshBitbucketToken.mockResolvedValue({ ok: false, reason: "transient" });

      vi.stubEnv("BITBUCKET_CLIENT_ID", "test-client-id");
      vi.stubEnv("BITBUCKET_CLIENT_SECRET", "test-client-secret");

      const result = await getStats("test-user");

      // Should NOT unlink — transient failure
      expect(mockDbDeleteLinkedPlatform).not.toHaveBeenCalled();
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
        .mockResolvedValueOnce(null) // codeberg cache
        .mockResolvedValueOnce(null); // supplemental
      mockFetchStatsData.mockResolvedValue(github);
      setupBitbucketLinked(bb);

      const result = await getStats("test-user");

      expect(result!.linkedPlatforms).toEqual(["bitbucket"]);
    });

    it("sets linkedPlatformLogins with Bitbucket remote username", async () => {
      const github = makeStats({ commitsTotal: 50 });
      const bb = makeStats({ commitsTotal: 30 });

      mockCacheGet
        .mockResolvedValueOnce(null) // merged
        .mockResolvedValueOnce(null) // stale
        .mockResolvedValueOnce(null) // bitbucket cache
        .mockResolvedValueOnce(null) // codeberg cache
        .mockResolvedValueOnce(null); // supplemental
      mockFetchStatsData.mockResolvedValue(github);
      setupBitbucketLinked(bb);

      const result = await getStats("test-user");

      expect(result!.linkedPlatformLogins).toEqual({ bitbucket: "bb-user" });
    });

    it("does NOT set hasSupplementalData when only Bitbucket is merged", async () => {
      const github = makeStats({ commitsTotal: 50 });
      const bb = makeStats({ commitsTotal: 30 });

      mockCacheGet
        .mockResolvedValueOnce(null) // merged
        .mockResolvedValueOnce(null) // stale
        .mockResolvedValueOnce(null) // bitbucket cache
        .mockResolvedValueOnce(null) // codeberg cache
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
        .mockResolvedValueOnce(null) // codeberg cache
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

    it("includes Bitbucket in linkedPlatforms when linked in DB but stats fetch returns null (fixes #632)", async () => {
      const github = makeStats({ commitsTotal: 50 });

      mockCacheGet
        .mockResolvedValueOnce(null) // merged
        .mockResolvedValueOnce(null) // stale
        .mockResolvedValueOnce(null) // bitbucket cache
        .mockResolvedValueOnce(null) // codeberg cache
        .mockResolvedValueOnce(null); // supplemental
      mockFetchStatsData.mockResolvedValue(github);
      mockIsBitbucketEnabled.mockResolvedValue(true);
      mockIsCodebergEnabled.mockResolvedValue(false);
      mockDbGetLinkedPlatform.mockImplementation(
        (_handle: string, platform: string) => {
          if (platform === "bitbucket") {
            return Promise.resolve({
              remoteLogin: "bb-user",
              tokens: {
                accessToken: "bb-token",
                refreshToken: "bb-refresh",
                expiresAt: new Date("2027-12-31"),
              },
            });
          }
          return Promise.resolve(null);
        },
      );
      mockIsTokenExpired.mockReturnValue(false);
      mockFetchBitbucketStats.mockResolvedValue(null); // API returns null

      const result = await getStats("test-user");

      expect(result!.commitsTotal).toBe(50); // GitHub-only (no BB stats to merge)
      expect(result!.linkedPlatforms).toEqual(["bitbucket"]);
      expect(result!.linkedPlatformLogins).toEqual({ bitbucket: "bb-user" });
    });

    it("caches Bitbucket stats separately", async () => {
      const github = makeStats({ commitsTotal: 50 });
      const bb = makeStats({ commitsTotal: 30 });

      mockCacheGet
        .mockResolvedValueOnce(null) // merged
        .mockResolvedValueOnce(null) // stale
        .mockResolvedValueOnce(null) // bitbucket cache
        .mockResolvedValueOnce(null) // codeberg cache
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

  // -----------------------------------------------------------------------
  // Codeberg integration
  // -----------------------------------------------------------------------

  describe("Codeberg integration", () => {
    it("fetches and merges Codeberg data when platform is linked", async () => {
      const github = makeStats({ commitsTotal: 50 });
      const cb = makeStats({ commitsTotal: 25 });

      mockCacheGet
        .mockResolvedValueOnce(null) // merged
        .mockResolvedValueOnce(null) // stale
        .mockResolvedValueOnce(null) // bitbucket cache
        .mockResolvedValueOnce(null) // codeberg cache
        .mockResolvedValueOnce(null); // supplemental
      mockFetchStatsData.mockResolvedValue(github);
      mockIsBitbucketEnabled.mockResolvedValue(false);
      mockIsCodebergEnabled.mockResolvedValue(true);
      mockDbGetLinkedPlatform.mockResolvedValue({
        remoteLogin: "cb-user",
        tokens: {
          accessToken: "cb-token",
          refreshToken: "cb-refresh",
          expiresAt: new Date("2027-12-31"),
        },
      });
      mockIsTokenExpired.mockReturnValue(false);
      mockFetchCodebergStats.mockResolvedValue(cb);

      const result = await getStats("test-user");

      expect(result).not.toBeNull();
      expect(result!.commitsTotal).toBe(75); // 50 + 25
      expect(mockFetchCodebergStats).toHaveBeenCalledWith(
        "cb-user",
        "cb-token",
        { displayName: "cb-user", avatarUrl: "" },
      );
    });

    it("skips Codeberg when feature flag is disabled", async () => {
      const github = makeStats({ commitsTotal: 50 });
      setupCacheMiss(github);
      // isCodebergEnabled already returns false from setupCacheMiss

      const result = await getStats("test-user");

      expect(result!.commitsTotal).toBe(50);
      expect(mockFetchCodebergStats).not.toHaveBeenCalled();
    });

    it("skips Codeberg when not linked", async () => {
      const github = makeStats({ commitsTotal: 50 });
      mockCacheGet
        .mockResolvedValueOnce(null) // merged
        .mockResolvedValueOnce(null) // stale
        .mockResolvedValueOnce(null) // bitbucket cache
        .mockResolvedValueOnce(null) // codeberg cache
        .mockResolvedValueOnce(null); // supplemental
      mockFetchStatsData.mockResolvedValue(github);
      mockIsBitbucketEnabled.mockResolvedValue(false);
      mockIsCodebergEnabled.mockResolvedValue(true);
      mockDbGetLinkedPlatform.mockResolvedValue(null); // not linked

      const result = await getStats("test-user");

      expect(result!.commitsTotal).toBe(50);
      expect(mockFetchCodebergStats).not.toHaveBeenCalled();
    });

    it("serves cached Codeberg stats", async () => {
      const github = makeStats({ commitsTotal: 50 });
      const cachedCb = makeStats({ commitsTotal: 25 });

      mockCacheGet
        .mockResolvedValueOnce(null) // merged
        .mockResolvedValueOnce(null) // stale
        .mockResolvedValueOnce(null) // bitbucket cache
        .mockResolvedValueOnce(cachedCb) // codeberg cache HIT
        .mockResolvedValueOnce(null); // supplemental
      mockFetchStatsData.mockResolvedValue(github);
      mockIsBitbucketEnabled.mockResolvedValue(false);

      const result = await getStats("test-user");

      expect(result!.commitsTotal).toBe(75); // 50 + 25
      // Should NOT have checked feature flag or DB — used cache
      expect(mockIsCodebergEnabled).not.toHaveBeenCalled();
      expect(mockFetchCodebergStats).not.toHaveBeenCalled();
    });

    it("refreshes expired Codeberg token", async () => {
      const github = makeStats({ commitsTotal: 50 });
      const cb = makeStats({ commitsTotal: 25 });

      mockCacheGet
        .mockResolvedValueOnce(null) // merged
        .mockResolvedValueOnce(null) // stale
        .mockResolvedValueOnce(null) // bitbucket cache
        .mockResolvedValueOnce(null) // codeberg cache
        .mockResolvedValueOnce(null); // supplemental
      mockFetchStatsData.mockResolvedValue(github);
      mockIsBitbucketEnabled.mockResolvedValue(false);
      mockIsCodebergEnabled.mockResolvedValue(true);
      mockDbGetLinkedPlatform.mockResolvedValue({
        remoteLogin: "cb-user",
        tokens: {
          accessToken: "expired-token",
          refreshToken: "cb-refresh",
          expiresAt: new Date("2020-01-01"), // expired
        },
      });
      mockIsTokenExpired.mockReturnValue(true);
      mockRefreshCodebergToken.mockResolvedValue({
        ok: true,
        tokens: {
          access_token: "new-cb-token",
          refresh_token: "new-cb-refresh",
          expires_in: 7200,
          token_type: "bearer",
        },
      });
      mockFetchCodebergStats.mockResolvedValue(cb);

      vi.stubEnv("CODEBERG_CLIENT_ID", "cb-client-id");
      vi.stubEnv("CODEBERG_CLIENT_SECRET", "cb-client-secret");

      const result = await getStats("test-user");

      expect(mockRefreshCodebergToken).toHaveBeenCalledWith(
        "cb-refresh",
        "cb-client-id",
        "cb-client-secret",
      );
      expect(mockDbUpdatePlatformTokens).toHaveBeenCalled();
      expect(mockFetchCodebergStats).toHaveBeenCalledWith(
        "cb-user",
        "new-cb-token",
        { displayName: "cb-user", avatarUrl: "" },
      );
      expect(result!.commitsTotal).toBe(75);

      vi.unstubAllEnvs();
    });

    it("unlinks Codeberg when refresh fails", async () => {
      const github = makeStats({ commitsTotal: 50 });

      mockCacheGet
        .mockResolvedValueOnce(null) // merged
        .mockResolvedValueOnce(null) // stale
        .mockResolvedValueOnce(null) // bitbucket cache
        .mockResolvedValueOnce(null) // codeberg cache
        .mockResolvedValueOnce(null); // supplemental
      mockFetchStatsData.mockResolvedValue(github);
      mockIsBitbucketEnabled.mockResolvedValue(false);
      mockIsCodebergEnabled.mockResolvedValue(true);
      mockDbGetLinkedPlatform.mockResolvedValue({
        remoteLogin: "cb-user",
        tokens: {
          accessToken: "expired-token",
          refreshToken: "cb-refresh",
          expiresAt: new Date("2020-01-01"),
        },
      });
      mockIsTokenExpired.mockReturnValue(true);
      mockRefreshCodebergToken.mockResolvedValue({ ok: false, reason: "revoked" });

      vi.stubEnv("CODEBERG_CLIENT_ID", "cb-client-id");
      vi.stubEnv("CODEBERG_CLIENT_SECRET", "cb-client-secret");

      const result = await getStats("test-user");

      expect(mockDbDeleteLinkedPlatform).toHaveBeenCalledWith(
        "test-user",
        "codeberg",
      );
      expect(result!.commitsTotal).toBe(50); // GitHub-only

      vi.unstubAllEnvs();
    });

    it("keeps link on transient refresh failure (Codeberg)", async () => {
      const github = makeStats({ commitsTotal: 50 });

      mockCacheGet
        .mockResolvedValueOnce(null) // merged
        .mockResolvedValueOnce(null) // stale
        .mockResolvedValueOnce(null) // bitbucket cache
        .mockResolvedValueOnce(null) // codeberg cache
        .mockResolvedValueOnce(null); // supplemental
      mockFetchStatsData.mockResolvedValue(github);
      mockIsBitbucketEnabled.mockResolvedValue(false);
      mockIsCodebergEnabled.mockResolvedValue(true);
      mockDbGetLinkedPlatform.mockResolvedValue({
        remoteLogin: "cb-user",
        tokens: {
          accessToken: "expired-token",
          refreshToken: "cb-refresh",
          expiresAt: new Date("2020-01-01"),
        },
      });
      mockIsTokenExpired.mockReturnValue(true);
      mockRefreshCodebergToken.mockResolvedValue({ ok: false, reason: "transient" });

      vi.stubEnv("CODEBERG_CLIENT_ID", "cb-client-id");
      vi.stubEnv("CODEBERG_CLIENT_SECRET", "cb-client-secret");

      const result = await getStats("test-user");

      // Should NOT unlink — transient failure
      expect(mockDbDeleteLinkedPlatform).not.toHaveBeenCalled();
      expect(result!.commitsTotal).toBe(50); // GitHub-only

      vi.unstubAllEnvs();
    });

    it("handles long-lived token (no expiry, no refresh_token)", async () => {
      const github = makeStats({ commitsTotal: 50 });
      const cb = makeStats({ commitsTotal: 25 });

      mockCacheGet
        .mockResolvedValueOnce(null) // merged
        .mockResolvedValueOnce(null) // stale
        .mockResolvedValueOnce(null) // bitbucket cache
        .mockResolvedValueOnce(null) // codeberg cache
        .mockResolvedValueOnce(null); // supplemental
      mockFetchStatsData.mockResolvedValue(github);
      mockIsBitbucketEnabled.mockResolvedValue(false);
      mockIsCodebergEnabled.mockResolvedValue(true);
      mockDbGetLinkedPlatform.mockResolvedValue({
        remoteLogin: "cb-user",
        tokens: {
          accessToken: "long-lived-token",
          refreshToken: null,
          expiresAt: null, // no expiry
        },
      });
      // isTokenExpired(null) returns true, but the code should proceed anyway
      mockIsTokenExpired.mockReturnValue(true);
      mockFetchCodebergStats.mockResolvedValue(cb);

      const result = await getStats("test-user");

      // Should NOT have tried to refresh or unlink
      expect(mockRefreshCodebergToken).not.toHaveBeenCalled();
      expect(mockDbDeleteLinkedPlatform).not.toHaveBeenCalled();
      // Should have used the original token
      expect(mockFetchCodebergStats).toHaveBeenCalledWith(
        "cb-user",
        "long-lived-token",
        { displayName: "cb-user", avatarUrl: "" },
      );
      expect(result!.commitsTotal).toBe(75);
    });

    it("sets linkedPlatforms to ['codeberg'] when only Codeberg linked", async () => {
      const github = makeStats({ commitsTotal: 50 });
      const cb = makeStats({ commitsTotal: 25 });

      mockCacheGet
        .mockResolvedValueOnce(null) // merged
        .mockResolvedValueOnce(null) // stale
        .mockResolvedValueOnce(null) // bitbucket cache
        .mockResolvedValueOnce(null) // codeberg cache
        .mockResolvedValueOnce(null); // supplemental
      mockFetchStatsData.mockResolvedValue(github);
      mockIsBitbucketEnabled.mockResolvedValue(false);
      mockIsCodebergEnabled.mockResolvedValue(true);
      mockDbGetLinkedPlatform.mockResolvedValue({
        remoteLogin: "cb-user",
        tokens: {
          accessToken: "cb-token",
          refreshToken: null,
          expiresAt: null,
        },
      });
      mockIsTokenExpired.mockReturnValue(true); // null → true
      mockFetchCodebergStats.mockResolvedValue(cb);

      const result = await getStats("test-user");

      expect(result!.linkedPlatforms).toEqual(["codeberg"]);
    });

    it("includes Codeberg in linkedPlatforms when linked in DB but stats fetch returns null (fixes #632)", async () => {
      const github = makeStats({ commitsTotal: 50 });

      mockCacheGet
        .mockResolvedValueOnce(null) // merged
        .mockResolvedValueOnce(null) // stale
        .mockResolvedValueOnce(null) // bitbucket cache
        .mockResolvedValueOnce(null) // codeberg cache
        .mockResolvedValueOnce(null); // supplemental
      mockFetchStatsData.mockResolvedValue(github);
      mockIsBitbucketEnabled.mockResolvedValue(false);
      mockIsCodebergEnabled.mockResolvedValue(true);
      mockDbGetLinkedPlatform.mockResolvedValue({
        remoteLogin: "cb-user",
        tokens: {
          accessToken: "cb-token",
          refreshToken: null,
          expiresAt: null,
        },
      });
      mockIsTokenExpired.mockReturnValue(true);
      mockFetchCodebergStats.mockResolvedValue(null); // fetch failed

      const result = await getStats("test-user");

      expect(result!.commitsTotal).toBe(50); // GitHub-only
      expect(result!.linkedPlatforms).toEqual(["codeberg"]);
      expect(result!.linkedPlatformLogins).toEqual({ codeberg: "cb-user" });
    });

    it("sets linkedPlatforms to ['bitbucket', 'codeberg'] when both linked", async () => {
      const github = makeStats({ commitsTotal: 50 });
      const bb = makeStats({ commitsTotal: 20 });
      const cb = makeStats({ commitsTotal: 15 });

      mockCacheGet
        .mockResolvedValueOnce(null) // merged
        .mockResolvedValueOnce(null) // stale
        .mockResolvedValueOnce(null) // bitbucket cache
        .mockResolvedValueOnce(null) // codeberg cache
        .mockResolvedValueOnce(null); // supplemental
      mockFetchStatsData.mockResolvedValue(github);
      mockIsBitbucketEnabled.mockResolvedValue(true);
      mockIsCodebergEnabled.mockResolvedValue(true);
      // Return different linked data based on platform argument
      mockDbGetLinkedPlatform.mockImplementation(
        (_handle: string, platform: string) => {
          if (platform === "bitbucket") {
            return Promise.resolve({
              remoteLogin: "bb-user",
              tokens: {
                accessToken: "bb-token",
                refreshToken: "bb-refresh",
                expiresAt: new Date("2027-12-31"),
              },
            });
          }
          if (platform === "codeberg") {
            return Promise.resolve({
              remoteLogin: "cb-user",
              tokens: {
                accessToken: "cb-token",
                refreshToken: null,
                expiresAt: null,
              },
            });
          }
          return Promise.resolve(null);
        },
      );
      mockFetchBitbucketStats.mockResolvedValue(bb);
      // isTokenExpired is called twice: once for bb (not expired), once for cb (null → true)
      mockIsTokenExpired
        .mockReturnValueOnce(false) // bitbucket: not expired
        .mockReturnValueOnce(true); // codeberg: null → true
      mockFetchCodebergStats.mockResolvedValue(cb);

      const result = await getStats("test-user");

      expect(result!.commitsTotal).toBe(85); // 50 + 20 + 15
      expect(result!.linkedPlatforms).toEqual(["bitbucket", "codeberg"]);
      expect(result!.linkedPlatformLogins).toEqual({
        bitbucket: "bb-user",
        codeberg: "cb-user",
      });
    });

    it("fetches Bitbucket and Codeberg in parallel (not sequentially)", async () => {
      const github = makeStats({ commitsTotal: 50 });
      const bb = makeStats({ commitsTotal: 20 });
      const cb = makeStats({ commitsTotal: 15 });

      // Track the order in which fetches start and complete
      const events: string[] = [];

      mockCacheGet
        .mockResolvedValueOnce(null) // merged
        .mockResolvedValueOnce(null) // stale
        .mockResolvedValueOnce(null) // bitbucket cache
        .mockResolvedValueOnce(null) // codeberg cache
        .mockResolvedValueOnce(null); // supplemental
      mockFetchStatsData.mockResolvedValue(github);
      mockIsBitbucketEnabled.mockResolvedValue(true);
      mockIsCodebergEnabled.mockResolvedValue(true);
      mockDbGetLinkedPlatform.mockImplementation(
        (_handle: string, platform: string) => {
          if (platform === "bitbucket") {
            return Promise.resolve({
              remoteLogin: "bb-user",
              tokens: {
                accessToken: "bb-token",
                refreshToken: "bb-refresh",
                expiresAt: new Date("2027-12-31"),
              },
            });
          }
          if (platform === "codeberg") {
            return Promise.resolve({
              remoteLogin: "cb-user",
              tokens: {
                accessToken: "cb-token",
                refreshToken: null,
                expiresAt: null,
              },
            });
          }
          return Promise.resolve(null);
        },
      );
      mockIsTokenExpired
        .mockReturnValueOnce(false) // bitbucket
        .mockReturnValueOnce(true); // codeberg (null → true)

      // Make BB fetch take "longer" — use a deferred promise so we can observe
      // that CB fetch doesn't wait for BB to complete.
      let resolveBb!: (value: StatsData) => void;
      mockFetchBitbucketStats.mockReturnValue(
        new Promise<StatsData>((resolve) => {
          resolveBb = resolve;
          events.push("bb:started");
        }),
      );
      mockFetchCodebergStats.mockImplementation(() => {
        events.push("cb:started");
        return Promise.resolve(cb);
      });

      const resultPromise = getStats("test-user");

      // Give microtasks a chance to settle — both fetches should have started
      await new Promise((r) => setTimeout(r, 50));

      // Both fetches should have started BEFORE bb resolves
      expect(events).toContain("bb:started");
      expect(events).toContain("cb:started");

      // Now resolve BB
      resolveBb(bb);
      const result = await resultPromise;

      expect(result).not.toBeNull();
      expect(result!.commitsTotal).toBe(85); // 50 + 20 + 15
    });

    it("Bitbucket error does not block Codeberg fetch", async () => {
      const github = makeStats({ commitsTotal: 50 });
      const cb = makeStats({ commitsTotal: 15 });

      mockCacheGet
        .mockResolvedValueOnce(null) // merged
        .mockResolvedValueOnce(null) // stale
        .mockResolvedValueOnce(null) // bitbucket cache
        .mockResolvedValueOnce(null) // codeberg cache
        .mockResolvedValueOnce(null); // supplemental
      mockFetchStatsData.mockResolvedValue(github);
      mockIsBitbucketEnabled.mockResolvedValue(true);
      mockIsCodebergEnabled.mockResolvedValue(true);
      mockDbGetLinkedPlatform.mockImplementation(
        (_handle: string, platform: string) => {
          if (platform === "bitbucket") {
            return Promise.resolve({
              remoteLogin: "bb-user",
              tokens: {
                accessToken: "bb-token",
                refreshToken: "bb-refresh",
                expiresAt: new Date("2027-12-31"),
              },
            });
          }
          if (platform === "codeberg") {
            return Promise.resolve({
              remoteLogin: "cb-user",
              tokens: {
                accessToken: "cb-token",
                refreshToken: null,
                expiresAt: null,
              },
            });
          }
          return Promise.resolve(null);
        },
      );
      mockIsTokenExpired
        .mockReturnValueOnce(false) // bitbucket
        .mockReturnValueOnce(true); // codeberg (null → true)

      // BB fetch throws an error
      mockFetchBitbucketStats.mockRejectedValue(new Error("BB API down"));
      mockFetchCodebergStats.mockResolvedValue(cb);

      const result = await getStats("test-user");

      // Should still return GitHub + Codeberg stats (BB error is swallowed)
      // BB is still in linkedPlatforms because it's linked in DB (#632)
      expect(result).not.toBeNull();
      expect(result!.commitsTotal).toBe(65); // 50 + 15
      expect(result!.linkedPlatforms).toEqual(["bitbucket", "codeberg"]);
    });

    it("Codeberg error does not block Bitbucket fetch", async () => {
      const github = makeStats({ commitsTotal: 50 });
      const bb = makeStats({ commitsTotal: 20 });

      mockCacheGet
        .mockResolvedValueOnce(null) // merged
        .mockResolvedValueOnce(null) // stale
        .mockResolvedValueOnce(null) // bitbucket cache
        .mockResolvedValueOnce(null) // codeberg cache
        .mockResolvedValueOnce(null); // supplemental
      mockFetchStatsData.mockResolvedValue(github);
      mockIsBitbucketEnabled.mockResolvedValue(true);
      mockIsCodebergEnabled.mockResolvedValue(true);
      mockDbGetLinkedPlatform.mockImplementation(
        (_handle: string, platform: string) => {
          if (platform === "bitbucket") {
            return Promise.resolve({
              remoteLogin: "bb-user",
              tokens: {
                accessToken: "bb-token",
                refreshToken: "bb-refresh",
                expiresAt: new Date("2027-12-31"),
              },
            });
          }
          if (platform === "codeberg") {
            return Promise.resolve({
              remoteLogin: "cb-user",
              tokens: {
                accessToken: "cb-token",
                refreshToken: null,
                expiresAt: null,
              },
            });
          }
          return Promise.resolve(null);
        },
      );
      mockIsTokenExpired
        .mockReturnValueOnce(false) // bitbucket
        .mockReturnValueOnce(true); // codeberg (null → true)

      mockFetchBitbucketStats.mockResolvedValue(bb);
      // CB fetch throws an error
      mockFetchCodebergStats.mockRejectedValue(new Error("CB API down"));

      const result = await getStats("test-user");

      // Should still return GitHub + Bitbucket stats (CB error is swallowed)
      // CB is still in linkedPlatforms because it's linked in DB (#632)
      expect(result).not.toBeNull();
      expect(result!.commitsTotal).toBe(70); // 50 + 20
      expect(result!.linkedPlatforms).toEqual(["bitbucket", "codeberg"]);
    });

    it("handles Codeberg fetch failure gracefully (returns GitHub-only)", async () => {
      const github = makeStats({ commitsTotal: 50 });

      mockCacheGet
        .mockResolvedValueOnce(null) // merged
        .mockResolvedValueOnce(null) // stale
        .mockResolvedValueOnce(null) // bitbucket cache
        .mockResolvedValueOnce(null) // codeberg cache
        .mockResolvedValueOnce(null); // supplemental
      mockFetchStatsData.mockResolvedValue(github);
      mockIsBitbucketEnabled.mockResolvedValue(false);
      mockIsCodebergEnabled.mockResolvedValue(true);
      mockDbGetLinkedPlatform.mockResolvedValue({
        remoteLogin: "cb-user",
        tokens: {
          accessToken: "cb-token",
          refreshToken: null,
          expiresAt: null,
        },
      });
      mockIsTokenExpired.mockReturnValue(true);
      mockFetchCodebergStats.mockResolvedValue(null); // fetch failed

      const result = await getStats("test-user");

      expect(result!.commitsTotal).toBe(50); // GitHub-only
      // Codeberg still appears in linkedPlatforms because it's linked in DB (#632)
      expect(result!.linkedPlatforms).toEqual(["codeberg"]);
    });

    it("caches Codeberg stats separately", async () => {
      const github = makeStats({ commitsTotal: 50 });
      const cb = makeStats({ commitsTotal: 25 });

      mockCacheGet
        .mockResolvedValueOnce(null) // merged
        .mockResolvedValueOnce(null) // stale
        .mockResolvedValueOnce(null) // bitbucket cache
        .mockResolvedValueOnce(null) // codeberg cache
        .mockResolvedValueOnce(null); // supplemental
      mockFetchStatsData.mockResolvedValue(github);
      mockIsBitbucketEnabled.mockResolvedValue(false);
      mockIsCodebergEnabled.mockResolvedValue(true);
      mockDbGetLinkedPlatform.mockResolvedValue({
        remoteLogin: "cb-user",
        tokens: {
          accessToken: "cb-token",
          refreshToken: null,
          expiresAt: null,
        },
      });
      mockIsTokenExpired.mockReturnValue(true);
      mockFetchCodebergStats.mockResolvedValue(cb);

      await getStats("test-user");

      expect(mockCacheSet).toHaveBeenCalledWith(
        "stats:v2:codeberg:test-user",
        cb,
        21600,
      );
    });
  });
});
