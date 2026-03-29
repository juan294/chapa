import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
  dbCleanOldSnapshots: vi.fn(() => Promise.resolve(0)),
}));

vi.mock("@/lib/github/client", () => ({
  getStats: vi.fn(),
}));

vi.mock("@/lib/impact/v4", () => ({
  computeImpactV4: vi.fn(() => ({
    handle: "mock",
    profileType: "collaborative",
    dimensions: { delivery: 50, quality: 50, consistency: 50, breadth: 50 },
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

vi.mock("@/lib/db/telemetry", () => ({
  dbCleanExpiredMergeOperations: vi.fn(() => Promise.resolve(0)),
}));

vi.mock("@/lib/cache/snapshot-cache", () => ({
  updateSnapshotCache: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/cache/redis", () => ({
  cacheGet: vi.fn(() => Promise.resolve(null)),
  cacheSet: vi.fn(() => Promise.resolve(true)),
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

vi.mock("@/lib/cache/craft-cache", () => ({
  getCachedCraftScore: vi.fn(() => Promise.resolve(null)),
}));

vi.mock("@/lib/render/avatar", () => ({
  getAvatarBase64: vi.fn(() => Promise.resolve("data:image/png;base64,abc")),
}));

import { dbGetUsers } from "@/lib/db/users";
import {
  dbInsertSnapshot,
  dbGetLatestSnapshotBatch,
  dbCleanOldSnapshots,
} from "@/lib/db/snapshots";
import { getStats } from "@/lib/github/client";
import { dbCleanExpiredVerifications } from "@/lib/db/verification";
import { dbCleanExpiredMergeOperations } from "@/lib/db/telemetry";
import { compareSnapshots } from "@/lib/history/diff";
import { isSignificantChange } from "@/lib/history/significant-change";
import { notifyScoreBump } from "@/lib/email/score-bump";
import { cacheGet, cacheSet } from "@/lib/cache/redis";
import { getCachedCraftScore } from "@/lib/cache/craft-cache";
import { getAvatarBase64 } from "@/lib/render/avatar";
import { computeImpactV4 } from "@/lib/impact/v4";
import { updateSnapshotCache } from "@/lib/cache/snapshot-cache";
import { GET } from "./route";

const mockedDbGetUsers = vi.mocked(dbGetUsers);
const mockedGetStats = vi.mocked(getStats);

/** Helper to build mock user rows with required profile fields */
function mockUser(handle: string, registeredAt = "2025-01-01") {
  return { handle, registeredAt, displayName: null as string | null, avatarUrl: null as string | null };
}

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

    it("passes through when CRON_SECRET env var is not set", async () => {
      delete process.env.CRON_SECRET;
      mockedDbGetUsers.mockResolvedValue([]);
      const res = await GET(makeRequest("test-cron-secret"));
      // No CRON_SECRET configured = auth skipped (pass-through)
      expect(res.status).toBe(200);
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
        mockUser("alice"),
        mockUser("bob", "2025-01-02"),
        mockUser("charlie", "2025-01-03"),
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
        mockUser("alice"),
        mockUser("bob", "2025-01-02"),
      ]);

      mockedGetStats.mockResolvedValue({ handle: "mock" } as never);

      await GET(makeRequest("test-cron-secret"));

      expect(mockedGetStats).toHaveBeenCalledWith("alice", undefined);
      expect(mockedGetStats).toHaveBeenCalledWith("bob", undefined);
    });

    it("uses GITHUB_TOKEN when available", async () => {
      process.env.GITHUB_TOKEN = "ghp_test_token";
      mockedDbGetUsers.mockResolvedValue([
        mockUser("alice"),
      ]);

      mockedGetStats.mockResolvedValue({ handle: "mock" } as never);

      await GET(makeRequest("test-cron-secret"));

      expect(mockedGetStats).toHaveBeenCalledWith("alice", "ghp_test_token");

      delete process.env.GITHUB_TOKEN;
    });

    it("reports warmed count (successful fetches only)", async () => {
      mockedDbGetUsers.mockResolvedValue([
        mockUser("alice"),
        mockUser("bob", "2025-01-02"),
        mockUser("charlie", "2025-01-03"),
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
      const users = Array.from({ length: 60 }, (_, i) => mockUser(`user${i}`));
      mockedDbGetUsers.mockResolvedValue(users);

      mockedGetStats.mockResolvedValue({ handle: "mock" } as never);

      const res = await GET(makeRequest("test-cron-secret"));
      const body = await res.json();

      expect(mockedGetStats).toHaveBeenCalledTimes(50);
      expect(body.handles).toHaveLength(50);
    });

    it("continues warming even if individual fetches fail", async () => {
      mockedDbGetUsers.mockResolvedValue([
        mockUser("alice"),
        mockUser("bob", "2025-01-02"),
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
        mockUser("alice"),
      ]);

      mockedGetStats.mockResolvedValue({ handle: "alice" } as never);

      await GET(makeRequest("test-cron-secret"));

      expect(vi.mocked(dbInsertSnapshot)).toHaveBeenCalledWith(
        "alice",
        expect.objectContaining({ date: "2025-01-01" }),
      );
    });

    it("swallows updateSnapshotCache rejection via .catch() (fire-and-forget)", async () => {
      mockedDbGetUsers.mockResolvedValue([mockUser("alice")]);
      mockedGetStats.mockResolvedValue({ handle: "alice" } as never);
      vi.mocked(dbInsertSnapshot).mockResolvedValue(true);
      // updateSnapshotCache rejects — the .catch(() => {}) should swallow it
      vi.mocked(updateSnapshotCache).mockRejectedValue(new Error("Redis write failed"));

      const res = await GET(makeRequest("test-cron-secret"));
      const body = await res.json();

      // Should still report the handle as warmed with a snapshot recorded
      expect(body.warmed).toBe(1);
      expect(body.snapshots).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Parallel processing
  // ---------------------------------------------------------------------------

  describe("parallel processing", () => {
    it("processes handles in parallel batches", async () => {
      const callOrder: string[] = [];

      mockedDbGetUsers.mockResolvedValue(
        Array.from({ length: 7 }, (_, i) => mockUser(`user${i}`)),
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
        Array.from({ length: 8 }, (_, i) => mockUser(`user${i}`)),
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
        mockUser("alice"),
        mockUser("bob", "2025-01-02"),
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
        mockUser("alice"),
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
        mockUser("alice"),
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
        mockUser("alice"),
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
        mockUser("alice"),
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
        mockUser("alice"),
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
        mockUser("alice"),
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
        mockUser("alice"),
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

  // ---------------------------------------------------------------------------
  // Handle rotation
  // ---------------------------------------------------------------------------

  describe("handle rotation", () => {
    it("starts at offset 0 when no stored offset exists", async () => {
      vi.mocked(cacheGet).mockResolvedValue(null);
      const users = Array.from({ length: 10 }, (_, i) => mockUser(`user${i}`));
      mockedDbGetUsers.mockResolvedValue(users);
      mockedGetStats.mockResolvedValue(null);

      const res = await GET(makeRequest("test-cron-secret"));
      const body = await res.json();

      expect(body.rotation.offset).toBe(0);
      expect(body.handles).toEqual(users.map((u) => u.handle));
    });

    it("reads stored offset and slices from that position", async () => {
      // 80 users, offset=10, MAX_HANDLES=50 → takes users 10–59
      vi.mocked(cacheGet).mockResolvedValue(10);
      const users = Array.from({ length: 80 }, (_, i) => mockUser(`user${i}`));
      mockedDbGetUsers.mockResolvedValue(users);
      mockedGetStats.mockResolvedValue(null);

      const res = await GET(makeRequest("test-cron-secret"));
      const body = await res.json();

      expect(body.rotation.offset).toBe(10);
      expect(body.handles[0]).toBe("user10");
      expect(body.handles).toHaveLength(50);
      expect(body.handles[49]).toBe("user59");
    });

    it("stores next offset after processing", async () => {
      vi.mocked(cacheGet).mockResolvedValue(0);
      const users = Array.from({ length: 60 }, (_, i) => mockUser(`user${i}`));
      mockedDbGetUsers.mockResolvedValue(users);
      mockedGetStats.mockResolvedValue(null);

      await GET(makeRequest("test-cron-secret"));

      // Next offset should be 50 (0 + MAX_HANDLES)
      expect(cacheSet).toHaveBeenCalledWith(
        "cron:warm-cache:offset",
        50,
        0,
      );
    });

    it("wraps around when offset + MAX_HANDLES exceeds total users", async () => {
      // 120 users, offset=100, MAX_HANDLES=50 → takes 100–119 + 0–29
      vi.mocked(cacheGet).mockResolvedValue(100);
      const users = Array.from({ length: 120 }, (_, i) => mockUser(`user${i}`));
      mockedDbGetUsers.mockResolvedValue(users);
      mockedGetStats.mockResolvedValue(null);

      const res = await GET(makeRequest("test-cron-secret"));
      const body = await res.json();

      expect(body.handles).toHaveLength(50);
      expect(body.handles[0]).toBe("user100");
      expect(body.handles[19]).toBe("user119");
      expect(body.handles[20]).toBe("user0");
      expect(body.handles[49]).toBe("user29");
      expect(body.rotation.nextOffset).toBe(30); // (100 + 50) % 120
    });

    it("resets offset to 0 when stored offset is past end of user list", async () => {
      // 80 users but offset=200 → reset to 0
      vi.mocked(cacheGet).mockResolvedValue(200);
      const users = Array.from({ length: 80 }, (_, i) => mockUser(`user${i}`));
      mockedDbGetUsers.mockResolvedValue(users);
      mockedGetStats.mockResolvedValue(null);

      const res = await GET(makeRequest("test-cron-secret"));
      const body = await res.json();

      expect(body.handles[0]).toBe("user0");
      expect(body.handles).toHaveLength(50);
    });

    it("includes rotation metadata in response", async () => {
      vi.mocked(cacheGet).mockResolvedValue(0);
      const users = Array.from({ length: 120 }, (_, i) => mockUser(`user${i}`));
      mockedDbGetUsers.mockResolvedValue(users);
      mockedGetStats.mockResolvedValue(null);

      const res = await GET(makeRequest("test-cron-secret"));
      const body = await res.json();

      expect(body.rotation).toEqual({
        offset: 0,
        nextOffset: 50,
        totalUsers: 120,
        coversAll: false,
      });
    });

    it("sets coversAll=true when all users fit in one run", async () => {
      vi.mocked(cacheGet).mockResolvedValue(0);
      const users = Array.from({ length: 30 }, (_, i) => mockUser(`user${i}`));
      mockedDbGetUsers.mockResolvedValue(users);
      mockedGetStats.mockResolvedValue(null);

      const res = await GET(makeRequest("test-cron-secret"));
      const body = await res.json();

      expect(body.rotation.coversAll).toBe(true);
      expect(body.rotation.totalUsers).toBe(30);
    });
  });

  // ---------------------------------------------------------------------------
  // Priority handles
  // ---------------------------------------------------------------------------

  describe("priority handles", () => {
    afterEach(() => {
      delete process.env.WARM_CACHE_PRIORITY_HANDLES;
    });

    it("always includes priority handles even when rotation would skip them", async () => {
      process.env.WARM_CACHE_PRIORITY_HANDLES = "juan294";
      // 80 users, offset=60 → normally takes users 60–79 + 0–29 (no juan294 at index 40)
      vi.mocked(cacheGet).mockResolvedValue(60);
      const users = Array.from({ length: 80 }, (_, i) => mockUser(`user${i}`));
      // Insert juan294 at position 40 (outside the rotation window 60–79 + 0–29)
      users[40] = mockUser("juan294");
      mockedDbGetUsers.mockResolvedValue(users);
      mockedGetStats.mockResolvedValue(null);

      const res = await GET(makeRequest("test-cron-secret"));
      const body = await res.json();

      expect(body.handles).toContain("juan294");
    });

    it("does not duplicate priority handles already in the rotation window", async () => {
      process.env.WARM_CACHE_PRIORITY_HANDLES = "user5";
      const users = Array.from({ length: 10 }, (_, i) => mockUser(`user${i}`));
      mockedDbGetUsers.mockResolvedValue(users);
      mockedGetStats.mockResolvedValue(null);

      const res = await GET(makeRequest("test-cron-secret"));
      const body = await res.json();

      // user5 appears exactly once
      const count = body.handles.filter((h: string) => h === "user5").length;
      expect(count).toBe(1);
    });

    it("supports multiple comma-separated priority handles", async () => {
      process.env.WARM_CACHE_PRIORITY_HANDLES = "alice,bob";
      // 80 users at offset=60 — alice and bob are not in the default user list
      vi.mocked(cacheGet).mockResolvedValue(60);
      const users = Array.from({ length: 80 }, (_, i) => mockUser(`user${i}`));
      users[0] = mockUser("alice");
      users[1] = mockUser("bob");
      mockedDbGetUsers.mockResolvedValue(users);
      mockedGetStats.mockResolvedValue(null);

      const res = await GET(makeRequest("test-cron-secret"));
      const body = await res.json();

      expect(body.handles).toContain("alice");
      expect(body.handles).toContain("bob");
    });

    it("ignores priority handles not in the user list", async () => {
      process.env.WARM_CACHE_PRIORITY_HANDLES = "nonexistent";
      const users = Array.from({ length: 10 }, (_, i) => mockUser(`user${i}`));
      mockedDbGetUsers.mockResolvedValue(users);
      mockedGetStats.mockResolvedValue(null);

      const res = await GET(makeRequest("test-cron-secret"));
      const body = await res.json();

      // nonexistent is not a registered user, so not added
      expect(body.handles).not.toContain("nonexistent");
    });

    it("works without WARM_CACHE_PRIORITY_HANDLES env var", async () => {
      // No env var set — should behave exactly as before
      const users = Array.from({ length: 10 }, (_, i) => mockUser(`user${i}`));
      mockedDbGetUsers.mockResolvedValue(users);
      mockedGetStats.mockResolvedValue(null);

      const res = await GET(makeRequest("test-cron-secret"));
      expect(res.status).toBe(200);
    });
  });

  // ---------------------------------------------------------------------------
  // Merge operations cleanup
  // ---------------------------------------------------------------------------

  describe("merge operations cleanup", () => {
    it("calls dbCleanExpiredMergeOperations", async () => {
      mockedDbGetUsers.mockResolvedValue([]);

      await GET(makeRequest("test-cron-secret"));

      expect(vi.mocked(dbCleanExpiredMergeOperations)).toHaveBeenCalled();
    });

    it("includes expiredMergeOpsDeleted in response", async () => {
      mockedDbGetUsers.mockResolvedValue([]);
      vi.mocked(dbCleanExpiredMergeOperations).mockResolvedValue(42);

      const res = await GET(makeRequest("test-cron-secret"));
      const body = await res.json();

      expect(body.expiredMergeOpsDeleted).toBe(42);
    });

    it("does not fail if merge ops cleanup throws", async () => {
      mockedDbGetUsers.mockResolvedValue([]);
      vi.mocked(dbCleanExpiredMergeOperations).mockRejectedValue(
        new Error("Supabase down"),
      );

      const res = await GET(makeRequest("test-cron-secret"));

      expect(res.status).toBe(200);
    });
  });

  // ---------------------------------------------------------------------------
  // Snapshot cleanup
  // ---------------------------------------------------------------------------

  describe("snapshot cleanup", () => {
    it("calls dbCleanOldSnapshots", async () => {
      mockedDbGetUsers.mockResolvedValue([]);

      await GET(makeRequest("test-cron-secret"));

      expect(vi.mocked(dbCleanOldSnapshots)).toHaveBeenCalled();
    });

    it("includes expiredSnapshotsDeleted in response", async () => {
      mockedDbGetUsers.mockResolvedValue([]);
      vi.mocked(dbCleanOldSnapshots).mockResolvedValue(17);

      const res = await GET(makeRequest("test-cron-secret"));
      const body = await res.json();

      expect(body.expiredSnapshotsDeleted).toBe(17);
    });

    it("does not fail if snapshot cleanup throws", async () => {
      mockedDbGetUsers.mockResolvedValue([]);
      vi.mocked(dbCleanOldSnapshots).mockRejectedValue(
        new Error("Supabase down"),
      );

      const res = await GET(makeRequest("test-cron-secret"));

      expect(res.status).toBe(200);
    });
  });

  // ---------------------------------------------------------------------------
  // Avatar and craft warming
  // ---------------------------------------------------------------------------

  describe("avatar and craft warming", () => {
    it("warms avatar cache for handles with avatarUrl", async () => {
      mockedDbGetUsers.mockResolvedValue([mockUser("alice")]);
      mockedGetStats.mockResolvedValue({
        handle: "alice",
        avatarUrl: "https://avatars.githubusercontent.com/u/123",
      } as never);

      await GET(makeRequest("test-cron-secret"));

      expect(vi.mocked(getAvatarBase64)).toHaveBeenCalledWith(
        "alice",
        "https://avatars.githubusercontent.com/u/123",
      );
    });

    it("skips avatar warming when stats have no avatarUrl", async () => {
      mockedDbGetUsers.mockResolvedValue([mockUser("alice")]);
      mockedGetStats.mockResolvedValue({ handle: "alice" } as never);

      await GET(makeRequest("test-cron-secret"));

      expect(vi.mocked(getAvatarBase64)).not.toHaveBeenCalled();
    });

    it("warms craft cache via getCachedCraftScore", async () => {
      mockedDbGetUsers.mockResolvedValue([mockUser("alice")]);
      mockedGetStats.mockResolvedValue({ handle: "alice" } as never);

      await GET(makeRequest("test-cron-secret"));

      expect(vi.mocked(getCachedCraftScore)).toHaveBeenCalledWith("alice");
    });

    it("passes craft score to computeImpactV4 when available", async () => {
      mockedDbGetUsers.mockResolvedValue([mockUser("alice")]);
      mockedGetStats.mockResolvedValue({ handle: "alice" } as never);
      vi.mocked(getCachedCraftScore).mockResolvedValue({
        tool: "claude-code",
        dimensions: { proficiency: 80, effectiveness: 75, sophistication: 70 },
        craftScore: 75,
        tier: "Practitioner",
        reportPeriod: { start: "2025-01-01", end: "2025-12-31" },
        computedAt: "2025-12-31T00:00:00.000Z",
      });

      await GET(makeRequest("test-cron-secret"));

      expect(vi.mocked(computeImpactV4)).toHaveBeenCalledWith(
        expect.objectContaining({ handle: "alice" }),
        75,
      );
    });

    it("continues warming even if avatar fetch fails", async () => {
      mockedDbGetUsers.mockResolvedValue([mockUser("alice")]);
      mockedGetStats.mockResolvedValue({
        handle: "alice",
        avatarUrl: "https://avatars.githubusercontent.com/u/123",
      } as never);
      vi.mocked(getAvatarBase64).mockRejectedValue(new Error("CDN timeout"));

      const res = await GET(makeRequest("test-cron-secret"));
      const body = await res.json();

      expect(body.warmed).toBe(1);
      expect(body.failed).toBe(0);
    });

    it("continues warming even if craft cache fails", async () => {
      mockedDbGetUsers.mockResolvedValue([mockUser("alice")]);
      mockedGetStats.mockResolvedValue({ handle: "alice" } as never);
      vi.mocked(getCachedCraftScore).mockRejectedValue(new Error("Redis down"));

      const res = await GET(makeRequest("test-cron-secret"));
      const body = await res.json();

      expect(body.warmed).toBe(1);
      expect(body.failed).toBe(0);
    });
  });
});
