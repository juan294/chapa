import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock dependencies BEFORE importing the route handler.
// ---------------------------------------------------------------------------

const {
  mockIsBitbucketEnabled,
  mockRequireSession,
  mockDbDeleteLinkedPlatform,
  mockCacheDel,
} = vi.hoisted(() => ({
  mockIsBitbucketEnabled: vi.fn(),
  mockRequireSession: vi.fn(),
  mockDbDeleteLinkedPlatform: vi.fn(),
  mockCacheDel: vi.fn(),
}));

vi.mock("@/lib/feature-flags", () => ({
  isBitbucketEnabled: mockIsBitbucketEnabled,
}));

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: mockRequireSession,
}));

vi.mock("@/lib/db/user-platforms", () => ({
  dbDeleteLinkedPlatform: mockDbDeleteLinkedPlatform,
}));

vi.mock("@/lib/cache/redis", () => ({
  cacheDel: mockCacheDel,
}));

import { POST } from "./route";
import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(): NextRequest {
  return new NextRequest(
    "https://chapa.thecreativetoken.com/api/auth/bitbucket/disconnect",
    { method: "POST" },
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

describe("POST /api/auth/bitbucket/disconnect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsBitbucketEnabled.mockResolvedValue(true);
    allowSession();
    mockDbDeleteLinkedPlatform.mockResolvedValue(true);
    mockCacheDel.mockResolvedValue(undefined);
  });

  it("returns 404 when feature flag is disabled", async () => {
    mockIsBitbucketEnabled.mockResolvedValue(false);

    const res = await POST(makeRequest());
    expect(res.status).toBe(404);
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireSession.mockReturnValue({
      error: NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      ),
    });

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
      "bitbucket",
    );
  });

  it("invalidates stats cache on success", async () => {
    await POST(makeRequest());

    expect(mockCacheDel).toHaveBeenCalledWith("stats:v2:merged:testuser");
    expect(mockCacheDel).toHaveBeenCalledWith("stats:v2:bitbucket:testuser");
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

    // Cache should still be invalidated to force re-fetch
    expect(mockCacheDel).toHaveBeenCalledWith("stats:v2:merged:testuser");
    expect(mockCacheDel).toHaveBeenCalledWith("stats:v2:bitbucket:testuser");
  });
});
