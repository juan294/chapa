import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock dependencies BEFORE importing the route handler.
// ---------------------------------------------------------------------------

const { mockBuildAuthUrl, mockCreateStateCookie, mockRateLimit } = vi.hoisted(
  () => ({
    mockBuildAuthUrl: vi.fn(),
    mockCreateStateCookie: vi.fn(),
    mockRateLimit: vi.fn(),
  }),
);

vi.mock("@/lib/auth/github", () => ({
  buildAuthUrl: mockBuildAuthUrl,
  createStateCookie: mockCreateStateCookie,
}));

vi.mock("@/lib/cache/redis", () => ({
  rateLimit: mockRateLimit,
}));

vi.mock("@/lib/http/client-ip", () => ({
  getClientIp: (req: Request) =>
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown",
}));

import { GET } from "./route";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(ip?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (ip) headers["x-forwarded-for"] = ip;
  return new NextRequest(
    "https://chapa.thecreativetoken.com/api/auth/login",
    { headers },
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/auth/login — rate limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("GITHUB_CLIENT_ID", "test-client-id");
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://chapa.thecreativetoken.com");
    mockRateLimit.mockResolvedValue({ allowed: true, current: 1, limit: 20 });
    mockCreateStateCookie.mockReturnValue({
      state: "abc",
      cookie: "gh_oauth_state=abc; Path=/",
    });
    mockBuildAuthUrl.mockReturnValue(
      "https://github.com/login/oauth/authorize?state=abc",
    );
  });

  it("redirects to error page when rate limited", async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, current: 21, limit: 20 });

    const res = await GET(makeRequest("1.2.3.4"));

    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toMatch(/too many/i);
  });

  it("rate limits by IP with correct key and window (20 req / 15 min)", async () => {
    await GET(makeRequest("1.2.3.4"));

    expect(mockRateLimit).toHaveBeenCalledWith(
      "ratelimit:login:1.2.3.4",
      20,
      900,
    );
  });

  it("uses 'unknown' when x-forwarded-for is absent", async () => {
    await GET(makeRequest());

    expect(mockRateLimit).toHaveBeenCalledWith(
      "ratelimit:login:unknown",
      20,
      900,
    );
  });

  it("proceeds with redirect when not rate limited", async () => {
    const res = await GET(makeRequest("1.2.3.4"));

    // 307 = NextResponse.redirect default status
    expect(res.status).toBe(307);
  });

  it("includes Retry-After header when rate limited", async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, current: 21, limit: 20 });

    const res = await GET(makeRequest("1.2.3.4"));

    expect(res.headers.get("Retry-After")).toBe("900");
  });
});

describe("GET /api/auth/login — redirect validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("GITHUB_CLIENT_ID", "test-client-id");
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://chapa.thecreativetoken.com");
    mockRateLimit.mockResolvedValue({ allowed: true, current: 1, limit: 20 });
    mockCreateStateCookie.mockReturnValue({
      state: "abc",
      cookie: "gh_oauth_state=abc; Path=/",
    });
    mockBuildAuthUrl.mockReturnValue(
      "https://github.com/login/oauth/authorize?state=abc",
    );
  });

  it("rejects protocol-relative URL //evil.com as redirect", async () => {
    const req = new NextRequest(
      "https://chapa.thecreativetoken.com/api/auth/login?redirect=//evil.com",
    );

    const res = await GET(req);

    // Should redirect to GitHub OAuth (307), but must NOT set chapa_redirect cookie
    expect(res.status).toBe(307);
    const cookies = res.headers.getSetCookie();
    const redirectCookie = cookies.find((c) => c.startsWith("chapa_redirect="));
    expect(redirectCookie).toBeUndefined();
  });
});

describe("GET /api/auth/login — fallback URL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimit.mockResolvedValue({ allowed: true, current: 1, limit: 20 });
    mockCreateStateCookie.mockReturnValue({
      state: "abc",
      cookie: "gh_oauth_state=abc; Path=/",
    });
    mockBuildAuthUrl.mockReturnValue(
      "https://github.com/login/oauth/authorize?state=abc",
    );
  });

  it("uses localhost:3001 as fallback when NEXT_PUBLIC_BASE_URL is not set", async () => {
    vi.stubEnv("GITHUB_CLIENT_ID", "test-client-id");
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "");

    await GET(makeRequest("1.2.3.4"));

    expect(mockBuildAuthUrl).toHaveBeenCalledWith(
      "test-client-id",
      "http://localhost:3001/api/auth/callback",
      "abc",
    );
  });
});
