import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  CODEBERG_ENV_VARS,
  CODEBERG_STATE_COOKIE,
  CODEBERG_AUTH_URL,
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
  mockIsCodebergEnabled,
  mockRequireSession,
  mockCreateCodebergStateCookie,
  mockBuildCodebergAuthUrl,
  mockRateLimit,
  mockGetClientIp,
} = vi.hoisted(() => ({
  mockIsCodebergEnabled: vi.fn(),
  mockRequireSession: vi.fn(),
  mockCreateCodebergStateCookie: vi.fn(),
  mockBuildCodebergAuthUrl: vi.fn(),
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
  createCodebergStateCookie: mockCreateCodebergStateCookie,
  buildCodebergAuthUrl: mockBuildCodebergAuthUrl,
  // Stubs required by ../config.ts (not used in connect flow)
  validateCodebergState: vi.fn(),
  clearCodebergStateCookie: vi.fn(),
  exchangeCodebergCode: vi.fn(),
  fetchCodebergUser: vi.fn(),
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
    "https://chapa.thecreativetoken.com/api/auth/codeberg/connect",
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/auth/codeberg/connect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsCodebergEnabled.mockResolvedValue(true);
    mockRateLimit.mockResolvedValue(RATE_LIMIT_ALLOWED);
    mockGetClientIp.mockReturnValue(TEST_IP);
    allowSession(mockRequireSession);
    setEnvVars(CODEBERG_ENV_VARS);
    mockCreateCodebergStateCookie.mockReturnValue(CODEBERG_STATE_COOKIE);
    mockBuildCodebergAuthUrl.mockReturnValue(CODEBERG_AUTH_URL);
  });

  afterEach(() => {
    clearEnvVars(CODEBERG_ENV_VARS);
  });

  it("returns 404 when feature flag is disabled", async () => {
    mockIsCodebergEnabled.mockResolvedValue(false);

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

  it("redirects to error when CODEBERG_CLIENT_ID is missing", async () => {
    delete process.env.CODEBERG_CLIENT_ID;

    const res = await GET(makeRequest());
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.searchParams.get("error")).toBe("config");
  });

  it("redirects to error when NEXT_PUBLIC_BASE_URL is missing", async () => {
    delete process.env.NEXT_PUBLIC_BASE_URL;

    const res = await GET(makeRequest());
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.searchParams.get("error")).toBe("config");
  });

  it("redirects to Codeberg OAuth URL on success", async () => {
    const res = await GET(makeRequest());

    expect(res.status).toBe(307);
    expect(res.headers.get("Location")).toBe(CODEBERG_AUTH_URL);
  });

  it("sets CSRF state cookie on success", async () => {
    const res = await GET(makeRequest());

    const setCookies = res.headers.getSetCookie();
    expect(setCookies.length).toBeGreaterThanOrEqual(1);
    expect(setCookies[0]).toContain("chapa_cb_oauth_state=");
  });

  it("passes correct redirect URI to buildCodebergAuthUrl", async () => {
    await GET(makeRequest());

    expect(mockBuildCodebergAuthUrl).toHaveBeenCalledWith(
      "test-cb-client-id",
      "https://chapa.thecreativetoken.com/api/auth/codeberg/callback",
      "random-csrf-state",
    );
  });
});
