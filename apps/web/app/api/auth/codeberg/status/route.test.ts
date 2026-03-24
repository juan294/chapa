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
  mockIsCodebergEnabled,
  mockRequireSession,
  mockDbGetLinkedPlatforms,
  mockRateLimit,
  mockGetClientIp,
} = vi.hoisted(() => ({
  mockIsCodebergEnabled: vi.fn(),
  mockRequireSession: vi.fn(),
  mockDbGetLinkedPlatforms: vi.fn(),
  mockRateLimit: vi.fn(),
  mockGetClientIp: vi.fn(),
}));

vi.mock("@/lib/feature-flags", () => ({
  isCodebergEnabled: mockIsCodebergEnabled,
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

// Stub all codeberg auth functions required by ../config.ts
vi.mock("@/lib/auth/codeberg", () => ({
  createCodebergStateCookie: vi.fn(),
  buildCodebergAuthUrl: vi.fn(),
  validateCodebergState: vi.fn(),
  clearCodebergStateCookie: vi.fn(),
  exchangeCodebergCode: vi.fn(),
  fetchCodebergUser: vi.fn(),
}));

import { GET } from "./route";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(): NextRequest {
  return new NextRequest(
    "https://chapa.thecreativetoken.com/api/auth/codeberg/status",
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/auth/codeberg/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsCodebergEnabled.mockResolvedValue(true);
    mockRateLimit.mockResolvedValue(RATE_LIMIT_STATUS_ALLOWED);
    mockGetClientIp.mockReturnValue(TEST_IP);
    allowSession(mockRequireSession);
    mockDbGetLinkedPlatforms.mockResolvedValue([]);
  });

  it("returns { enabled: false } when feature flag is disabled", async () => {
    mockIsCodebergEnabled.mockResolvedValue(false);

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
        platform: "codeberg",
        remoteLogin: "cb-user",
        connectedAt: "2026-02-25T12:00:00Z",
      },
    ]);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({
      enabled: true,
      linked: true,
      remoteLogin: "cb-user",
      connectedAt: "2026-02-25T12:00:00Z",
    });
  });

  it("passes session login to dbGetLinkedPlatforms", async () => {
    await GET(makeRequest());
    expect(mockDbGetLinkedPlatforms).toHaveBeenCalledWith("testuser");
  });
});
