import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/db/users", () => ({
  dbGetUsers: vi.fn(),
}));

vi.mock("@/lib/db/snapshots", () => ({
  dbInsertSnapshot: vi.fn(() => Promise.resolve(true)),
  dbGetLatestSnapshotBatch: vi.fn(() => Promise.resolve(new Map())),
}));

vi.mock("@/lib/github/client", () => ({
  getStats: vi.fn(),
}));

vi.mock("@/lib/impact/v4", () => ({
  computeImpactV4: vi.fn(() => ({
    handle: "mock",
    profileType: "collaborative",
    dimensions: { building: 50, guarding: 50, consistency: 50, breadth: 50 },
    archetype: "Balanced",
    compositeScore: 50,
    confidence: 80,
    confidencePenalties: [],
    adjustedComposite: 40,
    tier: "Solid",
    computedAt: "2025-01-01T00:00:00.000Z",
  })),
}));

vi.mock("@/lib/history/snapshot", () => ({
  buildSnapshot: vi.fn(() => ({ date: "2025-01-01" })),
}));

vi.mock("@/lib/db/verification", () => ({
  dbCleanExpiredVerifications: vi.fn(() => Promise.resolve(0)),
}));

vi.mock("@/lib/history/diff", () => ({
  compareSnapshots: vi.fn(() => ({
    direction: "stable",
    adjustedComposite: 0,
    tier: null,
    archetype: null,
  })),
}));

vi.mock("@/lib/history/significant-change", () => ({
  isSignificantChange: vi.fn(() => ({ significant: false })),
}));

vi.mock("@/lib/email/score-bump", () => ({
  notifyScoreBump: vi.fn(() => Promise.resolve()),
}));

import { dbGetUsers } from "@/lib/db/users";
import {
  dbInsertSnapshot,
  dbGetLatestSnapshotBatch,
} from "@/lib/db/snapshots";
import { getStats } from "@/lib/github/client";
import { dbCleanExpiredVerifications } from "@/lib/db/verification";
import { compareSnapshots } from "@/lib/history/diff";
import { isSignificantChange } from "@/lib/history/significant-change";
import { notifyScoreBump } from "@/lib/email/score-bump";
import { GET } from "./route";

const mockedDbGetUsers = vi.mocked(dbGetUsers);
const mockedGetStats = vi.mocked(getStats);

function makeRequest(cronSecret?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (cronSecret) {
    headers["Authorization"] = `Bearer ${cronSecret}`;
  }
  return new NextRequest("http://localhost:3001/api/cron/warm-cache", {
    method: "GET",
    headers,
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  process.env.CRON_SECRET = "test-cron-secret";
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

describe("GET /api/cron/warm-cache", () => {
  describe("authentication", () => {
    it("returns 401 when no Authorization header is provided", async () => {
      const res = await GET(makeRequest());
      expect(res.status).toBe(401);
    });

    it("returns 401 when CRON_SECRET env var is not set", async () => {
      delete process.env.CRON_SECRET;
      const res = await GET(makeRequest("test-cron-secret"));
      expect(res.status).toBe(401);
    });

    it("returns 401 when token does not match CRON_SECRET", async () => {
      const res = await GET(makeRequest("wrong-secret"));
      expect(res.status).toBe(401);
    });

    it("accepts a valid CRON_SECRET token", async () => {
      mockedDbGetUsers.mockResolvedValue([]);
      const res = await GET(makeRequest("test-cron-secret"));
      expect(res.status).toBe(200);
    });
  });

  // ---------------------------------------------------------------------------
  // Handle discovery (from Supabase)
  // ---------------------------------------------------------------------------

  describe("handle discovery", () => {
    it("calls dbGetUsers for handle discovery", async () => {
      mockedDbGetUsers.mockResolvedValue([]);
      await GET(makeRequest("test-cron-secret"));

      expect(mockedDbGetUsers).toHaveBeenCalled();
    });

    it("uses handles from dbGetUsers result", async () => {
      mockedDbGetUsers.mockResolvedValue([
        { handle: "alice", registeredAt: "2025-01-01" },
        { handle: "bob", registeredAt: "2025-01-02" },
        { handle: "charlie", registeredAt: "2025-01-03" },
      ]);

      mockedGetStats.mockResolvedValue(null);

      const res = await GET(makeRequest("test-cron-secret"));
      const body = await res.json();

      expect(body.handles).toHaveLength(3);
      expect(new Set(body.handles)).toEqual(
        new Set(["alice", "bob", "charlie"]),
      );
    });

    it("returns empty results when no users exist", async () => {
      mockedDbGetUsers.mockResolvedValue([]);

      const res = await GET(makeRequest("test-cron-secret"));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.warmed).toBe(0);
      expect(body.handles).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // Cache warming
  // ---------------------------------------------------------------------------

  describe("cache warming", () => {
    it("calls getStats for each discovered handle", async () => {
      mockedDbGetUsers.mockResolvedValue([
        { handle: "alice", registeredAt: "2025-01-01" },
        { handle: "bob", registeredAt: "2025-01-02" },
      ]);

      mockedGetStats.mockResolvedValue({ handle: "mock" } as never);

      await GET(makeRequest("test-cron-secret"));

      expect(mockedGetStats).toHaveBeenCalledWith("alice", undefined);
      expect(mockedGetStats).toHaveBeenCalledWith("bob", undefined);
    });

    it("uses GITHUB_TOKEN when available", async () => {
      process.env.GITHUB_TOKEN = "ghp_test_token";
      mockedDbGetUsers.mockResolvedValue([
        { handle: "alice", registeredAt: "2025-01-01" },
      ]);

      mockedGetStats.mockResolvedValue({ handle: "mock" } as never);

      await GET(makeRequest("test-cron-secret"));

      expect(mockedGetStats).toHaveBeenCalledWith("alice", "ghp_test_token");

      delete process.env.GITHUB_TOKEN;
    });

    it("reports warmed count (successful fetches only)", async () => {
      mockedDbGetUsers.mockResolvedValue([
        { handle: "alice", registeredAt: "2025-01-01" },
        { handle: "bob", registeredAt: "2025-01-02" },
        { handle: "charlie", registeredAt: "2025-01-03" },
      ]);

      mockedGetStats
        .mockResolvedValueOnce({ handle: "alice" } as never) // success
        .mockResolvedValueOnce(null) // failure
        .mockResolvedValueOnce({ handle: "charlie" } as never); // success

      const res = await GET(makeRequest("test-cron-secret"));
      const body = await res.json();

      expect(body.warmed).toBe(2);
      expect(body.failed).toBe(1);
    });

    it("caps at 50 handles per run", async () => {
      const users = Array.from({ length: 60 }, (_, i) => ({
        handle: `user${i}`,
        registeredAt: "2025-01-01",
      }));
      mockedDbGetUsers.mockResolvedValue(users);

      mockedGetStats.mockResolvedValue({ handle: "mock" } as never);

      const res = await GET(makeRequest("test-cron-secret"));
      const body = await res.json();

      expect(mockedGetStats).toHaveBeenCalledTimes(50);
      expect(body.handles).toHaveLength(50);
    });

    it("continues warming even if individual fetches fail", async () => {
      mockedDbGetUsers.mockResolvedValue([
        { handle: "alice", registeredAt: "2025-01-01" },
        { handle: "bob", registeredAt: "2025-01-02" },
      ]);

      mockedGetStats
        .mockRejectedValueOnce(new Error("network error"))
        .mockResolvedValueOnce({ handle: "bob" } as never);

      const res = await GET(makeRequest("test-cron-secret"));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.warmed).toBe(1);
      expect(body.failed).toBe(1);
    });

    it("calls dbInsertSnapshot for each successful warm", async () => {
      mockedDbGetUsers.mockResolvedValue([
        { handle: "alice", registeredAt: "2025-01-01" },
      ]);

      mockedGetStats.mockResolvedValue({ handle: "alice" } as never);

      await GET(makeRequest("test-cron-secret"));

      expect(vi.mocked(dbInsertSnapshot)).toHaveBeenCalledWith(
        "alice",
        expect.objectContaining({ date: "2025-01-01" }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Parallel processing
  // ---------------------------------------------------------------------------

  describe("parallel processing", () => {
    it("processes handles in parallel batches", async () => {
      const callOrder: string[] = [];

      mockedDbGetUsers.mockResolvedValue(
        Array.from({ length: 7 }, (_, i) => ({
          handle: `user${i}`,
          registeredAt: "2025-01-01",
        })),
      );

      mockedGetStats.mockImplementation(async (handle) => {
        callOrder.push(handle as string);
        // Small delay to let concurrent calls overlap
        await new Promise((r) => setTimeout(r, 10));
        return { handle } as never;
      });

      const res = await GET(makeRequest("test-cron-secret"));
      const body = await res.json();

      // All 7 handles should have been processed
      expect(body.warmed).toBe(7);
      expect(body.failed).toBe(0);
      expect(callOrder).toHaveLength(7);
    });

    it("isolates failures across batches — one failure does not block others", async () => {
      mockedDbGetUsers.mockResolvedValue(
        Array.from({ length: 8 }, (_, i) => ({
          handle: `user${i}`,
          registeredAt: "2025-01-01",
        })),
      );

      mockedGetStats.mockImplementation(async (handle) => {
        if (handle === "user2" || handle === "user6") {
          throw new Error(`Fetch failed for ${handle}`);
        }
        return { handle } as never;
      });

      const res = await GET(makeRequest("test-cron-secret"));
      const body = await res.json();

      // 8 total - 2 failures = 6 warmed
      expect(body.warmed).toBe(6);
      expect(body.failed).toBe(2);
      expect(body.total).toBe(8);
    });

    it("uses batch snapshot pre-fetch for efficiency", async () => {
      mockedDbGetUsers.mockResolvedValue([
        { handle: "alice", registeredAt: "2025-01-01" },
        { handle: "bob", registeredAt: "2025-01-02" },
      ]);

      mockedGetStats.mockResolvedValue({ handle: "mock" } as never);

      await GET(makeRequest("test-cron-secret"));

      // Should use dbGetLatestSnapshotBatch instead of individual calls
      expect(vi.mocked(dbGetLatestSnapshotBatch)).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Response shape
  // ---------------------------------------------------------------------------

  describe("response", () => {
    it("returns no-store cache control", async () => {
      mockedDbGetUsers.mockResolvedValue([]);
      const res = await GET(makeRequest("test-cron-secret"));
      expect(res.headers.get("Cache-Control")).toBe("no-store");
    });

    it("returns the expected JSON shape", async () => {
      mockedDbGetUsers.mockResolvedValue([
        { handle: "alice", registeredAt: "2025-01-01" },
      ]);

      mockedGetStats.mockResolvedValue({ handle: "alice" } as never);

      const res = await GET(makeRequest("test-cron-secret"));
      const body = await res.json();

      expect(body).toMatchObject({
        warmed: 1,
        failed: 0,
        total: 1,
        handles: ["alice"],
      });
      expect(typeof body.durationMs).toBe("number");
    });

    it("includes expiredVerificationsDeleted in response", async () => {
      mockedDbGetUsers.mockResolvedValue([]);
      vi.mocked(dbCleanExpiredVerifications).mockResolvedValue(5);

      const res = await GET(makeRequest("test-cron-secret"));
      const body = await res.json();

      expect(body.expiredVerificationsDeleted).toBe(5);
    });
  });

  // ---------------------------------------------------------------------------
  // Verification cleanup
  // ---------------------------------------------------------------------------

  describe("verification cleanup", () => {
    it("calls dbCleanExpiredVerifications", async () => {
      mockedDbGetUsers.mockResolvedValue([]);

      await GET(makeRequest("test-cron-secret"));

      expect(vi.mocked(dbCleanExpiredVerifications)).toHaveBeenCalled();
    });

    it("does not fail if cleanup throws", async () => {
      mockedDbGetUsers.mockResolvedValue([]);
      vi.mocked(dbCleanExpiredVerifications).mockRejectedValue(
        new Error("Supabase down"),
      );

      const res = await GET(makeRequest("test-cron-secret"));

      expect(res.status).toBe(200);
    });
  });

  // ---------------------------------------------------------------------------
  // Score bump notifications
  // ---------------------------------------------------------------------------

  describe("score bump notifications", () => {
    it("compares snapshot with previous when snapshot is inserted", async () => {
      mockedDbGetUsers.mockResolvedValue([
        { handle: "alice", registeredAt: "2025-01-01" },
      ]);
      mockedGetStats.mockResolvedValue({ handle: "alice" } as never);
      vi.mocked(dbInsertSnapshot).mockResolvedValue(true);
      vi.mocked(dbGetLatestSnapshotBatch).mockResolvedValue(
        new Map([
          [
            "alice",
            {
              date: "2025-01-01",
              adjustedComposite: 40,
            } as never,
          ],
        ]),
      );

      await GET(makeRequest("test-cron-secret"));

      expect(dbGetLatestSnapshotBatch).toHaveBeenCalled();
      expect(compareSnapshots).toHaveBeenCalled();
    });

    it("calls notifyScoreBump when change is significant", async () => {
      mockedDbGetUsers.mockResolvedValue([
        { handle: "alice", registeredAt: "2025-01-01" },
      ]);
      mockedGetStats.mockResolvedValue({ handle: "alice" } as never);
      vi.mocked(dbInsertSnapshot).mockResolvedValue(true);
      vi.mocked(dbGetLatestSnapshotBatch).mockResolvedValue(
        new Map([
          [
            "alice",
            {
              date: "2025-01-01",
              adjustedComposite: 40,
            } as never,
          ],
        ]),
      );
      vi.mocked(isSignificantChange).mockReturnValue({
        significant: true,
        reason: "score_bump",
        allReasons: ["score_bump"],
      });

      await GET(makeRequest("test-cron-secret"));

      expect(notifyScoreBump).toHaveBeenCalledWith(
        "alice",
        expect.any(Object), // diff
        expect.objectContaining({ significant: true, reason: "score_bump" }),
      );
    });

    it("does not call notifyScoreBump when change is not significant", async () => {
      mockedDbGetUsers.mockResolvedValue([
        { handle: "alice", registeredAt: "2025-01-01" },
      ]);
      mockedGetStats.mockResolvedValue({ handle: "alice" } as never);
      vi.mocked(dbInsertSnapshot).mockResolvedValue(true);
      vi.mocked(dbGetLatestSnapshotBatch).mockResolvedValue(
        new Map([
          [
            "alice",
            {
              date: "2025-01-01",
              adjustedComposite: 40,
            } as never,
          ],
        ]),
      );
      vi.mocked(isSignificantChange).mockReturnValue({
        significant: false,
      });

      await GET(makeRequest("test-cron-secret"));

      expect(notifyScoreBump).not.toHaveBeenCalled();
    });

    it("skips notification when no previous snapshot exists", async () => {
      mockedDbGetUsers.mockResolvedValue([
        { handle: "alice", registeredAt: "2025-01-01" },
      ]);
      mockedGetStats.mockResolvedValue({ handle: "alice" } as never);
      vi.mocked(dbInsertSnapshot).mockResolvedValue(true);
      vi.mocked(dbGetLatestSnapshotBatch).mockResolvedValue(new Map());

      await GET(makeRequest("test-cron-secret"));

      expect(compareSnapshots).not.toHaveBeenCalled();
      expect(notifyScoreBump).not.toHaveBeenCalled();
    });

    it("does not fail if notification throws", async () => {
      mockedDbGetUsers.mockResolvedValue([
        { handle: "alice", registeredAt: "2025-01-01" },
      ]);
      mockedGetStats.mockResolvedValue({ handle: "alice" } as never);
      vi.mocked(dbInsertSnapshot).mockResolvedValue(true);
      vi.mocked(dbGetLatestSnapshotBatch).mockResolvedValue(
        new Map([
          [
            "alice",
            {
              date: "2025-01-01",
              adjustedComposite: 40,
            } as never,
          ],
        ]),
      );
      vi.mocked(isSignificantChange).mockReturnValue({
        significant: true,
        reason: "tier_change",
        allReasons: ["tier_change"],
      });
      vi.mocked(notifyScoreBump).mockRejectedValue(new Error("Email down"));

      const res = await GET(makeRequest("test-cron-secret"));

      expect(res.status).toBe(200);
    });

    it("reports notification count in response", async () => {
      mockedDbGetUsers.mockResolvedValue([
        { handle: "alice", registeredAt: "2025-01-01" },
      ]);
      mockedGetStats.mockResolvedValue({ handle: "alice" } as never);
      vi.mocked(dbInsertSnapshot).mockResolvedValue(true);
      vi.mocked(dbGetLatestSnapshotBatch).mockResolvedValue(
        new Map([
          [
            "alice",
            {
              date: "2025-01-01",
              adjustedComposite: 40,
            } as never,
          ],
        ]),
      );
      vi.mocked(isSignificantChange).mockReturnValue({
        significant: true,
        reason: "score_bump",
        allReasons: ["score_bump"],
      });

      const res = await GET(makeRequest("test-cron-secret"));
      const body = await res.json();

      expect(body.notifications).toBe(1);
    });
  });
});
