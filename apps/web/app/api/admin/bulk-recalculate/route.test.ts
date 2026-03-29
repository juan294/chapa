import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

vi.mock("@/lib/cache/redis", () => ({
  rateLimit: vi.fn().mockResolvedValue({ allowed: true, current: 1, limit: 5 }),
  cacheDel: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/http/client-ip", () => ({
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

vi.mock("@/lib/db/users", () => ({
  dbGetUsers: vi.fn().mockResolvedValue([
    { handle: "alice" },
    { handle: "bob" },
  ]),
}));

vi.mock("@/lib/github/client", () => ({
  getStats: vi.fn().mockResolvedValue({
    handle: "testuser",
    commitsTotal: 50,
    activeDays: 30,
    prsMergedCount: 5,
    prsMergedWeight: 10,
    reviewsSubmittedCount: 0,
    issuesClosedCount: 3,
    linesAdded: 2000,
    linesDeleted: 500,
    reposContributed: 4,
    topRepoShare: 0.4,
    maxCommitsIn10Min: 3,
    totalStars: 0,
    totalForks: 0,
    totalWatchers: 0,
    heatmapData: [],
    fetchedAt: new Date().toISOString(),
  }),
}));

vi.mock("@/lib/impact/v4", () => ({
  computeImpactV4: vi.fn().mockReturnValue({
    handle: "testuser",
    profileType: "solo",
    dimensions: { delivery: 50, quality: 30, consistency: 40, breadth: 35 },
    archetype: "Emerging",
    compositeScore: 42,
    confidence: 100,
    confidencePenalties: [],
    adjustedComposite: 42,
    tier: "Solid",
    computedAt: new Date().toISOString(),
  }),
}));

vi.mock("@/lib/history/snapshot", () => ({
  buildSnapshot: vi.fn().mockReturnValue({
    date: "2026-03-28",
    capturedAt: new Date().toISOString(),
    delivery: 50,
    quality: 30,
    consistency: 40,
    breadth: 35,
    compositeScore: 42,
    adjustedComposite: 42,
    confidence: 100,
    tier: "Solid",
    archetype: "Emerging",
    profileType: "solo",
  }),
}));

vi.mock("@/lib/db/snapshots", () => ({
  dbReplaceSnapshot: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/cache/snapshot-cache", () => ({
  invalidateSnapshotCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/cache/craft-cache", () => ({
  getCachedCraftScore: vi.fn().mockResolvedValue(null),
}));

import { rateLimit } from "@/lib/cache/redis";
import { dbGetUsers } from "@/lib/db/users";
import { getStats } from "@/lib/github/client";
import { dbReplaceSnapshot } from "@/lib/db/snapshots";
import { invalidateSnapshotCache } from "@/lib/cache/snapshot-cache";

const VALID_SECRET = "test-admin-secret-123";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ADMIN_SECRET", VALID_SECRET);
  vi.mocked(rateLimit).mockResolvedValue({ allowed: true, current: 1, limit: 5 });
  vi.mocked(dbGetUsers).mockResolvedValue([
    { handle: "alice" },
    { handle: "bob" },
  ] as Awaited<ReturnType<typeof dbGetUsers>>);
});

function makeRequest(secret?: string, body?: object): NextRequest {
  const url = "https://chapa.thecreativetoken.com/api/admin/bulk-recalculate";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret !== undefined) {
    headers["Authorization"] = `Bearer ${secret}`;
  }
  return new NextRequest(url, {
    method: "POST",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("POST /api/admin/bulk-recalculate", () => {
  it("returns 401 without valid secret", async () => {
    const res = await POST(makeRequest("wrong-secret"));
    expect(res.status).toBe(401);
  });

  it("passes through when ADMIN_SECRET is not set (unprotected)", async () => {
    vi.stubEnv("ADMIN_SECRET", "");
    const res = await POST(makeRequest(VALID_SECRET));
    // When ADMIN_SECRET is not configured, the endpoint is unprotected
    // (matches verifyCronSecret pattern for unconfigured environments)
    expect(res.status).toBe(200);
  });

  it("returns 429 when rate limited", async () => {
    vi.mocked(rateLimit).mockResolvedValue({ allowed: false, current: 6, limit: 5 });
    const res = await POST(makeRequest(VALID_SECRET));
    expect(res.status).toBe(429);
  });

  it("recalculates all users when no handles provided", async () => {
    const res = await POST(makeRequest(VALID_SECRET));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.recalculated).toBe(2);
    expect(body.failed).toBe(0);
    expect(body.total).toBe(2);
    expect(dbGetUsers).toHaveBeenCalled();
    expect(getStats).toHaveBeenCalledTimes(2);
    expect(dbReplaceSnapshot).toHaveBeenCalledTimes(2);
    expect(invalidateSnapshotCache).toHaveBeenCalledTimes(2);
  });

  it("recalculates only specified handles when provided", async () => {
    const res = await POST(makeRequest(VALID_SECRET, { handles: ["alice"] }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.recalculated).toBe(1);
    expect(body.total).toBe(1);
    expect(dbGetUsers).not.toHaveBeenCalled();
    expect(getStats).toHaveBeenCalledTimes(1);
  });

  it("reports failures without aborting other handles", async () => {
    vi.mocked(getStats)
      .mockResolvedValueOnce(null) // alice fails
      .mockResolvedValueOnce({
        handle: "bob",
        commitsTotal: 50,
        activeDays: 30,
        prsMergedCount: 5,
        prsMergedWeight: 10,
        reviewsSubmittedCount: 0,
        issuesClosedCount: 3,
        linesAdded: 2000,
        linesDeleted: 500,
        reposContributed: 4,
        topRepoShare: 0.4,
        maxCommitsIn10Min: 3,
        totalStars: 0,
        totalForks: 0,
        totalWatchers: 0,
        heatmapData: [],
        fetchedAt: new Date().toISOString(),
      });

    const res = await POST(makeRequest(VALID_SECRET));
    const body = await res.json();

    expect(body.recalculated).toBe(1);
    expect(body.failed).toBe(1);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].handle).toBe("alice");
  });
});
