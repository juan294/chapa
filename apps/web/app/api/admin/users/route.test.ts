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
  scanKeys: vi.fn(),
  cacheMGet: vi.fn(),
  rateLimit: vi.fn().mockResolvedValue({ allowed: true, current: 1, limit: 10 }),
}));

vi.mock("@/lib/http/client-ip", () => ({
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

vi.mock("@/lib/impact/v4", () => ({
  computeImpactV4: vi.fn(),
}));

import { readSessionCookie } from "@/lib/auth/github";
import { isAdminHandle } from "@/lib/auth/admin";
import { scanKeys, cacheMGet, rateLimit } from "@/lib/cache/redis";
import { computeImpactV4 } from "@/lib/impact/v4";

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
  // scanKeys is called twice: once for stats:v2:* (primary), once for stats:stale:* (stale)
  vi.mocked(scanKeys)
    .mockResolvedValueOnce(["stats:v2:testuser"])  // primary
    .mockResolvedValueOnce([]);                     // stale
  vi.mocked(cacheMGet).mockResolvedValue([MOCK_STATS]);
  vi.mocked(computeImpactV4).mockReturnValue(MOCK_IMPACT);
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

  it("returns empty list when no stats keys in Redis", async () => {
    vi.mocked(scanKeys)
      .mockReset()
      .mockResolvedValueOnce([])   // primary
      .mockResolvedValueOnce([]);  // stale
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.users).toEqual([]);
  });

  it("finds users from stale keys when primary cache expired", async () => {
    const staleUser = { ...MOCK_STATS, handle: "staleuser" };
    vi.mocked(scanKeys)
      .mockReset()
      .mockResolvedValueOnce([])                        // primary — empty
      .mockResolvedValueOnce(["stats:stale:staleuser"]); // stale
    vi.mocked(cacheMGet).mockResolvedValue([staleUser]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.users).toHaveLength(1);
    expect(body.users[0].handle).toBe("staleuser");
  });

  it("deduplicates users present in both primary and stale keys", async () => {
    vi.mocked(scanKeys)
      .mockReset()
      .mockResolvedValueOnce(["stats:v2:user1"])      // primary
      .mockResolvedValueOnce(["stats:stale:user1"]);   // stale (same user)
    vi.mocked(cacheMGet).mockResolvedValue([MOCK_STATS]); // only 1 key fetched

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.users).toHaveLength(1);
    // Should prefer the primary key
    expect(vi.mocked(cacheMGet)).toHaveBeenCalledWith(["stats:v2:user1"]);
  });

  it("skips null values from cacheMGet", async () => {
    vi.mocked(scanKeys)
      .mockReset()
      .mockResolvedValueOnce(["stats:v2:user1", "stats:v2:user2"])
      .mockResolvedValueOnce([]);
    vi.mocked(cacheMGet).mockResolvedValue([MOCK_STATS, null]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.users).toHaveLength(1);
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
});
