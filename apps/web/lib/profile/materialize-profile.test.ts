import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CraftResult } from "@chapa/shared";
import { getTier } from "../impact/utils";
import { makeFullStats, makeSnapshot } from "../test-helpers/fixtures";
import {
  materializeImpactState,
  materializeProfile,
} from "./materialize-profile";

const mockGetStats = vi.fn();
const mockGetCachedCraftScore = vi.fn();
const mockGetCachedLatestSnapshot = vi.fn();
const mockIsStatsDirty = vi.fn();

vi.mock("@/lib/github/client", () => ({
  getStats: (...args: unknown[]) => mockGetStats(...args),
}));

vi.mock("@/lib/cache/craft-cache", () => ({
  getCachedCraftScore: (...args: unknown[]) => mockGetCachedCraftScore(...args),
}));

vi.mock("@/lib/cache/snapshot-cache", () => ({
  getCachedLatestSnapshot: (...args: unknown[]) =>
    mockGetCachedLatestSnapshot(...args),
}));

vi.mock("@/lib/cache/dirty-stats", () => ({
  isStatsDirty: (...args: unknown[]) => mockIsStatsDirty(...args),
}));

function makeCraftResult(
  overrides: Partial<CraftResult> = {},
): CraftResult {
  return {
    tool: "claude-code",
    dimensions: {
      proficiency: 70,
      effectiveness: 65,
      sophistication: 75,
    },
    craftScore: 72,
    tier: "Expert",
    reportPeriod: {
      start: "2026-04-01",
      end: "2026-04-17",
    },
    computedAt: "2026-04-17T10:00:00.000Z",
    ...overrides,
  };
}

describe("materializeImpactState", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("passes through the raw adjusted score when no snapshot exists", () => {
    const stats = makeFullStats();

    const result = materializeImpactState(stats);

    expect(result.displayImpact.adjustedComposite).toBe(
      result.rawImpact.adjustedComposite,
    );
    expect(result.snapshot.adjustedComposite).toBe(
      result.displayImpact.adjustedComposite,
    );
  });

  it("applies EMA and recalculates the tier when the snapshot is from a previous day", () => {
    const stats = makeFullStats();
    const previousDaySnapshot = makeSnapshot({
      date: "2026-04-16",
      adjustedComposite: 95,
    });

    const result = materializeImpactState(stats, {
      latestSnapshot: previousDaySnapshot,
      today: "2026-04-17",
    });

    expect(result.displayImpact.adjustedComposite).not.toBe(
      result.rawImpact.adjustedComposite,
    );
    expect(result.displayImpact.adjustedComposite).toBeLessThan(95);
    expect(result.displayImpact.tier).toBe(
      getTier(result.displayImpact.adjustedComposite),
    );
    expect(result.snapshot.adjustedComposite).toBe(
      result.displayImpact.adjustedComposite,
    );
  });

  it("reuses the same-day snapshot score to prevent the feedback loop", () => {
    const stats = makeFullStats();
    const sameDaySnapshot = makeSnapshot({
      date: "2026-04-17",
      adjustedComposite: 91,
      tier: "Elite",
    });

    const result = materializeImpactState(stats, {
      latestSnapshot: sameDaySnapshot,
      today: "2026-04-17",
    });

    expect(result.displayImpact.adjustedComposite).toBe(91);
    expect(result.displayImpact.tier).toBe("Elite");
    expect(result.rawImpact.adjustedComposite).not.toBe(91);
    expect(result.snapshot.adjustedComposite).toBe(91);
  });

  it("includes craft when a craft result is available", () => {
    const stats = makeFullStats();
    const craftResult = makeCraftResult({ craftScore: 88, tier: "Master" });

    const result = materializeImpactState(stats, { craftResult });

    expect(result.craftResult).toEqual(craftResult);
    expect(result.rawImpact.dimensions.craft).toBe(88);
    expect(result.displayImpact.dimensions.craft).toBe(88);
    expect(result.snapshot.craft).toBe(88);
  });

  it("keeps raw and display impact distinct in explicit-recalculate mode while snapshotting the display score", () => {
    const stats = makeFullStats();
    const previousDaySnapshot = makeSnapshot({
      date: "2026-04-16",
      adjustedComposite: 93,
    });

    const result = materializeImpactState(stats, {
      latestSnapshot: previousDaySnapshot,
      policy: "explicit-recalculate",
      today: "2026-04-17",
    });

    expect(result.rawImpact.adjustedComposite).not.toBe(
      result.displayImpact.adjustedComposite,
    );
    expect(result.snapshot.adjustedComposite).toBe(
      result.displayImpact.adjustedComposite,
    );
  });
});

describe("materializeProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null when stats could not be loaded", async () => {
    mockGetStats.mockResolvedValue(null);
    mockGetCachedCraftScore.mockResolvedValue(null);
    mockGetCachedLatestSnapshot.mockResolvedValue(null);

    const result = await materializeProfile("testuser");

    expect(result).toBeNull();
  });

  it("always reads craft from the cache (no live recomputation on read paths)", async () => {
    const stats = makeFullStats({ handle: "testuser" });
    const craftResult = makeCraftResult();
    const latestSnapshot = makeSnapshot({
      date: "2026-04-16",
      adjustedComposite: 90,
    });

    mockGetStats.mockResolvedValue(stats);
    mockGetCachedCraftScore.mockResolvedValue(craftResult);
    mockGetCachedLatestSnapshot.mockResolvedValue(latestSnapshot);

    const result = await materializeProfile("testuser", {
      token: "oauth-token",
      today: "2026-04-17",
    });

    expect(mockGetStats).toHaveBeenCalledWith("testuser", "oauth-token", {
      readOnly: undefined,
    });
    expect(mockGetCachedCraftScore).toHaveBeenCalledWith("testuser");
    expect(result?.craftResult).toEqual(craftResult);
    // Regression: stored craft must not be mutated by a refresh/read.
    // (No dbRecomputeCraft path exists anymore.)
  });

  it("passes read-only mode to the stats loader", async () => {
    const stats = makeFullStats({ handle: "testuser" });
    mockGetStats.mockResolvedValue(stats);
    mockGetCachedCraftScore.mockResolvedValue(null);
    mockGetCachedLatestSnapshot.mockResolvedValue(null);
    mockIsStatsDirty.mockResolvedValue(false);

    await materializeProfile("testuser", { readOnly: true });

    expect(mockGetStats).toHaveBeenCalledWith("testuser", undefined, {
      readOnly: true,
    });
  });

  it("tolerates craft and snapshot loader failures for public consumers", async () => {
    const stats = makeFullStats({ handle: "testuser" });

    mockGetStats.mockResolvedValue(stats);
    mockGetCachedCraftScore.mockRejectedValue(new Error("craft cache down"));
    mockGetCachedLatestSnapshot.mockRejectedValue(new Error("snapshot cache down"));

    const result = await materializeProfile("testuser");

    expect(result).not.toBeNull();
    expect(result?.craftResult).toBeNull();
    expect(result?.latestSnapshot).toBeNull();
    expect(result?.displayImpact.adjustedComposite).toBe(
      result?.rawImpact.adjustedComposite,
    );
  });

  it("#930: ignoreSnapshot bypasses the same-day EMA lock so fresh score passes through", async () => {
    const stats = makeFullStats({ handle: "testuser" });
    // Simulate the GitLab-timeout scenario: same-day snapshot has adjustedComposite: 0
    const badSameDaySnapshot = makeSnapshot({ date: "2026-04-17", adjustedComposite: 0 });

    mockGetStats.mockResolvedValue(stats);
    mockGetCachedCraftScore.mockResolvedValue(null);
    mockGetCachedLatestSnapshot.mockResolvedValue(badSameDaySnapshot);
    mockIsStatsDirty.mockResolvedValue(false);

    const result = await materializeProfile("testuser", {
      today: "2026-04-17",
      ignoreSnapshot: true,
    });

    expect(result).not.toBeNull();
    // Raw score passes through — same-day lock never consulted.
    expect(result?.displayImpact.adjustedComposite).toBe(result?.rawImpact.adjustedComposite);
    expect(result?.latestSnapshot).toBeNull();
    // Snapshot cache must NOT have been queried (it would have returned the bad zero).
    expect(mockGetCachedLatestSnapshot).not.toHaveBeenCalled();
  });

  it("uses a dirty marker to bypass stale same-day snapshot reuse", async () => {
    const stats = makeFullStats({
      handle: "testuser",
      linkedPlatforms: ["gitlab"],
    });
    const staleSameDaySnapshot = makeSnapshot({
      date: "2026-04-17",
      adjustedComposite: 42,
    });

    mockGetStats.mockResolvedValue(stats);
    mockGetCachedCraftScore.mockResolvedValue(null);
    mockGetCachedLatestSnapshot.mockResolvedValue(staleSameDaySnapshot);
    mockIsStatsDirty.mockResolvedValue(true);

    const expected = materializeImpactState(stats, {
      latestSnapshot: staleSameDaySnapshot,
      today: "2026-04-17",
      inputsChanged: true,
    });

    const result = await materializeProfile("testuser", {
      today: "2026-04-17",
    });

    expect(mockIsStatsDirty).toHaveBeenCalledWith("testuser");
    expect(result?.inputsChanged).toBe(true);
    expect(result?.displayImpact.adjustedComposite).toBe(
      expected.displayImpact.adjustedComposite,
    );
    expect(result?.snapshot.adjustedComposite).toBe(
      result?.displayImpact.adjustedComposite,
    );
  });
});
