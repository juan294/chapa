import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ImpactV6Result } from "@chapa/shared";
import { legacyViewModel } from "./score-view-model";

vi.mock("@/lib/db/snapshots", () => ({
  dbGetTopScoredProfiles: vi.fn(),
  dbGetScoredCandidates: vi.fn(),
}));
vi.mock("@/lib/db/users", () => ({ dbGetAllUserHandles: vi.fn() }));
vi.mock("./materialize-profile", () => ({ materializeDisplayProfile: vi.fn() }));

import { getLeaderboard } from "./leaderboard";
import { dbGetScoredCandidates, dbGetTopScoredProfiles } from "@/lib/db/snapshots";
import { dbGetAllUserHandles } from "@/lib/db/users";
import { materializeDisplayProfile } from "./materialize-profile";

const mockRecorded = vi.mocked(dbGetTopScoredProfiles);
const mockCandidates = vi.mocked(dbGetScoredCandidates);
const mockRegistered = vi.mocked(dbGetAllUserHandles);
const mockMaterialize = vi.mocked(materializeDisplayProfile);

function entry(handle: string, score: number, tier = "High") {
  return { handle, score, tier, rank: 0 };
}

/** A materialized profile as the board actually receives one: carrying the
 *  resolved score model the badge draws, not just the v6 aggregate (#1311). */
function live(adjustedComposite: number, tier = "High", handle = "someone") {
  const displayImpact = {
    handle, adjustedComposite, tier,
    // `legacyViewModel` projects all four dimensions, so a fixture without
    // them throws inside the materialize mock — where the loop's catch would
    // silently treat every candidate as unfetchable.
    dimensions: { delivery: 0, quality: 0, consistency: 0, breadth: 0 },
    archetype: "Builder", compositeScore: adjustedComposite,
  } as unknown as ImpactV6Result;
  return { displayImpact, scoring: legacyViewModel(displayImpact) } as unknown as Awaited<
    ReturnType<typeof materializeDisplayProfile>
  >;
}

describe("getLeaderboard", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockRegistered.mockResolvedValue(["a", "b", "c", "d", "juan294"]);
    mockRecorded.mockResolvedValue([]);
    mockCandidates.mockResolvedValue([]);
  });

  // A place is a score. Everyone on 80 shares first, and the next score is
  // second, not third.
  it("groups tied scores into one place and does not skip the next", async () => {
    mockRecorded.mockResolvedValue([
      entry("w-winter", 80),
      entry("juan294", 80),
      entry("nicholaivogel", 78),
      entry("lukiod", 75),
    ]);

    const board = await getLeaderboard(3);

    expect(board).toEqual([
      { rank: 1, score: 80, tier: "High", handles: ["juan294", "w-winter"] },
      { rank: 2, score: 78, tier: "High", handles: ["nicholaivogel"] },
      { rank: 3, score: 75, tier: "High", handles: ["lukiod"] },
    ]);
    expect(mockMaterialize).not.toHaveBeenCalled();
  });

  it("returns the requested number of places, not of handles", async () => {
    mockRecorded.mockResolvedValue([entry("a", 90), entry("b", 90), entry("c", 80), entry("d", 70)]);

    const board = await getLeaderboard(2);

    expect(board.map((place) => place.score)).toEqual([90, 80]);
    expect(board[0]?.handles).toEqual(["a", "b"]);
  });

  // A row whose snapshot predates headline_score cannot be published as-is, so
  // the handle is materialized rather than leaving the board short.
  it("fills missing places from live materialization", async () => {
    mockRecorded.mockResolvedValue([entry("a", 90)]);
    mockCandidates.mockResolvedValue(["a", "b", "c"]);
    mockMaterialize.mockImplementation(async (handle: string) => live(handle === "b" ? 95 : 70));

    const board = await getLeaderboard(3);

    expect(board.map((place) => [place.rank, place.score])).toEqual([
      [1, 95],
      [2, 90],
      [3, 70],
    ]);
    expect(mockMaterialize).not.toHaveBeenCalledWith("a");
  });

  it("rolls past a handle that cannot be fetched", async () => {
    mockCandidates.mockResolvedValue(["a", "b", "c"]);
    mockMaterialize.mockImplementation(async (handle: string) => {
      if (handle === "a") throw new Error("github 403");
      if (handle === "b") return null;
      return live(60);
    });

    await expect(getLeaderboard(1)).resolves.toEqual([
      { rank: 1, score: 60, tier: "High", handles: ["c"] },
    ]);
  });

  // Fetching a pool in parallel earns 403s, and every fetch past a full board
  // is waste.
  it("stops materializing once the places are filled", async () => {
    mockCandidates.mockResolvedValue(["a", "b", "c", "d"]);
    mockMaterialize.mockImplementation(async (handle: string) => live(handle === "a" ? 90 : 80));

    await getLeaderboard(2);

    expect(mockMaterialize).toHaveBeenCalledTimes(2);
  });

  it("reads a deeper pool than the number of places, so ties can collapse", async () => {
    await getLeaderboard(3);

    expect(mockRecorded).toHaveBeenCalledWith(["a", "b", "c", "d", "juan294"], 12);
  });

  // A badge rendered for a stranger creates a snapshot; it must not put that
  // person on a public podium they never opted into.
  it("publishes nothing when nobody has signed up", async () => {
    mockRegistered.mockResolvedValue([]);

    await expect(getLeaderboard(3)).resolves.toEqual([]);
    expect(mockRecorded).not.toHaveBeenCalled();
  });

  it("returns nothing for a non-positive limit, without touching the database", async () => {
    await expect(getLeaderboard(0)).resolves.toEqual([]);
    expect(mockRegistered).not.toHaveBeenCalled();
  });
});

/**
 * #1311 — the board publishes one number per place and links to the badge that
 * number came from. A v7 evidence range has no single number, so it takes no
 * place at all rather than publishing a bound the badge does not show. This is
 * the same rule the file already applies to a snapshot with no headline: a
 * handle whose number would contradict its badge waits instead.
 */
describe("a v7 evidence range takes no place", () => {
  it("skips a ranged candidate and gives the place to the next one", async () => {
    const ranged = {
      displayImpact: { handle: "b", adjustedComposite: 95, tier: "High" },
      scoring: {
        policyVersion: "v7", handle: "b", identity: null, window: null,
        dimensions: {
          delivery: { kind: "range", lower: 60, upper: 80, displayLower: 60, displayUpper: 80 },
          quality: { kind: "point", value: 54, display: 54 },
          consistency: { kind: "point", value: 73, display: 73 },
          breadth: { kind: "point", value: 68, display: 68 },
        },
        composite: { kind: "range", lower: 64, upper: 73, displayLower: 64, displayUpper: 73 },
        tier: null, archetype: null, craft: null, coverage: [], exclusions: [], limitations: [],
      },
    } as unknown as Awaited<ReturnType<typeof materializeDisplayProfile>>;

    mockRecorded.mockResolvedValue([]);
    mockCandidates.mockResolvedValue(["b", "c"]);
    mockMaterialize.mockImplementation(async (handle: string) =>
      handle === "b" ? ranged : live(60, "High", "c"),
    );

    const board = await getLeaderboard(1);

    expect(board).toEqual([{ rank: 1, score: 60, tier: "High", handles: ["c"] }]);
    // Not merely unranked — its bounds never reach the board at all.
    expect(JSON.stringify(board)).not.toContain("64");
    expect(JSON.stringify(board)).not.toContain("73");
  });
});
