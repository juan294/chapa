import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mock dependencies BEFORE importing the route handler.
// ---------------------------------------------------------------------------

const { mockResolveRequestAuth, mockCacheSet, mockCacheDel, mockRateLimit, mockDbUpsertSupplemental, mockGetClientIp } = vi.hoisted(() => ({
  mockResolveRequestAuth: vi.fn(),
  mockCacheSet: vi.fn(),
  mockCacheDel: vi.fn(),
  mockRateLimit: vi.fn(),
  mockDbUpsertSupplemental: vi.fn(),
  mockGetClientIp: vi.fn(),
}));

vi.mock("@/lib/auth/resolve-request-auth", () => ({
  resolveRequestAuth: mockResolveRequestAuth,
}));

vi.mock("@/lib/cache/redis", () => ({
  cacheSet: mockCacheSet,
  cacheDel: mockCacheDel,
  rateLimit: mockRateLimit,
}));

vi.mock("@/lib/db/supplemental", () => ({
  dbUpsertSupplemental: mockDbUpsertSupplemental,
}));

vi.mock("@/lib/http/client-ip", () => ({
  NO_TRUSTED_IP: "no-trusted-ip",
  getClientIp: (...args: unknown[]) => mockGetClientIp(...args),
}));

// Re-export real validation functions through the mock to avoid alias resolution issues
vi.mock("@/lib/validation", async () => {
  const actual = await import("../../../lib/validation");
  return actual;
});

import { POST } from "./route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const validStats = {
  handle: "juan_corp",
  commitsTotal: 30,
  activeDays: 10,
  prsMergedCount: 3,
  prsMergedWeight: 5,
  reviewsSubmittedCount: 2,
  issuesClosedCount: 1,
  linesAdded: 500,
  linesDeleted: 200,
  reposContributed: 2,
  topRepoShare: 0.6,
  maxCommitsIn10Min: 3,
  totalStars: 0,
  totalForks: 0,
  totalWatchers: 0,
  heatmapData: [{ date: "2025-01-01", count: 5 }],
  fetchedAt: new Date().toISOString(),
};

function makeRequest(
  body: Record<string, unknown>,
  token?: string,
): NextRequest {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return new NextRequest("https://chapa.thecreativetoken.com/api/supplemental", {
    method: "POST",
    body: JSON.stringify(body),
    headers,
  });
}

function makeRawRequest(body: string, token?: string): NextRequest {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return new NextRequest("https://chapa.thecreativetoken.com/api/supplemental", {
    method: "POST",
    body,
    headers,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/supplemental", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCacheSet.mockResolvedValue(undefined);
    mockCacheDel.mockResolvedValue(undefined);
    mockRateLimit.mockResolvedValue({ allowed: true, current: 1, limit: 10 });
    mockDbUpsertSupplemental.mockResolvedValue(undefined);
    mockGetClientIp.mockReturnValue("127.0.0.1");
  });

  it("returns 401 when Authorization header is missing", async () => {
    const req = makeRequest({
      targetHandle: "juan294",
      sourceHandle: "juan_corp",
      stats: validStats,
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when token is invalid (GitHub rejects it)", async () => {
    mockResolveRequestAuth.mockResolvedValue(null);
    const req = makeRequest(
      { targetHandle: "juan294", sourceHandle: "juan_corp", stats: validStats },
      "bad-token",
    );
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("rate limits by IP before resolving auth", async () => {
    mockRateLimit.mockResolvedValueOnce({ allowed: false, current: 11, limit: 10 });
    const req = makeRequest(
      { targetHandle: "juan294", sourceHandle: "juan_corp", stats: validStats },
      "bad-token",
    );

    const res = await POST(req);

    expect(res.status).toBe(429);
    expect(mockRateLimit).toHaveBeenCalledWith(
      "ratelimit:supplemental-ip:127.0.0.1",
      10,
      3600,
    );
    expect(mockResolveRequestAuth).not.toHaveBeenCalled();
  });

  it("verifies bearer auth before parsing JSON", async () => {
    mockResolveRequestAuth.mockResolvedValue(null);
    const req = makeRawRequest("{", "bad-token");

    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it("rejects oversized payloads before JSON parsing", async () => {
    mockResolveRequestAuth.mockResolvedValue({ handle: "juan294" });
    const req = makeRawRequest(`{"padding":"${"x".repeat(257 * 1024)}"}`, "valid-token");

    const res = await POST(req);

    expect(res.status).toBe(413);
    expect(mockDbUpsertSupplemental).not.toHaveBeenCalled();
  });

  it("returns 403 when authenticated user does not match targetHandle", async () => {
    mockResolveRequestAuth.mockResolvedValue({ handle: "other-user" });
    const req = makeRequest(
      { targetHandle: "juan294", sourceHandle: "juan_corp", stats: validStats },
      "valid-token",
    );
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 400 when body is missing required fields", async () => {
    mockResolveRequestAuth.mockResolvedValue({ handle: "juan294" });
    const req = makeRequest(
      { targetHandle: "juan294" }, // missing sourceHandle, stats
      "valid-token",
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when stats shape is invalid", async () => {
    mockResolveRequestAuth.mockResolvedValue({ handle: "juan294" });
    const req = makeRequest(
      { targetHandle: "juan294", sourceHandle: "juan_corp", stats: { bad: true } },
      "valid-token",
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when sourceHandle is invalid", async () => {
    mockResolveRequestAuth.mockResolvedValue({ handle: "juan294" });
    const req = makeRequest(
      { targetHandle: "juan294", sourceHandle: "<script>", stats: validStats },
      "valid-token",
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 200 and stores data on success", async () => {
    mockResolveRequestAuth.mockResolvedValue({ handle: "juan294" });
    const req = makeRequest(
      { targetHandle: "juan294", sourceHandle: "juan_corp", stats: validStats },
      "valid-token",
    );
    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it("stores supplemental data in Redis with correct key and TTL", async () => {
    mockResolveRequestAuth.mockResolvedValue({ handle: "juan294" });
    const req = makeRequest(
      { targetHandle: "juan294", sourceHandle: "juan_corp", stats: validStats },
      "valid-token",
    );
    await POST(req);

    expect(mockCacheSet).toHaveBeenCalledWith(
      "supplemental:juan294",  // lowercase normalized
      expect.objectContaining({
        targetHandle: "juan294",
        sourceHandle: "juan_corp",
        stats: validStats,
      }),
      86400,
    );
  });

  it("persists supplemental data to Supabase alongside Redis (#825)", async () => {
    mockResolveRequestAuth.mockResolvedValue({ handle: "juan294" });
    const req = makeRequest(
      { targetHandle: "juan294", sourceHandle: "juan_corp", stats: validStats },
      "valid-token",
    );
    await POST(req);

    // Both stores must be written: Redis (hot path, 24h) and Supabase (durable).
    // Without DB persistence, a missed CLI upload day silently drops EMU data.
    // Match by key — the route also writes the #826 stats:dirty marker.
    const cacheSetKeys = mockCacheSet.mock.calls.map((c) => c[0]);
    expect(cacheSetKeys).toContain("supplemental:juan294");
    expect(mockDbUpsertSupplemental).toHaveBeenCalledTimes(1);
    expect(mockDbUpsertSupplemental).toHaveBeenCalledWith(
      "juan294",
      expect.objectContaining({
        targetHandle: "juan294",
        sourceHandle: "juan_corp",
        stats: validStats,
      }),
    );
  });

  it("marks stats dirty so today's snapshot lock yields to the new inputs (#826)", async () => {
    mockResolveRequestAuth.mockResolvedValue({ handle: "juan294" });
    const req = makeRequest(
      { targetHandle: "juan294", sourceHandle: "juan_corp", stats: validStats },
      "valid-token",
    );
    await POST(req);

    // The dirty marker must be written so materializeProfile picks it up on
    // the next page render and replaces today's locked snapshot value.
    expect(mockCacheSet).toHaveBeenCalledWith(
      "stats:dirty:juan294",
      1,
      3600, // DIRTY_STATS_TTL — 1h
    );
  });

  it("invalidates the v2 stats cache key (must match client.ts cache key)", async () => {
    mockResolveRequestAuth.mockResolvedValue({ handle: "juan294" });
    const req = makeRequest(
      { targetHandle: "juan294", sourceHandle: "juan_corp", stats: validStats },
      "valid-token",
    );
    await POST(req);

    // The stats client (lib/github/client.ts) uses "stats:v2:merged:<handle>" as cache key.
    // The supplemental handler MUST delete the same key to force a re-merge.
    expect(mockCacheDel).toHaveBeenCalledWith("stats:v2:merged:juan294");
  });

  it("handle comparison is case-insensitive", async () => {
    mockResolveRequestAuth.mockResolvedValue({ handle: "Juan294" });
    const req = makeRequest(
      { targetHandle: "juan294", sourceHandle: "juan_corp", stats: validStats },
      "valid-token",
    );
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  // -------------------------------------------------------------------------
  // Rate limiting
  // -------------------------------------------------------------------------

  it("returns 429 when rate limited by targetHandle", async () => {
    mockResolveRequestAuth.mockResolvedValue({ handle: "juan294" });
    mockRateLimit
      .mockResolvedValueOnce({ allowed: true, current: 1, limit: 10 })
      .mockResolvedValueOnce({ allowed: false, current: 11, limit: 10 });

    const req = makeRequest(
      { targetHandle: "juan294", sourceHandle: "juan_corp", stats: validStats },
      "valid-token",
    );
    const res = await POST(req);

    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toMatch(/too many/i);
  });

  it("rate limits by targetHandle with correct key and window (10 req / 24h)", async () => {
    mockResolveRequestAuth.mockResolvedValue({ handle: "juan294" });

    const req = makeRequest(
      { targetHandle: "juan294", sourceHandle: "juan_corp", stats: validStats },
      "valid-token",
    );
    await POST(req);

    expect(mockRateLimit).toHaveBeenCalledWith(
      "ratelimit:supplemental-ip:127.0.0.1",
      10,
      3600,
    );
    expect(mockRateLimit).toHaveBeenCalledWith(
      "ratelimit:supplemental:juan294",
      10,
      86400,
    );
  });

  it("includes Retry-After header when rate limited", async () => {
    mockResolveRequestAuth.mockResolvedValue({ handle: "juan294" });
    mockRateLimit
      .mockResolvedValueOnce({ allowed: true, current: 1, limit: 10 })
      .mockResolvedValueOnce({ allowed: false, current: 11, limit: 10 });

    const req = makeRequest(
      { targetHandle: "juan294", sourceHandle: "juan_corp", stats: validStats },
      "valid-token",
    );
    const res = await POST(req);

    expect(res.headers.get("Retry-After")).toBe("86400");
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  it("re-throws when cacheSet throws (handled by withErrorCapture)", async () => {
    mockResolveRequestAuth.mockResolvedValue({ handle: "juan294" });
    mockCacheSet.mockRejectedValue(new Error("Redis down"));

    const req = makeRequest(
      { targetHandle: "juan294", sourceHandle: "juan_corp", stats: validStats },
      "valid-token",
    );

    await expect(POST(req)).rejects.toThrow("Redis down");
  });

  it("re-throws when resolveRequestAuth throws (handled by withErrorCapture)", async () => {
    mockResolveRequestAuth.mockRejectedValue(new Error("Auth service down"));

    const req = makeRequest(
      { targetHandle: "juan294", sourceHandle: "juan_corp", stats: validStats },
      "valid-token",
    );

    await expect(POST(req)).rejects.toThrow("Auth service down");
  });

  // -------------------------------------------------------------------------
  // SE-L2 (#890): Ownership check must fire BEFORE the per-handle rate-limit
  // -------------------------------------------------------------------------

  it("verifies ownership before consuming the per-handle rate-limit quota (SE-L2)", async () => {
    // An attacker cannot exhaust another handle's bucket by sending requests
    // with their own valid token but a different targetHandle.
    const ownershipCheckOrder: number[] = [];
    const rateLimitCallOrder: number[] = [];
    let callCounter = 0;

    mockResolveRequestAuth.mockImplementation(() => {
      ownershipCheckOrder.push(++callCounter);
      return Promise.resolve({ handle: "attacker" });
    });

    mockRateLimit.mockImplementation((key: string) => {
      if (key.startsWith("ratelimit:supplemental:")) {
        rateLimitCallOrder.push(++callCounter);
      }
      return Promise.resolve({ allowed: true, current: 1, limit: 10 });
    });

    const req = makeRequest(
      { targetHandle: "victim", sourceHandle: "juan_corp", stats: validStats },
      "attacker-token",
    );

    const res = await POST(req);

    // Must be 403 (ownership mismatch)
    expect(res.status).toBe(403);

    // Ownership check must have fired
    expect(ownershipCheckOrder.length).toBeGreaterThan(0);

    // Rate-limit must NOT have been incremented for the victim's handle
    expect(rateLimitCallOrder.length).toBe(0);
  });
});
