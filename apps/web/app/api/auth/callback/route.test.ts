import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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

vi.mock("@/lib/http/client-ip", () => ({
  getClientIp: (req: Request) =>
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown",
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

// ---------------------------------------------------------------------------
// Shared setup: allow rate limit by default, set env vars for happy path
// ---------------------------------------------------------------------------

function allowRateLimit() {
  mockRateLimit.mockResolvedValue({ allowed: true, current: 1, limit: 10 });
}

function setEnvVars() {
  process.env.GITHUB_CLIENT_ID = "test-client-id";
  process.env.GITHUB_CLIENT_SECRET = "test-client-secret";
  process.env.NEXTAUTH_SECRET = "test-session-secret";
}

function clearEnvVars() {
  delete process.env.GITHUB_CLIENT_ID;
  delete process.env.GITHUB_CLIENT_SECRET;
  delete process.env.NEXTAUTH_SECRET;
}

// ---------------------------------------------------------------------------
// Rate limiting tests (existing)
// ---------------------------------------------------------------------------

describe("GET /api/auth/callback — rate limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    allowRateLimit();
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

// ---------------------------------------------------------------------------
// OAuth callback integration tests
// ---------------------------------------------------------------------------

describe("GET /api/auth/callback — OAuth flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    allowRateLimit();
    setEnvVars();
  });

  afterEach(() => {
    clearEnvVars();
  });

  it("redirects to /?error=no_code when code param is missing", async () => {
    const res = await GET(makeRequest({ state: "abc123" }));

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.searchParams.get("error")).toBe("no_code");
  });

  it("redirects to /?error=invalid_state when state validation fails", async () => {
    mockValidateState.mockReturnValue(false);

    const res = await GET(
      makeRequest({ code: "valid-code", state: "bad-state", cookie: "chapa_oauth_state=other" }),
    );

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.searchParams.get("error")).toBe("invalid_state");
  });

  it("redirects to /?error=config when GITHUB_CLIENT_ID is missing", async () => {
    delete process.env.GITHUB_CLIENT_ID;
    mockValidateState.mockReturnValue(true);

    const res = await GET(
      makeRequest({ code: "valid-code", state: "valid-state", cookie: "chapa_oauth_state=valid-state" }),
    );

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.searchParams.get("error")).toBe("config");
  });

  it("redirects to /?error=config when GITHUB_CLIENT_SECRET is missing", async () => {
    delete process.env.GITHUB_CLIENT_SECRET;
    mockValidateState.mockReturnValue(true);

    const res = await GET(
      makeRequest({ code: "valid-code", state: "valid-state", cookie: "chapa_oauth_state=valid-state" }),
    );

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.searchParams.get("error")).toBe("config");
  });

  it("redirects to /?error=config when NEXTAUTH_SECRET is missing", async () => {
    delete process.env.NEXTAUTH_SECRET;
    mockValidateState.mockReturnValue(true);

    const res = await GET(
      makeRequest({ code: "valid-code", state: "valid-state", cookie: "chapa_oauth_state=valid-state" }),
    );

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.searchParams.get("error")).toBe("config");
  });

  it("redirects to /?error=token_exchange when token exchange fails", async () => {
    mockValidateState.mockReturnValue(true);
    mockExchangeCodeForToken.mockResolvedValue(null);

    const res = await GET(
      makeRequest({ code: "valid-code", state: "valid-state", cookie: "chapa_oauth_state=valid-state" }),
    );

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.searchParams.get("error")).toBe("token_exchange");
  });

  it("redirects to /?error=user_fetch when user fetch fails", async () => {
    mockValidateState.mockReturnValue(true);
    mockExchangeCodeForToken.mockResolvedValue("gho_valid_token");
    mockFetchGitHubUser.mockResolvedValue(null);

    const res = await GET(
      makeRequest({ code: "valid-code", state: "valid-state", cookie: "chapa_oauth_state=valid-state" }),
    );

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.searchParams.get("error")).toBe("user_fetch");
  });

  it("redirects to /u/:login with Set-Cookie on successful flow", async () => {
    mockValidateState.mockReturnValue(true);
    mockExchangeCodeForToken.mockResolvedValue("gho_valid_token");
    mockFetchGitHubUser.mockResolvedValue({
      login: "octocat",
      name: "The Octocat",
      avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
    });
    mockCreateSessionCookie.mockReturnValue("chapa_session=encrypted; HttpOnly; Path=/; Max-Age=86400");
    mockClearStateCookie.mockReturnValue("chapa_oauth_state=; HttpOnly; Path=/; Max-Age=0");

    const res = await GET(
      makeRequest({ code: "valid-code", state: "valid-state", cookie: "chapa_oauth_state=valid-state" }),
    );

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.pathname).toBe("/generating/octocat");

    // Verify Set-Cookie headers are present
    const setCookies = res.headers.getSetCookie();
    expect(setCookies).toHaveLength(3);
    expect(setCookies[0]).toContain("chapa_session=");
    expect(setCookies[1]).toContain("chapa_oauth_state=");
    expect(setCookies[2]).toContain("chapa_redirect=");
  });

  it("passes correct arguments to exchangeCodeForToken", async () => {
    mockValidateState.mockReturnValue(true);
    mockExchangeCodeForToken.mockResolvedValue("gho_valid_token");
    mockFetchGitHubUser.mockResolvedValue({
      login: "octocat",
      name: "The Octocat",
      avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
    });
    mockCreateSessionCookie.mockReturnValue("chapa_session=encrypted;");
    mockClearStateCookie.mockReturnValue("chapa_oauth_state=;");

    await GET(
      makeRequest({ code: "my-oauth-code", state: "valid-state", cookie: "chapa_oauth_state=valid-state" }),
    );

    expect(mockExchangeCodeForToken).toHaveBeenCalledWith(
      "my-oauth-code",
      "test-client-id",
      "test-client-secret",
    );
  });

  it("passes correct arguments to createSessionCookie", async () => {
    mockValidateState.mockReturnValue(true);
    mockExchangeCodeForToken.mockResolvedValue("gho_valid_token");
    mockFetchGitHubUser.mockResolvedValue({
      login: "octocat",
      name: "The Octocat",
      avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
    });
    mockCreateSessionCookie.mockReturnValue("chapa_session=encrypted;");
    mockClearStateCookie.mockReturnValue("chapa_oauth_state=;");

    await GET(
      makeRequest({ code: "valid-code", state: "valid-state", cookie: "chapa_oauth_state=valid-state" }),
    );

    expect(mockCreateSessionCookie).toHaveBeenCalledWith(
      {
        token: "gho_valid_token",
        login: "octocat",
        name: "The Octocat",
        avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
      },
      "test-session-secret",
    );
  });

  it("ignores malicious redirect cookie and falls back to profile page", async () => {
    process.env.NEXT_PUBLIC_BASE_URL = "https://chapa.thecreativetoken.com";
    mockValidateState.mockReturnValue(true);
    mockExchangeCodeForToken.mockResolvedValue("gho_valid_token");
    mockFetchGitHubUser.mockResolvedValue({
      login: "octocat",
      name: "The Octocat",
      avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
    });
    mockCreateSessionCookie.mockReturnValue("chapa_session=encrypted;");
    mockClearStateCookie.mockReturnValue("chapa_oauth_state=;");

    const res = await GET(
      makeRequest({
        code: "valid-code",
        state: "valid-state",
        cookie: `chapa_oauth_state=valid-state; chapa_redirect=${encodeURIComponent("https://evil.com/steal")}`,
      }),
    );

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.pathname).toBe("/generating/octocat");

    delete process.env.NEXT_PUBLIC_BASE_URL;
  });
});
