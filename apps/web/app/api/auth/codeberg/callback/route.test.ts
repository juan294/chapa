import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock dependencies BEFORE importing the route handler.
// ---------------------------------------------------------------------------

const {
  mockIsCodebergEnabled,
  mockRequireSession,
  mockValidateCodebergState,
  mockClearCodebergStateCookie,
  mockExchangeCodebergCode,
  mockFetchCodebergUser,
  mockComputeTokenExpiry,
  mockDbUpsertLinkedPlatform,
  mockCacheDel,
  mockRateLimit,
  mockGetClientIp,
} = vi.hoisted(() => ({
  mockIsCodebergEnabled: vi.fn(),
  mockRequireSession: vi.fn(),
  mockValidateCodebergState: vi.fn(),
  mockClearCodebergStateCookie: vi.fn(),
  mockExchangeCodebergCode: vi.fn(),
  mockFetchCodebergUser: vi.fn(),
  mockComputeTokenExpiry: vi.fn(),
  mockDbUpsertLinkedPlatform: vi.fn(),
  mockCacheDel: vi.fn(),
  mockRateLimit: vi.fn(),
  mockGetClientIp: vi.fn(),
}));

vi.mock("@/lib/feature-flags", () => ({
  isCodebergEnabled: mockIsCodebergEnabled,
}));

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: mockRequireSession,
}));

vi.mock("@/lib/auth/codeberg", () => ({
  validateCodebergState: mockValidateCodebergState,
  clearCodebergStateCookie: mockClearCodebergStateCookie,
  exchangeCodebergCode: mockExchangeCodebergCode,
  fetchCodebergUser: mockFetchCodebergUser,
}));

vi.mock("@/lib/auth/bitbucket", () => ({
  computeTokenExpiry: mockComputeTokenExpiry,
}));

vi.mock("@/lib/db/user-platforms", () => ({
  dbUpsertLinkedPlatform: mockDbUpsertLinkedPlatform,
}));

vi.mock("@/lib/cache/redis", () => ({
  cacheDel: mockCacheDel,
  rateLimit: mockRateLimit,
}));

vi.mock("@/lib/http/client-ip", () => ({
  getClientIp: mockGetClientIp,
}));

import { GET } from "./route";
import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(params?: {
  code?: string;
  state?: string;
  cookie?: string;
}): NextRequest {
  const url = new URL(
    "https://chapa.thecreativetoken.com/api/auth/codeberg/callback",
  );
  if (params?.code) url.searchParams.set("code", params.code);
  if (params?.state) url.searchParams.set("state", params.state);
  const headers: Record<string, string> = {};
  if (params?.cookie) headers["cookie"] = params.cookie;
  return new NextRequest(url, { headers });
}

function allowSession() {
  mockRequireSession.mockReturnValue({
    session: {
      login: "testuser",
      token: "gho_test",
      name: "Test User",
      avatar_url: "https://example.com/avatar.png",
    },
  });
}

function setEnvVars() {
  process.env.CODEBERG_CLIENT_ID = "test-cb-client-id";
  process.env.CODEBERG_CLIENT_SECRET = "test-cb-client-secret";
  process.env.NEXT_PUBLIC_BASE_URL = "https://chapa.thecreativetoken.com";
}

function clearEnvVars() {
  delete process.env.CODEBERG_CLIENT_ID;
  delete process.env.CODEBERG_CLIENT_SECRET;
  delete process.env.NEXT_PUBLIC_BASE_URL;
}

function setupHappyPath() {
  mockIsCodebergEnabled.mockResolvedValue(true);
  mockRateLimit.mockResolvedValue({ allowed: true, current: 1, limit: 10 });
  mockGetClientIp.mockReturnValue("1.2.3.4");
  allowSession();
  setEnvVars();
  mockValidateCodebergState.mockReturnValue(true);
  mockExchangeCodebergCode.mockResolvedValue({
    access_token: "cb_access_123",
    token_type: "bearer",
    expires_in: 28800,
    refresh_token: "cb_refresh_456",
  });
  mockFetchCodebergUser.mockResolvedValue({
    login: "cb-user",
    full_name: "CB User",
    avatar_url: "https://codeberg.org/avatars/12345",
  });
  mockComputeTokenExpiry.mockReturnValue(new Date("2026-03-01T00:00:00Z"));
  mockDbUpsertLinkedPlatform.mockResolvedValue(true);
  mockCacheDel.mockResolvedValue(undefined);
  mockClearCodebergStateCookie.mockReturnValue(
    "chapa_cb_oauth_state=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/auth/codeberg/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyPath();
  });

  afterEach(() => {
    clearEnvVars();
  });

  it("returns 404 when feature flag is disabled", async () => {
    mockIsCodebergEnabled.mockResolvedValue(false);

    const res = await GET(
      makeRequest({ code: "abc", state: "xyz", cookie: "chapa_cb_oauth_state=xyz" }),
    );
    expect(res.status).toBe(404);
  });

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, current: 11, limit: 10 });

    const res = await GET(
      makeRequest({ code: "abc", state: "xyz", cookie: "chapa_cb_oauth_state=xyz" }),
    );
    expect(res.status).toBe(429);
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireSession.mockReturnValue({
      error: NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      ),
    });

    const res = await GET(
      makeRequest({ code: "abc", state: "xyz", cookie: "chapa_cb_oauth_state=xyz" }),
    );
    expect(res.status).toBe(401);
  });

  it("redirects with error=codeberg_no_code when code is missing", async () => {
    const res = await GET(makeRequest({ state: "xyz" }));

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.pathname).toBe("/u/testuser");
    expect(location.searchParams.get("error")).toBe("codeberg_no_code");
  });

  it("redirects with error=codeberg_invalid_state when state validation fails", async () => {
    mockValidateCodebergState.mockReturnValue(false);

    const res = await GET(
      makeRequest({ code: "abc", state: "bad", cookie: "chapa_cb_oauth_state=other" }),
    );

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.searchParams.get("error")).toBe("codeberg_invalid_state");
  });

  it("redirects with error=codeberg_config when env vars are missing", async () => {
    delete process.env.CODEBERG_CLIENT_ID;

    const res = await GET(
      makeRequest({ code: "abc", state: "xyz", cookie: "chapa_cb_oauth_state=xyz" }),
    );

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.searchParams.get("error")).toBe("codeberg_config");
  });

  it("redirects with error=codeberg_token_exchange when token exchange fails", async () => {
    mockExchangeCodebergCode.mockResolvedValue(null);

    const res = await GET(
      makeRequest({ code: "bad-code", state: "xyz", cookie: "chapa_cb_oauth_state=xyz" }),
    );

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.searchParams.get("error")).toBe("codeberg_token_exchange");
  });

  it("redirects with error=codeberg_user_fetch when user fetch fails", async () => {
    mockFetchCodebergUser.mockResolvedValue(null);

    const res = await GET(
      makeRequest({ code: "abc", state: "xyz", cookie: "chapa_cb_oauth_state=xyz" }),
    );

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.searchParams.get("error")).toBe("codeberg_user_fetch");
  });

  it("redirects with error=codeberg_storage when DB upsert fails", async () => {
    mockDbUpsertLinkedPlatform.mockResolvedValue(false);

    const res = await GET(
      makeRequest({ code: "abc", state: "xyz", cookie: "chapa_cb_oauth_state=xyz" }),
    );

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.searchParams.get("error")).toBe("codeberg_storage");
  });

  it("redirects to /u/{handle}?codeberg=linked on success", async () => {
    const res = await GET(
      makeRequest({ code: "abc", state: "xyz", cookie: "chapa_cb_oauth_state=xyz" }),
    );

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.pathname).toBe("/u/testuser");
    expect(location.searchParams.get("codeberg")).toBe("linked");
  });

  it("stores tokens via dbUpsertLinkedPlatform", async () => {
    await GET(
      makeRequest({ code: "abc", state: "xyz", cookie: "chapa_cb_oauth_state=xyz" }),
    );

    expect(mockDbUpsertLinkedPlatform).toHaveBeenCalledWith(
      "testuser",
      "codeberg",
      "cb-user",
      "cb_access_123",
      "cb_refresh_456",
      new Date("2026-03-01T00:00:00Z"),
    );
  });

  it("passes null expiresAt when token has no expires_in", async () => {
    mockExchangeCodebergCode.mockResolvedValue({
      access_token: "cb_access_long",
      token_type: "bearer",
      // No expires_in, no refresh_token
    });

    await GET(
      makeRequest({ code: "abc", state: "xyz", cookie: "chapa_cb_oauth_state=xyz" }),
    );

    expect(mockDbUpsertLinkedPlatform).toHaveBeenCalledWith(
      "testuser",
      "codeberg",
      "cb-user",
      "cb_access_long",
      null,
      null,
    );
    // computeTokenExpiry should NOT be called when expires_in is absent
    expect(mockComputeTokenExpiry).not.toHaveBeenCalled();
  });

  it("invalidates stats cache on success", async () => {
    await GET(
      makeRequest({ code: "abc", state: "xyz", cookie: "chapa_cb_oauth_state=xyz" }),
    );

    expect(mockCacheDel).toHaveBeenCalledWith("stats:v2:merged:testuser");
    expect(mockCacheDel).toHaveBeenCalledWith("stats:v2:codeberg:testuser");
  });

  it("clears CSRF state cookie on success", async () => {
    const res = await GET(
      makeRequest({ code: "abc", state: "xyz", cookie: "chapa_cb_oauth_state=xyz" }),
    );

    const setCookies = res.headers.getSetCookie();
    expect(setCookies.some((c) => c.includes("chapa_cb_oauth_state="))).toBe(true);
  });

  it("passes correct arguments to exchangeCodebergCode", async () => {
    await GET(
      makeRequest({ code: "my-auth-code", state: "xyz", cookie: "chapa_cb_oauth_state=xyz" }),
    );

    expect(mockExchangeCodebergCode).toHaveBeenCalledWith(
      "my-auth-code",
      "test-cb-client-id",
      "test-cb-client-secret",
      "https://chapa.thecreativetoken.com/api/auth/codeberg/callback",
    );
  });

  it("passes access token to fetchCodebergUser", async () => {
    await GET(
      makeRequest({ code: "abc", state: "xyz", cookie: "chapa_cb_oauth_state=xyz" }),
    );

    expect(mockFetchCodebergUser).toHaveBeenCalledWith("cb_access_123");
  });
});
