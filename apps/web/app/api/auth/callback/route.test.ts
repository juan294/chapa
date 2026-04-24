import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock dependencies BEFORE importing the route handler.
// ---------------------------------------------------------------------------

const {
  mockExchangeCodeForToken,
  mockFetchGitHubUser,
  mockFetchGitHubUserEmail,
  mockCreateSessionCookie,
  mockValidateState,
  mockConsumeOauthState,
  mockClearStateCookie,
  mockRateLimit,
  mockDbUpsertUser,
  mockAddContact,
  mockCaptureServerError,
} = vi.hoisted(() => ({
  mockExchangeCodeForToken: vi.fn(),
  mockFetchGitHubUser: vi.fn(),
  mockFetchGitHubUserEmail: vi.fn(),
  mockCreateSessionCookie: vi.fn(),
  mockValidateState: vi.fn(),
  mockConsumeOauthState: vi.fn(),
  mockClearStateCookie: vi.fn(),
  mockRateLimit: vi.fn(),
  mockDbUpsertUser: vi.fn(),
  mockAddContact: vi.fn(),
  mockCaptureServerError: vi.fn(),
}));

vi.mock("@/lib/auth/github", () => ({
  exchangeCodeForToken: mockExchangeCodeForToken,
  fetchGitHubUser: mockFetchGitHubUser,
  fetchGitHubUserEmail: mockFetchGitHubUserEmail,
  createSessionCookie: mockCreateSessionCookie,
  validateState: mockValidateState,
  clearStateCookie: mockClearStateCookie,
}));

vi.mock("@/lib/auth/oauth-state", () => ({
  consumeOauthState: mockConsumeOauthState,
}));

vi.mock("@/lib/cache/redis", () => ({
  rateLimit: mockRateLimit,
}));

vi.mock("@/lib/http/client-ip", () => ({
  getClientIp: (req: Request) =>
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown",
}));

vi.mock("@/lib/db/users", () => ({
  dbUpsertUser: mockDbUpsertUser,
}));

vi.mock("@/lib/email/audience", () => ({
  addContact: mockAddContact,
}));

vi.mock("@/lib/analytics/server-errors", () => ({
  captureServerError: mockCaptureServerError,
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
  baseUrl?: string;
}): NextRequest {
  const url = new URL(
    params?.baseUrl ?? "https://chapa.thecreativetoken.com/api/auth/callback",
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
  mockConsumeOauthState.mockResolvedValue(true);
  mockFetchGitHubUserEmail.mockResolvedValue(null);
  mockDbUpsertUser.mockResolvedValue(undefined);
  mockAddContact.mockResolvedValue(undefined);
  mockCaptureServerError.mockResolvedValue(undefined);
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

  it("consumes the state value server-side and rejects replay", async () => {
    mockValidateState.mockReturnValue(true);
    mockConsumeOauthState
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    mockExchangeCodeForToken.mockResolvedValue("gho_valid_token");
    mockFetchGitHubUser.mockResolvedValue({
      login: "octocat",
      name: "The Octocat",
      avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
    });
    mockCreateSessionCookie.mockReturnValue("chapa_session=encrypted; HttpOnly; Path=/; Max-Age=86400");
    mockClearStateCookie.mockReturnValue("chapa_oauth_state=; HttpOnly; Path=/; Max-Age=0");

    const first = await GET(
      makeRequest({ code: "valid-code", state: "state-abc", cookie: "chapa_oauth_state=state-abc; chapa_oauth_state_store=shared" }),
    );
    expect(first.status).toBe(307);

    const second = await GET(
      makeRequest({ code: "valid-code", state: "state-abc", cookie: "chapa_oauth_state=state-abc; chapa_oauth_state_store=shared" }),
    );
    expect(second.status).toBe(400);
    await expect(second.json()).resolves.toEqual({ error: "state_already_used" });
  });

  it("skips shared-store replay enforcement when login marked the nonce as fallback-only", async () => {
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
      makeRequest({
        code: "valid-code",
        state: "valid-state",
        cookie: "chapa_oauth_state=valid-state; chapa_oauth_state_store=fallback",
      }),
    );

    expect(res.status).toBe(307);
    expect(mockConsumeOauthState).not.toHaveBeenCalled();
  });

  it("skips shared-store replay enforcement on localhost during local dev", async () => {
    mockValidateState.mockReturnValue(true);
    mockConsumeOauthState.mockResolvedValue(false);
    mockExchangeCodeForToken.mockResolvedValue("gho_valid_token");
    mockFetchGitHubUser.mockResolvedValue({
      login: "octocat",
      name: "The Octocat",
      avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
    });
    mockCreateSessionCookie.mockReturnValue("chapa_session=encrypted; HttpOnly; Path=/; Max-Age=86400");
    mockClearStateCookie.mockReturnValue("chapa_oauth_state=; HttpOnly; Path=/; Max-Age=0");

    const res = await GET(
      makeRequest({
        baseUrl: "http://localhost:3001/api/auth/callback",
        code: "valid-code",
        state: "valid-state",
        cookie: "chapa_oauth_state=valid-state; chapa_oauth_state_store=shared",
      }),
    );

    expect(res.status).toBe(307);
    expect(mockConsumeOauthState).not.toHaveBeenCalled();
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
    expect(setCookies).toHaveLength(4);
    expect(setCookies[0]).toContain("chapa_session=");
    expect(setCookies[1]).toContain("chapa_oauth_state=");
    expect(setCookies[2]).toContain("chapa_oauth_state_store=");
    expect(setCookies[3]).toContain("chapa_redirect=");
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

  it("captures email and upserts user on successful login", async () => {
    mockValidateState.mockReturnValue(true);
    mockExchangeCodeForToken.mockResolvedValue("gho_valid_token");
    mockFetchGitHubUser.mockResolvedValue({
      login: "octocat",
      name: "The Octocat",
      avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
    });
    mockFetchGitHubUserEmail.mockResolvedValue("octocat@github.com");
    mockCreateSessionCookie.mockReturnValue("chapa_session=encrypted;");
    mockClearStateCookie.mockReturnValue("chapa_oauth_state=;");

    await GET(
      makeRequest({ code: "valid-code", state: "valid-state", cookie: "chapa_oauth_state=valid-state" }),
    );

    expect(mockFetchGitHubUserEmail).toHaveBeenCalledWith("gho_valid_token");
    expect(mockDbUpsertUser).toHaveBeenCalledWith("octocat", {
      email: "octocat@github.com",
      displayName: "The Octocat",
      avatarUrl: "https://avatars.githubusercontent.com/u/1?v=4",
    });
  });

  it("upserts user without email when email fetch fails", async () => {
    mockValidateState.mockReturnValue(true);
    mockExchangeCodeForToken.mockResolvedValue("gho_valid_token");
    mockFetchGitHubUser.mockResolvedValue({
      login: "octocat",
      name: "The Octocat",
      avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
    });
    mockFetchGitHubUserEmail.mockResolvedValue(null);
    mockCreateSessionCookie.mockReturnValue("chapa_session=encrypted;");
    mockClearStateCookie.mockReturnValue("chapa_oauth_state=;");

    await GET(
      makeRequest({ code: "valid-code", state: "valid-state", cookie: "chapa_oauth_state=valid-state" }),
    );

    expect(mockDbUpsertUser).toHaveBeenCalledWith("octocat", {
      email: undefined,
      displayName: "The Octocat",
      avatarUrl: "https://avatars.githubusercontent.com/u/1?v=4",
    });
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

// ---------------------------------------------------------------------------
// captureServerError on error paths
// ---------------------------------------------------------------------------

describe("GET /api/auth/callback — error telemetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    allowRateLimit();
    setEnvVars();
    mockAddContact.mockResolvedValue(undefined);
  });

  afterEach(() => {
    clearEnvVars();
    delete process.env.NEXT_PUBLIC_BASE_URL;
  });

  it("calls captureServerError when config env vars are missing", async () => {
    delete process.env.GITHUB_CLIENT_ID;
    mockValidateState.mockReturnValue(true);

    await GET(
      makeRequest({ code: "valid-code", state: "valid-state", cookie: "chapa_oauth_state=valid-state" }),
    );

    expect(mockCaptureServerError).toHaveBeenCalledWith(
      expect.objectContaining({
        route: "/api/auth/callback",
        statusCode: 500,
      }),
    );
  });

  it("calls captureServerError when token exchange returns null", async () => {
    mockValidateState.mockReturnValue(true);
    mockExchangeCodeForToken.mockResolvedValue(null);

    await GET(
      makeRequest({ code: "valid-code", state: "valid-state", cookie: "chapa_oauth_state=valid-state" }),
    );

    expect(mockCaptureServerError).toHaveBeenCalledWith(
      expect.objectContaining({
        route: "/api/auth/callback",
        statusCode: 502,
      }),
    );
  });

  it("calls captureServerError when user fetch returns null", async () => {
    mockValidateState.mockReturnValue(true);
    mockExchangeCodeForToken.mockResolvedValue("gho_valid_token");
    mockFetchGitHubUser.mockResolvedValue(null);

    await GET(
      makeRequest({ code: "valid-code", state: "valid-state", cookie: "chapa_oauth_state=valid-state" }),
    );

    expect(mockCaptureServerError).toHaveBeenCalledWith(
      expect.objectContaining({
        route: "/api/auth/callback",
        statusCode: 502,
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Post-login redirect cookie handling
// ---------------------------------------------------------------------------

describe("GET /api/auth/callback — redirect cookie", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    allowRateLimit();
    setEnvVars();
    mockAddContact.mockResolvedValue(undefined);
  });

  afterEach(() => {
    clearEnvVars();
    delete process.env.NEXT_PUBLIC_BASE_URL;
  });

  function setupHappyPath() {
    mockValidateState.mockReturnValue(true);
    mockExchangeCodeForToken.mockResolvedValue("gho_valid_token");
    mockFetchGitHubUser.mockResolvedValue({
      login: "octocat",
      name: "The Octocat",
      avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
    });
    mockCreateSessionCookie.mockReturnValue("chapa_session=encrypted;");
    mockClearStateCookie.mockReturnValue("chapa_oauth_state=;");
  }

  it("redirects to a safe same-origin path from the cookie", async () => {
    process.env.NEXT_PUBLIC_BASE_URL = "https://chapa.thecreativetoken.com";
    setupHappyPath();

    const res = await GET(
      makeRequest({
        code: "valid-code",
        state: "valid-state",
        cookie: `chapa_oauth_state=valid-state; chapa_redirect=${encodeURIComponent("/studio")}`,
      }),
    );

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.pathname).toBe("/studio");
  });

  it("rejects double-slash redirect (protocol-relative URL)", async () => {
    process.env.NEXT_PUBLIC_BASE_URL = "https://chapa.thecreativetoken.com";
    setupHappyPath();

    const res = await GET(
      makeRequest({
        code: "valid-code",
        state: "valid-state",
        cookie: `chapa_oauth_state=valid-state; chapa_redirect=${encodeURIComponent("//evil.com")}`,
      }),
    );

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    // Falls back to default generating page
    expect(location.pathname).toBe("/generating/octocat");
  });

  it("falls back to /generating/:login when no redirect cookie present", async () => {
    setupHappyPath();

    const res = await GET(
      makeRequest({
        code: "valid-code",
        state: "valid-state",
        cookie: "chapa_oauth_state=valid-state",
      }),
    );

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.pathname).toBe("/generating/octocat");
  });

  it("falls back to /generating/:login when redirect cookie has malformed URI encoding", async () => {
    setupHappyPath();

    const res = await GET(
      makeRequest({
        code: "valid-code",
        state: "valid-state",
        // %ZZ is not a valid percent-encoded sequence
        cookie: "chapa_oauth_state=valid-state; chapa_redirect=%ZZ",
      }),
    );

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.pathname).toBe("/generating/octocat");
  });

  it("clears the redirect cookie in the response", async () => {
    setupHappyPath();

    const res = await GET(
      makeRequest({
        code: "valid-code",
        state: "valid-state",
        cookie: `chapa_oauth_state=valid-state; chapa_redirect=${encodeURIComponent("/studio")}`,
      }),
    );

    const setCookies = res.headers.getSetCookie();
    const redirectClear = setCookies.find((c) => c.startsWith("chapa_redirect="));
    expect(redirectClear).toBeDefined();
    expect(redirectClear).toContain("Max-Age=0");
  });
});

// ---------------------------------------------------------------------------
// Secure cookie flags & isSecureOrigin
// ---------------------------------------------------------------------------

describe("GET /api/auth/callback — cookie flags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    allowRateLimit();
    setEnvVars();
    mockAddContact.mockResolvedValue(undefined);
  });

  afterEach(() => {
    clearEnvVars();
    delete process.env.NEXT_PUBLIC_BASE_URL;
  });

  function setupHappyPath() {
    mockValidateState.mockReturnValue(true);
    mockExchangeCodeForToken.mockResolvedValue("gho_valid_token");
    mockFetchGitHubUser.mockResolvedValue({
      login: "octocat",
      name: "The Octocat",
      avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
    });
    mockCreateSessionCookie.mockReturnValue("chapa_session=encrypted;");
    mockClearStateCookie.mockReturnValue("chapa_oauth_state=;");
  }

  it("includes Secure flag when NEXT_PUBLIC_BASE_URL is https", async () => {
    process.env.NEXT_PUBLIC_BASE_URL = "https://chapa.thecreativetoken.com";
    setupHappyPath();

    const res = await GET(
      makeRequest({
        code: "valid-code",
        state: "valid-state",
        cookie: "chapa_oauth_state=valid-state",
      }),
    );

    // The redirect-clear cookie is built with cookieFlags()
    const setCookies = res.headers.getSetCookie();
    const redirectClear = setCookies.find((c) => c.startsWith("chapa_redirect="));
    expect(redirectClear).toContain("Secure");
  });

  it("omits Secure flag when NEXT_PUBLIC_BASE_URL is http", async () => {
    process.env.NEXT_PUBLIC_BASE_URL = "http://localhost:3001";
    setupHappyPath();

    const res = await GET(
      makeRequest({
        code: "valid-code",
        state: "valid-state",
        cookie: "chapa_oauth_state=valid-state",
      }),
    );

    const setCookies = res.headers.getSetCookie();
    const redirectClear = setCookies.find((c) => c.startsWith("chapa_redirect="));
    expect(redirectClear).toBeDefined();
    expect(redirectClear).not.toContain("Secure");
  });

  it("includes Secure flag when NEXT_PUBLIC_BASE_URL is unset", async () => {
    delete process.env.NEXT_PUBLIC_BASE_URL;
    setupHappyPath();

    const res = await GET(
      makeRequest({
        code: "valid-code",
        state: "valid-state",
        cookie: "chapa_oauth_state=valid-state",
      }),
    );

    const setCookies = res.headers.getSetCookie();
    const redirectClear = setCookies.find((c) => c.startsWith("chapa_redirect="));
    expect(redirectClear).toBeDefined();
    expect(redirectClear).toContain("Secure");
  });
});

// ---------------------------------------------------------------------------
// Email and audience sync
// ---------------------------------------------------------------------------

describe("GET /api/auth/callback — audience sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    allowRateLimit();
    setEnvVars();
    mockAddContact.mockResolvedValue(undefined);
  });

  afterEach(() => {
    clearEnvVars();
  });

  function setupHappyPath(opts?: { email?: string | null }) {
    mockValidateState.mockReturnValue(true);
    mockExchangeCodeForToken.mockResolvedValue("gho_valid_token");
    mockFetchGitHubUser.mockResolvedValue({
      login: "octocat",
      name: "The Octocat",
      avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
    });
    mockFetchGitHubUserEmail.mockResolvedValue(opts?.email ?? null);
    mockCreateSessionCookie.mockReturnValue("chapa_session=encrypted;");
    mockClearStateCookie.mockReturnValue("chapa_oauth_state=;");
  }

  it("calls addContact when email is available", async () => {
    setupHappyPath({ email: "octocat@github.com" });

    await GET(
      makeRequest({ code: "valid-code", state: "valid-state", cookie: "chapa_oauth_state=valid-state" }),
    );

    expect(mockAddContact).toHaveBeenCalledWith("octocat@github.com", {
      firstName: "The Octocat",
      handle: "octocat",
    });
  });

  it("does not call addContact when email is null", async () => {
    setupHappyPath({ email: null });

    await GET(
      makeRequest({ code: "valid-code", state: "valid-state", cookie: "chapa_oauth_state=valid-state" }),
    );

    expect(mockAddContact).not.toHaveBeenCalled();
  });

  it("succeeds even when fetchGitHubUserEmail throws", async () => {
    mockValidateState.mockReturnValue(true);
    mockExchangeCodeForToken.mockResolvedValue("gho_valid_token");
    mockFetchGitHubUser.mockResolvedValue({
      login: "octocat",
      name: "The Octocat",
      avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
    });
    mockFetchGitHubUserEmail.mockRejectedValue(new Error("Network error"));
    mockCreateSessionCookie.mockReturnValue("chapa_session=encrypted;");
    mockClearStateCookie.mockReturnValue("chapa_oauth_state=;");

    const res = await GET(
      makeRequest({ code: "valid-code", state: "valid-state", cookie: "chapa_oauth_state=valid-state" }),
    );

    // Should still redirect successfully
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.pathname).toBe("/generating/octocat");
  });

  it("handles user with null name gracefully", async () => {
    mockValidateState.mockReturnValue(true);
    mockExchangeCodeForToken.mockResolvedValue("gho_valid_token");
    mockFetchGitHubUser.mockResolvedValue({
      login: "octocat",
      name: null,
      avatar_url: null,
    });
    mockFetchGitHubUserEmail.mockResolvedValue("octocat@github.com");
    mockCreateSessionCookie.mockReturnValue("chapa_session=encrypted;");
    mockClearStateCookie.mockReturnValue("chapa_oauth_state=;");

    await GET(
      makeRequest({ code: "valid-code", state: "valid-state", cookie: "chapa_oauth_state=valid-state" }),
    );

    // addContact gets undefined for firstName when name is null
    expect(mockAddContact).toHaveBeenCalledWith("octocat@github.com", {
      firstName: undefined,
      handle: "octocat",
    });

    // dbUpsertUser gets null for name/avatar
    expect(mockDbUpsertUser).toHaveBeenCalledWith("octocat", {
      email: "octocat@github.com",
      displayName: null,
      avatarUrl: null,
    });
  });

  it("swallows dbUpsertUser rejection and calls captureServerError (fire-and-forget)", async () => {
    mockValidateState.mockReturnValue(true);
    mockExchangeCodeForToken.mockResolvedValue("gho_valid_token");
    mockFetchGitHubUser.mockResolvedValue({
      login: "octocat",
      name: "The Octocat",
      avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
    });
    mockFetchGitHubUserEmail.mockResolvedValue(null);
    mockCreateSessionCookie.mockReturnValue("chapa_session=encrypted;");
    mockClearStateCookie.mockReturnValue("chapa_oauth_state=;");
    // dbUpsertUser rejects — should be captured, not silently discarded
    mockDbUpsertUser.mockRejectedValue(new Error("DB down"));

    const res = await GET(
      makeRequest({ code: "valid-code", state: "valid-state", cookie: "chapa_oauth_state=valid-state" }),
    );

    // Should still redirect successfully despite dbUpsertUser failure
    expect(res.status).toBe(307);
    // Flush microtasks so .catch() runs
    await new Promise((r) => setTimeout(r, 0));
    // Error must be tracked — not silently swallowed
    expect(mockCaptureServerError).toHaveBeenCalledWith(
      expect.objectContaining({
        route: "/api/auth/callback",
        statusCode: 500,
        error: expect.any(Error),
      }),
    );
  });

  it("swallows addContact rejection and calls captureServerError (fire-and-forget)", async () => {
    mockValidateState.mockReturnValue(true);
    mockExchangeCodeForToken.mockResolvedValue("gho_valid_token");
    mockFetchGitHubUser.mockResolvedValue({
      login: "octocat",
      name: "The Octocat",
      avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
    });
    mockFetchGitHubUserEmail.mockResolvedValue("octocat@github.com");
    mockCreateSessionCookie.mockReturnValue("chapa_session=encrypted;");
    mockClearStateCookie.mockReturnValue("chapa_oauth_state=;");
    // addContact rejects — should be captured, not silently discarded
    mockAddContact.mockRejectedValue(new Error("Email service down"));

    const res = await GET(
      makeRequest({ code: "valid-code", state: "valid-state", cookie: "chapa_oauth_state=valid-state" }),
    );

    // Should still redirect successfully despite addContact failure
    expect(res.status).toBe(307);
    // Flush microtasks so .catch() runs
    await new Promise((r) => setTimeout(r, 0));
    // Error must be tracked — not silently swallowed
    expect(mockCaptureServerError).toHaveBeenCalledWith(
      expect.objectContaining({
        route: "/api/auth/callback",
        statusCode: 500,
        error: expect.any(Error),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// #705: Redirect allow-list enforcement
// ---------------------------------------------------------------------------

describe("GET /api/auth/callback — redirect allow-list (#705)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    allowRateLimit();
    setEnvVars();
    mockAddContact.mockResolvedValue(undefined);
    process.env.NEXT_PUBLIC_BASE_URL = "https://chapa.thecreativetoken.com";
  });

  afterEach(() => {
    clearEnvVars();
    delete process.env.NEXT_PUBLIC_BASE_URL;
  });

  function setupHappyPath() {
    mockValidateState.mockReturnValue(true);
    mockExchangeCodeForToken.mockResolvedValue("gho_valid_token");
    mockFetchGitHubUser.mockResolvedValue({
      login: "octocat",
      name: "The Octocat",
      avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
    });
    mockCreateSessionCookie.mockReturnValue("chapa_session=encrypted;");
    mockClearStateCookie.mockReturnValue("chapa_oauth_state=;");
  }

  it("allows redirect to /u/ prefix", async () => {
    setupHappyPath();

    const res = await GET(
      makeRequest({
        code: "valid-code",
        state: "valid-state",
        cookie: `chapa_oauth_state=valid-state; chapa_redirect=${encodeURIComponent("/u/someuser")}`,
      }),
    );

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.pathname).toBe("/u/someuser");
  });

  it("allows redirect to /studio", async () => {
    setupHappyPath();

    const res = await GET(
      makeRequest({
        code: "valid-code",
        state: "valid-state",
        cookie: `chapa_oauth_state=valid-state; chapa_redirect=${encodeURIComponent("/studio")}`,
      }),
    );

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.pathname).toBe("/studio");
  });

  it("allows redirect to /about", async () => {
    setupHappyPath();

    const res = await GET(
      makeRequest({
        code: "valid-code",
        state: "valid-state",
        cookie: `chapa_oauth_state=valid-state; chapa_redirect=${encodeURIComponent("/about")}`,
      }),
    );

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.pathname).toBe("/about");
  });

  it("allows redirect to exactly /", async () => {
    setupHappyPath();

    const res = await GET(
      makeRequest({
        code: "valid-code",
        state: "valid-state",
        cookie: `chapa_oauth_state=valid-state; chapa_redirect=${encodeURIComponent("/")}`,
      }),
    );

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.pathname).toBe("/");
  });

  it("blocks redirect to /evil-path (not on allow-list)", async () => {
    setupHappyPath();

    const res = await GET(
      makeRequest({
        code: "valid-code",
        state: "valid-state",
        cookie: `chapa_oauth_state=valid-state; chapa_redirect=${encodeURIComponent("/evil-path")}`,
      }),
    );

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    // Falls back to generating page — /evil-path is not on allow-list
    expect(location.pathname).toBe("/generating/octocat");
  });

  it("blocks redirect to /admin (not on allow-list)", async () => {
    setupHappyPath();

    const res = await GET(
      makeRequest({
        code: "valid-code",
        state: "valid-state",
        cookie: `chapa_oauth_state=valid-state; chapa_redirect=${encodeURIComponent("/admin")}`,
      }),
    );

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.pathname).toBe("/generating/octocat");
  });

  it("blocks redirect to /verify (not on allow-list)", async () => {
    setupHappyPath();

    const res = await GET(
      makeRequest({
        code: "valid-code",
        state: "valid-state",
        cookie: `chapa_oauth_state=valid-state; chapa_redirect=${encodeURIComponent("/verify/abc123")}`,
      }),
    );

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.pathname).toBe("/generating/octocat");
  });

  it("blocks cross-origin redirect to https://evil.com", async () => {
    setupHappyPath();

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
  });
});
