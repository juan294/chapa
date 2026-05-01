/**
 * End-to-end craft propagation test (#680).
 *
 * Three v2.7.x bugs shipped because each route was tested in isolation with
 * mocked impact compute. This test wires the real scoring pipeline together
 * for every endpoint that produces a user-visible profile, mocking only at
 * the I/O boundaries (Redis, Supabase, GitHub).
 *
 * What runs for real (no mocks):
 *   - computeImpactV6 (impact scoring)
 *   - computeCraftScore (craft scoring from insights)
 *   - materializeImpactState / materializeProfile (orchestration)
 *   - applyImpactScorePolicy / buildSnapshot (smoothing + snapshot)
 *
 * What is mocked at the boundary:
 *   - getStats (GitHub data fetch)
 *   - getCachedCraftScore (craft cache read)
 *   - getCachedLatestSnapshot (snapshot cache read)
 *   - isStatsDirty (dirty marker)
 *   - dbInsertSnapshot / dbReplaceSnapshot (Supabase writes)
 *   - updateSnapshotCache (Redis write-through)
 *
 * Asserts the invariant: when craft data exists for a handle, it appears in
 * the materialized profile produced by every public-facing endpoint.
 *
 * Coverage matrix (each row is a separate test):
 *   - badge route + share page → materializePublicProfile
 *   - /api/refresh, /api/recalculate, /api/cron/warm-cache,
 *     /api/admin/bulk-recalculate → materializeOrchestratedProfile
 *   - direct call: computeCraftScore → computeImpactV6 (no orchestration)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CraftResult, InsightsUpload, StatsData } from "@chapa/shared";
import { computeCraftScore } from "@/lib/insights/scoring";
import { computeImpactV6 } from "@/lib/impact/v6";
import { makeFullStats } from "@/lib/test-helpers/fixtures";

// Hoisted boundary mocks. Real scoring code lives below; only I/O is faked.
const {
  mockGetStats,
  mockGetCachedCraftScore,
  mockGetCachedLatestSnapshot,
  mockIsStatsDirty,
  mockDbInsertSnapshot,
  mockDbReplaceSnapshot,
  mockUpdateSnapshotCache,
} = vi.hoisted(() => ({
  mockGetStats: vi.fn(),
  mockGetCachedCraftScore: vi.fn(),
  mockGetCachedLatestSnapshot: vi.fn(),
  mockIsStatsDirty: vi.fn(),
  mockDbInsertSnapshot: vi.fn(),
  mockDbReplaceSnapshot: vi.fn(),
  mockUpdateSnapshotCache: vi.fn(),
}));

vi.mock("@/lib/github/client", () => ({
  getStats: (...args: unknown[]) => mockGetStats(...args),
}));

vi.mock("@/lib/cache/craft-cache", () => ({
  getCachedCraftScore: (...args: unknown[]) => mockGetCachedCraftScore(...args),
  updateCraftCache: vi.fn(async () => undefined),
}));

vi.mock("@/lib/cache/snapshot-cache", () => ({
  getCachedLatestSnapshot: (...args: unknown[]) =>
    mockGetCachedLatestSnapshot(...args),
  updateSnapshotCache: (...args: unknown[]) => mockUpdateSnapshotCache(...args),
}));

vi.mock("@/lib/cache/dirty-stats", () => ({
  isStatsDirty: (...args: unknown[]) => mockIsStatsDirty(...args),
  clearStatsDirty: vi.fn(async () => undefined),
}));

vi.mock("@/lib/db/snapshots", () => ({
  dbInsertSnapshot: (...args: unknown[]) => mockDbInsertSnapshot(...args),
  dbReplaceSnapshot: (...args: unknown[]) => mockDbReplaceSnapshot(...args),
}));

// Imports below MUST come after vi.mock calls so the mocks are wired in.
import {
  materializeOrchestratedProfile,
  persistOrchestratedSnapshot,
} from "./orchestrated-profile";
import { materializePublicProfile } from "./public-profile";
import { materializeProfile } from "./materialize-profile";

// ---------------------------------------------------------------------------
// Fixtures: realistic insights and stats so the real scoring formulas produce
// non-trivial outputs. Numbers are chosen to land craft squarely in mid-range
// so threshold drift in the formulas does not flake the test.
// ---------------------------------------------------------------------------

function makeInsights(overrides: Partial<InsightsUpload> = {}): InsightsUpload {
  return {
    tool: "claude-code",
    reportPeriod: { start: "2026-04-01", end: "2026-04-30" },
    volume: {
      messages: 1200,
      linesAdded: 18000,
      linesDeleted: 4000,
      files: 320,
      days: 22,
      msgsPerDay: 54,
    },
    toolUsage: { Read: 800, Edit: 600, Bash: 200, Glob: 100, Grep: 50 },
    sessionTypes: {
      complex: 12,
      "feature-development": 18,
      "bug-fix": 8,
      exploration: 5,
    },
    outcomes: {
      fullyAchieved: 30,
      mostlyAchieved: 10,
      partiallyAchieved: 3,
    },
    friction: {
      buggyCode: 5,
      wrongApproach: 2,
      misunderstoodRequest: 3,
    },
    satisfaction: {
      dissatisfied: 1,
      likelySatisfied: 8,
      satisfied: 32,
    },
    multiClauding: {
      overlapEvents: 18,
      sessionsInvolved: 15,
      messagePercent: 22,
    },
    responseTime: { medianSeconds: 2.4, averageSeconds: 4.0 },
    toolErrors: { Edit: 2, Bash: 1 },
    totalSessions: 43,
    totalToolCalls: 2200,
    ...overrides,
  };
}

function makeStatsForHandle(handle: string): StatsData {
  return makeFullStats({
    handle,
    commitsTotal: 220,
    activeDays: 180,
    prsMergedCount: 35,
    prsMergedWeight: 70,
    reviewsSubmittedCount: 25,
    reposContributed: 6,
  });
}

function craftFromInsights(): CraftResult {
  return computeCraftScore(makeInsights());
}

// ---------------------------------------------------------------------------
// Setup: every test runs with the same fixed system time and clean mocks.
// Default: a handle named "alice" with insights AND stats. Individual tests
// override mock returns as needed.
// ---------------------------------------------------------------------------

describe("end-to-end craft propagation through every impact-computing endpoint (#680)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-01T12:00:00.000Z"));
    vi.clearAllMocks();

    // Default I/O behavior — happy path with insights cached and no stale snapshot.
    mockGetStats.mockImplementation(async (handle: string) =>
      makeStatsForHandle(handle),
    );
    mockGetCachedCraftScore.mockResolvedValue(craftFromInsights());
    mockGetCachedLatestSnapshot.mockResolvedValue(null);
    mockIsStatsDirty.mockResolvedValue(false);
    mockDbInsertSnapshot.mockResolvedValue(true);
    mockDbReplaceSnapshot.mockResolvedValue(true);
    mockUpdateSnapshotCache.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // 1. Direct pipeline: computeCraftScore → computeImpactV6 produces a craft
  //    dimension. Sanity check that anchors all subsequent expectations.
  // -------------------------------------------------------------------------
  it("computeCraftScore feeds a non-null craft dimension into computeImpactV6", () => {
    const stats = makeStatsForHandle("alice");
    const craft = computeCraftScore(makeInsights());

    const withCraft = computeImpactV6(stats, craft.craftScore);
    const withoutCraft = computeImpactV6(stats);

    expect(craft.craftScore).toBeGreaterThan(0);
    expect(craft.craftScore).toBeLessThanOrEqual(100);
    expect(withCraft.dimensions.craft).toBe(craft.craftScore);
    expect(withoutCraft.dimensions.craft).toBeUndefined();
    // Composite should differ (craft contributes to the average).
    expect(withCraft.compositeScore).not.toBe(withoutCraft.compositeScore);
  });

  // -------------------------------------------------------------------------
  // 2. materializeProfile (the shared chokepoint). Every public-facing
  //    endpoint goes through this — refresh, recalculate, warm-cache,
  //    bulk-recalculate, badge.svg, and /u/[handle]. If craft propagates
  //    here, all six endpoints inherit the behavior.
  // -------------------------------------------------------------------------
  it("materializeProfile attaches craft from the cache to every materialized output", async () => {
    const result = await materializeProfile("alice");

    expect(result).not.toBeNull();
    const expectedCraft = craftFromInsights().craftScore;
    expect(result!.craftResult?.craftScore).toBe(expectedCraft);
    expect(result!.rawImpact.dimensions.craft).toBe(expectedCraft);
    expect(result!.displayImpact.dimensions.craft).toBe(expectedCraft);
    expect(result!.snapshot.craft).toBe(expectedCraft);
  });

  it("materializeProfile drops craft when no insights exist for the handle", async () => {
    mockGetCachedCraftScore.mockResolvedValueOnce(null);

    const result = await materializeProfile("anon");

    expect(result).not.toBeNull();
    expect(result!.craftResult).toBeNull();
    expect(result!.rawImpact.dimensions.craft).toBeUndefined();
    expect(result!.displayImpact.dimensions.craft).toBeUndefined();
    expect(result!.snapshot.craft).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // 3. Public read paths — badge.svg + share page → materializePublicProfile.
  // -------------------------------------------------------------------------
  it("materializePublicProfile (badge.svg + share page) produces craft", async () => {
    const result = await materializePublicProfile("alice");

    expect(result).not.toBeNull();
    expect(result!.craftResult?.craftScore).toBe(
      craftFromInsights().craftScore,
    );
    expect(result!.displayImpact.dimensions.craft).toBe(
      craftFromInsights().craftScore,
    );
  });

  // -------------------------------------------------------------------------
  // 4. Write paths — refresh, recalculate, warm-cache, bulk-recalculate all
  //    go through materializeOrchestratedProfile. Verify craft survives
  //    through to the persisted snapshot.
  // -------------------------------------------------------------------------
  it("materializeOrchestratedProfile (refresh/recalculate/warm/bulk) produces craft and persists it", async () => {
    const materialized = await materializeOrchestratedProfile("alice", {
      token: "oauth-token",
    });

    expect(materialized).not.toBeNull();
    expect(materialized!.craftResult?.craftScore).toBe(
      craftFromInsights().craftScore,
    );
    expect(materialized!.displayImpact.dimensions.craft).toBe(
      craftFromInsights().craftScore,
    );
    expect(materialized!.snapshot.craft).toBe(craftFromInsights().craftScore);

    // Persistence path (refresh/recalculate use mode: replace).
    const persistedReplace = await persistOrchestratedSnapshot(
      "alice",
      materialized!,
      { mode: "replace" },
    );
    expect(persistedReplace).toBe(true);
    expect(mockDbReplaceSnapshot).toHaveBeenCalledTimes(1);
    const replaceArgs = mockDbReplaceSnapshot.mock.calls[0];
    expect(replaceArgs).toBeDefined();
    expect(replaceArgs![1].craft).toBe(craftFromInsights().craftScore);

    // Persistence path (warm-cache uses mode: insert).
    const persistedInsert = await persistOrchestratedSnapshot(
      "alice",
      materialized!,
      { mode: "insert" },
    );
    expect(persistedInsert).toBe(true);
    expect(mockDbInsertSnapshot).toHaveBeenCalledTimes(1);
    const insertArgs = mockDbInsertSnapshot.mock.calls[0];
    expect(insertArgs).toBeDefined();
    expect(insertArgs![1].craft).toBe(craftFromInsights().craftScore);
  });

  // -------------------------------------------------------------------------
  // 5. v2.7.1 regression: formula changes must show up against stored raw
  //    data. computeCraftScore is pure — given the same insights, recomputing
  //    after a formula change yields a different score. The test below
  //    simulates this by computing craft with two different InsightsUpload
  //    shapes and asserting they produce different craft scores when scored
  //    through the *real* pipeline.
  // -------------------------------------------------------------------------
  it("changes to insights data flow through to a different impact score (no cached-craft staleness)", async () => {
    const baseInsights = makeInsights();
    const noisyInsights = makeInsights({
      friction: { buggyCode: 30, wrongApproach: 25, misunderstoodRequest: 20 },
      outcomes: {
        fullyAchieved: 5,
        mostlyAchieved: 5,
        partiallyAchieved: 30,
      },
    });

    const baseCraft = computeCraftScore(baseInsights);
    const noisyCraft = computeCraftScore(noisyInsights);

    // Sanity: the two insights shapes produce materially different craft.
    expect(noisyCraft.craftScore).toBeLessThan(baseCraft.craftScore);

    const stats = makeStatsForHandle("alice");
    const baseImpact = computeImpactV6(stats, baseCraft.craftScore);
    const noisyImpact = computeImpactV6(stats, noisyCraft.craftScore);

    expect(baseImpact.dimensions.craft).toBe(baseCraft.craftScore);
    expect(noisyImpact.dimensions.craft).toBe(noisyCraft.craftScore);
    expect(baseImpact.compositeScore).not.toBe(noisyImpact.compositeScore);
  });

  // -------------------------------------------------------------------------
  // 6. v2.7.2 regression contract: explicitly assert the bug shape.
  //    The bug was: an endpoint called computeImpactV6(stats) without craft,
  //    so the result lacked a craft dimension despite cached craft existing.
  //    materializeProfile must always include craft when getCachedCraftScore
  //    returns a value — regardless of which endpoint is calling it.
  // -------------------------------------------------------------------------
  it("v2.7.2 contract: every endpoint produces a craft dimension when craft is cached", async () => {
    // Enumerate the entrypoints used by the seven impact-computing routes.
    // The set is intentionally small — all seven endpoints converge on these
    // two functions, so covering them covers the whole route surface.
    const entrypoints: Array<{
      label: string;
      run: () => Promise<{ craft?: number } | null>;
    }> = [
      {
        label: "materializePublicProfile (badge.svg + /u/[handle])",
        run: async () => {
          const r = await materializePublicProfile("alice");
          return r ? { craft: r.displayImpact.dimensions.craft } : null;
        },
      },
      {
        label: "materializeOrchestratedProfile (refresh + recalculate + warm-cache + bulk-recalculate)",
        run: async () => {
          const r = await materializeOrchestratedProfile("alice");
          return r ? { craft: r.displayImpact.dimensions.craft } : null;
        },
      },
    ];

    const expected = craftFromInsights().craftScore;
    for (const ep of entrypoints) {
      const result = await ep.run();
      expect(result, `${ep.label} returned null`).not.toBeNull();
      expect(
        result!.craft,
        `${ep.label} dropped craft despite cached insights — this is the v2.7.2 bug shape`,
      ).toBe(expected);
    }
  });
});
