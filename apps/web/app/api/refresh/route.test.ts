import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: vi.fn(),
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

vi.mock("@/lib/history/snapshot", () => ({
  buildSnapshot: vi.fn(() => ({ date: "2025-01-01" })),
}));

vi.mock("@/lib/db/snapshots", () => ({
  dbInsertSnapshot: vi.fn(() => Promise.resolve(true)),
}));

import { requireSession } from "@/lib/auth/require-session";
import { cacheDel, rateLimit } from "@/lib/cache/redis";
import { getStats } from "@/lib/github/client";

const SESSION = {
  token: "tok",
  login: "testuser",
  name: "Test User",
  avatar_url: "https://example.com/avatar.png",
};

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
    vi.mocked(requireSession).mockReturnValue({ session: SESSION });
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(requireSession).mockReturnValue({
      error: NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      ),
    });
    const res = await POST(makeRequest("testuser"));
    expect(res.status).toBe(401);
  });

  it("returns 403 when refreshing another user's badge", async () => {
    vi.mocked(requireSession).mockReturnValue({
      session: {
        login: "otheruser",
        token: "tok",
        name: "Other User",
        avatar_url: "https://example.com/avatar.png",
      },
    });
    const res = await POST(makeRequest("testuser"));
    expect(res.status).toBe(403);
  });

  it("allows case-insensitive handle comparison", async () => {
    vi.mocked(requireSession).mockReturnValue({
      session: {
        login: "TestUser",
        token: "tok",
        name: "Test User",
        avatar_url: "https://example.com/avatar.png",
      },
    });
    vi.mocked(rateLimit).mockResolvedValue({ allowed: true, current: 1, limit: 5 });
    vi.mocked(getStats).mockResolvedValue({
      handle: "testuser",
      commitsTotal: 10,
      activeDays: 5,
      prsMergedCount: 1,
      prsMergedWeight: 2,
      reviewsSubmittedCount: 3,
      issuesClosedCount: 1,
      linesAdded: 100,
      linesDeleted: 50,
      reposContributed: 1,
      topRepoShare: 1,
      maxCommitsIn10Min: 1,
      totalStars: 0,
      totalForks: 0,
      totalWatchers: 0,
      heatmapData: [],
      fetchedAt: new Date().toISOString(),
    });

    const res = await POST(makeRequest("testuser"));
    expect(res.status).toBe(200);
  });

  it("returns 400 when handle is missing", async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
  });

  it("returns 429 when rate limited", async () => {
    vi.mocked(rateLimit).mockResolvedValue({ allowed: false, current: 6, limit: 5 });
    const res = await POST(makeRequest("testuser"));
    expect(res.status).toBe(429);
  });

  it("deletes cache and fetches fresh stats on success", async () => {
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

    // Should have deleted cache first (must match client.ts cache key: stats:v2:<handle> lowercase)
    expect(cacheDel).toHaveBeenCalledWith("stats:v2:testuser");

    // Should have fetched fresh stats with token
    expect(getStats).toHaveBeenCalledWith("testuser", "tok");

    const body = await res.json();
    expect(body.stats.commitsTotal).toBe(142);
    expect(body.impact.adjustedComposite).toBe(72);
  });

  it("returns 502 when GitHub fetch fails", async () => {
    vi.mocked(rateLimit).mockResolvedValue({ allowed: true, current: 1, limit: 5 });
    vi.mocked(getStats).mockResolvedValue(null);

    const res = await POST(makeRequest("testuser"));
    expect(res.status).toBe(502);
  });
});
