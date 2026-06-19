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
  mockDbGetSupplemental,
  mockIsBitbucketEnabled,
  mockIsCodebergEnabled,
  mockIsGitlabEnabled,
  mockDbGetLinkedPlatform,
  mockFetchBitbucketIfLinked,
  mockFetchCodebergIfLinked,
  mockFetchGitlabIfLinked,
} = vi.hoisted(() => ({
  mockFetchStatsData: vi.fn(),
  mockCacheGet: vi.fn(),
  mockCacheSet: vi.fn(),
  mockDbUpsertUser: vi.fn(() => Promise.resolve()),
  // Untyped here because vi.hoisted runs before imports — SupplementalStats type
  // isn't available yet. The mock is given a typed implementation per-test.
  mockDbGetSupplemental: vi.fn(),
  mockIsBitbucketEnabled: vi.fn(),
  mockIsCodebergEnabled: vi.fn(),
  mockIsGitlabEnabled: vi.fn(),
  mockDbGetLinkedPlatform: vi.fn(),
  mockFetchBitbucketIfLinked: vi.fn(),
  mockFetchCodebergIfLinked: vi.fn(),
  mockFetchGitlabIfLinked: vi.fn(),
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

vi.mock("@/lib/db/supplemental", () => ({
  dbGetSupplemental: mockDbGetSupplemental,
}));

vi.mock("@/lib/feature-flags", () => ({
  isBitbucketEnabled: mockIsBitbucketEnabled,
  isCodebergEnabled: mockIsCodebergEnabled,
  isGitlabEnabled: mockIsGitlabEnabled,
}));

vi.mock("@/lib/db/user-platforms", () => ({
  dbGetLinkedPlatform: mockDbGetLinkedPlatform,
}));

vi.mock("@/lib/bitbucket/client", () => ({
  fetchBitbucketIfLinked: mockFetchBitbucketIfLinked,
}));

vi.mock("@/lib/codeberg/client", () => ({
  fetchCodebergIfLinked: mockFetchCodebergIfLinked,
}));

vi.mock("@/lib/gitlab/client", () => ({
  fetchGitlabIfLinked: mockFetchGitlabIfLinked,
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
    .mockResolvedValueOnce(null); // supplemental:test-user
  mockFetchStatsData.mockResolvedValue(githubStats);
  // platform fns default to null from beforeEach
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCacheSet.mockResolvedValue(undefined);
    mockFetchBitbucketIfLinked.mockResolvedValue(null);
    mockFetchCodebergIfLinked.mockResolvedValue(null);
    mockFetchGitlabIfLinked.mockResolvedValue(null);
    mockIsBitbucketEnabled.mockResolvedValue(false);
    mockIsCodebergEnabled.mockResolvedValue(false);
    mockIsGitlabEnabled.mockResolvedValue(false);
    mockDbGetLinkedPlatform.mockResolvedValue(null);
    mockDbGetSupplemental.mockResolvedValue(null);
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
      .mockResolvedValueOnce(null); // supplemental
    mockFetchStatsData.mockResolvedValue(fresh);

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
      .mockResolvedValueOnce(supplemental); // supplemental hit
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
    setupCacheMiss(primary);

    const result = await getStats("test-user");
    expect(result).not.toBeNull();
    expect(result!.commitsTotal).toBe(50);
    expect(result!.hasSupplementalData).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // #825 — Supplemental data persistence: when the Redis key has expired but
  // Supabase still has the row, getStats must fall back to the DB and merge
  // the EMU stats. Otherwise a missed CLI upload day silently drops them.
  // -------------------------------------------------------------------------

  it("falls back to Supabase when Redis supplemental key is missing (#825)", async () => {
    const primary = makeStats({ commitsTotal: 50, prsMergedCount: 5 });
    const supplementalStats = makeStats({
      handle: "corp-user",
      commitsTotal: 30,
      prsMergedCount: 3,
    });
    const persisted: SupplementalStats = {
      targetHandle: "test-user",
      sourceHandle: "corp-user",
      stats: supplementalStats,
      uploadedAt: "2026-04-26T08:08:14.276Z",
    };

    mockCacheGet
      .mockResolvedValueOnce(null) // stats:v2:merged:test-user
      .mockResolvedValueOnce(null) // stats:stale:test-user
      .mockResolvedValueOnce(null); // supplemental:test-user — Redis miss
    mockFetchStatsData.mockResolvedValue(primary);
    mockDbGetSupplemental.mockResolvedValue(persisted);

    const result = await getStats("test-user");

    expect(mockDbGetSupplemental).toHaveBeenCalledWith("test-user");
    expect(result).not.toBeNull();
    expect(result!.commitsTotal).toBe(80); // 50 + 30 — supplemental was merged
    expect(result!.hasSupplementalData).toBe(true);
  });

  it("rehydrates Redis supplemental key on Supabase fallback hit (#825)", async () => {
    const primary = makeStats({ commitsTotal: 50 });
    const persisted: SupplementalStats = {
      targetHandle: "test-user",
      sourceHandle: "corp-user",
      stats: makeStats({ commitsTotal: 30 }),
      uploadedAt: "2026-04-26T08:08:14.276Z",
    };

    mockCacheGet
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null); // Redis supplemental miss
    mockFetchStatsData.mockResolvedValue(primary);
    mockDbGetSupplemental.mockResolvedValue(persisted);

    await getStats("test-user");
    // Allow fire-and-forget rehydration to flush
    await new Promise((r) => setImmediate(r));

    expect(mockCacheSet).toHaveBeenCalledWith(
      "supplemental:test-user",
      persisted,
      86400, // 24h — must match POST /api/supplemental TTL
    );
  });

  it("does not call Supabase when Redis supplemental hit (hot path)", async () => {
    const primary = makeStats({ commitsTotal: 50 });
    const supplemental: SupplementalStats = {
      targetHandle: "test-user",
      sourceHandle: "corp-user",
      stats: makeStats({ commitsTotal: 30 }),
      uploadedAt: new Date().toISOString(),
    };

    mockCacheGet
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(supplemental); // Redis hit
    mockFetchStatsData.mockResolvedValue(primary);

    await getStats("test-user");

    expect(mockDbGetSupplemental).not.toHaveBeenCalled();
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
      .mockResolvedValueOnce(supplemental);
    mockFetchStatsData.mockResolvedValue(primary);

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
        .mockResolvedValueOnce(null); // no supplemental
      mockFetchStatsData.mockResolvedValue(fresh); // API succeeds

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
      vi.useFakeTimers();

      // Hanging promise — never resolves
      const hangingPromise = new Promise<never>(() => { /* intentionally hangs */ });
      mockFetchStatsData.mockReturnValueOnce(hangingPromise);
      mockCacheGet.mockResolvedValue(null);

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
  // Bitbucket integration (orchestration — token refresh tested in bitbucket/client.test.ts)
  // -----------------------------------------------------------------------

  describe("Bitbucket integration", () => {
    it("fetches and merges Bitbucket data when platform is linked", async () => {
      const github = makeStats({ commitsTotal: 50 });
      const bb = makeStats({ commitsTotal: 30 });

      mockCacheGet
        .mockResolvedValueOnce(null) // merged
        .mockResolvedValueOnce(null) // stale
        .mockResolvedValueOnce(null); // supplemental
      mockFetchStatsData.mockResolvedValue(github);
      mockFetchBitbucketIfLinked.mockResolvedValue(bb);

      const result = await getStats("test-user");

      expect(result).not.toBeNull();
      expect(result!.commitsTotal).toBe(80); // 50 + 30
    });

    it("returns GitHub-only stats when Bitbucket returns null", async () => {
      const github = makeStats({ commitsTotal: 50 });
      setupCacheMiss(github); // mockFetchBitbucketIfLinked returns null by default

      const result = await getStats("test-user");
      expect(result!.commitsTotal).toBe(50);
    });

    it("sets linkedPlatforms: ['bitbucket'] on merged result", async () => {
      const github = makeStats({ commitsTotal: 50 });
      const bb = makeStats({ commitsTotal: 30 });

      mockCacheGet
        .mockResolvedValueOnce(null) // merged
        .mockResolvedValueOnce(null) // stale
        .mockResolvedValueOnce(null); // supplemental
      mockFetchStatsData.mockResolvedValue(github);
      mockFetchBitbucketIfLinked.mockResolvedValue(bb);
      mockDbGetLinkedPlatform.mockResolvedValue({
        remoteLogin: "bb-user",
        tokens: { accessToken: "t", refreshToken: null, expiresAt: null },
      });

      const result = await getStats("test-user");
      expect(result!.linkedPlatforms).toEqual(["bitbucket"]);
      expect(result!.linkedPlatformLogins).toEqual({ bitbucket: "bb-user" });
    });

    it("does NOT set hasSupplementalData when only Bitbucket is merged", async () => {
      const github = makeStats({ commitsTotal: 50 });
      const bb = makeStats({ commitsTotal: 30 });

      mockCacheGet
        .mockResolvedValueOnce(null) // merged
        .mockResolvedValueOnce(null) // stale
        .mockResolvedValueOnce(null); // supplemental
      mockFetchStatsData.mockResolvedValue(github);
      mockFetchBitbucketIfLinked.mockResolvedValue(bb);
      mockDbGetLinkedPlatform.mockResolvedValue({
        remoteLogin: "bb-user",
        tokens: { accessToken: "t", refreshToken: null, expiresAt: null },
      });

      const result = await getStats("test-user");
      // mergeStats with markAsSupplemental: false sets hasSupplementalData: false (not true)
      expect(result!.hasSupplementalData).not.toBe(true);
    });

    it("sets hasSupplementalData when EMU is also merged", async () => {
      const github = makeStats({ commitsTotal: 50 });
      const bb = makeStats({ commitsTotal: 30 });
      const supplemental: SupplementalStats = {
        targetHandle: "test-user",
        sourceHandle: "corp-user",
        stats: makeStats({ commitsTotal: 10 }),
        uploadedAt: new Date().toISOString(),
      };

      mockCacheGet
        .mockResolvedValueOnce(null) // merged
        .mockResolvedValueOnce(null) // stale
        .mockResolvedValueOnce(supplemental); // supplemental hit
      mockFetchStatsData.mockResolvedValue(github);
      mockFetchBitbucketIfLinked.mockResolvedValue(bb);
      mockDbGetLinkedPlatform.mockResolvedValue({
        remoteLogin: "bb-user",
        tokens: { accessToken: "t", refreshToken: null, expiresAt: null },
      });

      const result = await getStats("test-user");
      expect(result!.commitsTotal).toBe(90); // 50 + 30 + 10
      expect(result!.hasSupplementalData).toBe(true);
    });

    it("uses merged cache key (stats:v2:merged:{handle})", async () => {
      const github = makeStats({ commitsTotal: 50 });
      const bb = makeStats({ commitsTotal: 30 });

      mockCacheGet
        .mockResolvedValueOnce(null) // merged
        .mockResolvedValueOnce(null) // stale
        .mockResolvedValueOnce(null); // supplemental
      mockFetchStatsData.mockResolvedValue(github);
      mockFetchBitbucketIfLinked.mockResolvedValue(bb);
      mockDbGetLinkedPlatform.mockResolvedValue({
        remoteLogin: "bb-user",
        tokens: { accessToken: "t", refreshToken: null, expiresAt: null },
      });

      await getStats("test-user");

      expect(mockCacheSet).toHaveBeenCalledWith(
        "stats:v2:merged:test-user",
        expect.objectContaining({ commitsTotal: 80 }),
        21600,
      );
    });

    it("includes Bitbucket in linkedPlatforms when linked in DB but stats fetch returns null (fixes #632)", async () => {
      const github = makeStats({ commitsTotal: 50 });

      mockCacheGet
        .mockResolvedValueOnce(null) // merged
        .mockResolvedValueOnce(null) // stale
        .mockResolvedValueOnce(null); // supplemental
      mockFetchStatsData.mockResolvedValue(github);
      mockFetchBitbucketIfLinked.mockResolvedValue(null); // stats fetch failed
      mockIsBitbucketEnabled.mockResolvedValue(true);
      mockDbGetLinkedPlatform.mockResolvedValue({
        remoteLogin: "bb-user",
        tokens: { accessToken: "t", refreshToken: null, expiresAt: null },
      });

      const result = await getStats("test-user");

      expect(result!.commitsTotal).toBe(50); // GitHub-only
      expect(result!.linkedPlatforms).toEqual(["bitbucket"]);
      expect(result!.linkedPlatformLogins).toEqual({ bitbucket: "bb-user" });
    });
  });

  // -----------------------------------------------------------------------
  // Codeberg integration (orchestration — token refresh tested in codeberg/client.test.ts)
  // -----------------------------------------------------------------------

  describe("Codeberg integration", () => {
    it("fetches and merges Codeberg data when platform is linked", async () => {
      const github = makeStats({ commitsTotal: 50 });
      const cb = makeStats({ commitsTotal: 25 });

      mockCacheGet
        .mockResolvedValueOnce(null) // merged
        .mockResolvedValueOnce(null) // stale
        .mockResolvedValueOnce(null); // supplemental
      mockFetchStatsData.mockResolvedValue(github);
      mockFetchCodebergIfLinked.mockResolvedValue(cb);
      mockDbGetLinkedPlatform.mockResolvedValue({
        remoteLogin: "cb-user",
        tokens: { accessToken: "t", refreshToken: null, expiresAt: null },
      });

      const result = await getStats("test-user");

      expect(result).not.toBeNull();
      expect(result!.commitsTotal).toBe(75); // 50 + 25
    });

    it("returns GitHub-only stats when Codeberg returns null", async () => {
      const github = makeStats({ commitsTotal: 50 });
      setupCacheMiss(github); // mockFetchCodebergIfLinked returns null by default

      const result = await getStats("test-user");
      expect(result!.commitsTotal).toBe(50);
    });

    it("sets linkedPlatforms to ['codeberg'] when only Codeberg linked", async () => {
      const github = makeStats({ commitsTotal: 50 });
      const cb = makeStats({ commitsTotal: 25 });

      mockCacheGet
        .mockResolvedValueOnce(null) // merged
        .mockResolvedValueOnce(null) // stale
        .mockResolvedValueOnce(null); // supplemental
      mockFetchStatsData.mockResolvedValue(github);
      mockFetchCodebergIfLinked.mockResolvedValue(cb);
      mockDbGetLinkedPlatform.mockResolvedValue({
        remoteLogin: "cb-user",
        tokens: { accessToken: "t", refreshToken: null, expiresAt: null },
      });

      const result = await getStats("test-user");
      expect(result!.linkedPlatforms).toEqual(["codeberg"]);
    });

    it("includes Codeberg in linkedPlatforms when linked in DB but stats fetch returns null (fixes #632)", async () => {
      const github = makeStats({ commitsTotal: 50 });

      mockCacheGet
        .mockResolvedValueOnce(null) // merged
        .mockResolvedValueOnce(null) // stale
        .mockResolvedValueOnce(null); // supplemental
      mockFetchStatsData.mockResolvedValue(github);
      mockFetchCodebergIfLinked.mockResolvedValue(null); // fetch failed
      mockIsCodebergEnabled.mockResolvedValue(true);
      mockDbGetLinkedPlatform.mockResolvedValue({
        remoteLogin: "cb-user",
        tokens: { accessToken: "t", refreshToken: null, expiresAt: null },
      });

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
        .mockResolvedValueOnce(null); // supplemental
      mockFetchStatsData.mockResolvedValue(github);
      mockFetchBitbucketIfLinked.mockResolvedValue(bb);
      mockFetchCodebergIfLinked.mockResolvedValue(cb);
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

      const events: string[] = [];

      mockCacheGet
        .mockResolvedValueOnce(null) // merged
        .mockResolvedValueOnce(null) // stale
        .mockResolvedValueOnce(null); // supplemental
      mockFetchStatsData.mockResolvedValue(github);

      let resolveBb!: (value: StatsData) => void;
      mockFetchBitbucketIfLinked.mockReturnValue(
        new Promise<StatsData>((resolve) => {
          resolveBb = resolve;
          events.push("bb:started");
        }),
      );
      mockFetchCodebergIfLinked.mockImplementation(() => {
        events.push("cb:started");
        return Promise.resolve(cb);
      });
      mockDbGetLinkedPlatform.mockImplementation(
        (_handle: string, platform: string) => {
          const login = platform === "bitbucket" ? "bb-user" : "cb-user";
          return Promise.resolve({
            remoteLogin: login,
            tokens: { accessToken: "t", refreshToken: null, expiresAt: null },
          });
        },
      );

      const resultPromise = getStats("test-user");

      // Give microtasks a chance to settle — both fetches should have started
      await new Promise((r) => setTimeout(r, 50));

      expect(events).toContain("bb:started");
      expect(events).toContain("cb:started");

      resolveBb(bb);
      const result = await resultPromise;

      expect(result).not.toBeNull();
      expect(result!.commitsTotal).toBe(85);
    });

    it("Bitbucket error does not block Codeberg fetch", async () => {
      const github = makeStats({ commitsTotal: 50 });
      const cb = makeStats({ commitsTotal: 15 });

      mockCacheGet
        .mockResolvedValueOnce(null) // merged
        .mockResolvedValueOnce(null) // stale
        .mockResolvedValueOnce(null); // supplemental
      mockFetchStatsData.mockResolvedValue(github);
      mockFetchBitbucketIfLinked.mockRejectedValue(new Error("BB API down"));
      mockFetchCodebergIfLinked.mockResolvedValue(cb);
      mockIsBitbucketEnabled.mockResolvedValue(true);
      mockDbGetLinkedPlatform.mockImplementation(
        (_handle: string, platform: string) => {
          // DB fallback for BB (stats failed), direct for CB
          if (platform === "bitbucket") {
            return Promise.resolve({
              remoteLogin: "bb-user",
              tokens: { accessToken: "t", refreshToken: null, expiresAt: null },
            });
          }
          return Promise.resolve({
            remoteLogin: "cb-user",
            tokens: { accessToken: "t", refreshToken: null, expiresAt: null },
          });
        },
      );

      const result = await getStats("test-user");

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
        .mockResolvedValueOnce(null); // supplemental
      mockFetchStatsData.mockResolvedValue(github);
      mockFetchBitbucketIfLinked.mockResolvedValue(bb);
      mockFetchCodebergIfLinked.mockRejectedValue(new Error("CB API down"));
      mockIsCodebergEnabled.mockResolvedValue(true);
      mockDbGetLinkedPlatform.mockImplementation(
        (_handle: string, platform: string) => {
          if (platform === "bitbucket") {
            return Promise.resolve({
              remoteLogin: "bb-user",
              tokens: { accessToken: "t", refreshToken: null, expiresAt: null },
            });
          }
          return Promise.resolve({
            remoteLogin: "cb-user",
            tokens: { accessToken: "t", refreshToken: null, expiresAt: null },
          });
        },
      );

      const result = await getStats("test-user");

      expect(result).not.toBeNull();
      expect(result!.commitsTotal).toBe(70); // 50 + 20
      expect(result!.linkedPlatforms).toEqual(["bitbucket", "codeberg"]);
    });

    it("handles Codeberg fetch failure gracefully (returns GitHub-only)", async () => {
      const github = makeStats({ commitsTotal: 50 });

      mockCacheGet
        .mockResolvedValueOnce(null) // merged
        .mockResolvedValueOnce(null) // stale
        .mockResolvedValueOnce(null); // supplemental
      mockFetchStatsData.mockResolvedValue(github);
      mockFetchCodebergIfLinked.mockResolvedValue(null); // fetch failed
      mockIsCodebergEnabled.mockResolvedValue(true);
      mockDbGetLinkedPlatform.mockResolvedValue({
        remoteLogin: "cb-user",
        tokens: { accessToken: "t", refreshToken: null, expiresAt: null },
      });

      const result = await getStats("test-user");

      expect(result!.commitsTotal).toBe(50); // GitHub-only
      expect(result!.linkedPlatforms).toEqual(["codeberg"]);
    });
  });

  // -----------------------------------------------------------------------
  // GitLab integration (orchestration — token refresh tested in gitlab/client.test.ts)
  // -----------------------------------------------------------------------

  describe("GitLab integration", () => {
    it("fetches and merges GitLab data when platform is linked", async () => {
      const github = makeStats({ commitsTotal: 50 });
      const gl = makeStats({ commitsTotal: 25 });

      mockCacheGet
        .mockResolvedValueOnce(null) // merged
        .mockResolvedValueOnce(null) // stale
        .mockResolvedValueOnce(null); // supplemental
      mockFetchStatsData.mockResolvedValue(github);
      mockFetchGitlabIfLinked.mockResolvedValue(gl);
      mockDbGetLinkedPlatform.mockResolvedValue({
        remoteLogin: "gl-user",
        tokens: { accessToken: "t", refreshToken: null, expiresAt: null },
      });

      const result = await getStats("test-user");

      expect(result).not.toBeNull();
      expect(result!.commitsTotal).toBe(75); // 50 + 25
    });

    it("sets linkedPlatforms to ['gitlab'] when only GitLab linked", async () => {
      const github = makeStats({ commitsTotal: 50 });
      const gl = makeStats({ commitsTotal: 25 });

      mockCacheGet
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mockFetchStatsData.mockResolvedValue(github);
      mockFetchGitlabIfLinked.mockResolvedValue(gl);
      mockDbGetLinkedPlatform.mockResolvedValue({
        remoteLogin: "gl-user",
        tokens: { accessToken: "t", refreshToken: null, expiresAt: null },
      });

      const result = await getStats("test-user");
      expect(result!.linkedPlatforms).toEqual(["gitlab"]);
    });

    it("includes GitLab in linkedPlatforms when linked in DB but stats fetch returns null (fixes #632)", async () => {
      const github = makeStats({ commitsTotal: 50 });

      mockCacheGet
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mockFetchStatsData.mockResolvedValue(github);
      mockFetchGitlabIfLinked.mockResolvedValue(null); // fetch failed
      mockIsGitlabEnabled.mockResolvedValue(true);
      mockDbGetLinkedPlatform.mockResolvedValue({
        remoteLogin: "gl-user",
        tokens: { accessToken: "t", refreshToken: null, expiresAt: null },
      });

      const result = await getStats("test-user");

      expect(result!.commitsTotal).toBe(50); // GitHub-only
      expect(result!.linkedPlatforms).toEqual(["gitlab"]);
      expect(result!.linkedPlatformLogins).toEqual({ gitlab: "gl-user" });
    });

    it("sets linkedPlatforms to ['bitbucket', 'codeberg', 'gitlab'] when all three linked", async () => {
      const github = makeStats({ commitsTotal: 50 });
      const bb = makeStats({ commitsTotal: 20 });
      const cb = makeStats({ commitsTotal: 15 });
      const gl = makeStats({ commitsTotal: 10 });

      mockCacheGet
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mockFetchStatsData.mockResolvedValue(github);
      mockFetchBitbucketIfLinked.mockResolvedValue(bb);
      mockFetchCodebergIfLinked.mockResolvedValue(cb);
      mockFetchGitlabIfLinked.mockResolvedValue(gl);
      mockDbGetLinkedPlatform.mockImplementation(
        (_handle: string, platform: string) => {
          const login = { bitbucket: "bb-user", codeberg: "cb-user", gitlab: "gl-user" }[platform];
          return login
            ? Promise.resolve({
                remoteLogin: login,
                tokens: { accessToken: "t", refreshToken: null, expiresAt: null },
              })
            : Promise.resolve(null);
        },
      );

      const result = await getStats("test-user");

      expect(result!.commitsTotal).toBe(95); // 50 + 20 + 15 + 10
      expect(result!.linkedPlatforms).toEqual(["bitbucket", "codeberg", "gitlab"]);
      expect(result!.linkedPlatformLogins).toEqual({
        bitbucket: "bb-user",
        codeberg: "cb-user",
        gitlab: "gl-user",
      });
    });

    it("GitLab error does not block Bitbucket/Codeberg fetch", async () => {
      const github = makeStats({ commitsTotal: 50 });
      const bb = makeStats({ commitsTotal: 20 });

      mockCacheGet
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mockFetchStatsData.mockResolvedValue(github);
      mockFetchBitbucketIfLinked.mockResolvedValue(bb);
      mockFetchGitlabIfLinked.mockRejectedValue(new Error("GL API down"));
      mockIsGitlabEnabled.mockResolvedValue(true);
      mockDbGetLinkedPlatform.mockImplementation(
        (_handle: string, platform: string) => {
          const login = platform === "bitbucket" ? "bb-user" : "gl-user";
          return Promise.resolve({
            remoteLogin: login,
            tokens: { accessToken: "t", refreshToken: null, expiresAt: null },
          });
        },
      );

      const result = await getStats("test-user");

      expect(result).not.toBeNull();
      expect(result!.commitsTotal).toBe(70); // 50 + 20 (GitLab errored out)
      expect(result!.linkedPlatforms).toEqual(["bitbucket", "gitlab"]);
    });
  });
});
