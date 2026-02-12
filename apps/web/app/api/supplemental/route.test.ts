import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock dependencies BEFORE importing the route handler.
// ---------------------------------------------------------------------------

const { mockFetchGitHubUser, mockCacheSet, mockCacheDel, mockRateLimit } = vi.hoisted(() => ({
  mockFetchGitHubUser: vi.fn(),
  mockCacheSet: vi.fn(),
  mockCacheDel: vi.fn(),
  mockRateLimit: vi.fn(),
}));

vi.mock("@/lib/auth/github", () => ({
  fetchGitHubUser: mockFetchGitHubUser,
}));

vi.mock("@/lib/cache/redis", () => ({
  cacheSet: mockCacheSet,
  cacheDel: mockCacheDel,
  rateLimit: mockRateLimit,
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
): Request {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return new Request("https://chapa.thecreativetoken.com/api/supplemental", {
    method: "POST",
    body: JSON.stringify(body),
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
    mockFetchGitHubUser.mockResolvedValue(null);
    const req = makeRequest(
      { targetHandle: "juan294", sourceHandle: "juan_corp", stats: validStats },
      "bad-token",
    );
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated user does not match targetHandle", async () => {
    mockFetchGitHubUser.mockResolvedValue({
      login: "other-user",
      name: "Other",
      avatar_url: "https://example.com/other.png",
    });
    const req = makeRequest(
      { targetHandle: "juan294", sourceHandle: "juan_corp", stats: validStats },
      "valid-token",
    );
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 400 when body is missing required fields", async () => {
    mockFetchGitHubUser.mockResolvedValue({
      login: "juan294",
      name: "Juan",
      avatar_url: "https://example.com/juan.png",
    });
    const req = makeRequest(
      { targetHandle: "juan294" }, // missing sourceHandle, stats
      "valid-token",
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when stats shape is invalid", async () => {
    mockFetchGitHubUser.mockResolvedValue({
      login: "juan294",
      name: "Juan",
      avatar_url: "https://example.com/juan.png",
    });
    const req = makeRequest(
      { targetHandle: "juan294", sourceHandle: "juan_corp", stats: { bad: true } },
      "valid-token",
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when sourceHandle is invalid", async () => {
    mockFetchGitHubUser.mockResolvedValue({
      login: "juan294",
      name: "Juan",
      avatar_url: "https://example.com/juan.png",
    });
    const req = makeRequest(
      { targetHandle: "juan294", sourceHandle: "<script>", stats: validStats },
      "valid-token",
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 200 and stores data on success", async () => {
    mockFetchGitHubUser.mockResolvedValue({
      login: "juan294",
      name: "Juan",
      avatar_url: "https://example.com/juan.png",
    });
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
    mockFetchGitHubUser.mockResolvedValue({
      login: "juan294",
      name: "Juan",
      avatar_url: "https://example.com/juan.png",
    });
    const req = makeRequest(
      { targetHandle: "juan294", sourceHandle: "juan_corp", stats: validStats },
      "valid-token",
    );
    await POST(req);

    expect(mockCacheSet).toHaveBeenCalledWith(
      "supplemental:juan294",
      expect.objectContaining({
        targetHandle: "juan294",
        sourceHandle: "juan_corp",
        stats: validStats,
      }),
      86400,
    );
  });

  it("invalidates the primary stats cache", async () => {
    mockFetchGitHubUser.mockResolvedValue({
      login: "juan294",
      name: "Juan",
      avatar_url: "https://example.com/juan.png",
    });
    const req = makeRequest(
      { targetHandle: "juan294", sourceHandle: "juan_corp", stats: validStats },
      "valid-token",
    );
    await POST(req);

    expect(mockCacheDel).toHaveBeenCalledWith("stats:juan294");
  });

  it("handle comparison is case-insensitive", async () => {
    mockFetchGitHubUser.mockResolvedValue({
      login: "Juan294",
      name: "Juan",
      avatar_url: "https://example.com/juan.png",
    });
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
    mockRateLimit.mockResolvedValue({ allowed: false, current: 11, limit: 10 });

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
    mockFetchGitHubUser.mockResolvedValue({
      login: "juan294",
      name: "Juan",
      avatar_url: "https://example.com/juan.png",
    });

    const req = makeRequest(
      { targetHandle: "juan294", sourceHandle: "juan_corp", stats: validStats },
      "valid-token",
    );
    await POST(req);

    expect(mockRateLimit).toHaveBeenCalledWith(
      "ratelimit:supplemental:juan294",
      10,
      86400,
    );
  });

  it("includes Retry-After header when rate limited", async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, current: 11, limit: 10 });

    const req = makeRequest(
      { targetHandle: "juan294", sourceHandle: "juan_corp", stats: validStats },
      "valid-token",
    );
    const res = await POST(req);

    expect(res.headers.get("Retry-After")).toBe("86400");
  });
});
