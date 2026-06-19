import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock dependencies BEFORE importing the module under test.
// ---------------------------------------------------------------------------

const {
  mockRequireSession,
  mockDbUpsertLinkedPlatform,
  mockDbDeleteLinkedPlatform,
  mockDbGetLinkedPlatforms,
  mockCacheDel,
  mockRateLimit,
  mockGetClientIp,
  mockComputeTokenExpiry,
} = vi.hoisted(() => ({
  mockRequireSession: vi.fn(),
  mockDbUpsertLinkedPlatform: vi.fn(),
  mockDbDeleteLinkedPlatform: vi.fn(),
  mockDbGetLinkedPlatforms: vi.fn(),
  mockCacheDel: vi.fn(),
  mockRateLimit: vi.fn(),
  mockGetClientIp: vi.fn(),
  mockComputeTokenExpiry: vi.fn(),
}));

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: mockRequireSession,
}));

vi.mock("@/lib/db/user-platforms", () => ({
  dbUpsertLinkedPlatform: mockDbUpsertLinkedPlatform,
  dbDeleteLinkedPlatform: mockDbDeleteLinkedPlatform,
  dbGetLinkedPlatforms: mockDbGetLinkedPlatforms,
}));

vi.mock("@/lib/cache/redis", () => ({
  cacheDel: mockCacheDel,
  rateLimit: mockRateLimit,
}));

vi.mock("@/lib/http/client-ip", () => ({
  getClientIp: mockGetClientIp,
}));

vi.mock("@/lib/auth/bitbucket", () => ({
  computeTokenExpiry: mockComputeTokenExpiry,
}));

import { NextRequest, NextResponse } from "next/server";
import {
  createConnectHandler,
  createCallbackHandler,
  createDisconnectHandler,
  createStatusHandler,
  type PlatformOAuthConfig,
} from "./platform-oauth";

// ---------------------------------------------------------------------------
// Test platform config
// ---------------------------------------------------------------------------

// NOTE: TESTPLATFORM_CLIENT_ID and TESTPLATFORM_CLIENT_SECRET are fake OAuth credentials
// used exclusively for test scaffolding here. They are NOT production environment variables.
function makeMockConfig(): PlatformOAuthConfig & {
  mockIsEnabled: ReturnType<typeof vi.fn>;
  mockCreateStateCookie: ReturnType<typeof vi.fn>;
  mockBuildAuthUrl: ReturnType<typeof vi.fn>;
  mockValidateState: ReturnType<typeof vi.fn>;
  mockClearStateCookie: ReturnType<typeof vi.fn>;
  mockExchangeCode: ReturnType<typeof vi.fn>;
  mockFetchUser: ReturnType<typeof vi.fn>;
} {
  const mockIsEnabled = vi.fn().mockResolvedValue(true);
  const mockCreateStateCookie = vi.fn().mockReturnValue({
    state: "test-state-token",
    cookie: "test_cookie=test-state-token; HttpOnly; SameSite=Lax; Path=/; Max-Age=600",
  });
  const mockBuildAuthUrl = vi.fn().mockReturnValue(
    "https://testplatform.example/oauth/authorize?client_id=test-client&state=test-state-token",
  );
  const mockValidateState = vi.fn().mockReturnValue(true);
  const mockClearStateCookie = vi.fn().mockReturnValue(
    "test_cookie=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
  );
  const mockExchangeCode = vi.fn().mockResolvedValue({
    access_token: "tp_access_123",
    refresh_token: "tp_refresh_456",
    expires_in: 7200,
  });
  const mockFetchUser = vi.fn().mockResolvedValue({
    login: "tp-user",
  });

  return {
    platform: "testplatform",
    rateLimitPrefix: "tp",
    isEnabled: mockIsEnabled,
    clientIdEnvVar: "TESTPLATFORM_CLIENT_ID",
    clientSecretEnvVar: "TESTPLATFORM_CLIENT_SECRET",
    createStateCookie: mockCreateStateCookie,
    buildAuthUrl: mockBuildAuthUrl,
    validateState: mockValidateState,
    clearStateCookie: mockClearStateCookie,
    exchangeCode: mockExchangeCode,
    fetchUser: mockFetchUser,
    mockIsEnabled,
    mockCreateStateCookie,
    mockBuildAuthUrl,
    mockValidateState,
    mockClearStateCookie,
    mockExchangeCode,
    mockFetchUser,
  };
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

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

function denySession() {
  mockRequireSession.mockReturnValue({
    error: NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    ),
  });
}

function setEnvVars() {
  vi.stubEnv("TESTPLATFORM_CLIENT_ID", "test-client-id");
  vi.stubEnv("TESTPLATFORM_CLIENT_SECRET", "test-client-secret");
  vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://chapa.thecreativetoken.com");
}

function clearEnvVars() {
  vi.unstubAllEnvs();
}

// ---------------------------------------------------------------------------
// createConnectHandler
// ---------------------------------------------------------------------------

describe("createConnectHandler", () => {
  let config: ReturnType<typeof makeMockConfig>;
  let GET: ReturnType<typeof createConnectHandler>;

  beforeEach(() => {
    vi.clearAllMocks();
    config = makeMockConfig();
    GET = createConnectHandler(config);
    mockRateLimit.mockResolvedValue({ allowed: true, current: 1, limit: 10 });
    mockGetClientIp.mockReturnValue("1.2.3.4");
    allowSession();
    setEnvVars();
  });

  afterEach(() => {
    clearEnvVars();
  });

  it("returns 404 when feature flag is disabled", async () => {
    config.mockIsEnabled.mockResolvedValue(false);

    const req = new NextRequest("https://chapa.thecreativetoken.com/api/auth/testplatform/connect");
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, current: 11, limit: 10 });

    const req = new NextRequest("https://chapa.thecreativetoken.com/api/auth/testplatform/connect");
    const res = await GET(req);
    expect(res.status).toBe(429);
  });

  it("uses platform-specific rate limit key", async () => {
    const req = new NextRequest("https://chapa.thecreativetoken.com/api/auth/testplatform/connect");
    await GET(req);
    expect(mockRateLimit).toHaveBeenCalledWith("ratelimit:tp:connect:1.2.3.4", 10, 900);
  });

  it("returns 401 when not authenticated", async () => {
    denySession();

    const req = new NextRequest("https://chapa.thecreativetoken.com/api/auth/testplatform/connect");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("redirects to error when client ID env var is missing", async () => {
    vi.stubEnv("TESTPLATFORM_CLIENT_ID", undefined);

    const req = new NextRequest("https://chapa.thecreativetoken.com/api/auth/testplatform/connect");
    const res = await GET(req);
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.searchParams.get("error")).toBe("config");
  });

  it("uses production URL fallback when NEXT_PUBLIC_BASE_URL is unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", undefined);

    const req = new NextRequest("https://chapa.thecreativetoken.com/api/auth/testplatform/connect");
    const res = await GET(req);
    // getBaseUrl() always has a fallback — connect succeeds using production URL
    expect(res.status).toBe(307);
    expect(config.mockBuildAuthUrl).toHaveBeenCalledWith(
      "test-client-id",
      "https://chapa.thecreativetoken.com/api/auth/testplatform/callback",
      "test-state-token",
    );
  });

  it("redirects to platform OAuth URL on success", async () => {
    const req = new NextRequest("https://chapa.thecreativetoken.com/api/auth/testplatform/connect");
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("Location")).toBe(
      "https://testplatform.example/oauth/authorize?client_id=test-client&state=test-state-token",
    );
  });

  it("sets CSRF state cookie on success", async () => {
    const req = new NextRequest("https://chapa.thecreativetoken.com/api/auth/testplatform/connect");
    const res = await GET(req);

    const setCookies = res.headers.getSetCookie();
    expect(setCookies.length).toBeGreaterThanOrEqual(1);
    expect(setCookies[0]).toContain("test_cookie=");
  });

  it("passes correct redirect URI to buildAuthUrl", async () => {
    const req = new NextRequest("https://chapa.thecreativetoken.com/api/auth/testplatform/connect");
    await GET(req);

    expect(config.mockBuildAuthUrl).toHaveBeenCalledWith(
      "test-client-id",
      "https://chapa.thecreativetoken.com/api/auth/testplatform/callback",
      "test-state-token",
    );
  });
});

// ---------------------------------------------------------------------------
// createCallbackHandler
// ---------------------------------------------------------------------------

describe("createCallbackHandler", () => {
  let config: ReturnType<typeof makeMockConfig>;
  let GET: ReturnType<typeof createCallbackHandler>;

  function makeCallbackRequest(params?: {
    code?: string;
    state?: string;
    cookie?: string;
  }): NextRequest {
    const url = new URL("https://chapa.thecreativetoken.com/api/auth/testplatform/callback");
    if (params?.code) url.searchParams.set("code", params.code);
    if (params?.state) url.searchParams.set("state", params.state);
    const headers: Record<string, string> = {};
    if (params?.cookie) headers["cookie"] = params.cookie;
    return new NextRequest(url, { headers });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    config = makeMockConfig();
    GET = createCallbackHandler(config);
    mockRateLimit.mockResolvedValue({ allowed: true, current: 1, limit: 10 });
    mockGetClientIp.mockReturnValue("1.2.3.4");
    allowSession();
    setEnvVars();
    mockComputeTokenExpiry.mockReturnValue(new Date("2026-03-01T00:00:00Z"));
    mockDbUpsertLinkedPlatform.mockResolvedValue(true);
    mockCacheDel.mockResolvedValue(undefined);
  });

  afterEach(() => {
    clearEnvVars();
  });

  it("returns 404 when feature flag is disabled", async () => {
    config.mockIsEnabled.mockResolvedValue(false);

    const res = await GET(makeCallbackRequest({ code: "abc", state: "xyz" }));
    expect(res.status).toBe(404);
  });

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, current: 11, limit: 10 });

    const res = await GET(makeCallbackRequest({ code: "abc", state: "xyz" }));
    expect(res.status).toBe(429);
  });

  it("returns 401 when not authenticated", async () => {
    denySession();

    const res = await GET(makeCallbackRequest({ code: "abc", state: "xyz" }));
    expect(res.status).toBe(401);
  });

  it("redirects with error=testplatform_no_code when code is missing", async () => {
    const res = await GET(makeCallbackRequest({ state: "xyz" }));

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.pathname).toBe("/u/testuser");
    expect(location.searchParams.get("error")).toBe("testplatform_no_code");
  });

  it("redirects with error=testplatform_invalid_state when state fails", async () => {
    config.mockValidateState.mockReturnValue(false);

    const res = await GET(makeCallbackRequest({ code: "abc", state: "bad" }));

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.searchParams.get("error")).toBe("testplatform_invalid_state");
  });

  it("redirects with error=testplatform_config when env vars are missing", async () => {
    vi.stubEnv("TESTPLATFORM_CLIENT_ID", undefined);

    const res = await GET(makeCallbackRequest({ code: "abc", state: "xyz" }));

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.searchParams.get("error")).toBe("testplatform_config");
  });

  it("redirects with error=testplatform_token_exchange when exchange fails", async () => {
    config.mockExchangeCode.mockResolvedValue(null);

    const res = await GET(makeCallbackRequest({ code: "abc", state: "xyz" }));

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.searchParams.get("error")).toBe("testplatform_token_exchange");
  });

  it("redirects with error=testplatform_user_fetch when user fetch fails", async () => {
    config.mockFetchUser.mockResolvedValue(null);

    const res = await GET(makeCallbackRequest({ code: "abc", state: "xyz" }));

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.searchParams.get("error")).toBe("testplatform_user_fetch");
  });

  it("redirects with error=testplatform_storage when DB upsert fails", async () => {
    mockDbUpsertLinkedPlatform.mockResolvedValue(false);

    const res = await GET(makeCallbackRequest({ code: "abc", state: "xyz" }));

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.searchParams.get("error")).toBe("testplatform_storage");
  });

  it("redirects to /u/{handle}?testplatform=linked on success", async () => {
    const res = await GET(makeCallbackRequest({ code: "abc", state: "xyz" }));

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.pathname).toBe("/u/testuser");
    expect(location.searchParams.get("testplatform")).toBe("linked");
  });

  it("stores tokens via dbUpsertLinkedPlatform", async () => {
    await GET(makeCallbackRequest({ code: "abc", state: "xyz" }));

    expect(mockDbUpsertLinkedPlatform).toHaveBeenCalledWith(
      "testuser",
      "testplatform",
      "tp-user",
      "tp_access_123",
      "tp_refresh_456",
      new Date("2026-03-01T00:00:00Z"),
    );
  });

  it("passes null expiresAt when token has no expires_in", async () => {
    config.mockExchangeCode.mockResolvedValue({
      access_token: "tp_access_long",
      // No expires_in, no refresh_token
    });
    config.mockFetchUser.mockResolvedValue({ login: "tp-user" });

    await GET(makeCallbackRequest({ code: "abc", state: "xyz" }));

    expect(mockDbUpsertLinkedPlatform).toHaveBeenCalledWith(
      "testuser",
      "testplatform",
      "tp-user",
      "tp_access_long",
      null,
      null,
    );
    expect(mockComputeTokenExpiry).not.toHaveBeenCalled();
  });

  it("invalidates stats cache on success", async () => {
    await GET(makeCallbackRequest({ code: "abc", state: "xyz" }));

    expect(mockCacheDel).toHaveBeenCalledWith("stats:v2:merged:testuser");
    expect(mockCacheDel).toHaveBeenCalledWith("stats:v2:testplatform:testuser");
  });

  it("invalidates the rendered badge SVG cache on success (#856)", async () => {
    await GET(makeCallbackRequest({ code: "abc", state: "xyz" }));

    expect(mockCacheDel).toHaveBeenCalledWith(
      expect.stringMatching(/^badge:.*:testuser:warm-amber:/),
    );
  });

  it("clears CSRF state cookie on success", async () => {
    const res = await GET(makeCallbackRequest({ code: "abc", state: "xyz" }));

    const setCookies = res.headers.getSetCookie();
    expect(setCookies.some((c) => c.includes("test_cookie="))).toBe(true);
  });

  it("passes correct arguments to exchangeCode", async () => {
    await GET(makeCallbackRequest({ code: "my-auth-code", state: "xyz" }));

    expect(config.mockExchangeCode).toHaveBeenCalledWith(
      "my-auth-code",
      "test-client-id",
      "test-client-secret",
      "https://chapa.thecreativetoken.com/api/auth/testplatform/callback",
    );
  });

  it("passes access token to fetchUser", async () => {
    await GET(makeCallbackRequest({ code: "abc", state: "xyz" }));

    expect(config.mockFetchUser).toHaveBeenCalledWith("tp_access_123");
  });
});

// ---------------------------------------------------------------------------
// createDisconnectHandler
// ---------------------------------------------------------------------------

describe("createDisconnectHandler", () => {
  let config: ReturnType<typeof makeMockConfig>;
  let POST: ReturnType<typeof createDisconnectHandler>;

  beforeEach(() => {
    vi.clearAllMocks();
    config = makeMockConfig();
    POST = createDisconnectHandler(config);
    mockRateLimit.mockResolvedValue({ allowed: true, current: 1, limit: 10 });
    mockGetClientIp.mockReturnValue("1.2.3.4");
    allowSession();
    mockDbDeleteLinkedPlatform.mockResolvedValue(true);
    mockCacheDel.mockResolvedValue(undefined);
  });

  function makeRequest(): NextRequest {
    return new NextRequest(
      "https://chapa.thecreativetoken.com/api/auth/testplatform/disconnect",
      { method: "POST" },
    );
  }

  it("returns 404 when feature flag is disabled", async () => {
    config.mockIsEnabled.mockResolvedValue(false);

    const res = await POST(makeRequest());
    expect(res.status).toBe(404);
  });

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, current: 11, limit: 10 });

    const res = await POST(makeRequest());
    expect(res.status).toBe(429);
  });

  it("returns 401 when not authenticated", async () => {
    denySession();

    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns { success: true } on successful disconnect", async () => {
    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it("calls dbDeleteLinkedPlatform with correct arguments", async () => {
    await POST(makeRequest());

    expect(mockDbDeleteLinkedPlatform).toHaveBeenCalledWith("testuser", "testplatform");
  });

  it("invalidates stats cache on success", async () => {
    await POST(makeRequest());

    expect(mockCacheDel).toHaveBeenCalledWith("stats:v2:merged:testuser");
    expect(mockCacheDel).toHaveBeenCalledWith("stats:v2:testplatform:testuser");
  });

  it("clears supplemental EMU data on disconnect", async () => {
    await POST(makeRequest());

    expect(mockCacheDel).toHaveBeenCalledWith("supplemental:testuser");
  });

  it("invalidates the rendered badge SVG cache on disconnect (#856)", async () => {
    await POST(makeRequest());

    expect(mockCacheDel).toHaveBeenCalledWith(
      expect.stringMatching(/^badge:.*:testuser:warm-amber:/),
    );
  });

  it("returns { success: false } when DB delete fails", async () => {
    mockDbDeleteLinkedPlatform.mockResolvedValue(false);

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it("still invalidates cache even when DB delete fails", async () => {
    mockDbDeleteLinkedPlatform.mockResolvedValue(false);

    await POST(makeRequest());

    expect(mockCacheDel).toHaveBeenCalledWith("stats:v2:merged:testuser");
    expect(mockCacheDel).toHaveBeenCalledWith("stats:v2:testplatform:testuser");
    expect(mockCacheDel).toHaveBeenCalledWith("supplemental:testuser");
  });
});

// ---------------------------------------------------------------------------
// createStatusHandler
// ---------------------------------------------------------------------------

describe("createStatusHandler", () => {
  let config: ReturnType<typeof makeMockConfig>;
  let GET: ReturnType<typeof createStatusHandler>;

  beforeEach(() => {
    vi.clearAllMocks();
    config = makeMockConfig();
    GET = createStatusHandler(config);
    mockRateLimit.mockResolvedValue({ allowed: true, current: 1, limit: 20 });
    mockGetClientIp.mockReturnValue("1.2.3.4");
    allowSession();
    mockDbGetLinkedPlatforms.mockResolvedValue([]);
  });

  function makeRequest(): NextRequest {
    return new NextRequest(
      "https://chapa.thecreativetoken.com/api/auth/testplatform/status",
    );
  }

  it("returns { enabled: false } when feature flag is disabled", async () => {
    config.mockIsEnabled.mockResolvedValue(false);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ enabled: false });
  });

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, current: 21, limit: 20 });

    const res = await GET(makeRequest());
    expect(res.status).toBe(429);
  });

  it("uses status-specific rate limit (120 per 15 min)", async () => {
    await GET(makeRequest());
    expect(mockRateLimit).toHaveBeenCalledWith("ratelimit:tp:status:1.2.3.4", 120, 900);
  });

  it("returns 401 when not authenticated", async () => {
    denySession();

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns { enabled: true, linked: false } when not linked", async () => {
    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({
      enabled: true,
      linked: false,
      remoteLogin: null,
      connectedAt: null,
    });
  });

  it("returns linked status with remoteLogin when linked", async () => {
    mockDbGetLinkedPlatforms.mockResolvedValue([
      {
        platform: "testplatform",
        remoteLogin: "tp-user",
        connectedAt: "2026-02-20T12:00:00Z",
      },
    ]);

    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({
      enabled: true,
      linked: true,
      remoteLogin: "tp-user",
      connectedAt: "2026-02-20T12:00:00Z",
    });
  });

  it("passes session login to dbGetLinkedPlatforms", async () => {
    await GET(makeRequest());
    expect(mockDbGetLinkedPlatforms).toHaveBeenCalledWith("testuser");
  });
});
