import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock dependencies BEFORE importing the route handler.
// ---------------------------------------------------------------------------

const {
  mockIsBitbucketEnabled,
  mockRequireSession,
  mockValidateBitbucketState,
  mockClearBitbucketStateCookie,
  mockExchangeBitbucketCode,
  mockFetchBitbucketUser,
  mockComputeTokenExpiry,
  mockDbUpsertLinkedPlatform,
  mockCacheDel,
} = vi.hoisted(() => ({
  mockIsBitbucketEnabled: vi.fn(),
  mockRequireSession: vi.fn(),
  mockValidateBitbucketState: vi.fn(),
  mockClearBitbucketStateCookie: vi.fn(),
  mockExchangeBitbucketCode: vi.fn(),
  mockFetchBitbucketUser: vi.fn(),
  mockComputeTokenExpiry: vi.fn(),
  mockDbUpsertLinkedPlatform: vi.fn(),
  mockCacheDel: vi.fn(),
}));

vi.mock("@/lib/feature-flags", () => ({
  isBitbucketEnabled: mockIsBitbucketEnabled,
}));

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: mockRequireSession,
}));

vi.mock("@/lib/auth/bitbucket", () => ({
  validateBitbucketState: mockValidateBitbucketState,
  clearBitbucketStateCookie: mockClearBitbucketStateCookie,
  exchangeBitbucketCode: mockExchangeBitbucketCode,
  fetchBitbucketUser: mockFetchBitbucketUser,
  computeTokenExpiry: mockComputeTokenExpiry,
}));

vi.mock("@/lib/db/user-platforms", () => ({
  dbUpsertLinkedPlatform: mockDbUpsertLinkedPlatform,
}));

vi.mock("@/lib/cache/redis", () => ({
  cacheDel: mockCacheDel,
}));

import { GET } from "./route";
import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(params?: {
  code?: string;
  state?: string;
  cookie?: string;
}): NextRequest {
  const url = new URL(
    "https://chapa.thecreativetoken.com/api/auth/bitbucket/callback",
  );
  if (params?.code) url.searchParams.set("code", params.code);
  if (params?.state) url.searchParams.set("state", params.state);
  const headers: Record<string, string> = {};
  if (params?.cookie) headers["cookie"] = params.cookie;
  return new NextRequest(url, { headers });
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
  process.env.BITBUCKET_CLIENT_SECRET = "test-bb-client-secret";
  process.env.NEXT_PUBLIC_BASE_URL = "https://chapa.thecreativetoken.com";
}

function clearEnvVars() {
  delete process.env.BITBUCKET_CLIENT_ID;
  delete process.env.BITBUCKET_CLIENT_SECRET;
  delete process.env.NEXT_PUBLIC_BASE_URL;
}

function setupHappyPath() {
  mockIsBitbucketEnabled.mockResolvedValue(true);
  allowSession();
  setEnvVars();
  mockValidateBitbucketState.mockReturnValue(true);
  mockExchangeBitbucketCode.mockResolvedValue({
    access_token: "bb_access_123",
    refresh_token: "bb_refresh_456",
    expires_in: 7200,
    token_type: "bearer",
    scopes: "account repository",
  });
  mockFetchBitbucketUser.mockResolvedValue({
    username: "bb-user",
    display_name: "BB User",
    links: { avatar: { href: "https://example.com/avatar.png" } },
  });
  mockComputeTokenExpiry.mockReturnValue(new Date("2026-03-01T00:00:00Z"));
  mockDbUpsertLinkedPlatform.mockResolvedValue(true);
  mockCacheDel.mockResolvedValue(undefined);
  mockClearBitbucketStateCookie.mockReturnValue(
    "chapa_bb_oauth_state=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/auth/bitbucket/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyPath();
  });

  afterEach(() => {
    clearEnvVars();
  });

  it("returns 404 when feature flag is disabled", async () => {
    mockIsBitbucketEnabled.mockResolvedValue(false);

    const res = await GET(
      makeRequest({ code: "abc", state: "xyz", cookie: "chapa_bb_oauth_state=xyz" }),
    );
    expect(res.status).toBe(404);
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireSession.mockReturnValue({
      error: NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      ),
    });

    const res = await GET(
      makeRequest({ code: "abc", state: "xyz", cookie: "chapa_bb_oauth_state=xyz" }),
    );
    expect(res.status).toBe(401);
  });

  it("redirects with error=bitbucket_no_code when code is missing", async () => {
    const res = await GET(makeRequest({ state: "xyz" }));

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.pathname).toBe("/u/testuser");
    expect(location.searchParams.get("error")).toBe("bitbucket_no_code");
  });

  it("redirects with error=bitbucket_invalid_state when state validation fails", async () => {
    mockValidateBitbucketState.mockReturnValue(false);

    const res = await GET(
      makeRequest({ code: "abc", state: "bad", cookie: "chapa_bb_oauth_state=other" }),
    );

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.searchParams.get("error")).toBe("bitbucket_invalid_state");
  });

  it("redirects with error=bitbucket_config when env vars are missing", async () => {
    delete process.env.BITBUCKET_CLIENT_ID;

    const res = await GET(
      makeRequest({ code: "abc", state: "xyz", cookie: "chapa_bb_oauth_state=xyz" }),
    );

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.searchParams.get("error")).toBe("bitbucket_config");
  });

  it("redirects with error=bitbucket_token_exchange when token exchange fails", async () => {
    mockExchangeBitbucketCode.mockResolvedValue(null);

    const res = await GET(
      makeRequest({ code: "bad-code", state: "xyz", cookie: "chapa_bb_oauth_state=xyz" }),
    );

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.searchParams.get("error")).toBe("bitbucket_token_exchange");
  });

  it("redirects with error=bitbucket_user_fetch when user fetch fails", async () => {
    mockFetchBitbucketUser.mockResolvedValue(null);

    const res = await GET(
      makeRequest({ code: "abc", state: "xyz", cookie: "chapa_bb_oauth_state=xyz" }),
    );

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.searchParams.get("error")).toBe("bitbucket_user_fetch");
  });

  it("redirects with error=bitbucket_storage when DB upsert fails", async () => {
    mockDbUpsertLinkedPlatform.mockResolvedValue(false);

    const res = await GET(
      makeRequest({ code: "abc", state: "xyz", cookie: "chapa_bb_oauth_state=xyz" }),
    );

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.searchParams.get("error")).toBe("bitbucket_storage");
  });

  it("redirects to /u/{handle}?bitbucket=linked on success", async () => {
    const res = await GET(
      makeRequest({ code: "abc", state: "xyz", cookie: "chapa_bb_oauth_state=xyz" }),
    );

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.pathname).toBe("/u/testuser");
    expect(location.searchParams.get("bitbucket")).toBe("linked");
  });

  it("stores encrypted tokens via dbUpsertLinkedPlatform", async () => {
    await GET(
      makeRequest({ code: "abc", state: "xyz", cookie: "chapa_bb_oauth_state=xyz" }),
    );

    expect(mockDbUpsertLinkedPlatform).toHaveBeenCalledWith(
      "testuser",
      "bitbucket",
      "bb-user",
      "bb_access_123",
      "bb_refresh_456",
      new Date("2026-03-01T00:00:00Z"),
    );
  });

  it("invalidates stats cache on success", async () => {
    await GET(
      makeRequest({ code: "abc", state: "xyz", cookie: "chapa_bb_oauth_state=xyz" }),
    );

    expect(mockCacheDel).toHaveBeenCalledWith("stats:v2:testuser");
  });

  it("clears CSRF state cookie on success", async () => {
    const res = await GET(
      makeRequest({ code: "abc", state: "xyz", cookie: "chapa_bb_oauth_state=xyz" }),
    );

    const setCookies = res.headers.getSetCookie();
    expect(setCookies.some((c) => c.includes("chapa_bb_oauth_state="))).toBe(true);
  });

  it("passes correct arguments to exchangeBitbucketCode", async () => {
    await GET(
      makeRequest({ code: "my-auth-code", state: "xyz", cookie: "chapa_bb_oauth_state=xyz" }),
    );

    expect(mockExchangeBitbucketCode).toHaveBeenCalledWith(
      "my-auth-code",
      "test-bb-client-id",
      "test-bb-client-secret",
      "https://chapa.thecreativetoken.com/api/auth/bitbucket/callback",
    );
  });

  it("passes access token to fetchBitbucketUser", async () => {
    await GET(
      makeRequest({ code: "abc", state: "xyz", cookie: "chapa_bb_oauth_state=xyz" }),
    );

    expect(mockFetchBitbucketUser).toHaveBeenCalledWith("bb_access_123");
  });
});
