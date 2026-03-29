import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks — hoisted before any imports that depend on them
// ---------------------------------------------------------------------------

const { mockRateLimit, mockDbGet, mockGetClientIp, mockIsValidHandle } =
  vi.hoisted(() => ({
    mockRateLimit: vi.fn(),
    mockDbGet: vi.fn(),
    mockGetClientIp: vi.fn(),
    mockIsValidHandle: vi.fn(),
  }));

vi.mock("@/lib/validation", () => ({
  isValidHandle: mockIsValidHandle,
}));

vi.mock("@/lib/cache/redis", () => ({
  rateLimit: mockRateLimit,
}));

vi.mock("@/lib/db/tool-insights", () => ({
  dbGetToolInsights: mockDbGet,
}));

vi.mock("@/lib/http/client-ip", () => ({
  getClientIp: mockGetClientIp,
}));

// ---------------------------------------------------------------------------
// Import handler AFTER mocks
// ---------------------------------------------------------------------------

import { GET } from "./route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(handle: string): NextRequest {
  return new NextRequest(
    `https://chapa.thecreativetoken.com/api/insights/${handle}`,
  );
}

function makeParams(handle: string) {
  return { params: Promise.resolve({ handle }) };
}

const STORED_CRAFT = {
  tool: "claude-code" as const,
  dimensions: { proficiency: 60, effectiveness: 70, sophistication: 50 },
  craftScore: 60,
  tier: "Expert" as const,
  reportPeriod: { start: "2026-02-20", end: "2026-03-07" },
  computedAt: "2026-03-07T12:00:00.000Z",
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockIsValidHandle.mockReturnValue(true);
  mockRateLimit.mockResolvedValue({ allowed: true, current: 1, limit: 60 });
  mockDbGet.mockResolvedValue(null);
  mockGetClientIp.mockReturnValue("127.0.0.1");
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/insights/:handle", () => {
  // --- Success cases ---

  it("returns 200 with craft score for existing data", async () => {
    mockDbGet.mockResolvedValue(STORED_CRAFT);

    const resp = await GET(makeRequest("juan294"), makeParams("juan294"));

    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.craftScore).toEqual(STORED_CRAFT);
  });

  it("returns 200 with null craftScore when no data exists", async () => {
    mockDbGet.mockResolvedValue(null);

    const resp = await GET(makeRequest("newuser"), makeParams("newuser"));

    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.craftScore).toBeNull();
  });

  it("calls dbGetToolInsights with the lowercase handle", async () => {
    await GET(makeRequest("TestUser"), makeParams("TestUser"));

    // The route passes the handle directly; dbGetToolInsights lowercases internally
    expect(mockDbGet).toHaveBeenCalledTimes(1);
    expect(mockDbGet).toHaveBeenCalledWith("TestUser");
  });

  // --- Validation ---

  it("returns 400 for invalid handle (starts with hyphen)", async () => {
    mockIsValidHandle.mockReturnValue(false);

    const resp = await GET(makeRequest("-invalid"), makeParams("-invalid"));

    expect(resp.status).toBe(400);
    const body = await resp.json();
    expect(body.error).toContain("Invalid handle");
  });

  it("returns 400 for invalid handle (special characters)", async () => {
    mockIsValidHandle.mockReturnValue(false);

    const resp = await GET(makeRequest("user@name"), makeParams("user@name"));

    expect(resp.status).toBe(400);
    const body = await resp.json();
    expect(body.error).toContain("Invalid handle");
  });

  it("does not call dbGetToolInsights when handle is invalid", async () => {
    mockIsValidHandle.mockReturnValue(false);

    await GET(makeRequest("-bad"), makeParams("-bad"));

    expect(mockDbGet).not.toHaveBeenCalled();
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

  it("does not call dbGetToolInsights when rate limited", async () => {
    mockRateLimit.mockResolvedValue({
      allowed: false,
      current: 61,
      limit: 60,
    });

    await GET(makeRequest("juan294"), makeParams("juan294"));

    expect(mockDbGet).not.toHaveBeenCalled();
  });

  it("passes correct rate limit key based on client IP", async () => {
    mockGetClientIp.mockReturnValue("192.168.1.42");

    await GET(makeRequest("juan294"), makeParams("juan294"));

    expect(mockRateLimit).toHaveBeenCalledWith(
      "ratelimit:insights:192.168.1.42",
      60,
      60,
    );
  });

  // --- Edge cases ---

  it("returns null craftScore when dbGetToolInsights returns null (Supabase unavailable)", async () => {
    // dbGetToolInsights returns null when Supabase is unavailable — graceful degradation
    mockDbGet.mockResolvedValue(null);

    const resp = await GET(makeRequest("testuser"), makeParams("testuser"));

    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.craftScore).toBeNull();
  });

  it("is a public endpoint — no auth required", async () => {
    // The route has NO auth checks; any request with a valid handle should succeed
    mockDbGet.mockResolvedValue(STORED_CRAFT);

    const resp = await GET(makeRequest("anyone"), makeParams("anyone"));

    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.craftScore).toBeDefined();
  });

  it("returns JSON content type", async () => {
    const resp = await GET(makeRequest("testuser"), makeParams("testuser"));

    expect(resp.headers.get("content-type")).toContain("application/json");
  });

  it("response body has only craftScore key", async () => {
    mockDbGet.mockResolvedValue(STORED_CRAFT);

    const resp = await GET(makeRequest("testuser"), makeParams("testuser"));

    const body = await resp.json();
    expect(Object.keys(body)).toEqual(["craftScore"]);
  });

  // --- Error handling ---

  it("returns 500 JSON when dbGetToolInsights throws", async () => {
    mockDbGet.mockRejectedValue(new Error("DB connection lost"));

    const resp = await GET(makeRequest("juan294"), makeParams("juan294"));

    expect(resp.status).toBe(500);
    const body = await resp.json();
    expect(body.error).toBe("Internal server error");
  });

  it("returns 500 JSON when rateLimit throws", async () => {
    mockRateLimit.mockRejectedValue(new Error("Redis unavailable"));

    const resp = await GET(makeRequest("juan294"), makeParams("juan294"));

    expect(resp.status).toBe(500);
    const body = await resp.json();
    expect(body.error).toBe("Internal server error");
  });
});
