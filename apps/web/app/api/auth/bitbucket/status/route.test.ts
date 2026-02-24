import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock dependencies BEFORE importing the route handler.
// ---------------------------------------------------------------------------

const {
  mockIsBitbucketEnabled,
  mockRequireSession,
  mockDbGetLinkedPlatforms,
} = vi.hoisted(() => ({
  mockIsBitbucketEnabled: vi.fn(),
  mockRequireSession: vi.fn(),
  mockDbGetLinkedPlatforms: vi.fn(),
}));

vi.mock("@/lib/feature-flags", () => ({
  isBitbucketEnabled: mockIsBitbucketEnabled,
}));

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: mockRequireSession,
}));

vi.mock("@/lib/db/user-platforms", () => ({
  dbGetLinkedPlatforms: mockDbGetLinkedPlatforms,
}));

import { GET } from "./route";
import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(): NextRequest {
  return new NextRequest(
    "https://chapa.thecreativetoken.com/api/auth/bitbucket/status",
  );
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/auth/bitbucket/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsBitbucketEnabled.mockResolvedValue(true);
    allowSession();
    mockDbGetLinkedPlatforms.mockResolvedValue([]);
  });

  it("returns { enabled: false } when feature flag is disabled", async () => {
    mockIsBitbucketEnabled.mockResolvedValue(false);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ enabled: false });
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireSession.mockReturnValue({
      error: NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      ),
    });

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
        platform: "bitbucket",
        remoteLogin: "bb-user",
        connectedAt: "2026-02-20T12:00:00Z",
      },
    ]);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({
      enabled: true,
      linked: true,
      remoteLogin: "bb-user",
      connectedAt: "2026-02-20T12:00:00Z",
    });
  });

  it("passes session login to dbGetLinkedPlatforms", async () => {
    await GET(makeRequest());
    expect(mockDbGetLinkedPlatforms).toHaveBeenCalledWith("testuser");
  });
});
