import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CraftResult } from "@chapa/shared";
import { makeFullStats } from "../test-helpers/fixtures";
import {
  materializeDisplayProfile,
  materializeProfile,
} from "./materialize-profile";
import { githubUserNotFound, isGitHubUserNotFound } from "@/lib/github/not-found";
import { expectFound } from "@/lib/test-helpers/found";

const mockReadStats = vi.fn();
const mockGetCachedCraftScore = vi.fn();
const mockReadRenderableReceipt = vi.fn();
const mockScoreModelFrom = vi.fn();

vi.mock("@/lib/github/client", () => ({
  readStats: (...args: unknown[]) => mockReadStats(...args),
}));

vi.mock("@/lib/cache/craft-cache", () => ({
  getCachedCraftScore: (...args: unknown[]) => mockGetCachedCraftScore(...args),
}));

vi.mock("./score-model", () => ({
  readRenderableReceipt: (...args: unknown[]) => mockReadRenderableReceipt(...args),
  scoreModelFrom: (...args: unknown[]) => mockScoreModelFrom(...args),
}));

/** `loadDisplayInputs` reads `readStats`'s detailed result, not the collapsed
 * `getStats` shape. */
function current(stats: import("@chapa/shared").StatsData, capturedAt = "2026-04-17T12:00:00.000Z") {
  return { status: "current" as const, stats, capturedAt };
}
function stale(stats: import("@chapa/shared").StatsData, capturedAt = "2026-04-17T06:00:00.000Z") {
  return { status: "stale" as const, stats, capturedAt };
}
function unavailable() {
  return { status: "unavailable" as const };
}
function notFound(value: ReturnType<typeof githubUserNotFound>) {
  return { status: "not_found" as const, value };
}

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

const SOME_SCORING = { policyVersion: "v7.2" as const, handle: "testuser" };

beforeEach(() => {
  vi.clearAllMocks();
  mockReadRenderableReceipt.mockResolvedValue(null);
  mockScoreModelFrom.mockReturnValue(SOME_SCORING);
});

describe("statsComplete (#1003 persist-boundary integrity gate)", () => {
  async function materialize(overrides: Partial<ReturnType<typeof makeFullStats>>) {
    mockReadStats.mockResolvedValue(current(makeFullStats(overrides)));
    mockGetCachedCraftScore.mockResolvedValue(null);
    return expectFound(await materializeProfile("testuser"));
  }

  it.each(["2026-02-30", "2026-04-31"])("blocks persistence of an impossible heatmap date: %s", async date => {
    expect((await materialize({ heatmapData: [{ date, count: 0 }] })).statsComplete).toBe(false);
  });

  it("blocks persistence of an impossible fetched timestamp", async () => {
    expect((await materialize({ fetchedAt: "2026-02-30T12:00:00Z" })).statsComplete).toBe(false);
  });

  it("retains the persistence gate for structurally malformed legacy stats", async () => {
    expect((await materialize({ fetchedAt: "invalid" })).statsComplete).toBe(false);
  });

  it("is true when prsMergedCount is greater than zero", async () => {
    expect((await materialize({ prsMergedCount: 5, commitsTotal: 50 })).statsComplete).toBe(true);
  });

  it("is true for a genuine new/empty account (0 PRs, 0 commits, 0 issues)", async () => {
    expect((await materialize({ prsMergedCount: 0, commitsTotal: 0, issuesClosedCount: 0 })).statsComplete).toBe(true);
  });

  it("accepts measured zero with 0 PRs but real commit activity", async () => {
    expect((await materialize({ prsMergedCount: 0, commitsTotal: 15585, issuesClosedCount: 0 })).statsComplete).toBe(true);
  });

  it("accepts measured zero with 0 PRs but real issue activity", async () => {
    expect((await materialize({ prsMergedCount: 0, commitsTotal: 0, issuesClosedCount: 5104 })).statsComplete).toBe(true);
  });

  it("accepts positive counts with small samples without inferring corruption", async () => {
    expect((await materialize({ prsMergedCount: 140, prsMergedWeight: 3.37828, linesAdded: 59, linesDeleted: 10, commitsTotal: 16292, issuesClosedCount: 5208 })).statsComplete).toBe(true);
  });

  it("stays true for a prolific user whose weight sits at the aggregation cap", async () => {
    // The healthy juan294 07-13 shape — must never be gated.
    expect((await materialize({ prsMergedCount: 953, prsMergedWeight: 120, linesAdded: 101313, linesDeleted: 54996, commitsTotal: 16187, issuesClosedCount: 608 })).statsComplete).toBe(true);
  });
});

describe("materializeDisplayProfile", () => {
  it("loads a live owner profile with the current receipt-based scoring model", async () => {
    const stats = makeFullStats({ handle: "testuser" });
    const craftResult = makeCraftResult({ craftScore: 88 });
    mockReadStats.mockResolvedValue(current(stats));
    mockGetCachedCraftScore.mockResolvedValue(craftResult);
    mockReadRenderableReceipt.mockResolvedValue({ receipt: "envelope" });
    mockScoreModelFrom.mockReturnValue(SOME_SCORING);

    const result = await materializeDisplayProfile("testuser", {
      token: "oauth-token",
    });

    expect(mockReadStats).toHaveBeenCalledWith("testuser", "oauth-token", {
      readOnly: false,
    });
    expect(mockGetCachedCraftScore).toHaveBeenCalledWith("testuser");
    expect(mockReadRenderableReceipt).toHaveBeenCalledWith("testuser");
    expect(result?.craftResult).toEqual(craftResult);
    expect(result?.statsComplete).toBe(true);
    expect(result?.scoring).toBe(SOME_SCORING);
    expect(result).not.toHaveProperty("rawImpact");
    expect(result).not.toHaveProperty("displayImpact");
    expect(result).not.toHaveProperty("snapshot");
    expect(result).not.toHaveProperty("latestSnapshot");
  });

  it("accepts structurally valid zero-PR stats", async () => {
    mockReadStats.mockResolvedValue(
      current(
        makeFullStats({
          handle: "testuser",
          prsMergedCount: 0,
          commitsTotal: 15585,
          issuesClosedCount: 0,
        }),
      ),
    );
    mockGetCachedCraftScore.mockResolvedValue(null);

    const result = await materializeDisplayProfile("testuser");

    expect(result?.statsComplete).toBe(true);
  });

  it("returns null instead of fabricating stats when the live load fails", async () => {
    mockReadStats.mockResolvedValue(unavailable());
    mockGetCachedCraftScore.mockResolvedValue(null);

    const result = await materializeDisplayProfile("testuser");

    expect(result).toBeNull();
  });

  it("passes readOnly through to readStats for a public read-only caller (#1180 PE-L2)", async () => {
    const stats = makeFullStats({ handle: "testuser" });
    mockReadStats.mockResolvedValue(current(stats));
    mockGetCachedCraftScore.mockResolvedValue(null);

    const result = await materializeDisplayProfile("testuser", {
      readOnly: true,
    });

    expect(mockReadStats).toHaveBeenCalledWith("testuser", undefined, {
      readOnly: true,
    });
    expect(result?.scoring).toBe(SOME_SCORING);
  });
});

describe("materializeProfile", () => {
  it("returns null when stats could not be loaded", async () => {
    mockReadStats.mockResolvedValue(unavailable());
    mockGetCachedCraftScore.mockResolvedValue(null);

    expect(await materializeProfile("testuser")).toBeNull();
  });

  it("always reads craft from the cache (no live recomputation on read paths)", async () => {
    const stats = makeFullStats({ handle: "testuser" });
    const craftResult = makeCraftResult();

    mockReadStats.mockResolvedValue(current(stats));
    mockGetCachedCraftScore.mockResolvedValue(craftResult);

    const result = expectFound(await materializeProfile("testuser", {
      token: "oauth-token",
    }));

    expect(mockReadStats).toHaveBeenCalledWith("testuser", "oauth-token", {
      readOnly: undefined,
    });
    expect(mockGetCachedCraftScore).toHaveBeenCalledWith("testuser");
    expect(result?.craftResult).toEqual(craftResult);
  });

  it("passes read-only mode to the stats loader", async () => {
    const stats = makeFullStats({ handle: "testuser" });
    mockReadStats.mockResolvedValue(current(stats));
    mockGetCachedCraftScore.mockResolvedValue(null);

    await materializeProfile("testuser", { readOnly: true });

    expect(mockReadStats).toHaveBeenCalledWith("testuser", undefined, {
      readOnly: true,
    });
  });

  it("tolerates a craft loader failure for public consumers", async () => {
    const stats = makeFullStats({ handle: "testuser" });

    mockReadStats.mockResolvedValue(current(stats));
    mockGetCachedCraftScore.mockRejectedValue(new Error("craft cache down"));

    const result = expectFound(await materializeProfile("testuser"));

    expect(result).not.toBeNull();
    expect(result?.craftResult).toBeNull();
  });

  it("resolves the scoring model from the same receipt read materializeDisplayProfile uses", async () => {
    const stats = makeFullStats({ handle: "testuser" });
    mockReadStats.mockResolvedValue(current(stats));
    mockGetCachedCraftScore.mockResolvedValue(null);
    const receipt = { receipt: "envelope" };
    mockReadRenderableReceipt.mockResolvedValue(receipt);
    mockScoreModelFrom.mockReturnValue(SOME_SCORING);

    const result = expectFound(await materializeProfile("testuser"));

    expect(mockReadRenderableReceipt).toHaveBeenCalledWith("testuser");
    expect(mockScoreModelFrom).toHaveBeenCalledWith("testuser", receipt);
    expect(result?.scoring).toBe(SOME_SCORING);
  });

  it("carries scoring as undefined when the receipt authority read fails or finds nothing", async () => {
    const stats = makeFullStats({ handle: "testuser" });
    mockReadStats.mockResolvedValue(current(stats));
    mockGetCachedCraftScore.mockResolvedValue(null);
    mockReadRenderableReceipt.mockResolvedValue(null);
    mockScoreModelFrom.mockReturnValue(undefined);

    const result = expectFound(await materializeProfile("testuser"));

    expect(result?.scoring).toBeUndefined();
  });
});

// LE-8-2 — the stats loader distinguishes "GitHub says nobody owns this
// handle" from "could not load". The public materializer must carry that
// through rather than fold it into the same null an outage produces.
describe("a handle GitHub does not know (LE-8-2)", () => {
  beforeEach(() => {
    mockReadStats.mockResolvedValue(notFound(githubUserNotFound("ghost")));
    mockGetCachedCraftScore.mockResolvedValue(null);
  });

  it("materializeProfile returns the sentinel, not null", async () => {
    expect(isGitHubUserNotFound(await materializeProfile("ghost"))).toBe(true);
  });

  it("materializeProfile still returns null when stats are merely unavailable", async () => {
    mockReadStats.mockResolvedValue(unavailable());

    expect(await materializeProfile("ghost")).toBeNull();
  });

  it("materializeDisplayProfile keeps its null contract for the owner and read-only callers", async () => {
    expect(await materializeDisplayProfile("ghost", { readOnly: true })).toBeNull();
  });
});

// badge-source-outage-resilience (2026-09-22) — a `readStats` "stale" result
// (an exact-bound last-known-good aggregate served after a live
// refresh/collection failure, e.g. an ambiguous Bitbucket token-refresh claim)
// is structurally renderable but must never look publication-eligible. See
// `apps/web/lib/github/client.ts`'s `readStats` and
// `apps/web/lib/cache/stats-cache.ts`.
describe("stale last-known-good materialization (badge-source-outage-resilience)", () => {
  beforeEach(() => {
    mockGetCachedCraftScore.mockResolvedValue(null);
  });

  it("materializeProfile renders a stale aggregate but marks it structurally incomplete", async () => {
    const stats = makeFullStats({ handle: "testuser", prsMergedCount: 12, commitsTotal: 80 });
    mockReadStats.mockResolvedValue(stale(stats));

    const result = expectFound(await materializeProfile("testuser"));

    // Never publication-eligible, however healthy the underlying counts look.
    expect(result.statsFreshness).toBe("stale");
    expect(result.statsCapturedAt).toBe("2026-04-17T06:00:00.000Z");
    expect(result.statsComplete).toBe(false);
  });

  it("materializeDisplayProfile carries the same stale/incomplete contract", async () => {
    const stats = makeFullStats({ handle: "testuser", prsMergedCount: 3 });
    mockReadStats.mockResolvedValue(stale(stats));

    const result = await materializeDisplayProfile("testuser");

    expect(result).not.toBeNull();
    expect(result?.statsFreshness).toBe("stale");
    expect(result?.statsComplete).toBe(false);
  });

  it("a fresh (current) aggregate remains publication-eligible, unlike a stale one for the same handle", async () => {
    const stats = makeFullStats({ handle: "testuser", prsMergedCount: 3 });
    mockReadStats.mockResolvedValue(current(stats));

    const result = expectFound(await materializeProfile("testuser"));

    expect(result.statsFreshness).toBe("current");
    expect(result.statsComplete).toBe(true);
  });

  it("no trusted aggregate at all remains unavailable/null, never a fabricated stale render", async () => {
    mockReadStats.mockResolvedValue(unavailable());

    expect(await materializeProfile("testuser")).toBeNull();
  });
});
