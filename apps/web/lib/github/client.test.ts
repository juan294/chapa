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
  mockCaptureServerEvent,
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
  mockCaptureServerEvent: vi.fn(() => Promise.resolve()),
}));

// #1050: fetchScope depends on whether a tokenless fetch would resolve to the
// server GITHUB_TOKEN (queries.ts: `token ?? getGithubToken()`). Default to
// configured, matching production.
vi.mock("@/lib/env", () => ({
  getGithubToken: vi.fn(() => "server-pat-with-repo-scope"),
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

vi.mock("@/lib/analytics/server-errors", () => ({
  captureServerEvent: mockCaptureServerEvent,
}));

import { getStats, _resetInflight } from "./client";
import { getGithubToken } from "@/lib/env";
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
    .mockResolvedValueOnce(null) // stats:stale:v2:test-user (GitHub-derived baseline)
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
    // `clearAllMocks` clears recorded calls but NOT queued `mockResolvedValueOnce`
    // values, so a test that queues more reads than its path consumes leaks the
    // remainder into the next test. Resetting the queue keeps these cases
    // order-independent.
    mockCacheGet.mockReset();
    mockCacheSet.mockResolvedValue(undefined);
    mockFetchBitbucketIfLinked.mockResolvedValue(null);
    mockFetchCodebergIfLinked.mockResolvedValue(null);
    mockFetchGitlabIfLinked.mockResolvedValue(null);
    mockIsBitbucketEnabled.mockResolvedValue(false);
    mockIsCodebergEnabled.mockResolvedValue(false);
    mockIsGitlabEnabled.mockResolvedValue(false);
    mockDbGetLinkedPlatform.mockResolvedValue(null);
    mockDbGetSupplemental.mockResolvedValue(null);
    vi.mocked(getGithubToken).mockReturnValue("server-pat-with-repo-scope");
    _resetInflight();
  });

  it("returns cached stats when available (no supplemental)", async () => {
    const cached = makeStats();
    mockCacheGet.mockResolvedValue(cached);

    const result = await getStats("test-user");
    expect(result).toEqual(cached);
    expect(mockFetchStatsData).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // #1002 — degraded-PR-fetch guard
  // A viewer-scoped fetch that can't see private-repo merges returns zero or a
  // severe shortfall. That degraded count must not overwrite last-known-good.
  // ---------------------------------------------------------------------------
  describe("degraded PR fetch guard (#1002)", () => {
    /** primary miss → stale=lastGood → supplemental miss, fetch returns `fresh`. */
    function setupWithStale(fresh: StatsData, lastGood: StatsData | null) {
      mockCacheGet
        .mockResolvedValueOnce(null) // stats:v2:merged (primary miss)
        .mockResolvedValueOnce(lastGood) // stats:stale (last-known-good)
        .mockResolvedValueOnce(null); // supplemental miss
      mockFetchStatsData.mockResolvedValue(fresh);
    }

    it("serves last-known-good and does NOT overwrite the stale key when PRs collapse to 0", async () => {
      const lastGood = makeStats({ prsMergedCount: 41, prsMergedWeight: 120, commitsTotal: 14000 });
      const degraded = makeStats({
        prsMergedCount: 0,
        prsMergedWeight: 0,
        commitsTotal: 15533,
        issuesClosedCount: 5096,
      });
      setupWithStale(degraded, lastGood);

      const result = await getStats("test-user");

      // The good baseline is served, not the zero-PR result.
      expect(result).toEqual(lastGood);
      // The protected stale key is never overwritten with degraded data.
      expect(mockCacheSet).not.toHaveBeenCalledWith(
        "stats:stale:v2:test-user",
        expect.anything(),
        expect.anything(),
      );
      // The degraded object is never written anywhere.
      expect(mockCacheSet).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ prsMergedCount: 0 }),
        expect.anything(),
      );
      // Telemetry fired for observability.
      expect(mockCaptureServerEvent).toHaveBeenCalledWith(
        "github_degraded_pr_fetch",
        expect.objectContaining({ handle: "test-user", stalePrsMergedCount: 41 }),
      );
    });

    it("refreshes the primary key with good data so it does not refetch-thrash", async () => {
      const lastGood = makeStats({ prsMergedCount: 41, prsMergedWeight: 120 });
      const degraded = makeStats({ prsMergedCount: 0, prsMergedWeight: 0, commitsTotal: 9000 });
      setupWithStale(degraded, lastGood);

      await getStats("test-user");

      expect(mockCacheSet).toHaveBeenCalledWith(
        "stats:v2:merged:test-user",
        lastGood,
        expect.any(Number),
      );
    });

    it("does not write any cache in read-only mode but still serves last-known-good", async () => {
      const lastGood = makeStats({ prsMergedCount: 41, prsMergedWeight: 120 });
      const degraded = makeStats({ prsMergedCount: 0, prsMergedWeight: 0, commitsTotal: 9000 });
      setupWithStale(degraded, lastGood);

      const result = await getStats("test-user", undefined, { readOnly: true });

      expect(result).toEqual(lastGood);
      expect(mockCacheSet).not.toHaveBeenCalled();
    });

    it("heals: a real-PR fetch writes through even when the baseline was poisoned", async () => {
      const poisoned = makeStats({ prsMergedCount: 0, prsMergedWeight: 0, commitsTotal: 15000 });
      const healthy = makeStats({ prsMergedCount: 41, prsMergedWeight: 120, commitsTotal: 15100 });
      setupWithStale(healthy, poisoned);

      const result = await getStats("test-user");

      expect(result).toEqual(healthy);
      // Both keys are written with the healthy data.
      expect(mockCacheSet).toHaveBeenCalledWith("stats:v2:merged:test-user", healthy, expect.any(Number));
      expect(mockCacheSet).toHaveBeenCalledWith("stats:stale:v2:test-user", healthy, expect.any(Number));
      expect(mockCaptureServerEvent).not.toHaveBeenCalled();
    });

    it("caches a zero-PR fetch normally when there is no baseline (new user)", async () => {
      const fresh = makeStats({ prsMergedCount: 0, prsMergedWeight: 0, commitsTotal: 100 });
      setupWithStale(fresh, null);

      const result = await getStats("test-user");

      expect(result).toEqual(fresh);
      expect(mockCacheSet).toHaveBeenCalledWith("stats:stale:v2:test-user", fresh, expect.any(Number));
      expect(mockCaptureServerEvent).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // #1087 (PE-H2) — _loadOverlays has zero data dependency on fetchStats'
  // result, so it must be kicked off concurrently rather than strictly after
  // fetchStats resolves. The regression-risk requirement (see CLAUDE.md's
  // scoring-data integrity contract) is that this concurrency change must NOT
  // let overlay data leak into the degraded-fetch guard's decision — the
  // guard must still compare only `primary` against `baseline`.
  // ---------------------------------------------------------------------------
  describe("concurrent GitHub + overlay fetch (#1087 / PE-H2)", () => {
    /** primary miss → stale=lastGood → supplemental miss, fetch returns `fresh`. */
    function setupWithStale(fresh: StatsData, lastGood: StatsData | null) {
      mockCacheGet
        .mockResolvedValueOnce(null) // stats:v2:merged (primary miss)
        .mockResolvedValueOnce(lastGood) // stats:stale (last-known-good)
        .mockResolvedValueOnce(null); // supplemental miss
      mockFetchStatsData.mockResolvedValue(fresh);
    }

    it("kicks off the overlay fetch before fetchStats resolves, not strictly after it", async () => {
      mockCacheGet
        .mockResolvedValueOnce(null) // stats:v2:merged (primary miss)
        .mockResolvedValueOnce(null) // stats:stale (baseline miss)
        .mockResolvedValueOnce(null); // supplemental miss

      let resolveFetchStats!: (value: StatsData) => void;
      mockFetchStatsData.mockReturnValue(
        new Promise<StatsData>((resolve) => {
          resolveFetchStats = resolve;
        }),
      );

      const resultPromise = getStats("test-user");

      // Flush pending microtasks (the cacheGet reads that precede fetchStats)
      // without resolving fetchStats itself.
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      // The overlay fetch (independent of fetchStats' result) must already
      // have been kicked off even though fetchStats is still pending — proof
      // the two run concurrently rather than overlays waiting on fetchStats.
      expect(mockFetchStatsData).toHaveBeenCalled();
      expect(mockFetchBitbucketIfLinked).toHaveBeenCalled();

      resolveFetchStats(makeStats());
      const result = await resultPromise;
      expect(result).not.toBeNull();
    });

    it("kicks off the supplemental lookup concurrently with the platform fetches, not strictly after them", async () => {
      // Collapsing _loadOverlays' own internal waves (the second half of the
      // #1087/PE-H2 recommendation): the platform fetches (bitbucket/codeberg/
      // gitlab) and the supplemental lookup have zero data dependency on each
      // other, so the supplemental cacheGet must fire even while a platform
      // fetch is still in flight — not wait for Promise.allSettled(platforms)
      // to resolve first.
      mockCacheGet
        .mockResolvedValueOnce(null) // stats:v2:merged (primary miss)
        .mockResolvedValueOnce(null) // stats:stale (baseline miss)
        .mockResolvedValueOnce(null); // supplemental miss — must fire concurrently

      mockFetchStatsData.mockResolvedValue(makeStats());

      let resolveBitbucket!: (value: StatsData | null) => void;
      mockFetchBitbucketIfLinked.mockReturnValue(
        new Promise<StatsData | null>((resolve) => {
          resolveBitbucket = resolve;
        }),
      );

      const resultPromise = getStats("test-user");

      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      // The 3rd cacheGet call (supplemental) must already have fired even
      // though the bitbucket platform fetch — part of the same overlay load —
      // is still pending. Proof the supplemental wave doesn't wait on the
      // platform-fetch wave to settle.
      expect(mockCacheGet).toHaveBeenCalledTimes(3);
      expect(mockCacheGet).toHaveBeenNthCalledWith(3, "supplemental:test-user");

      resolveBitbucket(null);
      const result = await resultPromise;
      expect(result).not.toBeNull();
    });

    it("regression: a slow concurrent overlay fetch does not influence the degraded-fetch guard's primary-vs-baseline decision", async () => {
      const lastGood = makeStats({ prsMergedCount: 41, prsMergedWeight: 120, commitsTotal: 14000 });
      const degraded = makeStats({
        prsMergedCount: 0,
        prsMergedWeight: 0,
        commitsTotal: 15533,
        issuesClosedCount: 5096,
      });
      setupWithStale(degraded, lastGood);

      // The overlay resolves late, with an inflated PR count. If overlay data
      // were ever composed onto `primary`/`baseline` before the guard ran
      // (rather than strictly after both `Promise.all` legs settle), a large
      // overlay like this could mask the shortfall the guard exists to catch
      // (the #1061 failure mode this repo already hardened against).
      let resolveBitbucket!: (value: StatsData) => void;
      mockFetchBitbucketIfLinked.mockReturnValue(
        new Promise<StatsData>((resolve) => {
          resolveBitbucket = resolve;
        }),
      );

      const resultPromise = getStats("test-user");
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      resolveBitbucket(
        makeStats({ handle: "test-user-bitbucket", prsMergedCount: 500, commitsTotal: 500 }),
      );

      await resultPromise;

      // The guard compared primary (0) against baseline (41) — unaffected by
      // the overlay's inflated count — and rejected exactly as it does with
      // no overlay in flight at all.
      expect(mockCaptureServerEvent).toHaveBeenCalledWith(
        "github_degraded_pr_fetch",
        expect.objectContaining({
          handle: "test-user",
          freshPrsMergedCount: 0,
          stalePrsMergedCount: 41,
        }),
      );
      expect(mockCacheSet).not.toHaveBeenCalledWith(
        "stats:stale:v2:test-user",
        expect.anything(),
        expect.anything(),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // #1179 (PE-M4) — fold the baseline read into the existing Promise.all
  // The baseline (`stats:stale:v2:*`) read had no data dependency on `primary`
  // or `overlays` — the guards only consume it after `primary` exists — yet it
  // sat in front of the two slowest network legs (GitHub GraphQL + overlays).
  // ---------------------------------------------------------------------------
  describe("baseline read runs concurrently with fetch + overlays (#1179 / PE-M4)", () => {
    it("kicks off fetchStats before the baseline cacheGet resolves, not strictly after it", async () => {
      mockCacheGet.mockResolvedValueOnce(null); // stats:v2:merged (primary miss)

      let resolveBaseline!: (value: StatsData | null) => void;
      mockCacheGet.mockImplementationOnce(
        () =>
          new Promise<StatsData | null>((resolve) => {
            resolveBaseline = resolve;
          }),
      ); // stats:stale (baseline) — held pending
      mockCacheGet.mockResolvedValueOnce(null); // supplemental miss

      mockFetchStatsData.mockResolvedValue(makeStats());

      const resultPromise = getStats("test-user");

      // Flush pending microtasks (everything that can run without the
      // baseline read settling) without resolving it.
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      // fetchStats must already have been invoked even though the baseline
      // read is still pending — proof the baseline read no longer gates the
      // GitHub fetch behind a serialized round-trip.
      expect(mockFetchStatsData).toHaveBeenCalled();

      resolveBaseline(null);
      const result = await resultPromise;
      expect(result).not.toBeNull();
    });

    it("still rejects a degraded fetch once the concurrently-read baseline settles (integrity invariant survives)", async () => {
      // Critical invariant (#1004/#1060): folding the baseline read into
      // Promise.all must not change what the degraded-fetch guard sees, nor
      // let a slow baseline resolve to a stale/null value by the time the
      // guard runs. `primary` (0 merged PRs) must still be judged against the
      // REAL baseline (41 merged PRs) once both promises have settled.
      const lastGood = makeStats({ prsMergedCount: 41, prsMergedWeight: 120, commitsTotal: 14000 });
      const degraded = makeStats({
        prsMergedCount: 0,
        prsMergedWeight: 0,
        commitsTotal: 15533,
        issuesClosedCount: 5096,
      });

      mockCacheGet.mockResolvedValueOnce(null); // stats:v2:merged (primary miss)

      let resolveBaseline!: (value: StatsData | null) => void;
      mockCacheGet.mockImplementationOnce(
        () =>
          new Promise<StatsData | null>((resolve) => {
            resolveBaseline = resolve;
          }),
      ); // stats:stale (baseline) — resolves late, after fetchStats
      mockCacheGet.mockResolvedValueOnce(null); // supplemental miss

      mockFetchStatsData.mockResolvedValue(degraded);

      const resultPromise = getStats("test-user");

      // Let fetchStats settle first, proving the guard still waits for the
      // baseline rather than running against a premature `undefined`/`null`.
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      resolveBaseline(lastGood);

      await resultPromise;

      expect(mockCaptureServerEvent).toHaveBeenCalledWith(
        "github_degraded_pr_fetch",
        expect.objectContaining({
          handle: "test-user",
          freshPrsMergedCount: 0,
          stalePrsMergedCount: 41,
        }),
      );
      // Rejected fetch must not overwrite the protected baseline.
      expect(mockCacheSet).not.toHaveBeenCalledWith(
        "stats:stale:v2:test-user",
        expect.anything(),
        expect.anything(),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // #1004 phase 2 — scope-aware, non-downgrading cache writes
  // A lower-scope (public) fetch must never overwrite a higher-scope
  // (authenticated) entry already cached for this handle.
  // ---------------------------------------------------------------------------
  describe("scope-aware non-downgrading cache writes (#1004 phase 2)", () => {
    it("tags a fetch as public when there is no session token AND no server token", async () => {
      // Genuinely unauthenticated: nothing to fall back to. (In production
      // GitHub's GraphQL API would reject this outright with a 403 — see
      // #1050 — so this is the defensive branch, not a live code path.)
      vi.mocked(getGithubToken).mockReturnValue(undefined);
      const fresh = makeStats({ prsMergedCount: 10 });
      setupCacheMiss(fresh);

      const result = await getStats("test-user");

      expect(result!.fetchScope).toBe("public");
    });

    it("tags a tokenless fetch as authenticated — it uses the `repo`-scoped server token", async () => {
      // #1050: fetchScope means "was this private-inclusive?", not "was a token
      // argument present?". A tokenless call resolves to the server
      // GITHUB_TOKEN (queries.ts: `token ?? getGithubToken()`), which holds
      // `repo` and sees private merges — so it is the *more* trustworthy fetch,
      // despite passing no token here.
      const fresh = makeStats({ prsMergedCount: 10 });
      setupCacheMiss(fresh);

      const result = await getStats("test-user");

      expect(result!.fetchScope).toBe("authenticated");
    });

    it("tags a session-token fetch as public — the OAuth app grants no `repo` scope", async () => {
      // The inverse of the above, and the #1050 bug: this used to be tagged
      // "authenticated" purely because a token object was passed, letting a
      // scope-blind refresh outrank the server token's complete data.
      const fresh = makeStats({ prsMergedCount: 10 });
      setupCacheMiss(fresh);

      const result = await getStats("test-user", "gho_session_token_no_repo_scope");

      expect(result!.fetchScope).toBe("public");
    });

    it("a public fetch does NOT overwrite an authenticated stats:v2:merged entry", async () => {
      // getStats() itself misses on cacheKey (that's why _fetchAndCache runs
      // at all), but a concurrent authenticated fetch races ahead and writes
      // its better-scoped entry before this fetch reaches its own write —
      // the re-read inside _fetchAndCache must catch it.
      const authenticatedEntry = makeStats({ fetchScope: "authenticated", prsMergedCount: 904 });
      const publicFetch = makeStats({ prsMergedCount: 3 });

      mockCacheGet
        .mockResolvedValueOnce(null) // getStats(): cacheKey miss -> triggers fetch
        .mockResolvedValueOnce(null) // _fetchAndCache: staleKey miss
        .mockResolvedValueOnce(null) // supplemental miss
        .mockResolvedValueOnce(authenticatedEntry); // re-read cacheKey before write: race
      mockFetchStatsData.mockResolvedValue(publicFetch);

      // #1050: the session-token path is the public-scoped one — OAuth grants
      // no `repo`, so this fetch cannot see private repos.
      const result = await getStats("test-user", "gho_session_token_no_repo_scope");

      // The caller still gets its own freshly-fetched (public) data.
      expect(result!.fetchScope).toBe("public");
      // But the shared cache is not clobbered.
      expect(mockCacheSet).not.toHaveBeenCalledWith(
        "stats:v2:merged:test-user",
        expect.anything(),
        expect.anything(),
      );
    });

    it("a public fetch does NOT overwrite an authenticated stats:stale entry", async () => {
      const authenticatedStale = makeStats({ fetchScope: "authenticated", prsMergedCount: 904 });
      const publicFetch = makeStats({ prsMergedCount: 3 });

      mockCacheGet
        .mockResolvedValueOnce(null) // cacheKey miss
        .mockResolvedValueOnce(authenticatedStale) // staleKey hit -> authenticated
        .mockResolvedValueOnce(null); // supplemental miss
      // No re-read of cacheKey: 3 merged PRs against an authenticated baseline
      // of 904 is a scope shortfall, so `isDegradedPrFetch` (#1045) now returns
      // early via _serveStaleAndReCache and never reaches the write rule.
      mockFetchStatsData.mockResolvedValue(publicFetch);

      // #1050: this is the real juan294 shape — a user's own refresh (session
      // token, no `repo`) seeing a fraction of what the server token already
      // established. It must not overwrite the last-known-good.
      const result = await getStats("test-user", "gho_session_token_no_repo_scope");

      expect(mockCacheSet).not.toHaveBeenCalledWith(
        "stats:stale:v2:test-user",
        expect.anything(),
        expect.anything(),
      );
      // #1045/#1046: previously this asserted the merged key "still writes
      // normally" with the public data, because getStats confirms a miss on
      // cacheKey before fetching — so the write rule's re-read was null by
      // construction and the downgrade check was a no-op. That is exactly how
      // juan294's badge came to serve Delivery 58 / composite 68 off a
      // scope-blinded fetch while stats:stale held the real numbers. The
      // merged key must receive the last-known-good, never the downgrade.
      expect(mockCacheSet).toHaveBeenCalledWith(
        "stats:v2:merged:test-user",
        expect.objectContaining({ fetchScope: "authenticated", prsMergedCount: 904 }),
        expect.any(Number),
      );
      expect(result!.prsMergedCount).toBe(904);
    });

    it("#1050: a session-token fetch is NOT labelled authenticated (OAuth lacks `repo`)", async () => {
      // The inversion this fixes: fetchScope was assigned from token PRESENCE,
      // not from what the token could SEE.
      //
      //   anonymous badge hit -> falls back to server GITHUB_TOKEN (has `repo`)
      //                       -> saw 987 merged PRs -> was labelled "public"
      //   user's own refresh  -> session OAuth token (no `repo`)
      //                       -> saw 140 merged PRs -> was labelled "authenticated"
      //
      // scopeRank puts authenticated(2) above public(1), so the BLINDED fetch
      // outranked and overwrote the COMPLETE one. The non-downgrading rule from
      // #1004 was not merely bypassed here — it was pointed backwards, actively
      // preferring the corrupt data. This is what collapsed juan294's Delivery
      // 100 -> 58 the moment he clicked Refresh on his own profile.
      const publicFetch = makeStats({ prsMergedCount: 140 });
      mockCacheGet
        .mockResolvedValueOnce(null) // cacheKey miss
        .mockResolvedValueOnce(null) // staleKey miss
        .mockResolvedValueOnce(null) // supplemental miss
        .mockResolvedValueOnce(null); // re-read cacheKey
      mockFetchStatsData.mockResolvedValue(publicFetch);

      const result = await getStats("test-user", "gho_session_token_without_repo_scope");

      expect(result!.fetchScope).toBe("public");
    });

    it("#1046: a mild public downgrade still cannot overwrite the authenticated merged key", async () => {
      // Below #1045's shortfall threshold (800 vs 904 is not a collapse), so
      // isDegradedPrFetch allows it through and the write rule is the only
      // thing standing between a scope downgrade and the primary cache key.
      // It must compare against the durable scope record (stats:stale), not a
      // cacheKey that getStats already proved is a miss.
      const authenticatedStale = makeStats({ fetchScope: "authenticated", prsMergedCount: 904 });
      const publicFetch = makeStats({ prsMergedCount: 800 });

      mockCacheGet
        .mockResolvedValueOnce(null) // cacheKey miss
        .mockResolvedValueOnce(authenticatedStale) // staleKey hit -> authenticated
        .mockResolvedValueOnce(null) // supplemental miss
        .mockResolvedValueOnce(null); // re-read cacheKey -> null by construction

      mockFetchStatsData.mockResolvedValue(publicFetch);

      // #1050: a session token is the public-scoped path (OAuth lacks `repo`).
      await getStats("test-user", "gho_session_token_no_repo_scope");

      expect(mockCacheSet).not.toHaveBeenCalledWith(
        "stats:v2:merged:test-user",
        expect.objectContaining({ fetchScope: "public" }),
        expect.any(Number),
      );
    });

    it("an authenticated fetch DOES overwrite a public entry (upgrade allowed)", async () => {
      const publicStale = makeStats({ fetchScope: "public", prsMergedCount: 3 });
      const authedFetch = makeStats({ prsMergedCount: 904 });

      mockCacheGet
        .mockResolvedValueOnce(null) // cacheKey miss
        .mockResolvedValueOnce(publicStale) // staleKey hit -> public
        .mockResolvedValueOnce(null) // supplemental miss
        .mockResolvedValueOnce(null); // re-read cacheKey -> no existing merged entry
      mockFetchStatsData.mockResolvedValue(authedFetch);

      // #1050: no session token — this is the server-GITHUB_TOKEN path, which
      // is the private-inclusive ("authenticated") one. Healing a poisoned
      // public baseline must still write through.
      await getStats("test-user");

      expect(mockCacheSet).toHaveBeenCalledWith(
        "stats:stale:v2:test-user",
        expect.objectContaining({ fetchScope: "authenticated" }),
        expect.any(Number),
      );
      expect(mockCacheSet).toHaveBeenCalledWith(
        "stats:v2:merged:test-user",
        expect.objectContaining({ fetchScope: "authenticated" }),
        expect.any(Number),
      );
    });

    it("a first fetch (no existing entry at either key) writes normally regardless of scope", async () => {
      const fresh = makeStats({ prsMergedCount: 10 });
      setupCacheMiss(fresh); // no 4th queued cacheGet response -> falls through to undefined

      // #1050: session token -> public scope. With nothing cached at either
      // key there is no better-scoped entry to protect, so it writes through.
      await getStats("test-user", "gho_session_token_no_repo_scope");

      expect(mockCacheSet).toHaveBeenCalledWith(
        "stats:v2:merged:test-user",
        expect.objectContaining({ fetchScope: "public" }),
        expect.any(Number),
      );
      expect(mockCacheSet).toHaveBeenCalledWith(
        "stats:stale:v2:test-user",
        expect.objectContaining({ fetchScope: "public" }),
        expect.any(Number),
      );
    });

    it("an untagged (legacy) cached entry is treated as public and does not block a public write", async () => {
      const legacyStale = makeStats({ prsMergedCount: 3 }); // no fetchScope
      const publicFetch = makeStats({ prsMergedCount: 5 });

      mockCacheGet
        .mockResolvedValueOnce(null) // cacheKey miss
        .mockResolvedValueOnce(legacyStale) // staleKey hit -> untagged
        .mockResolvedValueOnce(null) // supplemental miss
        .mockResolvedValueOnce(null); // re-read cacheKey -> no existing merged entry
      mockFetchStatsData.mockResolvedValue(publicFetch);

      // #1050: session token -> public scope. An untagged legacy entry ranks as
      // public too, so this is an equal-scope write and must not be blocked.
      await getStats("test-user", "gho_session_token_no_repo_scope");

      expect(mockCacheSet).toHaveBeenCalledWith(
        "stats:stale:v2:test-user",
        expect.objectContaining({ fetchScope: "public" }),
        expect.any(Number),
      );
    });

    // #1163 (BE-H2): the rejected-fetch branch reads `existingComposed` at
    // :522 to detect a concurrent better-scoped write (the documented inflight
    // race between separate public/authenticated dedup keys — :91-99), but
    // wrote the composed value to `cacheKey` unconditionally whenever a
    // baseline existed, regardless of whether `existingComposed` outranked
    // the value it was about to write. That silently downgraded the shared
    // cache — the exact #1002/#1050 signature, reintroduced via the
    // rejection path.
    it("#1163: a rejected fetch's baseline fallback does not overwrite a better-scoped existingComposed entry (race)", async () => {
      // The baseline is only public-scoped and lower-value than the entry a
      // concurrent authenticated fetch already landed at cacheKey.
      const publicBaseline = makeStats({
        fetchScope: "public",
        prsMergedCount: 50,
        commitsTotal: 100,
      });
      const raceWinnerAuthenticated = makeStats({
        fetchScope: "authenticated",
        prsMergedCount: 900,
      });
      // Not a degraded-fetch collapse (same scope as baseline, comparable
      // magnitude) — this fetch is rejected purely by the scope-rank check
      // against the racing authenticated entry.
      const publicFetch = makeStats({ prsMergedCount: 55, commitsTotal: 100 });

      mockCacheGet
        .mockResolvedValueOnce(null) // getStats(): cacheKey miss -> triggers fetch
        .mockResolvedValueOnce(publicBaseline) // staleKey hit -> public baseline
        .mockResolvedValueOnce(null) // supplemental miss
        .mockResolvedValueOnce(raceWinnerAuthenticated); // re-read cacheKey: race winner landed
      mockFetchStatsData.mockResolvedValue(publicFetch);

      await getStats("test-user", "gho_session_token_no_repo_scope");

      expect(mockCacheSet).not.toHaveBeenCalledWith(
        "stats:v2:merged:test-user",
        expect.objectContaining({ fetchScope: "public" }),
        expect.any(Number),
      );
    });

    it("#1163: still refreshes cacheKey TTL on a rejected fetch when existingComposed is not better-scoped than the fallback", async () => {
      // Anti-thrash requirement: the write must still happen (refreshing the
      // 6h TTL so a sustained scope-blinded caller doesn't refetch on every
      // request) whenever existingComposed is present but NOT better-scoped
      // than the value about to be written.
      const authenticatedBaseline = makeStats({
        fetchScope: "authenticated",
        prsMergedCount: 904,
        commitsTotal: 500,
      });
      const stalePublicExisting = makeStats({ fetchScope: "public", prsMergedCount: 3 });
      const publicFetch = makeStats({ prsMergedCount: 3, commitsTotal: 500 });

      mockCacheGet
        .mockResolvedValueOnce(null) // cacheKey miss
        .mockResolvedValueOnce(authenticatedBaseline) // staleKey hit -> authenticated
        .mockResolvedValueOnce(null) // supplemental miss
        .mockResolvedValueOnce(stalePublicExisting); // re-read cacheKey: existing entry, but NOT better-scoped than the fallback

      mockFetchStatsData.mockResolvedValue(publicFetch);

      await getStats("test-user", "gho_session_token_no_repo_scope");

      expect(mockCacheSet).toHaveBeenCalledWith(
        "stats:v2:merged:test-user",
        expect.objectContaining({ fetchScope: "authenticated", prsMergedCount: 904 }),
        expect.any(Number),
      );
    });
  });

  it("#1083: never issues a live GitHub fetch in read-only mode, even on a cold key", async () => {
    // No baseline exists yet — a handle that has never been fetched by a
    // write-mode caller (badge route, warm-cache cron, refresh).
    mockCacheGet
      .mockResolvedValueOnce(null) // stats:v2:merged:test-user (primary)
      .mockResolvedValueOnce(null); // stats:stale:v2:test-user (baseline)

    const result = await getStats("test-user", undefined, { readOnly: true });

    expect(result).toBeNull();
    expect(mockFetchStatsData).not.toHaveBeenCalled();
    expect(mockFetchBitbucketIfLinked).not.toHaveBeenCalled();
    expect(mockFetchCodebergIfLinked).not.toHaveBeenCalled();
    expect(mockFetchGitlabIfLinked).not.toHaveBeenCalled();
    expect(mockCacheSet).not.toHaveBeenCalled();
    expect(mockDbUpsertUser).not.toHaveBeenCalled();
  });

  it("#1083: serves the protected baseline in read-only mode without writing caches or fetching GitHub", async () => {
    const baseline = makeStats();
    mockCacheGet.mockImplementation((key: string) => {
      if (key === "stats:v2:merged:test-user") return Promise.resolve(null);
      if (key === "stats:stale:v2:test-user") return Promise.resolve(baseline);
      return Promise.resolve(null);
    });

    const result = await getStats("test-user", undefined, { readOnly: true });

    expect(result).toEqual(baseline);
    expect(mockFetchStatsData).not.toHaveBeenCalled();
    expect(mockFetchBitbucketIfLinked).not.toHaveBeenCalled();
    expect(mockFetchCodebergIfLinked).not.toHaveBeenCalled();
    expect(mockFetchGitlabIfLinked).not.toHaveBeenCalled();
    expect(mockCacheSet).not.toHaveBeenCalled();
    expect(mockDbUpsertUser).not.toHaveBeenCalled();
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

  it("PE-L2: backfills enriched stats into the cache so the next hit needs no DB reads", async () => {
    // First hit: cached stats with linkedPlatforms but no logins — triggers N DB reads.
    const cached = makeStats({
      linkedPlatforms: ["bitbucket"],
    });
    mockCacheGet.mockResolvedValue(cached);
    mockDbGetLinkedPlatform.mockResolvedValue({
      remoteLogin: "bb-user",
      tokens: { accessToken: "t", refreshToken: null, expiresAt: null },
    });

    await getStats("test-user");

    // Expect a fire-and-forget cache write with the enriched stats
    expect(mockCacheSet).toHaveBeenCalledWith(
      "stats:v2:merged:test-user",
      expect.objectContaining({ linkedPlatformLogins: { bitbucket: "bb-user" } }),
      expect.any(Number),
    );
  });

  it("PE-L2: does not backfill enriched stats in read-only mode", async () => {
    const cached = makeStats({
      linkedPlatforms: ["bitbucket"],
    });
    mockCacheGet.mockResolvedValue(cached);
    mockDbGetLinkedPlatform.mockResolvedValue({
      remoteLogin: "bb-user",
      tokens: { accessToken: "t", refreshToken: null, expiresAt: null },
    });

    const result = await getStats("test-user", undefined, { readOnly: true });

    expect(result!.linkedPlatformLogins).toEqual({ bitbucket: "bb-user" });
    expect(mockCacheSet).not.toHaveBeenCalled();
  });

  it("PE-L2: does not backfill the cache when no logins are found", async () => {
    // linkedPlatforms present but DB returns null for all — no logins resolved,
    // no enriched data to cache.
    const cached = makeStats({
      linkedPlatforms: ["bitbucket"],
    });
    mockCacheGet.mockResolvedValue(cached);
    mockDbGetLinkedPlatform.mockResolvedValue(null);

    await getStats("test-user");

    expect(mockCacheSet).not.toHaveBeenCalled();
  });

  it("PE-L2: skips DB reads on a second warm-cache hit when enrichment was backfilled", async () => {
    // The enriched (backfilled) stats already have linkedPlatformLogins —
    // _enrichWithLogins should return early without any DB reads.
    const enriched = makeStats({
      linkedPlatforms: ["bitbucket"],
      linkedPlatformLogins: { bitbucket: "bb-user" },
    });
    mockCacheGet.mockResolvedValue(enriched);

    await getStats("test-user");

    // DB should not be called — no enrichment needed
    expect(mockDbGetLinkedPlatform).not.toHaveBeenCalled();
    expect(mockFetchStatsData).not.toHaveBeenCalled();
    expect(mockCacheSet).not.toHaveBeenCalled();
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
      "stats:stale:v2:test-user",
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
    expect(mockCacheGet).toHaveBeenCalledWith("stats:stale:v2:test-user");
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

  it("caches the composed result under the merged key and the GitHub-derived half under the baseline key", async () => {
    const primary = makeStats({ commitsTotal: 50 });
    const supplemental: SupplementalStats = {
      targetHandle: "test-user",
      sourceHandle: "corp-user",
      stats: makeStats({ commitsTotal: 30 }),
      uploadedAt: new Date().toISOString(),
    };

    mockCacheGet
      .mockResolvedValueOnce(null) // merged
      .mockResolvedValueOnce(null) // baseline
      .mockResolvedValueOnce(supplemental);
    mockFetchStatsData.mockResolvedValue(primary);

    await getStats("test-user");

    expect(mockCacheSet).toHaveBeenCalledWith(
      "stats:v2:merged:test-user",
      expect.objectContaining({ commitsTotal: 80, hasSupplementalData: true }),
      21600,
    );
    // #1060 — the baseline is the guard's comparison input, so it holds the
    // GitHub-derived value alone. Composing the supplemental into it would make
    // every later fetch judge itself against a non-GitHub-derived number.
    expect(mockCacheSet).toHaveBeenCalledWith(
      "stats:stale:v2:test-user",
      expect.objectContaining({ commitsTotal: 50 }),
      604800,
    );
    const baselineWrite = mockCacheSet.mock.calls.find(
      (c) => c[0] === "stats:stale:v2:test-user",
    );
    expect(baselineWrite![1].hasSupplementalData).toBeUndefined();
  });

  // #1239 — Fetching stats is not consent. `/u/:handle` and the badge route
  // accept ANY handle, so registering the fetched handle in the permanent
  // `users` table turned every public badge view into a signup for a person
  // who had never visited Chapa. Registration belongs to the OAuth callback
  // alone; these tests fail if the write is ever reintroduced here.
  it("#1239: does not register the handle on a successful live fetch", async () => {
    const fresh = makeStats();
    setupCacheMiss(fresh);

    await getStats("Test-User");

    expect(mockDbUpsertUser).not.toHaveBeenCalled();
  });

  it("#1239: does not register the handle when serving from cache", async () => {
    const cached = makeStats();
    mockCacheGet.mockResolvedValue(cached);

    await getStats("test-user");

    expect(mockDbUpsertUser).not.toHaveBeenCalled();
  });

  it("#1239: does not register the handle when the API fails", async () => {
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
        "stats:stale:v2:test-user",
        fresh,
        604800,
      );
    });

    it("re-caches stale data into the primary key (not the stale key) to bound refetch churn", async () => {
      const stale = makeStats({ commitsTotal: 42 });
      mockCacheGet
        .mockResolvedValueOnce(null) // merged miss
        .mockResolvedValueOnce(stale); // stale hit
      mockFetchStatsData.mockResolvedValue(null); // API failure

      await getStats("test-user");

      // Mirrors the #1002 degraded-fetch anti-thrash pattern: refresh only
      // the primary key with the last-known-good data so a sustained GitHub
      // outage doesn't cause a refetch on every subsequent request. The
      // protected stale key itself is left untouched.
      expect(mockCacheSet).toHaveBeenCalledWith(
        "stats:v2:merged:test-user",
        stale,
        21600,
      );
      expect(mockCacheSet).not.toHaveBeenCalledWith(
        "stats:stale:v2:test-user",
        expect.anything(),
        expect.anything(),
      );
    });

    it("does not re-cache stale data in read-only mode", async () => {
      const stale = makeStats({ commitsTotal: 42 });
      mockCacheGet
        .mockResolvedValueOnce(null) // merged miss
        .mockResolvedValueOnce(stale); // stale hit
      mockFetchStatsData.mockResolvedValue(null); // API failure

      const result = await getStats("test-user", undefined, { readOnly: true });

      expect(result).toEqual(stale);
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

      expect(mockCacheGet).toHaveBeenCalledWith("stats:stale:v2:test-user");
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

    it("does not let a private-inclusive server-token request reuse a scope-blind session fetch", async () => {
      const sessionStats = makeStats({ commitsTotal: 11 });
      const serverStats = makeStats({ commitsTotal: 22 });

      let resolveSessionFetch!: (value: StatsData) => void;
      let resolveServerFetch!: (value: StatsData) => void;
      mockFetchStatsData
        .mockReturnValueOnce(
          new Promise<StatsData>((resolve) => {
            resolveSessionFetch = resolve;
          }),
        )
        .mockReturnValueOnce(
          new Promise<StatsData>((resolve) => {
            resolveServerFetch = resolve;
          }),
        );
      mockCacheGet.mockResolvedValue(null);

      const sessionPromise = getStats("test-user", "auth-token");
      const serverPromise = getStats("test-user");

      resolveSessionFetch(sessionStats);
      resolveServerFetch(serverStats);

      const [sessionResult, serverResult] = await Promise.all([
        sessionPromise,
        serverPromise,
      ]);

      expect(sessionResult).toEqual(sessionStats);
      expect(serverResult).toEqual(serverStats);
      expect(mockFetchStatsData).toHaveBeenCalledTimes(2);
      expect(mockFetchStatsData).toHaveBeenNthCalledWith(1, "test-user", "auth-token");
      expect(mockFetchStatsData).toHaveBeenNthCalledWith(2, "test-user", undefined);
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

    it("lets a scope-blind session caller reuse a private-inclusive server-token fetch", async () => {
      const serverStats = makeStats({ commitsTotal: 22 });

      let resolveServerFetch!: (value: StatsData) => void;
      mockFetchStatsData.mockReturnValueOnce(
        new Promise<StatsData>((resolve) => {
          resolveServerFetch = resolve;
        }),
      );
      mockCacheGet.mockResolvedValue(null);

      const serverPromise = getStats("test-user");
      const sessionPromise = getStats("test-user", "auth-token");

      resolveServerFetch(serverStats);

      const [serverResult, sessionResult] = await Promise.all([
        serverPromise,
        sessionPromise,
      ]);

      expect(serverResult).toEqual(serverStats);
      expect(sessionResult).toEqual(serverStats);
      expect(mockFetchStatsData).toHaveBeenCalledTimes(1);
      expect(mockFetchStatsData).toHaveBeenCalledWith("test-user", undefined);
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

    it("fetches the link row exactly once per platform, on the successful-stats-fetch path (#1093)", async () => {
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

      // Previously: one wave skipped the DB read because the stats fetch had
      // already succeeded, then a later wave re-fetched the same row to
      // resolve the login — two calls for one successfully-fetched platform.
      expect(mockDbGetLinkedPlatform).toHaveBeenCalledTimes(1);
      expect(mockDbGetLinkedPlatform).toHaveBeenCalledWith("test-user", "bitbucket");
      expect(result!.linkedPlatformLogins).toEqual({ bitbucket: "bb-user" });
    });

    it("fetches the link row exactly once per platform, on the failed-stats-fetch path (#1093, guards #632)", async () => {
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

      expect(mockDbGetLinkedPlatform).toHaveBeenCalledTimes(1);
      expect(mockDbGetLinkedPlatform).toHaveBeenCalledWith("test-user", "bitbucket");

      // #632 regression guard: the platform must still appear in Data Sources
      // (linkedPlatforms) even though its own stats fetch failed, because the
      // link row itself (source of truth for "is this platform linked") says
      // it's linked.
      expect(result!.commitsTotal).toBe(50); // GitHub-only — stats fetch failed
      expect(result!.linkedPlatforms).toEqual(["bitbucket"]);
      expect(result!.linkedPlatformLogins).toEqual({ bitbucket: "bb-user" });
    });

    it("does not gate a successfully-fetched platform's link-row query behind a slower platform's enabled-check wave (#1093)", async () => {
      const github = makeStats({ commitsTotal: 50 });
      const cb = makeStats({ commitsTotal: 15 });

      mockCacheGet
        .mockResolvedValueOnce(null) // merged
        .mockResolvedValueOnce(null) // stale
        .mockResolvedValueOnce(null); // supplemental
      mockFetchStatsData.mockResolvedValue(github);

      // Bitbucket's stats fetch failed, and its enabled-check is slow (simulating
      // a real feature-flag/DB round-trip that hasn't resolved yet).
      mockFetchBitbucketIfLinked.mockResolvedValue(null);
      let resolveBitbucketEnabled!: (value: boolean) => void;
      mockIsBitbucketEnabled.mockReturnValue(
        new Promise<boolean>((resolve) => {
          resolveBitbucketEnabled = resolve;
        }),
      );

      // Codeberg's stats fetch succeeded — its link-row query has zero data
      // dependency on Bitbucket's still-pending enabled-check.
      mockFetchCodebergIfLinked.mockResolvedValue(cb);
      mockDbGetLinkedPlatform.mockImplementation((_handle: string, platform: string) => {
        if (platform === "codeberg") {
          return Promise.resolve({
            remoteLogin: "cb-user",
            tokens: { accessToken: "t", refreshToken: null, expiresAt: null },
          });
        }
        return Promise.resolve(null);
      });

      const resultPromise = getStats("test-user");

      // Give microtasks a chance to settle. Bitbucket's enabled-check is still
      // pending at this point.
      await new Promise((r) => setTimeout(r, 20));

      // The Codeberg link-row query must already have started — it has no
      // dependency on Bitbucket's pending enabled-check and must not be
      // serialized behind it in a second wave.
      expect(mockDbGetLinkedPlatform).toHaveBeenCalledWith("test-user", "codeberg");

      resolveBitbucketEnabled(false);
      const result = await resultPromise;

      expect(result!.linkedPlatforms).toEqual(["codeberg"]);
      expect(result!.linkedPlatformLogins).toEqual({ codeberg: "cb-user" });
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

  // -------------------------------------------------------------------------
  // #1060 / #1061 — GitHub-derived vs composed stats.
  //
  // The integrity guards exist to detect GitHub *token-scope* blindness, so
  // they may only ever inspect GitHub-derived data. Linked-platform and EMU
  // supplemental counts are not token-scoped: composing them before the guards
  // both (a) lets a rejected fetch discard the supplemental entirely (#1060)
  // and (b) lets a supplemental mask a blinded GitHub fetch (#1061).
  //
  // `stats:stale:v2:` holds GitHub-derived data ONLY; `stats:v2:merged:` holds
  // the composed value callers receive.
  // -------------------------------------------------------------------------
  describe("GitHub-derived vs composed stats (#1060, #1061)", () => {
    const BASELINE_KEY = "stats:stale:v2:test-user";
    const COMPOSED_KEY = "stats:v2:merged:test-user";

    function supplementalOf(stats: StatsData): SupplementalStats {
      return {
        targetHandle: "test-user",
        sourceHandle: "corp-user",
        stats,
        uploadedAt: new Date().toISOString(),
      };
    }

    it("#1060: a scope-downgraded fetch keeps the current supplemental instead of discarding it", async () => {
      // The exact frivas shape: EMU stats uploaded, then the owner clicks
      // Refresh. The session token is scope-blind, so the fetch is rejected as
      // a downgrade — but the EMU data must survive that rejection.
      const baseline = makeStats({
        fetchScope: "authenticated",
        prsMergedCount: 40,
        commitsTotal: 200,
      });
      const publicFetch = makeStats({ prsMergedCount: 25, commitsTotal: 180 });
      const supplemental = supplementalOf(
        makeStats({ handle: "corp-user", prsMergedCount: 32, commitsTotal: 453 }),
      );

      mockCacheGet
        .mockResolvedValueOnce(null) // getStats: composed key miss
        .mockResolvedValueOnce(baseline) // baseline: authenticated, GitHub-derived
        .mockResolvedValueOnce(supplemental) // supplemental hit
        .mockResolvedValueOnce(null); // re-read of composed key before write
      mockFetchStatsData.mockResolvedValue(publicFetch);

      const result = await getStats("test-user", "gho_session_token_no_repo_scope");

      // 40 (protected baseline) + 32 (current supplemental) — NOT 40 alone.
      expect(result!.prsMergedCount).toBe(72);
      expect(result!.hasSupplementalData).toBe(true);
      expect(mockCacheSet).toHaveBeenCalledWith(
        COMPOSED_KEY,
        expect.objectContaining({ prsMergedCount: 72, hasSupplementalData: true }),
        expect.any(Number),
      );
    });

    it("#1061: a supplemental cannot mask a blinded GitHub fetch", async () => {
      // GitHub returns zero merged PRs (scope-blinded) but the EMU supplemental
      // carries 50, which — if composed first — lifts the value over both
      // detection signatures and disarms the guard.
      const baseline = makeStats({
        fetchScope: "authenticated",
        prsMergedCount: 80,
        commitsTotal: 400,
      });
      const blindedFetch = makeStats({ prsMergedCount: 0, commitsTotal: 500 });
      const supplemental = supplementalOf(
        makeStats({ handle: "corp-user", prsMergedCount: 50, commitsTotal: 300 }),
      );

      mockCacheGet
        .mockResolvedValueOnce(null) // composed key miss
        .mockResolvedValueOnce(baseline)
        .mockResolvedValueOnce(supplemental)
        .mockResolvedValueOnce(null);
      mockFetchStatsData.mockResolvedValue(blindedFetch);

      await getStats("test-user", "gho_session_token_no_repo_scope");

      // The guard must have seen 0, not 50.
      expect(mockCaptureServerEvent).toHaveBeenCalledWith(
        "github_degraded_pr_fetch",
        expect.objectContaining({
          handle: "test-user",
          freshPrsMergedCount: 0,
          stalePrsMergedCount: 80,
          fetchScope: "public",
        }),
      );
      // The protected baseline is never overwritten by a rejected fetch.
      expect(mockCacheSet).not.toHaveBeenCalledWith(
        BASELINE_KEY,
        expect.anything(),
        expect.anything(),
      );
    });

    it("#1061: an equivalent blinded fetch with no supplemental behaves identically", async () => {
      const baseline = makeStats({
        fetchScope: "authenticated",
        prsMergedCount: 80,
        commitsTotal: 400,
      });
      const blindedFetch = makeStats({ prsMergedCount: 0, commitsTotal: 500 });

      mockCacheGet
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(baseline)
        .mockResolvedValueOnce(null) // no supplemental
        .mockResolvedValueOnce(null);
      mockFetchStatsData.mockResolvedValue(blindedFetch);

      await getStats("test-user", "gho_session_token_no_repo_scope");

      expect(mockCaptureServerEvent).toHaveBeenCalledWith(
        "github_degraded_pr_fetch",
        expect.objectContaining({ freshPrsMergedCount: 0 }),
      );
      expect(mockCacheSet).not.toHaveBeenCalledWith(
        BASELINE_KEY,
        expect.anything(),
        expect.anything(),
      );
    });

    it("the baseline key stores GitHub-derived data only — no supplemental, no platforms", async () => {
      const primary = makeStats({ commitsTotal: 50, prsMergedCount: 5 });
      const supplemental = supplementalOf(
        makeStats({ handle: "corp-user", commitsTotal: 30, prsMergedCount: 3 }),
      );
      mockFetchBitbucketIfLinked.mockResolvedValue(
        makeStats({ handle: "bb-user", commitsTotal: 7, prsMergedCount: 1 }),
      );
      mockDbGetLinkedPlatform.mockResolvedValue({ remoteLogin: "bb-user" });

      mockCacheGet
        .mockResolvedValueOnce(null) // composed key miss
        .mockResolvedValueOnce(null) // no baseline
        .mockResolvedValueOnce(supplemental)
        .mockResolvedValueOnce(null);
      mockFetchStatsData.mockResolvedValue(primary);

      await getStats("test-user");

      // Composed key: everything layered on.
      expect(mockCacheSet).toHaveBeenCalledWith(
        COMPOSED_KEY,
        expect.objectContaining({
          commitsTotal: 87, // 50 + 7 + 30
          prsMergedCount: 9, // 5 + 1 + 3
          hasSupplementalData: true,
        }),
        expect.any(Number),
      );
      // Baseline key: GitHub primary alone.
      const baselineWrite = mockCacheSet.mock.calls.find(
        (c) => c[0] === BASELINE_KEY,
      );
      expect(baselineWrite).toBeDefined();
      expect(baselineWrite![1]).toMatchObject({
        commitsTotal: 50,
        prsMergedCount: 5,
        fetchScope: "authenticated",
      });
      expect(baselineWrite![1].hasSupplementalData).toBeUndefined();
      expect(baselineWrite![1].linkedPlatforms).toBeUndefined();
    });

    it("re-composes the supplemental when GitHub is unavailable and the baseline is served", async () => {
      const baseline = makeStats({
        fetchScope: "authenticated",
        commitsTotal: 200,
        prsMergedCount: 40,
      });
      const supplemental = supplementalOf(
        makeStats({ handle: "corp-user", commitsTotal: 453, prsMergedCount: 32 }),
      );

      mockCacheGet
        .mockResolvedValueOnce(null) // composed key miss
        .mockResolvedValueOnce(baseline)
        .mockResolvedValueOnce(supplemental);
      mockFetchStatsData.mockResolvedValue(null); // GitHub down

      const result = await getStats("test-user");

      expect(result!.prsMergedCount).toBe(72);
      expect(result!.hasSupplementalData).toBe(true);
      // A GitHub outage must not touch the protected baseline.
      expect(mockCacheSet).not.toHaveBeenCalledWith(
        BASELINE_KEY,
        expect.anything(),
        expect.anything(),
      );
    });

    it("returns the better-scoped composed value to the caller on a downgrade (D4)", async () => {
      const baseline = makeStats({
        fetchScope: "authenticated",
        prsMergedCount: 40,
        commitsTotal: 200,
      });
      const publicFetch = makeStats({ prsMergedCount: 25, commitsTotal: 180 });

      mockCacheGet
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(baseline)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mockFetchStatsData.mockResolvedValue(publicFetch);

      const result = await getStats("test-user", "gho_session_token_no_repo_scope");

      // Pre-#1060 this returned the caller's own blinded fetch. It now returns
      // the protected, better-scoped data — the user sees their real score.
      expect(result!.fetchScope).toBe("authenticated");
      expect(result!.prsMergedCount).toBe(40);
    });

    it("writes no cache in read-only mode even when composing a rejected fetch", async () => {
      const baseline = makeStats({
        fetchScope: "authenticated",
        prsMergedCount: 40,
        commitsTotal: 200,
      });
      const publicFetch = makeStats({ prsMergedCount: 25, commitsTotal: 180 });
      const supplemental = supplementalOf(
        makeStats({ handle: "corp-user", prsMergedCount: 32, commitsTotal: 453 }),
      );

      mockCacheGet
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(baseline)
        .mockResolvedValueOnce(supplemental);
      mockFetchStatsData.mockResolvedValue(publicFetch);

      const result = await getStats("test-user", "gho_session_token_no_repo_scope", {
        readOnly: true,
      });

      expect(result!.prsMergedCount).toBe(72);
      expect(mockCacheSet).not.toHaveBeenCalled();
    });

    it("a first fetch with a supplemental writes both keys with their own shapes", async () => {
      const primary = makeStats({ commitsTotal: 50, prsMergedCount: 5 });
      const supplemental = supplementalOf(
        makeStats({ handle: "corp-user", commitsTotal: 30, prsMergedCount: 3 }),
      );

      mockCacheGet
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null) // no baseline (new user)
        .mockResolvedValueOnce(supplemental)
        .mockResolvedValueOnce(null);
      mockFetchStatsData.mockResolvedValue(primary);

      await getStats("test-user");

      expect(mockCacheSet).toHaveBeenCalledWith(
        COMPOSED_KEY,
        expect.objectContaining({ commitsTotal: 80, hasSupplementalData: true }),
        21600,
      );
      expect(mockCacheSet).toHaveBeenCalledWith(
        BASELINE_KEY,
        expect.objectContaining({ commitsTotal: 50 }),
        604800,
      );
    });
  });
});
