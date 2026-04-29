import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock dependencies BEFORE importing the route handler.
// ---------------------------------------------------------------------------

const { mockBuildAuthUrl, mockCreateStateCookie, mockIssueOauthState, mockRateLimit } = vi.hoisted(
  () => ({
    mockBuildAuthUrl: vi.fn(),
    mockCreateStateCookie: vi.fn(),
    mockIssueOauthState: vi.fn(),
    mockRateLimit: vi.fn(),
  }),
);

vi.mock("@/lib/auth/github", () => ({
  buildAuthUrl: mockBuildAuthUrl,
  createStateCookie: mockCreateStateCookie,
}));

vi.mock("@/lib/auth/oauth-state", () => ({
  issueOauthState: mockIssueOauthState,
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

function makeRequest(
  ip?: string,
  redirect?: string,
): NextRequest {
  const headers: Record<string, string> = {};
  if (ip) headers["x-forwarded-for"] = ip;
  const qs = redirect != null ? `?redirect=${encodeURIComponent(redirect)}` : "";
  return new NextRequest(
    `https://chapa.thecreativetoken.com/api/auth/login${qs}`,
    { headers },
  );
}

/** Find the `chapa_redirect` Set-Cookie value from a response, if present. */
function findRedirectCookie(res: Response): string | undefined {
  return res.headers.getSetCookie().find((c) => c.startsWith("chapa_redirect="));
}

function findStateStoreCookie(res: Response): string | undefined {
  return res.headers.getSetCookie().find((c) => c.startsWith("chapa_oauth_state_store="));
}

// ---------------------------------------------------------------------------
// Shared mock defaults
// ---------------------------------------------------------------------------

function setupDefaultMocks(): void {
  mockRateLimit.mockResolvedValue({ allowed: true, current: 1, limit: 20 });
  mockIssueOauthState.mockResolvedValue("shared");
  mockCreateStateCookie.mockReturnValue({
    state: "abc",
    cookie: "gh_oauth_state=abc; Path=/",
  });
  mockBuildAuthUrl.mockReturnValue(
    "https://github.com/login/oauth/authorize?state=abc",
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
    setupDefaultMocks();
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

describe("GET /api/auth/login — missing GITHUB_CLIENT_ID", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it("returns 500 when GITHUB_CLIENT_ID is not set", async () => {
    vi.stubEnv("GITHUB_CLIENT_ID", "");

    const res = await GET(makeRequest("1.2.3.4"));

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toMatch(/not configured/i);
  });

  it("returns 500 when GITHUB_CLIENT_ID is undefined", async () => {
    vi.stubEnv("GITHUB_CLIENT_ID", undefined);

    const res = await GET(makeRequest("1.2.3.4"));

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("GitHub OAuth not configured");
  });

  it("returns 500 when GITHUB_CLIENT_ID is whitespace only", async () => {
    vi.stubEnv("GITHUB_CLIENT_ID", "   ");

    const res = await GET(makeRequest("1.2.3.4"));

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("GitHub OAuth not configured");
  });
});

describe("GET /api/auth/login — OAuth redirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("GITHUB_CLIENT_ID", "test-client-id");
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://chapa.thecreativetoken.com");
    setupDefaultMocks();
  });

  it("redirects to the GitHub OAuth URL from buildAuthUrl", async () => {
    const res = await GET(makeRequest("1.2.3.4"));

    expect(res.status).toBe(307);
    expect(res.headers.get("Location")).toBe(
      "https://github.com/login/oauth/authorize?state=abc",
    );
  });

  it("passes the correct redirectUri to buildAuthUrl", async () => {
    await GET(makeRequest("1.2.3.4"));

    expect(mockBuildAuthUrl).toHaveBeenCalledWith(
      "test-client-id",
      "https://chapa.thecreativetoken.com/api/auth/callback",
      "abc",
    );
  });

  it("sets the state cookie from createStateCookie", async () => {
    const res = await GET(makeRequest("1.2.3.4"));

    const cookies = res.headers.getSetCookie();
    expect(cookies).toContain("gh_oauth_state=abc; Path=/");
  });

  it("calls createStateCookie exactly once", async () => {
    await GET(makeRequest("1.2.3.4"));

    expect(mockCreateStateCookie).toHaveBeenCalledOnce();
  });

  it("issues the OAuth state server-side before redirecting", async () => {
    await GET(makeRequest("1.2.3.4"));

    expect(mockIssueOauthState).toHaveBeenCalledWith("abc");
    expect(mockIssueOauthState).toHaveBeenCalledOnce();
  });

  it("sets a shared-store marker cookie when the nonce is persisted centrally", async () => {
    const res = await GET(makeRequest("1.2.3.4"));

    expect(findStateStoreCookie(res)).toContain("chapa_oauth_state_store=shared");
  });

  it("sets a fallback-store marker cookie when login falls back to local memory", async () => {
    mockIssueOauthState.mockResolvedValueOnce("fallback");

    const res = await GET(makeRequest("1.2.3.4"));

    expect(findStateStoreCookie(res)).toContain("chapa_oauth_state_store=fallback");
  });
});

describe("GET /api/auth/login — cookie flags (Secure)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it("includes Secure flag in redirect cookie when base URL is https", async () => {
    vi.stubEnv("GITHUB_CLIENT_ID", "test-client-id");
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://chapa.thecreativetoken.com");

    const res = await GET(makeRequest("1.2.3.4", "/studio"));

    const redirectCookie = findRedirectCookie(res);
    expect(redirectCookie).toBeDefined();
    expect(redirectCookie).toContain("Secure");
  });

  it("omits Secure flag in redirect cookie when base URL is http", async () => {
    vi.stubEnv("GITHUB_CLIENT_ID", "test-client-id");
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "http://localhost:3001");

    const res = await GET(makeRequest("1.2.3.4", "/studio"));

    const redirectCookie = findRedirectCookie(res);
    expect(redirectCookie).toBeDefined();
    expect(redirectCookie).not.toContain("Secure");
  });
});

describe("GET /api/auth/login — redirect validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("GITHUB_CLIENT_ID", "test-client-id");
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://chapa.thecreativetoken.com");
    setupDefaultMocks();
  });

  it("rejects protocol-relative URL //evil.com as redirect", async () => {
    const res = await GET(makeRequest("1.2.3.4", "//evil.com"));

    expect(res.status).toBe(307);
    expect(findRedirectCookie(res)).toBeUndefined();
  });

  it("sets chapa_redirect cookie for valid relative path /studio", async () => {
    const res = await GET(makeRequest("1.2.3.4", "/studio"));

    expect(res.status).toBe(307);
    const redirectCookie = findRedirectCookie(res);
    expect(redirectCookie).toBeDefined();
    expect(redirectCookie).toContain(encodeURIComponent("/studio"));
    expect(redirectCookie).toContain("Max-Age=600");
  });

  it("sets chapa_redirect cookie for same-origin absolute URL", async () => {
    const res = await GET(
      makeRequest(
        "1.2.3.4",
        "https://chapa.thecreativetoken.com/u/octocat",
      ),
    );

    expect(findRedirectCookie(res)).toBeDefined();
  });

  it("rejects cross-origin absolute URL as redirect", async () => {
    const res = await GET(makeRequest("1.2.3.4", "https://evil.com/steal"));

    expect(findRedirectCookie(res)).toBeUndefined();
  });

  it("does not set chapa_redirect cookie when no redirect param is provided", async () => {
    const res = await GET(makeRequest("1.2.3.4"));

    expect(findRedirectCookie(res)).toBeUndefined();
  });

  it("URL-encodes the redirect value in the cookie", async () => {
    const res = await GET(makeRequest("1.2.3.4", "/u/some-user"));

    const redirectCookie = findRedirectCookie(res);
    expect(redirectCookie).toBeDefined();
    expect(redirectCookie).toContain(encodeURIComponent("/u/some-user"));
  });

  it("rejects bare string (non-URL, non-slash) as redirect", async () => {
    const res = await GET(makeRequest("1.2.3.4", "not-a-url"));

    expect(findRedirectCookie(res)).toBeUndefined();
  });

  it("includes HttpOnly and SameSite=Lax flags on redirect cookie", async () => {
    const res = await GET(makeRequest("1.2.3.4", "/studio"));

    const redirectCookie = findRedirectCookie(res);
    expect(redirectCookie).toBeDefined();
    expect(redirectCookie).toContain("HttpOnly");
    expect(redirectCookie).toContain("SameSite=Lax");
  });
});

describe("GET /api/auth/login — fallback URL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it("uses production URL fallback when NEXT_PUBLIC_BASE_URL is not set", async () => {
    vi.stubEnv("GITHUB_CLIENT_ID", "test-client-id");
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "");

    await GET(makeRequest("1.2.3.4"));

    expect(mockBuildAuthUrl).toHaveBeenCalledWith(
      "test-client-id",
      "https://chapa.thecreativetoken.com/api/auth/callback",
      "abc",
    );
  });
});

describe("GET /api/auth/login — env var trimming", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it("trims whitespace from GITHUB_CLIENT_ID", async () => {
    vi.stubEnv("GITHUB_CLIENT_ID", "  test-client-id  ");
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://chapa.thecreativetoken.com");

    await GET(makeRequest("1.2.3.4"));

    expect(mockBuildAuthUrl).toHaveBeenCalledWith(
      "test-client-id",
      "https://chapa.thecreativetoken.com/api/auth/callback",
      "abc",
    );
  });

  it("trims whitespace from NEXT_PUBLIC_BASE_URL", async () => {
    vi.stubEnv("GITHUB_CLIENT_ID", "test-client-id");
    vi.stubEnv(
      "NEXT_PUBLIC_BASE_URL",
      "  https://chapa.thecreativetoken.com  ",
    );

    await GET(makeRequest("1.2.3.4"));

    expect(mockBuildAuthUrl).toHaveBeenCalledWith(
      "test-client-id",
      "https://chapa.thecreativetoken.com/api/auth/callback",
      "abc",
    );
  });
});
