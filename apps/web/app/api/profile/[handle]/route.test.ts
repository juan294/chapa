import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks — hoisted before any imports that depend on them
// ---------------------------------------------------------------------------

const {
  mockRateLimit,
  mockDbGetLatestSnapshot,
  mockDbGetToolInsights,
  mockGetClientIp,
  mockIsValidHandle,
} = vi.hoisted(() => ({
  mockRateLimit: vi.fn(),
  mockDbGetLatestSnapshot: vi.fn(),
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

vi.mock("@/lib/db/snapshots", () => ({
  dbGetLatestSnapshot: mockDbGetLatestSnapshot,
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

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockIsValidHandle.mockReturnValue(true);
  mockRateLimit.mockResolvedValue({ allowed: true, current: 1, limit: 60 });
  mockDbGetLatestSnapshot.mockResolvedValue(MOCK_SNAPSHOT);
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

  // --- 404: no snapshot ---

  it("returns 404 when no snapshot exists for handle", async () => {
    mockDbGetLatestSnapshot.mockResolvedValue(null);

    const resp = await GET(makeRequest("unknown"), makeParams("unknown"));

    expect(resp.status).toBe(404);
    const body = await resp.json();
    expect(body.error).toContain("No profile found");
  });

  it("queries both snapshot and craft in parallel (even on 404)", async () => {
    mockDbGetLatestSnapshot.mockResolvedValue(null);

    await GET(makeRequest("unknown"), makeParams("unknown"));

    expect(mockDbGetLatestSnapshot).toHaveBeenCalledWith("unknown");
    expect(mockDbGetToolInsights).toHaveBeenCalledWith("unknown");
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

    expect(mockDbGetLatestSnapshot).not.toHaveBeenCalled();
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

    expect(mockDbGetLatestSnapshot).not.toHaveBeenCalled();
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
    mockDbGetLatestSnapshot.mockResolvedValue(null);

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

  it("includes Cache-Control header on success", async () => {
    const resp = await GET(makeRequest("juan294"), makeParams("juan294"));

    expect(resp.headers.get("Cache-Control")).toBe(
      "public, s-maxage=3600, stale-while-revalidate=86400",
    );
  });

  // --- Error handling ---

  it("returns 500 when dbGetLatestSnapshot throws", async () => {
    mockDbGetLatestSnapshot.mockRejectedValue(new Error("DB down"));

    const resp = await GET(makeRequest("juan294"), makeParams("juan294"));

    expect(resp.status).toBe(500);
    const body = await resp.json();
    expect(body.error).toContain("Internal server error");
  });

  it("includes CORS header on 500 response", async () => {
    mockDbGetLatestSnapshot.mockRejectedValue(new Error("DB down"));

    const resp = await GET(makeRequest("juan294"), makeParams("juan294"));

    expect(resp.headers.get("Access-Control-Allow-Origin")).toBe("*");
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
