import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  RATE_LIMIT_ALLOWED,
  RATE_LIMIT_BLOCKED,
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
  mockDbDeleteLinkedPlatform,
  mockCacheDel,
  mockMarkStatsDirty,
  mockRateLimit,
  mockGetClientIp,
} = vi.hoisted(() => ({
  mockIsGitlabEnabled: vi.fn(),
  mockRequireSession: vi.fn(),
  mockDbDeleteLinkedPlatform: vi.fn(),
  mockCacheDel: vi.fn(),
  mockMarkStatsDirty: vi.fn(),
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
  dbDeleteLinkedPlatform: mockDbDeleteLinkedPlatform,
  // Stubs required by platform-oauth.ts (not used in disconnect flow)
  dbUpsertLinkedPlatform: vi.fn(),
  dbGetLinkedPlatforms: vi.fn(),
}));

vi.mock("@/lib/cache/redis", () => ({
  cacheDel: mockCacheDel,
  // Disconnect uses rateLimitStrict (fail-closed, #1027 BE-M3) — same spy so
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

// Stub all gitlab auth functions required by ../config.ts
vi.mock("@/lib/auth/gitlab", () => ({
  createGitlabStateCookie: vi.fn(),
  buildGitlabAuthUrl: vi.fn(),
  validateGitlabState: vi.fn(),
  clearGitlabStateCookie: vi.fn(),
  exchangeGitlabCode: vi.fn(),
  fetchGitlabUser: vi.fn(),
}));

import { POST } from "./route";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(): NextRequest {
  return new NextRequest(
    "https://chapa.thecreativetoken.com/api/auth/gitlab/disconnect",
    { method: "POST" },
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/auth/gitlab/disconnect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsGitlabEnabled.mockResolvedValue(true);
    mockRateLimit.mockResolvedValue(RATE_LIMIT_ALLOWED);
    mockGetClientIp.mockReturnValue(TEST_IP);
    allowSession(mockRequireSession);
    mockDbDeleteLinkedPlatform.mockResolvedValue(true);
    mockCacheDel.mockResolvedValue(undefined);
  });

  it("returns 404 when feature flag is disabled", async () => {
    mockIsGitlabEnabled.mockResolvedValue(false);

    const res = await POST(makeRequest());
    expect(res.status).toBe(404);
  });

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue(RATE_LIMIT_BLOCKED);

    const res = await POST(makeRequest());
    expect(res.status).toBe(429);
  });

  it("returns 401 when not authenticated", async () => {
    denySession(mockRequireSession);

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

    expect(mockDbDeleteLinkedPlatform).toHaveBeenCalledWith(
      "testuser",
      "gitlab",
    );
  });

  it("invalidates stats cache on success", async () => {
    await POST(makeRequest());

    expect(mockCacheDel).toHaveBeenCalledWith("stats:v2:merged:testuser");
    expect(mockCacheDel).toHaveBeenCalledWith("stats:v2:gitlab:testuser");
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
    expect(mockCacheDel).toHaveBeenCalledWith("stats:v2:gitlab:testuser");
  });
});
