import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock dependencies BEFORE importing the route handler.
// ---------------------------------------------------------------------------

const {
  mockIsBitbucketEnabled,
  mockRequireSession,
  mockCreateBitbucketStateCookie,
  mockBuildBitbucketAuthUrl,
} = vi.hoisted(() => ({
  mockIsBitbucketEnabled: vi.fn(),
  mockRequireSession: vi.fn(),
  mockCreateBitbucketStateCookie: vi.fn(),
  mockBuildBitbucketAuthUrl: vi.fn(),
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
}));

import { GET } from "./route";
import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(): NextRequest {
  return new NextRequest(
    "https://chapa.thecreativetoken.com/api/auth/bitbucket/connect",
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

function setEnvVars() {
  process.env.BITBUCKET_CLIENT_ID = "test-bb-client-id";
  process.env.NEXT_PUBLIC_BASE_URL = "https://chapa.thecreativetoken.com";
}

function clearEnvVars() {
  delete process.env.BITBUCKET_CLIENT_ID;
  delete process.env.NEXT_PUBLIC_BASE_URL;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/auth/bitbucket/connect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsBitbucketEnabled.mockResolvedValue(true);
    allowSession();
    setEnvVars();
    mockCreateBitbucketStateCookie.mockReturnValue({
      state: "random-csrf-state",
      cookie: "chapa_bb_oauth_state=random-csrf-state; HttpOnly; SameSite=Lax; Path=/; Max-Age=600",
    });
    mockBuildBitbucketAuthUrl.mockReturnValue(
      "https://bitbucket.org/site/oauth2/authorize?client_id=test-bb-client-id&state=random-csrf-state",
    );
  });

  afterEach(() => {
    clearEnvVars();
  });

  it("returns 404 when feature flag is disabled", async () => {
    mockIsBitbucketEnabled.mockResolvedValue(false);

    const res = await GET(makeRequest());
    expect(res.status).toBe(404);
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

  it("redirects to error when BITBUCKET_CLIENT_ID is missing", async () => {
    delete process.env.BITBUCKET_CLIENT_ID;

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

  it("redirects to Bitbucket OAuth URL on success", async () => {
    const res = await GET(makeRequest());

    expect(res.status).toBe(307);
    expect(res.headers.get("Location")).toBe(
      "https://bitbucket.org/site/oauth2/authorize?client_id=test-bb-client-id&state=random-csrf-state",
    );
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
