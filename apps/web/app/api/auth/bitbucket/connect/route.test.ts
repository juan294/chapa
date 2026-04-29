import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  BITBUCKET_ENV_VARS,
  BITBUCKET_STATE_COOKIE,
  BITBUCKET_AUTH_URL,
  RATE_LIMIT_ALLOWED,
  RATE_LIMIT_BLOCKED,
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
  mockCreateBitbucketStateCookie,
  mockBuildBitbucketAuthUrl,
  mockRateLimit,
  mockGetClientIp,
} = vi.hoisted(() => ({
  mockIsBitbucketEnabled: vi.fn(),
  mockRequireSession: vi.fn(),
  mockCreateBitbucketStateCookie: vi.fn(),
  mockBuildBitbucketAuthUrl: vi.fn(),
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
  createBitbucketStateCookie: mockCreateBitbucketStateCookie,
  buildBitbucketAuthUrl: mockBuildBitbucketAuthUrl,
  // Stubs required by ../config.ts (not used in connect flow)
  validateBitbucketState: vi.fn(),
  clearBitbucketStateCookie: vi.fn(),
  exchangeBitbucketCode: vi.fn(),
  fetchBitbucketUser: vi.fn(),
  computeTokenExpiry: vi.fn(),
}));

vi.mock("@/lib/cache/redis", () => ({
  rateLimit: mockRateLimit,
  // Stub required by platform-oauth.ts (not used in connect flow)
  cacheDel: vi.fn(),
}));

vi.mock("@/lib/http/client-ip", () => ({
  getClientIp: mockGetClientIp,
}));

// Stub all DB functions required by platform-oauth.ts (not used in connect flow)
vi.mock("@/lib/db/user-platforms", () => ({
  dbUpsertLinkedPlatform: vi.fn(),
  dbDeleteLinkedPlatform: vi.fn(),
  dbGetLinkedPlatforms: vi.fn(),
}));

import { GET } from "./route";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(): NextRequest {
  return new NextRequest(
    "https://chapa.thecreativetoken.com/api/auth/bitbucket/connect",
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/auth/bitbucket/connect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsBitbucketEnabled.mockResolvedValue(true);
    mockRateLimit.mockResolvedValue(RATE_LIMIT_ALLOWED);
    mockGetClientIp.mockReturnValue(TEST_IP);
    allowSession(mockRequireSession);
    setEnvVars(BITBUCKET_ENV_VARS);
    mockCreateBitbucketStateCookie.mockReturnValue(BITBUCKET_STATE_COOKIE);
    mockBuildBitbucketAuthUrl.mockReturnValue(BITBUCKET_AUTH_URL);
  });

  afterEach(() => {
    clearEnvVars(BITBUCKET_ENV_VARS);
  });

  it("returns 404 when feature flag is disabled", async () => {
    mockIsBitbucketEnabled.mockResolvedValue(false);

    const res = await GET(makeRequest());
    expect(res.status).toBe(404);
  });

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue(RATE_LIMIT_BLOCKED);

    const res = await GET(makeRequest());
    expect(res.status).toBe(429);
  });

  it("returns 401 when not authenticated", async () => {
    denySession(mockRequireSession);

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("redirects to error when BITBUCKET_CLIENT_ID is missing", async () => {
    vi.stubEnv("BITBUCKET_CLIENT_ID", undefined);

    const res = await GET(makeRequest());
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.searchParams.get("error")).toBe("config");
  });

  it("uses production URL fallback when NEXT_PUBLIC_BASE_URL is unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", undefined);

    const res = await GET(makeRequest());
    // getBaseUrl() always has a fallback — connect succeeds using production URL
    expect(res.status).toBe(307);
    expect(mockBuildBitbucketAuthUrl).toHaveBeenCalledWith(
      "test-bb-client-id",
      "https://chapa.thecreativetoken.com/api/auth/bitbucket/callback",
      "random-csrf-state",
    );
  });

  it("redirects to Bitbucket OAuth URL on success", async () => {
    const res = await GET(makeRequest());

    expect(res.status).toBe(307);
    expect(res.headers.get("Location")).toBe(BITBUCKET_AUTH_URL);
  });

  it("sets CSRF state cookie on success", async () => {
    const res = await GET(makeRequest());

    const setCookies = res.headers.getSetCookie();
    expect(setCookies.length).toBeGreaterThanOrEqual(1);
    expect(setCookies[0]).toContain("chapa_bb_oauth_state=");
  });

  it("passes correct redirect URI to buildBitbucketAuthUrl", async () => {
    await GET(makeRequest());

    expect(mockBuildBitbucketAuthUrl).toHaveBeenCalledWith(
      "test-bb-client-id",
      "https://chapa.thecreativetoken.com/api/auth/bitbucket/callback",
      "random-csrf-state",
    );
  });
});
