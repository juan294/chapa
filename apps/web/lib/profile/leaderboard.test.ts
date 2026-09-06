import { describe, it, expect, vi, beforeEach } from "vitest";

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

function live(adjustedComposite: number, tier = "High") {
  return { displayImpact: { adjustedComposite, tier } } as unknown as Awaited<
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
