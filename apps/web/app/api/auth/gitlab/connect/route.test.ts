import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  GITLAB_ENV_VARS,
  GITLAB_STATE_COOKIE,
  GITLAB_AUTH_URL,
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
  mockIsGitlabEnabled,
  mockRequireSession,
  mockCreateGitlabStateCookie,
  mockBuildGitlabAuthUrl,
  mockRateLimit,
  mockGetClientIp,
} = vi.hoisted(() => ({
  mockIsGitlabEnabled: vi.fn(),
  mockRequireSession: vi.fn(),
  mockCreateGitlabStateCookie: vi.fn(),
  mockBuildGitlabAuthUrl: vi.fn(),
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
  createGitlabStateCookie: mockCreateGitlabStateCookie,
  buildGitlabAuthUrl: mockBuildGitlabAuthUrl,
  // Stubs required by ../config.ts (not used in connect flow)
  validateGitlabState: vi.fn(),
  clearGitlabStateCookie: vi.fn(),
  exchangeGitlabCode: vi.fn(),
  fetchGitlabUser: vi.fn(),
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
    "https://chapa.thecreativetoken.com/api/auth/gitlab/connect",
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/auth/gitlab/connect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsGitlabEnabled.mockResolvedValue(true);
    mockRateLimit.mockResolvedValue(RATE_LIMIT_ALLOWED);
    mockGetClientIp.mockReturnValue(TEST_IP);
    allowSession(mockRequireSession);
    setEnvVars(GITLAB_ENV_VARS);
    mockCreateGitlabStateCookie.mockReturnValue(GITLAB_STATE_COOKIE);
    mockBuildGitlabAuthUrl.mockReturnValue(GITLAB_AUTH_URL);
  });

  afterEach(() => {
    clearEnvVars(GITLAB_ENV_VARS);
  });

  it("returns 404 when feature flag is disabled", async () => {
    mockIsGitlabEnabled.mockResolvedValue(false);

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

  it("redirects to error when GITLAB_CLIENT_ID is missing", async () => {
    vi.stubEnv("GITLAB_CLIENT_ID", undefined);

    const res = await GET(makeRequest());
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.searchParams.get("error")).toBe("config");
  });

  it("uses production URL fallback when NEXT_PUBLIC_BASE_URL is unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", undefined);

    const res = await GET(makeRequest());
    expect(res.status).toBe(307);
    expect(mockBuildGitlabAuthUrl).toHaveBeenCalledWith(
      "test-gl-client-id",
      "https://chapa.thecreativetoken.com/api/auth/gitlab/callback",
      "random-csrf-state",
    );
  });

  it("redirects to GitLab OAuth URL on success", async () => {
    const res = await GET(makeRequest());

    expect(res.status).toBe(307);
    expect(res.headers.get("Location")).toBe(GITLAB_AUTH_URL);
  });

  it("sets CSRF state cookie on success", async () => {
    const res = await GET(makeRequest());

    const setCookies = res.headers.getSetCookie();
    expect(setCookies.length).toBeGreaterThanOrEqual(1);
    expect(setCookies[0]).toContain("chapa_gl_oauth_state=");
  });

  it("passes correct redirect URI to buildGitlabAuthUrl", async () => {
    await GET(makeRequest());

    expect(mockBuildGitlabAuthUrl).toHaveBeenCalledWith(
      "test-gl-client-id",
      "https://chapa.thecreativetoken.com/api/auth/gitlab/callback",
      "random-csrf-state",
    );
  });
});
