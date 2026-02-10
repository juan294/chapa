import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock dependencies BEFORE importing the route handler.
// ---------------------------------------------------------------------------

const {
  mockExchangeCodeForToken,
  mockFetchGitHubUser,
  mockCreateSessionCookie,
  mockValidateState,
  mockClearStateCookie,
  mockRateLimit,
} = vi.hoisted(() => ({
  mockExchangeCodeForToken: vi.fn(),
  mockFetchGitHubUser: vi.fn(),
  mockCreateSessionCookie: vi.fn(),
  mockValidateState: vi.fn(),
  mockClearStateCookie: vi.fn(),
  mockRateLimit: vi.fn(),
}));

vi.mock("@/lib/auth/github", () => ({
  exchangeCodeForToken: mockExchangeCodeForToken,
  fetchGitHubUser: mockFetchGitHubUser,
  createSessionCookie: mockCreateSessionCookie,
  validateState: mockValidateState,
  clearStateCookie: mockClearStateCookie,
}));

vi.mock("@/lib/cache/redis", () => ({
  rateLimit: mockRateLimit,
}));

import { GET } from "./route";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(params?: {
  code?: string;
  state?: string;
  ip?: string;
  cookie?: string;
}): NextRequest {
  const url = new URL(
    "https://chapa.thecreativetoken.com/api/auth/callback",
  );
  if (params?.code) url.searchParams.set("code", params.code);
  if (params?.state) url.searchParams.set("state", params.state);
  const headers: Record<string, string> = {};
  if (params?.ip) headers["x-forwarded-for"] = params.ip;
  if (params?.cookie) headers["cookie"] = params.cookie;
  return new NextRequest(url, { headers });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/auth/callback — rate limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimit.mockResolvedValue({ allowed: true, current: 1, limit: 10 });
  });

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue({
      allowed: false,
      current: 11,
      limit: 10,
    });

    const res = await GET(
      makeRequest({ code: "abc", state: "xyz", ip: "1.2.3.4" }),
    );

    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toMatch(/too many/i);
  });

  it("rate limits by IP with correct key and window (10 req / 15 min)", async () => {
    // Provide enough context so the handler doesn't short-circuit before rate limit
    await GET(makeRequest({ code: "abc", state: "xyz", ip: "1.2.3.4" }));

    expect(mockRateLimit).toHaveBeenCalledWith(
      "ratelimit:callback:1.2.3.4",
      10,
      900,
    );
  });

  it("includes Retry-After header when rate limited", async () => {
    mockRateLimit.mockResolvedValue({
      allowed: false,
      current: 11,
      limit: 10,
    });

    const res = await GET(
      makeRequest({ code: "abc", state: "xyz", ip: "1.2.3.4" }),
    );

    expect(res.headers.get("Retry-After")).toBe("900");
  });

  it("proceeds when not rate limited (redirects on missing code)", async () => {
    const res = await GET(makeRequest({ ip: "1.2.3.4" }));

    // Should redirect to /?error=no_code (not a 429)
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("Location")!).searchParams.get("error")).toBe(
      "no_code",
    );
  });
});
