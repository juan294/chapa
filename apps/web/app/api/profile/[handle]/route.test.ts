import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks — hoisted before any imports that depend on them
// ---------------------------------------------------------------------------

const {
  mockRateLimit,
  mockGetCachedLatestSnapshot,
  mockDbGetToolInsights,
  mockGetClientIp,
  mockIsValidHandle,
} = vi.hoisted(() => ({
  mockRateLimit: vi.fn(),
  mockGetCachedLatestSnapshot: vi.fn(),
  mockDbGetToolInsights: vi.fn(),
  mockGetClientIp: vi.fn(),
  mockIsValidHandle: vi.fn(),
}));

vi.mock("@/lib/validation", () => ({
  isValidHandle: mockIsValidHandle,
}));

vi.mock("@/lib/cache/redis", () => ({
  rateLimit: mockRateLimit,
}));

vi.mock("@/lib/cache/snapshot-cache", () => ({
  getCachedLatestSnapshot: mockGetCachedLatestSnapshot,
}));

vi.mock("@/lib/db/tool-insights", () => ({
  dbGetToolInsights: mockDbGetToolInsights,
}));

vi.mock("@/lib/http/client-ip", () => ({
  getClientIp: mockGetClientIp,
}));

// ---------------------------------------------------------------------------
// Import handler AFTER mocks
// ---------------------------------------------------------------------------

import { GET, OPTIONS } from "./route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(handle: string): NextRequest {
  return new NextRequest(
    `https://chapa.thecreativetoken.com/api/profile/${handle}`,
  );
}

function makeParams(handle: string) {
  return { params: Promise.resolve({ handle }) };
}

const MOCK_SNAPSHOT = {
  date: "2026-03-27",
  capturedAt: "2026-03-27T10:30:00Z",
  commitsTotal: 500,
  prsMergedCount: 42,
  prsMergedWeight: 84,
  reviewsSubmittedCount: 30,
  issuesClosedCount: 15,
  reposContributed: 8,
  activeDays: 200,
  linesAdded: 50000,
  linesDeleted: 20000,
  totalStars: 100,
  totalForks: 20,
  totalWatchers: 50,
  topRepoShare: 0.4,
  maxCommitsIn10Min: 3,
  delivery: 100,
  quality: 40,
  consistency: 46,
  breadth: 69,
  archetype: "Builder",
  profileType: "full",
  compositeScore: 68,
  adjustedComposite: 68,
  confidence: 85,
  tier: "High",
};

const MOCK_CRAFT = {
  tool: "claude-code" as const,
  dimensions: { proficiency: 70, effectiveness: 75, sophistication: 74 },
  craftScore: 73,
  tier: "Expert" as const,
  reportPeriod: { start: "2026-02-20", end: "2026-03-27" },
  computedAt: "2026-03-27T08:00:00.000Z",
};

const LATEST_UPLOADED_CRAFT = {
  ...MOCK_CRAFT,
  tool: "cursor" as const,
  craftScore: 81,
  tier: "Master" as const,
  computedAt: "2026-03-28T08:00:00.000Z",
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockIsValidHandle.mockReturnValue(true);
  mockRateLimit.mockResolvedValue({ allowed: true, current: 1, limit: 60 });
  mockGetCachedLatestSnapshot.mockResolvedValue(MOCK_SNAPSHOT);
  mockDbGetToolInsights.mockResolvedValue(MOCK_CRAFT);
  mockGetClientIp.mockReturnValue("127.0.0.1");
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/profile/:handle", () => {
  // --- Success: full profile with craft ---

  it("returns 200 with full profile when snapshot and craft exist", async () => {
    const resp = await GET(makeRequest("juan294"), makeParams("juan294"));

    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body).toEqual({
      handle: "juan294",
      dimensions: {
        delivery: 100,
        quality: 40,
        consistency: 46,
        breadth: 69,
        craft: 73,
      },
      compositeScore: 68,
      adjustedComposite: 68,
      archetype: "Builder",
      tier: "High",
      craft: {
        tool: "claude-code",
        tier: "Expert",
        score: 73,
      },
      snapshotDate: "2026-03-27",
      computedAt: "2026-03-27T10:30:00Z",
    });
  });

  // --- Success: profile without craft ---

  it("returns craft: null and no dimensions.craft when no tool insights exist", async () => {
    mockDbGetToolInsights.mockResolvedValue(null);

    const resp = await GET(makeRequest("juan294"), makeParams("juan294"));

    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.craft).toBeNull();
    expect(body.dimensions).not.toHaveProperty("craft");
  });

  it("uses snapshot.craft for dimensions when present (not tool insights)", async () => {
    // Snapshot has craft=80 stored from when it was computed
    mockGetCachedLatestSnapshot.mockResolvedValue({
      ...MOCK_SNAPSHOT,
      craft: 80,
    });
    // Tool insights returns a different score (73) — dimensions should use snapshot value
    mockDbGetToolInsights.mockResolvedValue(MOCK_CRAFT);

    const resp = await GET(makeRequest("juan294"), makeParams("juan294"));

    expect(resp.status).toBe(200);
    const body = await resp.json();
    // dimensions.craft comes from snapshot for consistency
    expect(body.dimensions.craft).toBe(80);
    expect(body.craft).toBeNull();
    expect(mockDbGetToolInsights).not.toHaveBeenCalled();
  });

  it("falls back to tool insights craft when snapshot has no craft", async () => {
    // Snapshot without craft (legacy row before craft column was added)
    mockGetCachedLatestSnapshot.mockResolvedValue(MOCK_SNAPSHOT);
    mockDbGetToolInsights.mockResolvedValue(MOCK_CRAFT);

    const resp = await GET(makeRequest("juan294"), makeParams("juan294"));
    const body = await resp.json();

    // Falls back to tool insights craft score
    expect(body.dimensions.craft).toBe(73);
  });

  it("surfaces the latest uploaded craft details returned by the DB layer", async () => {
    mockGetCachedLatestSnapshot.mockResolvedValue(MOCK_SNAPSHOT);
    mockDbGetToolInsights.mockResolvedValue(LATEST_UPLOADED_CRAFT);

    const resp = await GET(makeRequest("juan294"), makeParams("juan294"));
    const body = await resp.json();

    expect(body.dimensions.craft).toBe(81);
    expect(body.craft).toEqual({
      tool: "cursor",
      tier: "Master",
      score: 81,
    });
  });

  // --- 404: no snapshot ---

  it("returns 404 when no snapshot exists for handle", async () => {
    mockGetCachedLatestSnapshot.mockResolvedValue(null);

    const resp = await GET(makeRequest("unknown"), makeParams("unknown"));

    expect(resp.status).toBe(404);
    const body = await resp.json();
    expect(body.error).toContain("No profile found");
  });

  it("uses the latest snapshot cache and skips craft on 404", async () => {
    mockGetCachedLatestSnapshot.mockResolvedValue(null);

    await GET(makeRequest("unknown"), makeParams("unknown"));

    expect(mockGetCachedLatestSnapshot).toHaveBeenCalledWith("unknown");
    expect(mockDbGetToolInsights).not.toHaveBeenCalled();
  });

  // --- Validation ---

  it("returns 400 for invalid handle", async () => {
    mockIsValidHandle.mockReturnValue(false);

    const resp = await GET(makeRequest("-invalid"), makeParams("-invalid"));

    expect(resp.status).toBe(400);
    const body = await resp.json();
    expect(body.error).toContain("Invalid handle");
  });

  it("does not call DB when handle is invalid", async () => {
    mockIsValidHandle.mockReturnValue(false);

    await GET(makeRequest("-bad"), makeParams("-bad"));

    expect(mockGetCachedLatestSnapshot).not.toHaveBeenCalled();
    expect(mockDbGetToolInsights).not.toHaveBeenCalled();
  });

  // --- Rate limiting ---

  it("returns 429 when IP rate limited", async () => {
    mockRateLimit.mockResolvedValue({
      allowed: false,
      current: 61,
      limit: 60,
    });

    const resp = await GET(makeRequest("juan294"), makeParams("juan294"));

    expect(resp.status).toBe(429);
    const body = await resp.json();
    expect(body.error).toContain("Too many requests");
  });

  it("returns Retry-After header on 429", async () => {
    mockRateLimit.mockResolvedValue({
      allowed: false,
      current: 61,
      limit: 60,
    });

    const resp = await GET(makeRequest("juan294"), makeParams("juan294"));

    expect(resp.headers.get("Retry-After")).toBe("60");
  });

  it("does not call DB when rate limited", async () => {
    mockRateLimit.mockResolvedValue({
      allowed: false,
      current: 61,
      limit: 60,
    });

    await GET(makeRequest("juan294"), makeParams("juan294"));

    expect(mockGetCachedLatestSnapshot).not.toHaveBeenCalled();
    expect(mockDbGetToolInsights).not.toHaveBeenCalled();
  });

  it("passes correct rate limit key based on client IP", async () => {
    mockGetClientIp.mockReturnValue("192.168.1.42");

    await GET(makeRequest("juan294"), makeParams("juan294"));

    expect(mockRateLimit).toHaveBeenCalledWith(
      "ratelimit:profile:192.168.1.42",
      60,
      60,
    );
  });

  // --- CORS headers ---

  it("includes CORS header on success response", async () => {
    const resp = await GET(makeRequest("juan294"), makeParams("juan294"));

    expect(resp.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("includes CORS header on 400 response", async () => {
    mockIsValidHandle.mockReturnValue(false);

    const resp = await GET(makeRequest("-bad"), makeParams("-bad"));

    expect(resp.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("includes CORS header on 404 response", async () => {
    mockGetCachedLatestSnapshot.mockResolvedValue(null);

    const resp = await GET(makeRequest("unknown"), makeParams("unknown"));

    expect(resp.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("includes CORS header on 429 response", async () => {
    mockRateLimit.mockResolvedValue({
      allowed: false,
      current: 61,
      limit: 60,
    });

    const resp = await GET(makeRequest("juan294"), makeParams("juan294"));

    expect(resp.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  // --- Cache headers ---

  it("includes Cache-Control header with 5-minute CDN cache", async () => {
    const resp = await GET(makeRequest("juan294"), makeParams("juan294"));

    expect(resp.headers.get("Cache-Control")).toBe(
      "public, s-maxage=300, stale-while-revalidate=3600",
    );
  });

  // --- Error handling ---

  it("re-throws when getCachedLatestSnapshot throws (handled by withErrorCapture)", async () => {
    mockGetCachedLatestSnapshot.mockRejectedValue(new Error("DB down"));

    await expect(GET(makeRequest("juan294"), makeParams("juan294"))).rejects.toThrow("DB down");
  });
});

// ---------------------------------------------------------------------------
// OPTIONS (CORS preflight)
// ---------------------------------------------------------------------------

describe("OPTIONS /api/profile/:handle", () => {
  it("returns 204 with CORS headers", async () => {
    const resp = await OPTIONS();

    expect(resp.status).toBe(204);
    expect(resp.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(resp.headers.get("Access-Control-Allow-Methods")).toBe(
      "GET, OPTIONS",
    );
    expect(resp.headers.get("Access-Control-Allow-Headers")).toBe(
      "Content-Type",
    );
  });
});
