import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock dependencies BEFORE importing the route handler.
// ---------------------------------------------------------------------------

const {
  mockIsCodebergEnabled,
  mockRequireSession,
  mockCreateCodebergStateCookie,
  mockBuildCodebergAuthUrl,
} = vi.hoisted(() => ({
  mockIsCodebergEnabled: vi.fn(),
  mockRequireSession: vi.fn(),
  mockCreateCodebergStateCookie: vi.fn(),
  mockBuildCodebergAuthUrl: vi.fn(),
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
}));

import { GET } from "./route";
import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(): NextRequest {
  return new NextRequest(
    "https://chapa.thecreativetoken.com/api/auth/codeberg/connect",
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
  process.env.CODEBERG_CLIENT_ID = "test-cb-client-id";
  process.env.NEXT_PUBLIC_BASE_URL = "https://chapa.thecreativetoken.com";
}

function clearEnvVars() {
  delete process.env.CODEBERG_CLIENT_ID;
  delete process.env.NEXT_PUBLIC_BASE_URL;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/auth/codeberg/connect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsCodebergEnabled.mockResolvedValue(true);
    allowSession();
    setEnvVars();
    mockCreateCodebergStateCookie.mockReturnValue({
      state: "random-csrf-state",
      cookie: "chapa_cb_oauth_state=random-csrf-state; HttpOnly; SameSite=Lax; Path=/; Max-Age=600",
    });
    mockBuildCodebergAuthUrl.mockReturnValue(
      "https://codeberg.org/login/oauth/authorize?client_id=test-cb-client-id&state=random-csrf-state",
    );
  });

  afterEach(() => {
    clearEnvVars();
  });

  it("returns 404 when feature flag is disabled", async () => {
    mockIsCodebergEnabled.mockResolvedValue(false);

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
    expect(res.headers.get("Location")).toBe(
      "https://codeberg.org/login/oauth/authorize?client_id=test-cb-client-id&state=random-csrf-state",
    );
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
