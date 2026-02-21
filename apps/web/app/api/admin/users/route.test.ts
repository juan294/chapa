import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

vi.mock("@/lib/auth/github", () => ({
  readSessionCookie: vi.fn(),
}));

vi.mock("@/lib/auth/admin", () => ({
  isAdminHandle: vi.fn(),
}));

vi.mock("@/lib/cache/redis", () => ({
  cacheMGet: vi.fn(),
  rateLimit: vi.fn().mockResolvedValue({ allowed: true, current: 1, limit: 10 }),
}));

vi.mock("@/lib/db/users", () => ({
  dbGetUsers: vi.fn(() => Promise.resolve([])),
}));

vi.mock("@/lib/http/client-ip", () => ({
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

vi.mock("@/lib/impact/v4", () => ({
  computeImpactV4: vi.fn(),
}));

vi.mock("@/lib/impact/smoothing", () => ({
  applyEMA: vi.fn(),
}));

vi.mock("@/lib/impact/utils", () => ({
  getTier: vi.fn(),
}));

vi.mock("@/lib/db/snapshots", () => ({
  dbGetLatestSnapshotBatch: vi.fn(),
}));

import { readSessionCookie } from "@/lib/auth/github";
import { isAdminHandle } from "@/lib/auth/admin";
import { cacheMGet, rateLimit } from "@/lib/cache/redis";
import { dbGetUsers } from "@/lib/db/users";
import { computeImpactV4 } from "@/lib/impact/v4";
import { applyEMA } from "@/lib/impact/smoothing";
import { getTier } from "@/lib/impact/utils";
import { dbGetLatestSnapshotBatch } from "@/lib/db/snapshots";

const MOCK_STATS = {
  handle: "testuser",
  displayName: "Test User",
  avatarUrl: "https://avatars.githubusercontent.com/u/1",
  commitsTotal: 100,
  prsMergedCount: 20,
  prsMergedWeight: 40,
  reviewsSubmittedCount: 15,
  issuesClosedCount: 5,
  linesAdded: 5000,
  linesDeleted: 2000,
  reposContributed: 8,
  topRepoShare: 0.4,
  maxCommitsIn10Min: 3,
  totalStars: 50,
  totalForks: 10,
  totalWatchers: 5,
  activeDays: 180,
  heatmapData: [{ date: "2025-01-01", count: 5 }],
  fetchedAt: "2025-06-01T00:00:00Z",
};

const MOCK_IMPACT = {
  handle: "testuser",
  profileType: "collaborative" as const,
  dimensions: { building: 70, guarding: 60, consistency: 80, breadth: 50 },
  archetype: "Builder" as const,
  compositeScore: 65,
  confidence: 85,
  confidencePenalties: [],
  adjustedComposite: 65,
  tier: "Solid" as const,
  computedAt: "2025-06-01T00:00:00Z",
};

function makeRequest(): NextRequest {
  return new NextRequest("https://chapa.thecreativetoken.com/api/admin/users", {
    headers: { cookie: "chapa_session=encrypted-value" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXTAUTH_SECRET", "test-secret");
  vi.stubEnv("ADMIN_HANDLES", "admin1");
  vi.mocked(readSessionCookie).mockReturnValue({
    login: "admin1",
    name: "Admin One",
    avatar_url: "https://example.com/avatar.png",
    token: "gho_fake",
  });
  vi.mocked(isAdminHandle).mockReturnValue(true);
  vi.mocked(rateLimit).mockResolvedValue({ allowed: true, current: 1, limit: 10 });
  // dbGetUsers returns user handles from Supabase
  vi.mocked(dbGetUsers).mockResolvedValue([
    { handle: "testuser", registeredAt: "2025-06-01T00:00:00Z" },
  ]);
  // cacheMGet is called twice: primary keys, stale keys
  vi.mocked(cacheMGet)
    .mockResolvedValueOnce([MOCK_STATS])            // primary stats
    .mockResolvedValueOnce([null]);                  // stale stats (not needed)
  vi.mocked(computeImpactV4).mockReturnValue(MOCK_IMPACT);
  // EMA smoothing: by default, batch returns empty map → raw score passes through
  vi.mocked(dbGetLatestSnapshotBatch).mockResolvedValue(new Map());
  vi.mocked(applyEMA).mockImplementation((current) => Math.round(current));
  vi.mocked(getTier).mockReturnValue("Solid");
});

describe("GET /api/admin/users", () => {
  it("returns user list for admin", async () => {
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.users).toHaveLength(1);
    expect(body.users[0].handle).toBe("testuser");
    expect(body.users[0].archetype).toBe("Builder");
    expect(body.users[0].tier).toBe("Solid");
    expect(body.users[0].adjustedComposite).toBe(65);
    // heatmapData should NOT be in the response (too large)
    expect(body.users[0].heatmapData).toBeUndefined();
  });

  it("returns 401 when session is missing", async () => {
    vi.mocked(readSessionCookie).mockReturnValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 401 when NEXTAUTH_SECRET is not set", async () => {
    vi.stubEnv("NEXTAUTH_SECRET", "");
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not admin", async () => {
    vi.mocked(isAdminHandle).mockReturnValue(false);
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
  });

  it("returns 429 when rate limited", async () => {
    vi.mocked(rateLimit).mockResolvedValue({ allowed: false, current: 11, limit: 10 });
    const res = await GET(makeRequest());
    expect(res.status).toBe(429);
  });

  it("returns empty list when no users in Supabase", async () => {
    vi.mocked(dbGetUsers).mockResolvedValue([]);
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.users).toEqual([]);
  });

  it("discovers users from Supabase via dbGetUsers", async () => {
    vi.mocked(dbGetUsers).mockResolvedValue([
      { handle: "user1", registeredAt: "2025-06-01T00:00:00Z" },
      { handle: "user2", registeredAt: "2025-05-01T00:00:00Z" },
    ]);
    vi.mocked(cacheMGet)
      .mockReset()
      .mockResolvedValueOnce([MOCK_STATS, { ...MOCK_STATS, handle: "user2" }])   // primary
      .mockResolvedValueOnce([null, null]);                                        // stale

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.users).toHaveLength(2);
    expect(dbGetUsers).toHaveBeenCalledTimes(1);
  });

  it("uses stale stats as fallback when primary cache expired", async () => {
    const staleUser = { ...MOCK_STATS, handle: "staleuser" };
    vi.mocked(dbGetUsers).mockResolvedValue([
      { handle: "staleuser", registeredAt: "2025-06-01T00:00:00Z" },
    ]);
    vi.mocked(cacheMGet)
      .mockReset()
      .mockResolvedValueOnce([null])         // primary miss
      .mockResolvedValueOnce([staleUser]);   // stale hit

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.users).toHaveLength(1);
    expect(body.users[0].handle).toBe("staleuser");
    expect(body.users[0].statsExpired).toBe(false);
  });

  it("shows statsExpired when all caches expired", async () => {
    vi.mocked(dbGetUsers).mockResolvedValue([
      { handle: "expireduser", registeredAt: "2025-06-01T00:00:00Z" },
    ]);
    vi.mocked(cacheMGet)
      .mockReset()
      .mockResolvedValueOnce([null])   // primary miss
      .mockResolvedValueOnce([null]);  // stale miss

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.users).toHaveLength(1);
    expect(body.users[0].handle).toBe("expireduser");
    expect(body.users[0].statsExpired).toBe(true);
    expect(body.users[0].archetype).toBeNull();
  });

  it("returns statsExpired false for users with stats", async () => {
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.users[0].statsExpired).toBe(false);
  });

  it("includes selected stats fields in response", async () => {
    const res = await GET(makeRequest());
    const body = await res.json();
    const user = body.users[0];

    expect(user).toHaveProperty("handle");
    expect(user).toHaveProperty("displayName");
    expect(user).toHaveProperty("avatarUrl");
    expect(user).toHaveProperty("fetchedAt");
    expect(user).toHaveProperty("commitsTotal");
    expect(user).toHaveProperty("prsMergedCount");
    expect(user).toHaveProperty("reviewsSubmittedCount");
    expect(user).toHaveProperty("activeDays");
    expect(user).toHaveProperty("reposContributed");
    expect(user).toHaveProperty("totalStars");
    expect(user).toHaveProperty("confidence");
  });

  describe("EMA smoothing", () => {
    it("applies EMA smoothing using previous snapshot from batch", async () => {
      vi.mocked(dbGetLatestSnapshotBatch).mockResolvedValue(
        new Map([["testuser", { adjustedComposite: 50 } as never]]),
      );
      // applyEMA(65, 50) with alpha=0.15 → round(0.15*65 + 0.85*50) = round(52.25) = 52
      vi.mocked(applyEMA).mockReturnValue(52);
      vi.mocked(getTier).mockReturnValue("Emerging");

      const res = await GET(makeRequest());
      const body = await res.json();

      expect(applyEMA).toHaveBeenCalledWith(65, 50);
      expect(getTier).toHaveBeenCalledWith(52);
      expect(body.users[0].adjustedComposite).toBe(52);
      expect(body.users[0].tier).toBe("Emerging");
    });

    it("passes null to applyEMA when handle absent from batch Map", async () => {
      vi.mocked(dbGetLatestSnapshotBatch).mockResolvedValue(new Map());
      vi.mocked(applyEMA).mockReturnValue(65);
      vi.mocked(getTier).mockReturnValue("Solid");

      const res = await GET(makeRequest());
      const body = await res.json();

      expect(applyEMA).toHaveBeenCalledWith(65, null);
      expect(body.users[0].adjustedComposite).toBe(65);
    });

    it("calls batch once with all stat-having handles", async () => {
      vi.mocked(dbGetUsers).mockResolvedValue([
        { handle: "user1", registeredAt: "2025-06-01T00:00:00Z" },
        { handle: "user2", registeredAt: "2025-05-01T00:00:00Z" },
      ]);
      vi.mocked(cacheMGet)
        .mockReset()
        .mockResolvedValueOnce([MOCK_STATS, { ...MOCK_STATS, handle: "user2" }])
        .mockResolvedValueOnce([null, null]);

      await GET(makeRequest());

      expect(dbGetLatestSnapshotBatch).toHaveBeenCalledTimes(1);
      expect(dbGetLatestSnapshotBatch).toHaveBeenCalledWith(["user1", "user2"]);
    });

    it("does not include handles without stats in batch call", async () => {
      vi.mocked(dbGetUsers).mockResolvedValue([
        { handle: "nostats", registeredAt: "2025-06-01T00:00:00Z" },
      ]);
      vi.mocked(cacheMGet)
        .mockReset()
        .mockResolvedValueOnce([null])
        .mockResolvedValueOnce([null]);

      await GET(makeRequest());

      // Batch is still called but with empty array (short-circuits internally)
      expect(dbGetLatestSnapshotBatch).toHaveBeenCalledWith([]);
    });
  });
});
