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

// ---------------------------------------------------------------------------
// Mock Supabase DB layer
// ---------------------------------------------------------------------------

vi.mock("@/lib/db/snapshots", () => ({
  dbInsertSnapshot: vi.fn(() => Promise.resolve(true)),
  dbGetSnapshots: vi.fn(() => Promise.resolve([])),
  dbGetLatestSnapshot: vi.fn(() => Promise.resolve(null)),
  dbGetSnapshotCount: vi.fn(() => Promise.resolve(0)),
}));

import {
  recordSnapshot,
  getSnapshots,
  getLatestSnapshot,
  getSnapshotCount,
  pruneSnapshots,
} from "./history";
import {
  dbInsertSnapshot,
  dbGetSnapshots,
  dbGetLatestSnapshot,
  dbGetSnapshotCount,
} from "@/lib/db/snapshots";

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
// getSnapshots — reads from Supabase
// ---------------------------------------------------------------------------

describe("getSnapshots", () => {
  it("delegates to dbGetSnapshots and returns results", async () => {
    const s1 = makeSnapshot({ date: "2025-06-14" });
    const s2 = makeSnapshot({ date: "2025-06-15" });
    vi.mocked(dbGetSnapshots).mockResolvedValue([s1, s2]);

    const result = await getSnapshots("TestUser", "2025-06-14", "2025-06-15");

    expect(result).toEqual([s1, s2]);
    expect(dbGetSnapshots).toHaveBeenCalledWith("TestUser", "2025-06-14", "2025-06-15");
  });

  it("returns empty array when Supabase returns empty", async () => {
    vi.mocked(dbGetSnapshots).mockResolvedValue([]);

    const result = await getSnapshots("TestUser", "2025-06-14", "2025-06-15");

    expect(result).toEqual([]);
  });

  it("passes undefined for omitted date range params", async () => {
    vi.mocked(dbGetSnapshots).mockResolvedValue([]);

    await getSnapshots("TestUser");

    expect(dbGetSnapshots).toHaveBeenCalledWith("TestUser", undefined, undefined);
  });

  it("does not call Redis for reads", async () => {
    vi.mocked(dbGetSnapshots).mockResolvedValue([]);

    await getSnapshots("TestUser");

    expect(mockZrange).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getLatestSnapshot — reads from Supabase
// ---------------------------------------------------------------------------

describe("getLatestSnapshot", () => {
  it("delegates to dbGetLatestSnapshot and returns result", async () => {
    const latest = makeSnapshot({ date: "2025-06-15" });
    vi.mocked(dbGetLatestSnapshot).mockResolvedValue(latest);

    const result = await getLatestSnapshot("TestUser");

    expect(result).toEqual(latest);
    expect(dbGetLatestSnapshot).toHaveBeenCalledWith("TestUser");
  });

  it("returns null when no snapshots exist", async () => {
    vi.mocked(dbGetLatestSnapshot).mockResolvedValue(null);

    const result = await getLatestSnapshot("TestUser");

    expect(result).toBeNull();
  });

  it("does not call Redis for reads", async () => {
    vi.mocked(dbGetLatestSnapshot).mockResolvedValue(null);

    await getLatestSnapshot("TestUser");

    expect(mockZrange).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getSnapshotCount — reads from Supabase
// ---------------------------------------------------------------------------

describe("getSnapshotCount", () => {
  it("delegates to dbGetSnapshotCount and returns result", async () => {
    vi.mocked(dbGetSnapshotCount).mockResolvedValue(42);

    const result = await getSnapshotCount("TestUser");

    expect(result).toBe(42);
    expect(dbGetSnapshotCount).toHaveBeenCalledWith("TestUser");
  });

  it("returns 0 when Supabase returns 0", async () => {
    vi.mocked(dbGetSnapshotCount).mockResolvedValue(0);

    const result = await getSnapshotCount("TestUser");

    expect(result).toBe(0);
  });

  it("does not call Redis for reads", async () => {
    vi.mocked(dbGetSnapshotCount).mockResolvedValue(0);

    await getSnapshotCount("TestUser");

    expect(mockZcard).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// pruneSnapshots (standalone — still exists, removed from recordSnapshot)
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
// recordSnapshot — no longer calls pruneSnapshots (Phase 4)
// ---------------------------------------------------------------------------

describe("recordSnapshot — no prune after write (Phase 4)", () => {
  it("does NOT call pruneSnapshots after a successful write", async () => {
    mockZrange.mockResolvedValue([]); // no existing entry
    mockZadd.mockResolvedValue(1);

    const result = await recordSnapshot("TestUser", makeSnapshot());

    expect(result).toBe(true);
    // Prune-related Redis calls should NOT happen from recordSnapshot
    // (zcard is only called by pruneSnapshots)
    expect(mockZcard).not.toHaveBeenCalled();
    expect(mockZremrangebyrank).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// recordSnapshot — Supabase dual-write
// ---------------------------------------------------------------------------

describe("recordSnapshot — Supabase dual-write", () => {
  it("calls dbInsertSnapshot after a successful Redis write", async () => {
    mockZrange.mockResolvedValue([]);
    mockZadd.mockResolvedValue(1);

    const snapshot = makeSnapshot();
    await recordSnapshot("TestUser", snapshot);

    await vi.waitFor(() => {
      expect(vi.mocked(dbInsertSnapshot)).toHaveBeenCalledWith(
        "TestUser",
        snapshot,
      );
    });
  });

  it("does not call dbInsertSnapshot when Redis dedup skips write", async () => {
    mockZrange.mockResolvedValue(["existing-member"]);

    await recordSnapshot("TestUser", makeSnapshot());

    expect(vi.mocked(dbInsertSnapshot)).not.toHaveBeenCalled();
  });

  it("still returns true when Supabase write fails (fire-and-forget)", async () => {
    mockZrange.mockResolvedValue([]);
    mockZadd.mockResolvedValue(1);
    vi.mocked(dbInsertSnapshot).mockRejectedValue(new Error("Supabase down"));

    const result = await recordSnapshot("TestUser", makeSnapshot());

    expect(result).toBe(true);
  });

  it("does not call dbInsertSnapshot when Redis itself fails", async () => {
    mockZrange.mockRejectedValue(new Error("Redis down"));

    await recordSnapshot("TestUser", makeSnapshot());

    expect(vi.mocked(dbInsertSnapshot)).not.toHaveBeenCalled();
  });
});
