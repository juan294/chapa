import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_BADGE_CONFIG } from "@chapa/shared";

// ---------------------------------------------------------------------------
// Mocks — hoisted before any imports that depend on them
// ---------------------------------------------------------------------------

const { mockReadSessionCookie, mockRequireSession, mockCacheGet, mockCacheSet, mockRateLimit } =
  vi.hoisted(() => ({
    mockReadSessionCookie: vi.fn(),
    mockRequireSession: vi.fn(),
    mockCacheGet: vi.fn(),
    mockCacheSet: vi.fn(),
    mockRateLimit: vi.fn(),
  }));

vi.mock("@/lib/auth/github", () => ({
  readSessionCookie: mockReadSessionCookie,
}));

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: mockRequireSession,
}));

vi.mock("@/lib/cache/redis", () => ({
  cacheGet: mockCacheGet,
  cacheSet: mockCacheSet,
  rateLimit: mockRateLimit,
}));

// Re-export real validation functions through the mock to avoid alias resolution issues
vi.mock("@/lib/validation", async () => {
  const actual = await import("../../../../lib/validation");
  return actual;
});

vi.mock("@/lib/feature-flags", () => ({
  isStudioEnabled: () => true,
}));

// ---------------------------------------------------------------------------
// Import handlers AFTER mocks
// ---------------------------------------------------------------------------

import { GET, PUT } from "./route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGetRequest(cookie?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (cookie) headers["cookie"] = cookie;
  return new NextRequest("https://chapa.thecreativetoken.com/api/studio/config", {
    headers,
  });
}

function makePutRequest(body: unknown, cookie?: string): NextRequest {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cookie) headers["cookie"] = cookie;
  return new NextRequest("https://chapa.thecreativetoken.com/api/studio/config", {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });
}

const SESSION = {
  token: "ghp_test123",
  login: "juan294",
  name: "Juan",
  avatar_url: "https://avatars.githubusercontent.com/u/1",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/studio/config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXTAUTH_SECRET", "test-secret");
  });

  it("returns 401 when no session", async () => {
    mockReadSessionCookie.mockReturnValue(null);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it("returns { config: null } when no NEXTAUTH_SECRET", async () => {
    vi.stubEnv("NEXTAUTH_SECRET", "");

    const res = await GET(makeGetRequest("session=abc"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ config: null });
  });

  it("returns saved config from Redis", async () => {
    mockReadSessionCookie.mockReturnValue(SESSION);
    const savedConfig = { ...DEFAULT_BADGE_CONFIG, background: "aurora" };
    mockCacheGet.mockResolvedValue(savedConfig);

    const res = await GET(makeGetRequest("session=abc"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.config).toEqual(savedConfig);
    expect(mockCacheGet).toHaveBeenCalledWith("config:juan294");
  });

  it("returns { config: null } when Redis has no config", async () => {
    mockReadSessionCookie.mockReturnValue(SESSION);
    mockCacheGet.mockResolvedValue(null);

    const res = await GET(makeGetRequest("session=abc"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ config: null });
  });
});

describe("PUT /api/studio/config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSession.mockReturnValue({ session: SESSION });
    mockRateLimit.mockResolvedValue({ allowed: true, current: 1, limit: 30 });
  });

  it("returns 401 when no session", async () => {
    mockRequireSession.mockReturnValue({
      error: NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      ),
    });

    const res = await PUT(makePutRequest(DEFAULT_BADGE_CONFIG));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid config body", async () => {
    const res = await PUT(makePutRequest({ background: "neon" }, "session=abc"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/invalid/i);
  });

  it("returns 400 for non-JSON body", async () => {
    const req = new NextRequest("https://chapa.thecreativetoken.com/api/studio/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie: "session=abc" },
      body: "not json{{{",
    });

    const res = await PUT(req);
    expect(res.status).toBe(400);
  });

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, current: 31, limit: 30 });

    const res = await PUT(makePutRequest(DEFAULT_BADGE_CONFIG, "session=abc"));
    expect(res.status).toBe(429);
  });

  it("saves valid config to Redis with 365-day TTL", async () => {
    mockCacheSet.mockResolvedValue(undefined);

    const config = { ...DEFAULT_BADGE_CONFIG, background: "aurora" as const };
    const res = await PUT(makePutRequest(config, "session=abc"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mockCacheSet).toHaveBeenCalledWith("config:juan294", config, 31536000);
  });

  it("rate limits by user login", async () => {
    mockCacheSet.mockResolvedValue(undefined);

    await PUT(makePutRequest(DEFAULT_BADGE_CONFIG, "session=abc"));

    expect(mockRateLimit).toHaveBeenCalledWith("ratelimit:config:juan294", 30, 3600);
  });
});
