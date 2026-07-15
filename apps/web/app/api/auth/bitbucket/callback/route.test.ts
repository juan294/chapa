import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  BITBUCKET_ENV_VARS,
  BITBUCKET_TOKEN_RESPONSE,
  BITBUCKET_USER,
  BITBUCKET_CLEAR_COOKIE,
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
  mockIsBitbucketEnabled,
  mockRequireSession,
  mockValidateBitbucketState,
  mockClearBitbucketStateCookie,
  mockExchangeBitbucketCode,
  mockFetchBitbucketUser,
  mockComputeTokenExpiry,
  mockDbUpsertLinkedPlatform,
  mockCacheDel,
  mockMarkStatsDirty,
  mockRateLimit,
  mockGetClientIp,
} = vi.hoisted(() => ({
  mockIsBitbucketEnabled: vi.fn(),
  mockRequireSession: vi.fn(),
  mockValidateBitbucketState: vi.fn(),
  mockClearBitbucketStateCookie: vi.fn(),
  mockExchangeBitbucketCode: vi.fn(),
  mockFetchBitbucketUser: vi.fn(),
  mockComputeTokenExpiry: vi.fn(),
  mockDbUpsertLinkedPlatform: vi.fn(),
  mockCacheDel: vi.fn(),
  mockMarkStatsDirty: vi.fn(),
  mockRateLimit: vi.fn(),
  mockGetClientIp: vi.fn(),
}));

vi.mock("@/lib/feature-flags", () => ({
  isBitbucketEnabled: mockIsBitbucketEnabled,
}));

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: mockRequireSession,
}));

vi.mock("@/lib/auth/bitbucket", () => ({
  validateBitbucketState: mockValidateBitbucketState,
  clearBitbucketStateCookie: mockClearBitbucketStateCookie,
  exchangeBitbucketCode: mockExchangeBitbucketCode,
  fetchBitbucketUser: mockFetchBitbucketUser,
  computeTokenExpiry: mockComputeTokenExpiry,
  // Stubs required by ../config.ts (not used in callback flow)
  createBitbucketStateCookie: vi.fn(),
  buildBitbucketAuthUrl: vi.fn(),
}));

vi.mock("@/lib/db/user-platforms", () => ({
  dbUpsertLinkedPlatform: mockDbUpsertLinkedPlatform,
  // Stubs required by platform-oauth.ts (not used in callback flow)
  dbDeleteLinkedPlatform: vi.fn(),
  dbGetLinkedPlatforms: vi.fn(),
}));

vi.mock("@/lib/cache/redis", () => ({
  cacheDel: mockCacheDel,
  // Callback uses rateLimitStrict (fail-closed, #1027 BE-M3) — same spy so
  // existing assertions against mockRateLimit still hold.
  rateLimitStrict: mockRateLimit,
  rateLimit: mockRateLimit,
}));

vi.mock("@/lib/cache/dirty-stats", () => ({
  markStatsDirty: mockMarkStatsDirty,
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
    "https://chapa.thecreativetoken.com/api/auth/bitbucket/callback",
  );
  if (params?.code) url.searchParams.set("code", params.code);
  if (params?.state) url.searchParams.set("state", params.state);
  const headers: Record<string, string> = {};
  if (params?.cookie) headers["cookie"] = params.cookie;
  return new NextRequest(url, { headers });
}

function setupHappyPath() {
  mockIsBitbucketEnabled.mockResolvedValue(true);
  mockRateLimit.mockResolvedValue(RATE_LIMIT_ALLOWED);
  mockGetClientIp.mockReturnValue(TEST_IP);
  allowSession(mockRequireSession);
  setEnvVars(BITBUCKET_ENV_VARS);
  mockValidateBitbucketState.mockReturnValue(true);
  mockExchangeBitbucketCode.mockResolvedValue(BITBUCKET_TOKEN_RESPONSE);
  mockFetchBitbucketUser.mockResolvedValue(BITBUCKET_USER);
  mockComputeTokenExpiry.mockReturnValue(TEST_TOKEN_EXPIRY);
  mockDbUpsertLinkedPlatform.mockResolvedValue(true);
  mockCacheDel.mockResolvedValue(undefined);
  mockClearBitbucketStateCookie.mockReturnValue(BITBUCKET_CLEAR_COOKIE);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/auth/bitbucket/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyPath();
  });

  afterEach(() => {
    clearEnvVars(BITBUCKET_ENV_VARS);
  });

  it("returns 404 when feature flag is disabled", async () => {
    mockIsBitbucketEnabled.mockResolvedValue(false);

    const res = await GET(
      makeRequest({ code: "abc", state: "xyz", cookie: "chapa_bb_oauth_state=xyz" }),
    );
    expect(res.status).toBe(404);
  });

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue(RATE_LIMIT_BLOCKED);

    const res = await GET(
      makeRequest({ code: "abc", state: "xyz", cookie: "chapa_bb_oauth_state=xyz" }),
    );
    expect(res.status).toBe(429);
  });

  it("returns 401 when not authenticated", async () => {
    denySession(mockRequireSession);

    const res = await GET(
      makeRequest({ code: "abc", state: "xyz", cookie: "chapa_bb_oauth_state=xyz" }),
    );
    expect(res.status).toBe(401);
  });

  it("redirects with error=bitbucket_no_code when code is missing", async () => {
    const res = await GET(makeRequest({ state: "xyz" }));

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.pathname).toBe("/u/testuser");
    expect(location.searchParams.get("error")).toBe("bitbucket_no_code");
  });

  it("redirects with error=bitbucket_invalid_state when state validation fails", async () => {
    mockValidateBitbucketState.mockReturnValue(false);

    const res = await GET(
      makeRequest({ code: "abc", state: "bad", cookie: "chapa_bb_oauth_state=other" }),
    );

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.searchParams.get("error")).toBe("bitbucket_invalid_state");
  });

  it("redirects with error=bitbucket_config when env vars are missing", async () => {
    vi.stubEnv("BITBUCKET_CLIENT_ID", undefined);

    const res = await GET(
      makeRequest({ code: "abc", state: "xyz", cookie: "chapa_bb_oauth_state=xyz" }),
    );

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.searchParams.get("error")).toBe("bitbucket_config");
  });

  it("redirects with error=bitbucket_token_exchange when token exchange fails", async () => {
    mockExchangeBitbucketCode.mockResolvedValue(null);

    const res = await GET(
      makeRequest({ code: "bad-code", state: "xyz", cookie: "chapa_bb_oauth_state=xyz" }),
    );

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.searchParams.get("error")).toBe("bitbucket_token_exchange");
  });

  it("redirects with error=bitbucket_user_fetch when user fetch fails", async () => {
    mockFetchBitbucketUser.mockResolvedValue(null);

    const res = await GET(
      makeRequest({ code: "abc", state: "xyz", cookie: "chapa_bb_oauth_state=xyz" }),
    );

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.searchParams.get("error")).toBe("bitbucket_user_fetch");
  });

  it("redirects with error=bitbucket_storage when DB upsert fails", async () => {
    mockDbUpsertLinkedPlatform.mockResolvedValue(false);

    const res = await GET(
      makeRequest({ code: "abc", state: "xyz", cookie: "chapa_bb_oauth_state=xyz" }),
    );

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.searchParams.get("error")).toBe("bitbucket_storage");
  });

  it("redirects to /u/{handle}?bitbucket=linked on success", async () => {
    const res = await GET(
      makeRequest({ code: "abc", state: "xyz", cookie: "chapa_bb_oauth_state=xyz" }),
    );

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.pathname).toBe("/u/testuser");
    expect(location.searchParams.get("bitbucket")).toBe("linked");
  });

  it("stores encrypted tokens via dbUpsertLinkedPlatform", async () => {
    await GET(
      makeRequest({ code: "abc", state: "xyz", cookie: "chapa_bb_oauth_state=xyz" }),
    );

    expect(mockDbUpsertLinkedPlatform).toHaveBeenCalledWith(
      "testuser",
      "bitbucket",
      "bb-user",
      "bb_access_123",
      "bb_refresh_456",
      TEST_TOKEN_EXPIRY,
    );
  });

  it("invalidates stats cache on success", async () => {
    await GET(
      makeRequest({ code: "abc", state: "xyz", cookie: "chapa_bb_oauth_state=xyz" }),
    );

    expect(mockCacheDel).toHaveBeenCalledWith("stats:v2:merged:testuser");
    expect(mockCacheDel).toHaveBeenCalledWith("stats:v2:bitbucket:testuser");
  });

  it("clears CSRF state cookie on success", async () => {
    const res = await GET(
      makeRequest({ code: "abc", state: "xyz", cookie: "chapa_bb_oauth_state=xyz" }),
    );

    const setCookies = res.headers.getSetCookie();
    expect(setCookies.some((c) => c.includes("chapa_bb_oauth_state="))).toBe(true);
  });

  it("passes correct arguments to exchangeBitbucketCode", async () => {
    await GET(
      makeRequest({ code: "my-auth-code", state: "xyz", cookie: "chapa_bb_oauth_state=xyz" }),
    );

    expect(mockExchangeBitbucketCode).toHaveBeenCalledWith(
      "my-auth-code",
      "test-bb-client-id",
      "test-bb-client-secret",
      "https://chapa.thecreativetoken.com/api/auth/bitbucket/callback",
    );
  });

  it("passes access token to fetchBitbucketUser", async () => {
    await GET(
      makeRequest({ code: "abc", state: "xyz", cookie: "chapa_bb_oauth_state=xyz" }),
    );

    expect(mockFetchBitbucketUser).toHaveBeenCalledWith("bb_access_123");
  });
});
