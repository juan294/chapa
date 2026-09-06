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

  it("ranks only registered handles", async () => {
    mockRecorded.mockResolvedValue([
      { handle: "a", score: 90, tier: "Elite", rank: 0 },
      { handle: "b", score: 85, tier: "Elite", rank: 0 },
      { handle: "c", score: 80, tier: "High", rank: 0 },
    ]);

    await expect(getLeaderboard(3)).resolves.toHaveLength(3);
    expect(mockRecorded).toHaveBeenCalledWith(["a", "b", "c", "d", "juan294"], 3);
    expect(mockMaterialize).not.toHaveBeenCalled();
  });

  // The podium is a fixed shape: a row whose snapshot predates headline_score
  // is materialized rather than left as a gap.
  it("fills the podium from live materialization when rows lack a headline", async () => {
    mockRecorded.mockResolvedValue([{ handle: "a", score: 90, tier: "Elite", rank: 0 }]);
    mockCandidates.mockResolvedValue(["a", "b", "c"]);
    mockMaterialize.mockImplementation(async (handle: string) => live(handle === "b" ? 95 : 70));

    const board = await getLeaderboard(3);

    expect(board).toEqual([
      { handle: "b", score: 95, tier: "High", rank: 1 },
      { handle: "a", score: 90, tier: "Elite", rank: 2 },
      { handle: "c", score: 70, tier: "High", rank: 3 },
    ]);
    // The recorded handle is never re-fetched.
    expect(mockMaterialize).not.toHaveBeenCalledWith("a");
  });

  // Equal scores share a place. Alphabetical order inside a tie is arbitrary
  // and must not read as one developer beating another.
  it("gives tied scores the same place and skips the next one", async () => {
    mockRecorded.mockResolvedValue([
      { handle: "juan294", score: 80, tier: "High", rank: 0 },
      { handle: "w-winter", score: 80, tier: "High", rank: 0 },
      { handle: "nicholaivogel", score: 78, tier: "High", rank: 0 },
    ]);

    const board = await getLeaderboard(3);

    expect(board.map((entry) => entry.rank)).toEqual([1, 1, 3]);
  });

  it("rolls past a handle that cannot be fetched", async () => {
    mockCandidates.mockResolvedValue(["a", "b", "c"]);
    mockMaterialize.mockImplementation(async (handle: string) => {
      if (handle === "a") throw new Error("github 403");
      if (handle === "b") return null;
      return live(60);
    });

    await expect(getLeaderboard(1)).resolves.toEqual([{ handle: "c", score: 60, tier: "High", rank: 1 }]);
  });

  // Fetching a whole pool in parallel earns 403s, and every extra fetch past a
  // full podium is waste.
  it("stops materializing as soon as the podium is full", async () => {
    mockCandidates.mockResolvedValue(["a", "b", "c", "d"]);
    mockMaterialize.mockResolvedValue(live(70));

    await getLeaderboard(2);

    expect(mockMaterialize).toHaveBeenCalledTimes(2);
  });

  it("asks for a wider candidate pool than the podium", async () => {
    await getLeaderboard(3);

    expect(mockCandidates).toHaveBeenCalledWith(["a", "b", "c", "d", "juan294"], 12);
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
