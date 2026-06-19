import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  RATE_LIMIT_STATUS_ALLOWED,
  RATE_LIMIT_STATUS_BLOCKED,
  TEST_IP,
  allowSession,
  denySession,
} from "@/lib/test-helpers/platform-auth-fixtures";

// ---------------------------------------------------------------------------
// Mock dependencies BEFORE importing the route handler.
// ---------------------------------------------------------------------------

const {
  mockIsGitlabEnabled,
  mockRequireSession,
  mockDbGetLinkedPlatforms,
  mockRateLimit,
  mockGetClientIp,
} = vi.hoisted(() => ({
  mockIsGitlabEnabled: vi.fn(),
  mockRequireSession: vi.fn(),
  mockDbGetLinkedPlatforms: vi.fn(),
  mockRateLimit: vi.fn(),
  mockGetClientIp: vi.fn(),
}));

vi.mock("@/lib/feature-flags", () => ({
  isGitlabEnabled: mockIsGitlabEnabled,
}));

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: mockRequireSession,
}));

vi.mock("@/lib/db/user-platforms", () => ({
  dbGetLinkedPlatforms: mockDbGetLinkedPlatforms,
  // Stubs required by platform-oauth.ts (not used in status flow)
  dbUpsertLinkedPlatform: vi.fn(),
  dbDeleteLinkedPlatform: vi.fn(),
}));

vi.mock("@/lib/cache/redis", () => ({
  rateLimit: mockRateLimit,
  // Stub required by platform-oauth.ts (not used in status flow)
  cacheDel: vi.fn(),
}));

vi.mock("@/lib/http/client-ip", () => ({
  getClientIp: mockGetClientIp,
}));

// Stub all gitlab auth functions required by ../config.ts
vi.mock("@/lib/auth/gitlab", () => ({
  createGitlabStateCookie: vi.fn(),
  buildGitlabAuthUrl: vi.fn(),
  validateGitlabState: vi.fn(),
  clearGitlabStateCookie: vi.fn(),
  exchangeGitlabCode: vi.fn(),
  fetchGitlabUser: vi.fn(),
}));

import { GET } from "./route";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(): NextRequest {
  return new NextRequest(
    "https://chapa.thecreativetoken.com/api/auth/gitlab/status",
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/auth/gitlab/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsGitlabEnabled.mockResolvedValue(true);
    mockRateLimit.mockResolvedValue(RATE_LIMIT_STATUS_ALLOWED);
    mockGetClientIp.mockReturnValue(TEST_IP);
    allowSession(mockRequireSession);
    mockDbGetLinkedPlatforms.mockResolvedValue([]);
  });

  it("returns { enabled: false } when feature flag is disabled", async () => {
    mockIsGitlabEnabled.mockResolvedValue(false);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ enabled: false });
  });

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue(RATE_LIMIT_STATUS_BLOCKED);

    const res = await GET(makeRequest());
    expect(res.status).toBe(429);
  });

  it("returns 401 when not authenticated", async () => {
    denySession(mockRequireSession);

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns { enabled: true, linked: false } when not linked", async () => {
    mockDbGetLinkedPlatforms.mockResolvedValue([]);

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
        platform: "gitlab",
        remoteLogin: "gl-user",
        connectedAt: "2026-06-19T12:00:00Z",
      },
    ]);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({
      enabled: true,
      linked: true,
      remoteLogin: "gl-user",
      connectedAt: "2026-06-19T12:00:00Z",
    });
  });

  it("passes session login to dbGetLinkedPlatforms", async () => {
    await GET(makeRequest());
    expect(mockDbGetLinkedPlatforms).toHaveBeenCalledWith("testuser");
  });
});
