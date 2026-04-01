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
    dimensions: { delivery: 75, quality: 65, consistency: 70, breadth: 60 },
    archetype: "Builder",
    computedAt: new Date().toISOString(),
  }),
}));

vi.mock("@/lib/history/snapshot", () => ({
  buildSnapshot: vi.fn(() => ({ date: "2025-01-01" })),
}));

vi.mock("@/lib/db/snapshots", () => ({
  dbReplaceSnapshot: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("@/lib/cache/snapshot-cache", () => ({
  getCachedLatestSnapshot: vi.fn(() => Promise.resolve(null)),
  updateSnapshotCache: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/history/history", () => ({
  invalidateHistoryCache: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/analytics/server-errors", () => ({
  captureServerError: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { requireSession } from "@/lib/auth/require-session";
import { cacheDel, rateLimit } from "@/lib/cache/redis";
import { getStats } from "@/lib/github/client";
import { invalidateHistoryCache } from "@/lib/history/history";
import { dbReplaceSnapshot } from "@/lib/db/snapshots";
import { updateSnapshotCache } from "@/lib/cache/snapshot-cache";
import { captureServerError } from "@/lib/analytics/server-errors";
import { revalidatePath } from "next/cache";

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

    // Should have deleted merged cache key (must match client.ts: stats:v2:merged:<handle>)
    expect(cacheDel).toHaveBeenCalledWith("stats:v2:merged:testuser");

    // Should have fetched fresh stats with token
    expect(getStats).toHaveBeenCalledWith("testuser", "tok");

    const body = await res.json();
    expect(body.stats.commitsTotal).toBe(142);
    expect(body.impact.adjustedComposite).toBe(72);
  });

  it("invalidates history cache on successful refresh", async () => {
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

    // Should invalidate history cache so next history request fetches fresh data
    expect(invalidateHistoryCache).toHaveBeenCalledWith("testuser");
  });

  it("returns 502 when GitHub fetch fails", async () => {
    vi.mocked(rateLimit).mockResolvedValue({ allowed: true, current: 1, limit: 5 });
    vi.mocked(getStats).mockResolvedValue(null);

    const res = await POST(makeRequest("testuser"));
    expect(res.status).toBe(502);
  });

  it("returns 500 when an unexpected error is thrown", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    vi.mocked(rateLimit).mockResolvedValue({ allowed: true, current: 1, limit: 5 });
    vi.mocked(getStats).mockRejectedValue(new Error("unexpected boom"));

    const res = await POST(makeRequest("testuser"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal server error");

    consoleErrorSpy.mockRestore();
  });

  it("executes snapshot insert .then() callback to update cache on success", async () => {
    // Use a deferred promise so we can await the fire-and-forget chain
    let resolveFn: (val: boolean) => void;
    const deferredPromise = new Promise<boolean>((resolve) => {
      resolveFn = resolve;
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

    vi.mocked(dbReplaceSnapshot).mockReturnValue(deferredPromise);

    const res = await POST(makeRequest("testuser"));
    expect(res.status).toBe(200);

    // Resolve the deferred promise to trigger the .then() callback
    resolveFn!(true);
    // Flush microtasks so the .then() callback runs
    await new Promise((r) => setTimeout(r, 0));

    expect(updateSnapshotCache).toHaveBeenCalledWith(
      "testuser",
      expect.objectContaining({ date: "2025-01-01" }),
    );
  });

  it("does not update snapshot cache when insert returns false", async () => {
    let resolveFn: (val: boolean) => void;
    const deferredPromise = new Promise<boolean>((resolve) => {
      resolveFn = resolve;
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

    vi.mocked(dbReplaceSnapshot).mockReturnValue(deferredPromise);

    const res = await POST(makeRequest("testuser"));
    expect(res.status).toBe(200);

    // Resolve with false — snapshot was a duplicate
    resolveFn!(false);
    await new Promise((r) => setTimeout(r, 0));

    expect(updateSnapshotCache).not.toHaveBeenCalled();
  });

  it("handles snapshot insert rejection gracefully via .catch()", async () => {
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

    // Make the insert reject — the .catch(() => {}) should swallow the error
    vi.mocked(dbReplaceSnapshot).mockRejectedValue(new Error("DB down"));

    const res = await POST(makeRequest("testuser"));
    expect(res.status).toBe(200);

    // Flush microtasks so the .catch() callback executes
    await new Promise((r) => setTimeout(r, 0));

    // The response should still be successful
    const body = await res.json();
    expect(body.stats).toBeDefined();
    expect(body.impact).toBeDefined();
  });

  it("calls captureServerError when GitHub fetch fails (502)", async () => {
    vi.mocked(rateLimit).mockResolvedValue({ allowed: true, current: 1, limit: 5 });
    vi.mocked(getStats).mockResolvedValue(null);

    await POST(makeRequest("testuser"));

    expect(captureServerError).toHaveBeenCalledWith(
      expect.objectContaining({
        route: "/api/refresh",
        statusCode: 502,
      }),
    );
  });

  it("calls captureServerError on unhandled exception (500)", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    vi.mocked(rateLimit).mockResolvedValue({ allowed: true, current: 1, limit: 5 });
    vi.mocked(getStats).mockRejectedValue(new Error("unexpected boom"));

    await POST(makeRequest("testuser"));

    expect(captureServerError).toHaveBeenCalledWith(
      expect.objectContaining({
        route: "/api/refresh",
        statusCode: 500,
      }),
    );

    consoleErrorSpy.mockRestore();
  });

  // ISR revalidation — Phase 1 of share-page-oauth-fix plan
  describe("ISR revalidation", () => {
    it("calls revalidatePath for the user's share page after successful refresh", async () => {
      vi.mocked(rateLimit).mockResolvedValue({ allowed: true, current: 1, limit: 15 });
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
      expect(revalidatePath).toHaveBeenCalledWith("/u/testuser");
    });

    it("does not call revalidatePath when stats fetch fails", async () => {
      vi.mocked(rateLimit).mockResolvedValue({ allowed: true, current: 1, limit: 15 });
      vi.mocked(getStats).mockResolvedValue(null);

      const res = await POST(makeRequest("testuser"));
      expect(res.status).toBe(502);
      expect(revalidatePath).not.toHaveBeenCalled();
    });
  });
});
