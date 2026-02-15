import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSnapshot } from "../test-helpers/fixtures";

// ---------------------------------------------------------------------------
// Mock Redis — sorted set operations (Upstash uses zrange with options)
// ---------------------------------------------------------------------------

const mockZadd = vi.fn();
const mockZrange = vi.fn();
const mockZcard = vi.fn();
const mockZremrangebyrank = vi.fn();

vi.mock("@/lib/cache/redis", () => ({
  getRawRedis: vi.fn(() => ({
    zadd: mockZadd,
    zrange: mockZrange,
    zcard: mockZcard,
    zremrangebyrank: mockZremrangebyrank,
  })),
}));

import {
  recordSnapshot,
  getSnapshots,
  getLatestSnapshot,
  getSnapshotCount,
  pruneSnapshots,
} from "./history";

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// recordSnapshot
// ---------------------------------------------------------------------------

describe("recordSnapshot", () => {
  it("skips write if snapshot for today already exists", async () => {
    // zrange returns a non-empty array → duplicate exists
    mockZrange.mockResolvedValue(["existing-member"]);

    const result = await recordSnapshot("TestUser", makeSnapshot());

    expect(result).toBe(false);
    expect(mockZadd).not.toHaveBeenCalled();
  });

  it("writes snapshot to sorted set when no duplicate exists", async () => {
    mockZrange.mockResolvedValue([]); // no existing entry
    mockZadd.mockResolvedValue(1);

    const snapshot = makeSnapshot();
    const result = await recordSnapshot("TestUser", snapshot);

    expect(result).toBe(true);
    expect(mockZadd).toHaveBeenCalledWith(
      "history:testuser",
      {
        score: expect.any(Number),
        member: JSON.stringify(snapshot),
      },
    );
  });

  it("normalizes handle to lowercase for the key", async () => {
    mockZrange.mockResolvedValue([]);
    mockZadd.mockResolvedValue(1);

    await recordSnapshot("TestUser", makeSnapshot());

    // Dedup check uses lowercase key
    expect(mockZrange).toHaveBeenCalledWith(
      "history:testuser",
      expect.any(Number),
      expect.any(Number),
      { byScore: true, count: 1, offset: 0 },
    );
  });

  it("uses date's midnight UTC timestamp as score", async () => {
    mockZrange.mockResolvedValue([]);
    mockZadd.mockResolvedValue(1);

    const snapshot = makeSnapshot({ date: "2025-06-15" });
    await recordSnapshot("TestUser", snapshot);

    const expectedScore = new Date("2025-06-15T00:00:00.000Z").getTime() / 1000;
    expect(mockZadd).toHaveBeenCalledWith(
      "history:testuser",
      {
        score: expectedScore,
        member: JSON.stringify(snapshot),
      },
    );
  });

  it("returns false and does not throw on Redis error", async () => {
    mockZrange.mockRejectedValue(new Error("connection failed"));

    const result = await recordSnapshot("TestUser", makeSnapshot());

    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getSnapshots
// ---------------------------------------------------------------------------

describe("getSnapshots", () => {
  it("returns parsed snapshots for a date range", async () => {
    const s1 = makeSnapshot({ date: "2025-06-14" });
    const s2 = makeSnapshot({ date: "2025-06-15" });
    mockZrange.mockResolvedValue([
      JSON.stringify(s1),
      JSON.stringify(s2),
    ]);

    const result = await getSnapshots("TestUser", "2025-06-14", "2025-06-15");

    expect(result).toEqual([s1, s2]);
    expect(mockZrange).toHaveBeenCalledWith(
      "history:testuser",
      expect.any(Number),
      expect.any(Number),
      { byScore: true },
    );
  });

  it("returns empty array on Redis error", async () => {
    mockZrange.mockRejectedValue(new Error("timeout"));

    const result = await getSnapshots("TestUser", "2025-06-14", "2025-06-15");

    expect(result).toEqual([]);
  });

  it("returns all snapshots when no date range provided", async () => {
    const s1 = makeSnapshot({ date: "2025-01-01" });
    mockZrange.mockResolvedValue([JSON.stringify(s1)]);

    const result = await getSnapshots("TestUser");

    expect(mockZrange).toHaveBeenCalledWith(
      "history:testuser",
      "-inf",
      "+inf",
      { byScore: true },
    );
    expect(result).toEqual([s1]);
  });
});

// ---------------------------------------------------------------------------
// getLatestSnapshot
// ---------------------------------------------------------------------------

describe("getLatestSnapshot", () => {
  it("returns the most recent snapshot", async () => {
    const latest = makeSnapshot({ date: "2025-06-15" });
    mockZrange.mockResolvedValue([JSON.stringify(latest)]);

    const result = await getLatestSnapshot("TestUser");

    expect(result).toEqual(latest);
    expect(mockZrange).toHaveBeenCalledWith(
      "history:testuser",
      "+inf",
      "-inf",
      { byScore: true, rev: true, count: 1, offset: 0 },
    );
  });

  it("returns null when no snapshots exist", async () => {
    mockZrange.mockResolvedValue([]);

    const result = await getLatestSnapshot("TestUser");

    expect(result).toBeNull();
  });

  it("returns null on Redis error", async () => {
    mockZrange.mockRejectedValue(new Error("boom"));

    const result = await getLatestSnapshot("TestUser");

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getSnapshotCount
// ---------------------------------------------------------------------------

describe("getSnapshotCount", () => {
  it("returns the number of snapshots stored", async () => {
    mockZcard.mockResolvedValue(42);

    const result = await getSnapshotCount("TestUser");

    expect(result).toBe(42);
    expect(mockZcard).toHaveBeenCalledWith("history:testuser");
  });

  it("returns 0 on Redis error", async () => {
    mockZcard.mockRejectedValue(new Error("network"));

    const result = await getSnapshotCount("TestUser");

    expect(result).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// pruneSnapshots
// ---------------------------------------------------------------------------

describe("pruneSnapshots", () => {
  it("removes oldest entries when count exceeds maxEntries", async () => {
    mockZcard.mockResolvedValue(400);
    mockZremrangebyrank.mockResolvedValue(35);

    await pruneSnapshots("TestUser", 365);

    // Should remove from rank 0 to (400 - 365 - 1) = 34
    expect(mockZremrangebyrank).toHaveBeenCalledWith("history:testuser", 0, 34);
  });

  it("does nothing when count is at or below maxEntries", async () => {
    mockZcard.mockResolvedValue(365);

    await pruneSnapshots("TestUser", 365);

    expect(mockZremrangebyrank).not.toHaveBeenCalled();
  });

  it("does nothing when count is below maxEntries", async () => {
    mockZcard.mockResolvedValue(100);

    await pruneSnapshots("TestUser", 365);

    expect(mockZremrangebyrank).not.toHaveBeenCalled();
  });

  it("normalizes handle to lowercase for the key", async () => {
    mockZcard.mockResolvedValue(400);
    mockZremrangebyrank.mockResolvedValue(35);

    await pruneSnapshots("TestUser", 365);

    expect(mockZcard).toHaveBeenCalledWith("history:testuser");
    expect(mockZremrangebyrank).toHaveBeenCalledWith("history:testuser", 0, 34);
  });

  it("does not throw on Redis error", async () => {
    mockZcard.mockRejectedValue(new Error("connection failed"));

    // Should not throw
    await expect(pruneSnapshots("TestUser", 365)).resolves.toBeUndefined();
  });

  it("does not throw when zremrangebyrank fails", async () => {
    mockZcard.mockResolvedValue(400);
    mockZremrangebyrank.mockRejectedValue(new Error("write error"));

    await expect(pruneSnapshots("TestUser", 365)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// recordSnapshot — prune after write
// ---------------------------------------------------------------------------

describe("recordSnapshot — prune integration", () => {
  it("calls pruneSnapshots after a successful write", async () => {
    mockZrange.mockResolvedValue([]); // no existing entry
    mockZadd.mockResolvedValue(1);
    mockZcard.mockResolvedValue(400); // triggers prune
    mockZremrangebyrank.mockResolvedValue(35);

    const result = await recordSnapshot("TestUser", makeSnapshot());

    expect(result).toBe(true);
    // Prune should have been called (fire-and-forget, but we can check zcard was called)
    // We need to flush microtasks for the fire-and-forget .catch() chain
    await vi.waitFor(() => {
      expect(mockZcard).toHaveBeenCalledWith("history:testuser");
    });
  });

  it("does not call prune when write is skipped (duplicate)", async () => {
    mockZrange.mockResolvedValue(["existing-member"]);

    await recordSnapshot("TestUser", makeSnapshot());

    expect(mockZcard).not.toHaveBeenCalled();
    expect(mockZremrangebyrank).not.toHaveBeenCalled();
  });
});
