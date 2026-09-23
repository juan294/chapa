import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/users", () => ({ dbGetAllUserHandles: vi.fn() }));
vi.mock("./score-model", () => ({ readRenderableReceipt: vi.fn() }));

import { getLeaderboard } from "./leaderboard";
import { dbGetAllUserHandles } from "@/lib/db/users";
import { readRenderableReceipt } from "./score-model";

const mockRegistered = vi.mocked(dbGetAllUserHandles);
const mockReceipt = vi.mocked(readRenderableReceipt);

beforeEach(() => {
  vi.resetAllMocks();
  mockRegistered.mockResolvedValue([]);
  mockReceipt.mockResolvedValue(null);
});

describe("getLeaderboard", () => {
  it("returns nothing for a non-positive limit, without touching the database", async () => {
    await expect(getLeaderboard(0)).resolves.toEqual([]);
    expect(mockRegistered).not.toHaveBeenCalled();
  });

  it("publishes nothing when nobody has signed up", async () => {
    mockRegistered.mockResolvedValue([]);

    await expect(getLeaderboard(3)).resolves.toEqual([]);
    expect(mockReceipt).not.toHaveBeenCalled();
  });

  it("uses a constant v7.2 selection when the caller passes none", async () => {
    mockRegistered.mockResolvedValue(["alice"]);

    await getLeaderboard(3);

    expect(mockReceipt).toHaveBeenCalledWith("alice", expect.objectContaining({ enabled: true, machinePolicy: "v7.2", cacheable: true }));
  });
});

describe("observed leaderboard policy isolation", () => {
  const selection = { enabled: true, machinePolicy: "v7.2" as const, cacheable: true, capturedAt: Date.parse("2026-09-08T10:00:00.000Z") };

  it("ranks all current registered receipts without a legacy top-pool cutoff", async () => {
    const { scoringConsistencyFixture } = await import("@/lib/profile/__fixtures__/scoring-consistency");
    const low = await scoringConsistencyFixture();
    const boundary = await scoringConsistencyFixture({ boundary: true });
    mockRegistered.mockResolvedValue(["low", "missing", "boundary", "unavailable"]);
    mockReceipt.mockImplementation(async handle => handle === "low" ? { receipt: low.envelope, trend: null } : handle === "boundary" ? { receipt: boundary.envelope, trend: null } : handle === "unavailable" ? { unavailable: true } : null);

    expect(await getLeaderboard(3, selection)).toEqual([
      { rank: 1, score: 69.99, tier: "Solid", handles: ["boundary"], policyVersion: "v7.2" },
      { rank: 2, score: 46, tier: "Solid", handles: ["low"], policyVersion: "v7.2" },
    ]);
    expect(mockReceipt).toHaveBeenCalledWith("boundary", selection);
  });

  it("publishes no standing when policy authority is unavailable", async () => {
    expect(await getLeaderboard(3, { ...selection, cacheable: false })).toEqual([]);
    expect(mockRegistered).not.toHaveBeenCalled();
  });

  // #1335 phase 4/5 — an owner whose collection is still in progress (no
  // receipt has been issued yet, so `readRenderableReceipt` returns null)
  // takes no place: the board only ever ranks what has actually been
  // issued and is drawable.
  it("skips a registered owner whose collection is still in progress (no receipt issued yet)", async () => {
    const { scoringConsistencyFixture } = await import("@/lib/profile/__fixtures__/scoring-consistency");
    const ready = await scoringConsistencyFixture();
    mockRegistered.mockResolvedValue(["collecting-owner", "ready-owner"]);
    mockReceipt.mockImplementation(async (handle) =>
      handle === "ready-owner" ? { receipt: ready.envelope, trend: null } : null,
    );
    expect(await getLeaderboard(3, selection)).toEqual([
      { rank: 1, score: 46, tier: "Solid", handles: ["ready-owner"], policyVersion: "v7.2" },
    ]);
  });

  it("skips an unavailable-authority subject and gives the place to the next candidate", async () => {
    const { scoringConsistencyFixture } = await import("@/lib/profile/__fixtures__/scoring-consistency");
    const ready = await scoringConsistencyFixture();
    mockRegistered.mockResolvedValue(["unavailable-owner", "ready-owner"]);
    mockReceipt.mockImplementation(async (handle) =>
      handle === "ready-owner" ? { receipt: ready.envelope, trend: null } : { unavailable: true },
    );
    expect(await getLeaderboard(3, selection)).toEqual([
      { rank: 1, score: 46, tier: "Solid", handles: ["ready-owner"], policyVersion: "v7.2" },
    ]);
  });

  it("groups tied canonical scores into one place and does not skip the next rank", async () => {
    const { scoringConsistencyFixture } = await import("@/lib/profile/__fixtures__/scoring-consistency");
    const low = await scoringConsistencyFixture();
    mockRegistered.mockResolvedValue(["a", "b"]);
    mockReceipt.mockResolvedValue({ receipt: low.envelope, trend: null });

    const board = await getLeaderboard(3, selection);

    expect(board).toEqual([
      { rank: 1, score: 46, tier: "Solid", handles: ["a", "b"], policyVersion: "v7.2" },
    ]);
  });
});
