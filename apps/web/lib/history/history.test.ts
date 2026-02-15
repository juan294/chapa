import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MetricsSnapshot } from "./types";

// ---------------------------------------------------------------------------
// Mock Redis — sorted set operations (Upstash uses zrange with options)
// ---------------------------------------------------------------------------

const mockZadd = vi.fn();
const mockZrange = vi.fn();
const mockZcard = vi.fn();

vi.mock("@/lib/cache/redis", () => ({
  getRawRedis: vi.fn(() => ({
    zadd: mockZadd,
    zrange: mockZrange,
    zcard: mockZcard,
  })),
}));

import {
  recordSnapshot,
  getSnapshots,
  getLatestSnapshot,
  getSnapshotCount,
} from "./history";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSnapshot(overrides: Partial<MetricsSnapshot> = {}): MetricsSnapshot {
  return {
    date: "2025-06-15",
    capturedAt: "2025-06-15T14:30:00.000Z",
    commitsTotal: 150,
    prsMergedCount: 30,
    prsMergedWeight: 45,
    reviewsSubmittedCount: 20,
    issuesClosedCount: 10,
    reposContributed: 8,
    activeDays: 200,
    linesAdded: 5000,
    linesDeleted: 2000,
    totalStars: 100,
    totalForks: 25,
    totalWatchers: 50,
    topRepoShare: 0.4,
    maxCommitsIn10Min: 3,
    building: 75,
    guarding: 60,
    consistency: 80,
    breadth: 55,
    archetype: "Builder",
    profileType: "collaborative",
    compositeScore: 67.5,
    adjustedComposite: 60.75,
    confidence: 90,
    tier: "High",
    ...overrides,
  };
}

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
