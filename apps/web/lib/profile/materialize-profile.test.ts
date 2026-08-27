import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CraftResult } from "@chapa/shared";
import { getTier } from "../impact/utils";
import { makeFullStats, makeSnapshot } from "../test-helpers/fixtures";
import {
  materializeDisplayProfile,
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

  it("#1001: keeps the display headline fresh but applies EMA to the persisted snapshot when the snapshot is from a previous day", () => {
    const stats = makeFullStats();
    const previousDaySnapshot = makeSnapshot({
      date: "2026-04-16",
      adjustedComposite: 95,
    });

    const result = materializeImpactState(stats, {
      latestSnapshot: previousDaySnapshot,
      today: "2026-04-17",
    });

    // Headline is always the fresh score, consistent with the dimensions.
    expect(result.displayImpact.adjustedComposite).toBe(
      result.rawImpact.adjustedComposite,
    );
    // EMA smoothing is retained only for the persisted trend snapshot, and it
    // genuinely differs from the fresh headline (EMA pulls toward yesterday's 95).
    expect(result.snapshot.adjustedComposite).not.toBe(
      result.rawImpact.adjustedComposite,
    );
    expect(result.snapshot.tier).toBe(
      getTier(result.snapshot.adjustedComposite),
    );
  });

  it("#1001: keeps the display headline fresh while the same-day lock still governs the persisted snapshot", () => {
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

    // Headline reflects today's fresh computation, not the locked snapshot.
    expect(result.displayImpact.adjustedComposite).toBe(
      result.rawImpact.adjustedComposite,
    );
    expect(result.displayImpact.adjustedComposite).not.toBe(91);
    // The same-day feedback-loop lock still preserves the smoothed value in
    // the trend snapshot (prevents the stored series from spiralling).
    expect(result.snapshot.adjustedComposite).toBe(91);
    expect(result.snapshot.tier).toBe("Elite");
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

  it("#1001: keeps the display headline fresh in explicit-recalculate mode while the snapshot carries the smoothed score", () => {
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

    // Headline is the fresh score; smoothing only touches the trend snapshot.
    expect(result.displayImpact.adjustedComposite).toBe(
      result.rawImpact.adjustedComposite,
    );
    expect(result.snapshot.adjustedComposite).not.toBe(
      result.displayImpact.adjustedComposite,
    );
  });

  it("#1001: never applies score smoothing to the display headline — it is the raw impact object", () => {
    const stats = makeFullStats();
    const priorDay = makeSnapshot({ date: "2026-04-16", adjustedComposite: 95 });

    const result = materializeImpactState(stats, {
      latestSnapshot: priorDay,
      today: "2026-04-17",
    });

    // Object identity: no policy transform is applied to the display headline.
    expect(result.displayImpact).toBe(result.rawImpact);
    // The persisted snapshot still carries a distinct, EMA-smoothed value.
    expect(result.snapshot.adjustedComposite).not.toBe(
      result.rawImpact.adjustedComposite,
    );
  });
});

describe("statsComplete (#1003 persist-boundary integrity gate)", () => {
  it("is true when prsMergedCount is greater than zero", () => {
    const stats = makeFullStats({ prsMergedCount: 5, commitsTotal: 50 });

    const result = materializeImpactState(stats);

    expect(result.statsComplete).toBe(true);
  });

  it("is true for a genuine new/empty account (0 PRs, 0 commits, 0 issues)", () => {
    const stats = makeFullStats({
      prsMergedCount: 0,
      commitsTotal: 0,
      issuesClosedCount: 0,
    });

    const result = materializeImpactState(stats);

    expect(result.statsComplete).toBe(true);
  });

  it("is false for the corrupt shape: 0 PRs but real commit activity", () => {
    const stats = makeFullStats({
      prsMergedCount: 0,
      commitsTotal: 15585,
      issuesClosedCount: 0,
    });

    const result = materializeImpactState(stats);

    expect(result.statsComplete).toBe(false);
  });

  it("is false for the corrupt shape: 0 PRs but real issue activity", () => {
    const stats = makeFullStats({
      prsMergedCount: 0,
      commitsTotal: 0,
      issuesClosedCount: 5104,
    });

    const result = materializeImpactState(stats);

    expect(result.statsComplete).toBe(false);
  });

  it("is false for the #1049 scope-blinded shape: positive count, collapsed sample", () => {
    // The exact juan294 2026-07-14 payload that DID persist and poison three
    // snapshot rows: prsMergedCount 140 sails past the zero-check, while the
    // fields Delivery actually scores on (weight is 70% of it) collapsed.
    const stats = makeFullStats({
      prsMergedCount: 140,
      prsMergedWeight: 3.37828,
      linesAdded: 59,
      linesDeleted: 10,
      commitsTotal: 16292,
      issuesClosedCount: 5208,
    });

    const result = materializeImpactState(stats);

    expect(result.statsComplete).toBe(false);
  });

  it("stays true for a prolific user whose weight sits at the aggregation cap", () => {
    // The healthy juan294 07-13 shape — must never be gated.
    const stats = makeFullStats({
      prsMergedCount: 953,
      prsMergedWeight: 120,
      linesAdded: 101313,
      linesDeleted: 54996,
      commitsTotal: 16187,
      issuesClosedCount: 608,
    });

    const result = materializeImpactState(stats);

    expect(result.statsComplete).toBe(true);
  });
});

describe("materializeDisplayProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads a live owner profile without trend-state reads", async () => {
    const stats = makeFullStats({ handle: "testuser" });
    const craftResult = makeCraftResult({ craftScore: 88 });
    mockGetStats.mockResolvedValue(stats);
    mockGetCachedCraftScore.mockResolvedValue(craftResult);

    const result = await materializeDisplayProfile("testuser", {
      token: "oauth-token",
    });

    expect(mockGetStats).toHaveBeenCalledWith("testuser", "oauth-token", {
      readOnly: false,
    });
    expect(mockGetCachedCraftScore).toHaveBeenCalledWith("testuser");
    expect(mockGetCachedLatestSnapshot).not.toHaveBeenCalled();
    expect(mockIsStatsDirty).not.toHaveBeenCalled();
    expect(result?.displayImpact).toBe(result?.rawImpact);
    expect(result?.displayImpact.dimensions.craft).toBe(88);
    expect(result?.statsComplete).toBe(true);
    expect(result).not.toHaveProperty("snapshot");
    expect(result).not.toHaveProperty("latestSnapshot");
  });

  it("preserves the completeness gate for poisoned stats", async () => {
    mockGetStats.mockResolvedValue(
      makeFullStats({
        handle: "testuser",
        prsMergedCount: 0,
        commitsTotal: 15585,
        issuesClosedCount: 0,
      }),
    );
    mockGetCachedCraftScore.mockResolvedValue(null);

    const result = await materializeDisplayProfile("testuser");

    expect(result?.statsComplete).toBe(false);
  });

  it("returns null instead of fabricating stats when the live load fails", async () => {
    mockGetStats.mockResolvedValue(null);
    mockGetCachedCraftScore.mockResolvedValue(null);

    const result = await materializeDisplayProfile("testuser");

    expect(result).toBeNull();
  });

  // #1180 (PE-L2) — `/api/profile/[handle]` calls `getCachedLatestSnapshot`
  // itself, then separately needed just the fresh `displayImpact` headline
  // (#1062). Routing that lookup through `materializeProfile` (via
  // `materializePublicProfile`) performed a SECOND, identical
  // `getCachedLatestSnapshot` read whose result (`latestSnapshot`) only ever
  // feeds the persisted trend `snapshot` — never `displayImpact`, which is
  // always the fresh `rawImpact` (#1001). `materializeDisplayProfile` already
  // skips that lookup entirely (see the "no trend-state reads" test above);
  // it only needed a `readOnly` passthrough to be safe for a public,
  // unauthenticated, CORS-enabled endpoint (#1083 — never a live GitHub
  // fetch on a cold key from a read-only caller).
  it("passes readOnly through to getStats for a public read-only caller (#1180 PE-L2)", async () => {
    const stats = makeFullStats({ handle: "testuser" });
    mockGetStats.mockResolvedValue(stats);
    mockGetCachedCraftScore.mockResolvedValue(null);

    const result = await materializeDisplayProfile("testuser", {
      readOnly: true,
    });

    expect(mockGetStats).toHaveBeenCalledWith("testuser", undefined, {
      readOnly: true,
    });
    expect(mockGetCachedLatestSnapshot).not.toHaveBeenCalled();
    expect(mockIsStatsDirty).not.toHaveBeenCalled();
    expect(result?.displayImpact).toBe(result?.rawImpact);
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
    // The dirty marker (inputsChanged) still governs the persisted snapshot's
    // smoothing via the same-day-lock bypass — match the snapshot, not display.
    expect(result?.snapshot.adjustedComposite).toBe(
      expected.snapshot.adjustedComposite,
    );
  });
});
