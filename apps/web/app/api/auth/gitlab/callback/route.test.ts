import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  GITLAB_ENV_VARS,
  GITLAB_TOKEN_RESPONSE,
  GITLAB_USER,
  GITLAB_CLEAR_COOKIE,
  RATE_LIMIT_ALLOWED,
  RATE_LIMIT_BLOCKED,
  TEST_TOKEN_EXPIRY,
  TEST_IP,
  allowSession,
  denySession,
  setEnvVars,
  clearEnvVars,
} from "@/lib/test-helpers/platform-auth-fixtures";

// ---------------------------------------------------------------------------
// Mock dependencies BEFORE importing the route handler.
// ---------------------------------------------------------------------------

const {
  mockIsGitlabEnabled,
  mockRequireSession,
  mockValidateGitlabState,
  mockClearGitlabStateCookie,
  mockExchangeGitlabCode,
  mockFetchGitlabUser,
  mockComputeTokenExpiry,
  mockDbUpsertLinkedPlatform,
  mockCacheDel,
  mockRateLimit,
  mockGetClientIp,
} = vi.hoisted(() => ({
  mockIsGitlabEnabled: vi.fn(),
  mockRequireSession: vi.fn(),
  mockValidateGitlabState: vi.fn(),
  mockClearGitlabStateCookie: vi.fn(),
  mockExchangeGitlabCode: vi.fn(),
  mockFetchGitlabUser: vi.fn(),
  mockComputeTokenExpiry: vi.fn(),
  mockDbUpsertLinkedPlatform: vi.fn(),
  mockCacheDel: vi.fn(),
  mockRateLimit: vi.fn(),
  mockGetClientIp: vi.fn(),
}));

vi.mock("@/lib/feature-flags", () => ({
  isGitlabEnabled: mockIsGitlabEnabled,
}));

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: mockRequireSession,
}));

vi.mock("@/lib/auth/gitlab", () => ({
  validateGitlabState: mockValidateGitlabState,
  clearGitlabStateCookie: mockClearGitlabStateCookie,
  exchangeGitlabCode: mockExchangeGitlabCode,
  fetchGitlabUser: mockFetchGitlabUser,
  // Stubs required by ../config.ts (not used in callback flow)
  createGitlabStateCookie: vi.fn(),
  buildGitlabAuthUrl: vi.fn(),
}));

vi.mock("@/lib/auth/bitbucket", () => ({
  computeTokenExpiry: mockComputeTokenExpiry,
}));

vi.mock("@/lib/db/user-platforms", () => ({
  dbUpsertLinkedPlatform: mockDbUpsertLinkedPlatform,
  // Stubs required by platform-oauth.ts (not used in callback flow)
  dbDeleteLinkedPlatform: vi.fn(),
  dbGetLinkedPlatforms: vi.fn(),
}));

vi.mock("@/lib/cache/redis", () => ({
  cacheDel: mockCacheDel,
  rateLimit: mockRateLimit,
}));

vi.mock("@/lib/http/client-ip", () => ({
  getClientIp: mockGetClientIp,
}));

import { GET } from "./route";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(params?: {
  code?: string;
  state?: string;
  cookie?: string;
}): NextRequest {
  const url = new URL(
    "https://chapa.thecreativetoken.com/api/auth/gitlab/callback",
  );
  if (params?.code) url.searchParams.set("code", params.code);
  if (params?.state) url.searchParams.set("state", params.state);
  const headers: Record<string, string> = {};
  if (params?.cookie) headers["cookie"] = params.cookie;
  return new NextRequest(url, { headers });
}

function setupHappyPath() {
  mockIsGitlabEnabled.mockResolvedValue(true);
  mockRateLimit.mockResolvedValue(RATE_LIMIT_ALLOWED);
  mockGetClientIp.mockReturnValue(TEST_IP);
  allowSession(mockRequireSession);
  setEnvVars(GITLAB_ENV_VARS);
  mockValidateGitlabState.mockReturnValue(true);
  mockExchangeGitlabCode.mockResolvedValue(GITLAB_TOKEN_RESPONSE);
  mockFetchGitlabUser.mockResolvedValue(GITLAB_USER);
  mockComputeTokenExpiry.mockReturnValue(TEST_TOKEN_EXPIRY);
  mockDbUpsertLinkedPlatform.mockResolvedValue(true);
  mockCacheDel.mockResolvedValue(undefined);
  mockClearGitlabStateCookie.mockReturnValue(GITLAB_CLEAR_COOKIE);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/auth/gitlab/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyPath();
  });

  afterEach(() => {
    clearEnvVars(GITLAB_ENV_VARS);
  });

  it("returns 404 when feature flag is disabled", async () => {
    mockIsGitlabEnabled.mockResolvedValue(false);

    const res = await GET(
      makeRequest({ code: "abc", state: "xyz", cookie: "chapa_gl_oauth_state=xyz" }),
    );
    expect(res.status).toBe(404);
  });

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue(RATE_LIMIT_BLOCKED);

    const res = await GET(
      makeRequest({ code: "abc", state: "xyz", cookie: "chapa_gl_oauth_state=xyz" }),
    );
    expect(res.status).toBe(429);
  });

  it("returns 401 when not authenticated", async () => {
    denySession(mockRequireSession);

    const res = await GET(
      makeRequest({ code: "abc", state: "xyz", cookie: "chapa_gl_oauth_state=xyz" }),
    );
    expect(res.status).toBe(401);
  });

  it("redirects with error=gitlab_no_code when code is missing", async () => {
    const res = await GET(makeRequest({ state: "xyz" }));

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.pathname).toBe("/u/testuser");
    expect(location.searchParams.get("error")).toBe("gitlab_no_code");
  });

  it("redirects with error=gitlab_invalid_state when state validation fails", async () => {
    mockValidateGitlabState.mockReturnValue(false);

    const res = await GET(
      makeRequest({ code: "abc", state: "bad", cookie: "chapa_gl_oauth_state=other" }),
    );

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.searchParams.get("error")).toBe("gitlab_invalid_state");
  });

  it("redirects with error=gitlab_config when env vars are missing", async () => {
    vi.stubEnv("GITLAB_CLIENT_ID", undefined);

    const res = await GET(
      makeRequest({ code: "abc", state: "xyz", cookie: "chapa_gl_oauth_state=xyz" }),
    );

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.searchParams.get("error")).toBe("gitlab_config");
  });

  it("redirects with error=gitlab_token_exchange when token exchange fails", async () => {
    mockExchangeGitlabCode.mockResolvedValue(null);

    const res = await GET(
      makeRequest({ code: "bad-code", state: "xyz", cookie: "chapa_gl_oauth_state=xyz" }),
    );

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.searchParams.get("error")).toBe("gitlab_token_exchange");
  });

  it("redirects with error=gitlab_user_fetch when user fetch fails", async () => {
    mockFetchGitlabUser.mockResolvedValue(null);

    const res = await GET(
      makeRequest({ code: "abc", state: "xyz", cookie: "chapa_gl_oauth_state=xyz" }),
    );

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.searchParams.get("error")).toBe("gitlab_user_fetch");
  });

  it("redirects with error=gitlab_storage when DB upsert fails", async () => {
    mockDbUpsertLinkedPlatform.mockResolvedValue(false);

    const res = await GET(
      makeRequest({ code: "abc", state: "xyz", cookie: "chapa_gl_oauth_state=xyz" }),
    );

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.searchParams.get("error")).toBe("gitlab_storage");
  });

  it("redirects to /u/{handle}?gitlab=linked on success", async () => {
    const res = await GET(
      makeRequest({ code: "abc", state: "xyz", cookie: "chapa_gl_oauth_state=xyz" }),
    );

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.pathname).toBe("/u/testuser");
    expect(location.searchParams.get("gitlab")).toBe("linked");
  });

  it("stores tokens via dbUpsertLinkedPlatform", async () => {
    await GET(
      makeRequest({ code: "abc", state: "xyz", cookie: "chapa_gl_oauth_state=xyz" }),
    );

    expect(mockDbUpsertLinkedPlatform).toHaveBeenCalledWith(
      "testuser",
      "gitlab",
      "gl-user",
      "gl_access_123",
      "gl_refresh_456",
      TEST_TOKEN_EXPIRY,
    );
  });

  it("passes null expiresAt when token has no expires_in", async () => {
    mockExchangeGitlabCode.mockResolvedValue({
      access_token: "gl_access_long",
      token_type: "bearer",
      // No expires_in, no refresh_token
    });

    await GET(
      makeRequest({ code: "abc", state: "xyz", cookie: "chapa_gl_oauth_state=xyz" }),
    );

    expect(mockDbUpsertLinkedPlatform).toHaveBeenCalledWith(
      "testuser",
      "gitlab",
      "gl-user",
      "gl_access_long",
      null,
      null,
    );
    expect(mockComputeTokenExpiry).not.toHaveBeenCalled();
  });

  it("invalidates stats cache on success", async () => {
    await GET(
      makeRequest({ code: "abc", state: "xyz", cookie: "chapa_gl_oauth_state=xyz" }),
    );

    expect(mockCacheDel).toHaveBeenCalledWith("stats:v2:merged:testuser");
    expect(mockCacheDel).toHaveBeenCalledWith("stats:v2:gitlab:testuser");
  });

  it("clears CSRF state cookie on success", async () => {
    const res = await GET(
      makeRequest({ code: "abc", state: "xyz", cookie: "chapa_gl_oauth_state=xyz" }),
    );

    const setCookies = res.headers.getSetCookie();
    expect(setCookies.some((c) => c.includes("chapa_gl_oauth_state="))).toBe(true);
  });

  it("passes correct arguments to exchangeGitlabCode", async () => {
    await GET(
      makeRequest({ code: "my-auth-code", state: "xyz", cookie: "chapa_gl_oauth_state=xyz" }),
    );

    expect(mockExchangeGitlabCode).toHaveBeenCalledWith(
      "my-auth-code",
      "test-gl-client-id",
      "test-gl-client-secret",
      "https://chapa.thecreativetoken.com/api/auth/gitlab/callback",
    );
  });

  it("passes access token to fetchGitlabUser", async () => {
    await GET(
      makeRequest({ code: "abc", state: "xyz", cookie: "chapa_gl_oauth_state=xyz" }),
    );

    expect(mockFetchGitlabUser).toHaveBeenCalledWith("gl_access_123");
  });
});
