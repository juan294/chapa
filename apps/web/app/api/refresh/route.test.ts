import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth/github", () => ({
  readSessionCookie: vi.fn(),
}));

vi.mock("@/lib/cache/redis", () => ({
  cacheDel: vi.fn(),
  rateLimit: vi.fn().mockResolvedValue({ allowed: true, current: 1, limit: 5 }),
}));

vi.mock("@/lib/github/client", () => ({
  getStats: vi.fn(),
}));

vi.mock("@/lib/validation", () => ({
  isValidHandle: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/impact/v4", () => ({
  computeImpactV4: vi.fn().mockReturnValue({
    handle: "testuser",
    profileType: "collaborative",
    adjustedComposite: 72,
    compositeScore: 72,
    confidence: 85,
    tier: "Solid",
    confidencePenalties: [],
    dimensions: { building: 75, guarding: 65, consistency: 70, breadth: 60 },
    archetype: "Builder",
    computedAt: new Date().toISOString(),
  }),
}));

import { readSessionCookie } from "@/lib/auth/github";
import { cacheDel, rateLimit } from "@/lib/cache/redis";
import { getStats } from "@/lib/github/client";

function makeRequest(handle?: string): NextRequest {
  const url = handle
    ? `http://localhost:3001/api/refresh?handle=${handle}`
    : "http://localhost:3001/api/refresh";
  return new NextRequest(url, { method: "POST" });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXTAUTH_SECRET = "test-secret";
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(readSessionCookie).mockReturnValue(null);
    const res = await POST(makeRequest("testuser"));
    expect(res.status).toBe(401);
  });

  it("returns 403 when refreshing another user's badge", async () => {
    vi.mocked(readSessionCookie).mockReturnValue({
      login: "otheruser",
      token: "tok",
      name: "Other User",
      avatar_url: "https://example.com/avatar.png",
    });
    const res = await POST(makeRequest("testuser"));
    expect(res.status).toBe(403);
  });

  it("returns 400 when handle is missing", async () => {
    vi.mocked(readSessionCookie).mockReturnValue({
      login: "testuser",
      token: "tok",
      name: "Test User",
      avatar_url: "https://example.com/avatar.png",
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
  });

  it("returns 429 when rate limited", async () => {
    vi.mocked(readSessionCookie).mockReturnValue({
      login: "testuser",
      token: "tok",
      name: "Test User",
      avatar_url: "https://example.com/avatar.png",
    });
    vi.mocked(rateLimit).mockResolvedValue({ allowed: false, current: 6, limit: 5 });
    const res = await POST(makeRequest("testuser"));
    expect(res.status).toBe(429);
  });

  it("deletes cache and fetches fresh stats on success", async () => {
    vi.mocked(readSessionCookie).mockReturnValue({
      login: "testuser",
      token: "tok",
      name: "Test User",
      avatar_url: "https://example.com/avatar.png",
    });
    vi.mocked(rateLimit).mockResolvedValue({ allowed: true, current: 1, limit: 5 });
    vi.mocked(getStats).mockResolvedValue({
      handle: "testuser",
      commitsTotal: 142,
      activeDays: 45,
      prsMergedCount: 18,
      prsMergedWeight: 22,
      reviewsSubmittedCount: 31,
      issuesClosedCount: 5,
      linesAdded: 4200,
      linesDeleted: 1100,
      reposContributed: 4,
      topRepoShare: 0.6,
      maxCommitsIn10Min: 3,
      totalStars: 0,
      totalForks: 0,
      totalWatchers: 0,
      heatmapData: [],
      fetchedAt: new Date().toISOString(),
    });

    const res = await POST(makeRequest("testuser"));
    expect(res.status).toBe(200);

    // Should have deleted cache first
    expect(cacheDel).toHaveBeenCalledWith("stats:testuser");

    // Should have fetched fresh stats with token
    expect(getStats).toHaveBeenCalledWith("testuser", "tok");

    const body = await res.json();
    expect(body.stats.commitsTotal).toBe(142);
    expect(body.impact.adjustedComposite).toBe(72);
  });

  it("returns 502 when GitHub fetch fails", async () => {
    vi.mocked(readSessionCookie).mockReturnValue({
      login: "testuser",
      token: "tok",
      name: "Test User",
      avatar_url: "https://example.com/avatar.png",
    });
    vi.mocked(rateLimit).mockResolvedValue({ allowed: true, current: 1, limit: 5 });
    vi.mocked(getStats).mockResolvedValue(null);

    const res = await POST(makeRequest("testuser"));
    expect(res.status).toBe(502);
  });
});
