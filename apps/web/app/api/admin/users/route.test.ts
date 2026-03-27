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
  rateLimit: vi.fn().mockResolvedValue({ allowed: true, current: 1, limit: 10 }),
}));

vi.mock("@/lib/http/client-ip", () => ({
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

vi.mock("@/lib/db/admin-users", () => ({
  dbGetAdminUsers: vi.fn(),
}));

import { readSessionCookie } from "@/lib/auth/github";
import { isAdminHandle } from "@/lib/auth/admin";
import { rateLimit } from "@/lib/cache/redis";
import { dbGetAdminUsers } from "@/lib/db/admin-users";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_ADMIN_RESULT = {
  users: [
    {
      handle: "testuser",
      displayName: "Test User",
      avatarUrl: "https://avatars.githubusercontent.com/u/1",
      registeredAt: "2025-06-01T00:00:00Z",
      lastSnapshotDate: "2025-06-01",
      fetchedAt: "2025-06-01T12:00:00Z",
      commitsTotal: 100,
      prsMergedCount: 20,
      reviewsSubmittedCount: 15,
      activeDays: 180,
      reposContributed: 8,
      totalStars: 50,
      archetype: "Builder",
      tier: "Solid",
      adjustedComposite: 65,
      rawScore: 60,
      confidence: 85,
    },
  ],
  total: 1,
  page: 1,
  limit: 25,
  totalPages: 1,
};

function makeRequest(params?: Record<string, string>): NextRequest {
  const url = new URL("https://chapa.thecreativetoken.com/api/admin/users");
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }
  return new NextRequest(url, {
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
  vi.mocked(dbGetAdminUsers).mockResolvedValue(MOCK_ADMIN_RESULT);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/admin/users", () => {
  // Auth & rate limit (unchanged)
  it("returns 401 when session is missing", async () => {
    vi.mocked(readSessionCookie).mockReturnValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 500 when NEXTAUTH_SECRET is not set", async () => {
    vi.stubEnv("NEXTAUTH_SECRET", "");
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
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

  // Data layer — dbGetAdminUsers
  it("returns paginated users from Supabase", async () => {
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.users).toHaveLength(1);
    expect(body.users[0].handle).toBe("testuser");
    expect(body.users[0].archetype).toBe("Builder");
    expect(body.users[0].tier).toBe("Solid");
    expect(body.users[0].adjustedComposite).toBe(65);
  });

  it("passes default query params when none provided", async () => {
    await GET(makeRequest());

    expect(dbGetAdminUsers).toHaveBeenCalledWith({
      page: 1,
      limit: 25,
      sort: "adjustedComposite",
      dir: "desc",
      search: undefined,
      tier: undefined,
      archetype: undefined,
    });
  });

  it("passes custom query params from URL", async () => {
    await GET(makeRequest({
      page: "2",
      limit: "50",
      sort: "handle",
      dir: "asc",
      search: "juan",
    }));

    expect(dbGetAdminUsers).toHaveBeenCalledWith({
      page: 2,
      limit: 50,
      sort: "handle",
      dir: "asc",
      search: "juan",
      tier: undefined,
      archetype: undefined,
    });
  });

  it("returns 400 for invalid sort field", async () => {
    const res = await GET(makeRequest({ sort: "invalidField" }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/sort/i);
  });

  it("passes tier filter", async () => {
    await GET(makeRequest({ tier: "Elite" }));

    expect(dbGetAdminUsers).toHaveBeenCalledWith(
      expect.objectContaining({ tier: "Elite" }),
    );
  });

  it("passes archetype filter", async () => {
    await GET(makeRequest({ archetype: "Builder" }));

    expect(dbGetAdminUsers).toHaveBeenCalledWith(
      expect.objectContaining({ archetype: "Builder" }),
    );
  });

  it("returns empty result when no users exist", async () => {
    vi.mocked(dbGetAdminUsers).mockResolvedValue({
      users: [],
      total: 0,
      page: 1,
      limit: 25,
      totalPages: 0,
    });

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.users).toEqual([]);
    expect(body.total).toBe(0);
  });

  it("includes pagination metadata in response", async () => {
    vi.mocked(dbGetAdminUsers).mockResolvedValue({
      users: [],
      total: 150,
      page: 3,
      limit: 25,
      totalPages: 6,
    });

    const res = await GET(makeRequest({ page: "3" }));
    const body = await res.json();

    expect(body.total).toBe(150);
    expect(body.page).toBe(3);
    expect(body.limit).toBe(25);
    expect(body.totalPages).toBe(6);
  });

  it("sets Cache-Control: no-store header", async () => {
    const res = await GET(makeRequest());
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("includes all expected user fields in response", async () => {
    const res = await GET(makeRequest());
    const body = await res.json();
    const user = body.users[0];

    expect(user).toHaveProperty("handle");
    expect(user).toHaveProperty("displayName");
    expect(user).toHaveProperty("avatarUrl");
    expect(user).toHaveProperty("registeredAt");
    expect(user).toHaveProperty("lastSnapshotDate");
    expect(user).toHaveProperty("fetchedAt");
    expect(user).toHaveProperty("commitsTotal");
    expect(user).toHaveProperty("prsMergedCount");
    expect(user).toHaveProperty("reviewsSubmittedCount");
    expect(user).toHaveProperty("activeDays");
    expect(user).toHaveProperty("reposContributed");
    expect(user).toHaveProperty("totalStars");
    expect(user).toHaveProperty("confidence");
    expect(user).toHaveProperty("archetype");
    expect(user).toHaveProperty("tier");
    expect(user).toHaveProperty("adjustedComposite");
    expect(user).toHaveProperty("rawScore");
  });

  it("does not include statsExpired in response", async () => {
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.users[0]).not.toHaveProperty("statsExpired");
  });

  it("returns 504 when Supabase call times out", async () => {
    vi.useFakeTimers();

    // Mock a promise that never resolves
    vi.mocked(dbGetAdminUsers).mockImplementation(
      () => new Promise(() => {}),
    );

    const resPromise = GET(makeRequest());

    // Advance past the 10s timeout
    await vi.advanceTimersByTimeAsync(10_001);

    const res = await resPromise;
    expect(res.status).toBe(504);
    const body = await res.json();
    expect(body.error).toMatch(/timeout/i);

    vi.useRealTimers();
  });

  it("accepts all valid sort fields", async () => {
    const validFields = [
      "handle", "adjustedComposite", "rawScore", "confidence",
      "commitsTotal", "prsMergedCount", "reviewsSubmittedCount",
      "activeDays", "totalStars", "tier", "archetype",
      "registeredAt", "lastSnapshotDate",
    ];

    for (const field of validFields) {
      vi.clearAllMocks();
      vi.mocked(readSessionCookie).mockReturnValue({
        login: "admin1",
        name: "Admin One",
        avatar_url: "https://example.com/avatar.png",
        token: "gho_fake",
      });
      vi.mocked(isAdminHandle).mockReturnValue(true);
      vi.mocked(rateLimit).mockResolvedValue({ allowed: true, current: 1, limit: 10 });
      vi.mocked(dbGetAdminUsers).mockResolvedValue(MOCK_ADMIN_RESULT);

      const res = await GET(makeRequest({ sort: field }));
      expect(res.status).toBe(200);
    }
  });
});
