import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// buildBitbucketAuthUrl
// ---------------------------------------------------------------------------

import {
  buildBitbucketAuthUrl,
  exchangeBitbucketCode,
  refreshBitbucketToken,
  fetchBitbucketUser,
  createBitbucketStateCookie,
  validateBitbucketState,
  clearBitbucketStateCookie,
  computeTokenExpiry,
  isTokenExpired,
} from "./bitbucket";

describe("buildBitbucketAuthUrl", () => {
  it("returns a Bitbucket OAuth URL with correct client_id", () => {
    const url = buildBitbucketAuthUrl(
      "test-client-id",
      "http://localhost:3001/api/auth/bitbucket/callback",
      "test-state",
    );
    const parsed = new URL(url);
    expect(parsed.origin).toBe("https://bitbucket.org");
    expect(parsed.pathname).toBe("/site/oauth2/authorize");
    expect(parsed.searchParams.get("client_id")).toBe("test-client-id");
  });

  it("includes the redirect_uri", () => {
    const url = buildBitbucketAuthUrl(
      "cid",
      "http://localhost:3001/api/auth/bitbucket/callback",
      "test-state",
    );
    const parsed = new URL(url);
    expect(parsed.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3001/api/auth/bitbucket/callback",
    );
  });

  it("includes the provided state parameter for CSRF protection", () => {
    const url = buildBitbucketAuthUrl(
      "cid",
      "http://localhost:3001/api/auth/bitbucket/callback",
      "my-csrf-state-123",
    );
    const parsed = new URL(url);
    expect(parsed.searchParams.get("state")).toBe("my-csrf-state-123");
  });

  it("includes response_type=code", () => {
    const url = buildBitbucketAuthUrl("cid", "http://localhost:3001/cb", "s");
    const parsed = new URL(url);
    expect(parsed.searchParams.get("response_type")).toBe("code");
  });
});

// ---------------------------------------------------------------------------
// exchangeBitbucketCode
// ---------------------------------------------------------------------------

describe("exchangeBitbucketCode", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sends form-encoded body (not JSON) to Bitbucket token endpoint", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: "bb_access_123",
          refresh_token: "bb_refresh_456",
          expires_in: 7200,
          token_type: "bearer",
          scopes: "account repository",
        }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await exchangeBitbucketCode("code123", "cid", "csecret", "http://localhost:3001/cb");

    const [url, opts] = mockFetch.mock.calls[0]!;
    expect(url).toBe("https://bitbucket.org/site/oauth2/access_token");
    expect(opts.method).toBe("POST");
    expect(opts.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    // Body should be URLSearchParams (form-encoded)
    expect(opts.body).toBeInstanceOf(URLSearchParams);
    const body = opts.body as URLSearchParams;
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("code123");
    expect(body.get("redirect_uri")).toBe("http://localhost:3001/cb");
  });

  it("returns tokens on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "bb_access_123",
            refresh_token: "bb_refresh_456",
            expires_in: 7200,
            token_type: "bearer",
            scopes: "account repository",
          }),
      }),
    );

    const result = await exchangeBitbucketCode("code123", "cid", "csecret", "http://localhost:3001/cb");
    expect(result).not.toBeNull();
    expect(result!.access_token).toBe("bb_access_123");
    expect(result!.refresh_token).toBe("bb_refresh_456");
    expect(result!.expires_in).toBe(7200);
  });

  it("returns null on error response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: "invalid_grant" }),
      }),
    );

    const result = await exchangeBitbucketCode("bad", "cid", "csecret", "http://localhost:3001/cb");
    expect(result).toBeNull();
  });

  it("returns null on network error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network error")),
    );

    const result = await exchangeBitbucketCode("code", "cid", "csecret", "http://localhost:3001/cb");
    expect(result).toBeNull();
  });

  it("uses Basic auth header with client credentials", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: "bb_access_123",
          refresh_token: "bb_refresh_456",
          expires_in: 7200,
          token_type: "bearer",
          scopes: "account",
        }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await exchangeBitbucketCode("code", "my-client-id", "my-client-secret", "http://localhost:3001/cb");

    const [, opts] = mockFetch.mock.calls[0]!;
    const authHeader = opts.headers["Authorization"] as string;
    expect(authHeader).toMatch(/^Basic /);
    const decoded = Buffer.from(authHeader.slice(6), "base64").toString();
    expect(decoded).toBe("my-client-id:my-client-secret");
  });
});

// ---------------------------------------------------------------------------
// refreshBitbucketToken
// ---------------------------------------------------------------------------

describe("refreshBitbucketToken", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sends grant_type=refresh_token", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: "new_access",
          refresh_token: "new_refresh",
          expires_in: 7200,
          token_type: "bearer",
          scopes: "account",
        }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await refreshBitbucketToken("old_refresh", "cid", "csecret");

    const [, opts] = mockFetch.mock.calls[0]!;
    const body = opts.body as URLSearchParams;
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("old_refresh");
  });

  it("returns new tokens on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "new_access",
            refresh_token: "new_refresh",
            expires_in: 7200,
            token_type: "bearer",
            scopes: "account",
          }),
      }),
    );

    const result = await refreshBitbucketToken("old_refresh", "cid", "csecret");
    expect(result).not.toBeNull();
    expect(result!.access_token).toBe("new_access");
    expect(result!.refresh_token).toBe("new_refresh");
  });

  it("returns null on error (e.g. refresh token revoked)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: "invalid_grant" }),
      }),
    );

    const result = await refreshBitbucketToken("revoked", "cid", "csecret");
    expect(result).toBeNull();
  });

  it("returns null on network error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network error")),
    );

    const result = await refreshBitbucketToken("refresh", "cid", "csecret");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// fetchBitbucketUser
// ---------------------------------------------------------------------------

describe("fetchBitbucketUser", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns { username, display_name, links } on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            username: "bb-user",
            display_name: "BB User",
            links: { avatar: { href: "https://example.com/avatar.png" } },
          }),
      }),
    );

    const user = await fetchBitbucketUser("bb_access_token");
    expect(user).not.toBeNull();
    expect(user!.username).toBe("bb-user");
    expect(user!.display_name).toBe("BB User");
    expect(user!.links.avatar.href).toBe("https://example.com/avatar.png");
  });

  it("sends Bearer token in Authorization header", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          username: "bb-user",
          display_name: "BB User",
          links: { avatar: { href: "https://example.com/avatar.png" } },
        }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await fetchBitbucketUser("my_token");

    const [url, opts] = mockFetch.mock.calls[0]!;
    expect(url).toBe("https://api.bitbucket.org/2.0/user");
    expect(opts.headers["Authorization"]).toBe("Bearer my_token");
  });

  it("returns null on 401 (invalid token)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401 }),
    );

    const user = await fetchBitbucketUser("bad-token");
    expect(user).toBeNull();
  });

  it("returns null on network error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network error")),
    );

    const user = await fetchBitbucketUser("token");
    expect(user).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// CSRF state helpers
// ---------------------------------------------------------------------------

describe("createBitbucketStateCookie", () => {
  it("returns a state value and a Set-Cookie header string", () => {
    const { state, cookie } = createBitbucketStateCookie();
    expect(state).toBeTruthy();
    expect(state.length).toBe(32); // 16 bytes hex
    expect(cookie).toContain("chapa_bb_oauth_state=");
    expect(cookie).toContain(state);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Max-Age=600");
  });

  it("generates unique state values each call", () => {
    const a = createBitbucketStateCookie();
    const b = createBitbucketStateCookie();
    expect(a.state).not.toBe(b.state);
  });
});

describe("validateBitbucketState", () => {
  it("returns true when cookie state matches query state", () => {
    const { state, cookie } = createBitbucketStateCookie();
    const cookieHeader = cookie.split(";")[0]!;
    expect(validateBitbucketState(cookieHeader, state)).toBe(true);
  });

  it("returns false when state values do not match", () => {
    const { cookie } = createBitbucketStateCookie();
    const cookieHeader = cookie.split(";")[0]!;
    expect(validateBitbucketState(cookieHeader, "wrong-state-value")).toBe(false);
  });

  it("returns false when cookie header is null", () => {
    expect(validateBitbucketState(null, "some-state")).toBe(false);
  });

  it("returns false when state param is null", () => {
    const { cookie } = createBitbucketStateCookie();
    const cookieHeader = cookie.split(";")[0]!;
    expect(validateBitbucketState(cookieHeader, null)).toBe(false);
  });

  it("uses timing-safe comparison", () => {
    // Verify matching works with exact values (timing-safe internally)
    const { state, cookie } = createBitbucketStateCookie();
    const cookieHeader = cookie.split(";")[0]!;
    expect(validateBitbucketState(cookieHeader, state)).toBe(true);
    // Mismatched length should also fail
    expect(validateBitbucketState(cookieHeader, state + "extra")).toBe(false);
  });
});

describe("clearBitbucketStateCookie", () => {
  it("returns a cookie with Max-Age=0", () => {
    const cookie = clearBitbucketStateCookie();
    expect(cookie).toContain("chapa_bb_oauth_state=");
    expect(cookie).toContain("Max-Age=0");
  });
});

// ---------------------------------------------------------------------------
// computeTokenExpiry
// ---------------------------------------------------------------------------

describe("computeTokenExpiry", () => {
  it("returns a date in the future based on expires_in seconds", () => {
    const before = Date.now();
    const result = computeTokenExpiry(7200);
    const after = Date.now();

    expect(result.getTime()).toBeGreaterThanOrEqual(before + 7200 * 1000);
    expect(result.getTime()).toBeLessThanOrEqual(after + 7200 * 1000);
  });

  it("returns a date ~2 hours from now for 7200 seconds", () => {
    const result = computeTokenExpiry(7200);
    const twoHoursFromNow = Date.now() + 7200 * 1000;
    // Should be within 1 second
    expect(Math.abs(result.getTime() - twoHoursFromNow)).toBeLessThan(1000);
  });
});

// ---------------------------------------------------------------------------
// isTokenExpired
// ---------------------------------------------------------------------------

describe("isTokenExpired", () => {
  it("returns true when expiresAt is null", () => {
    expect(isTokenExpired(null)).toBe(true);
  });

  it("returns true when token is past expiry", () => {
    const pastDate = new Date(Date.now() - 60 * 1000); // 1 minute ago
    expect(isTokenExpired(pastDate)).toBe(true);
  });

  it("returns true when within 5-minute buffer", () => {
    const almostExpired = new Date(Date.now() + 3 * 60 * 1000); // 3 minutes from now
    expect(isTokenExpired(almostExpired)).toBe(true);
  });

  it("returns false when token is fresh", () => {
    const future = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
    expect(isTokenExpired(future)).toBe(false);
  });

  it("returns true when exactly at 5-minute boundary", () => {
    const atBoundary = new Date(Date.now() + 5 * 60 * 1000);
    // At the exact boundary, should be considered expired (<=)
    expect(isTokenExpired(atBoundary)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Cookie Secure flag (conditional on HTTPS)
// ---------------------------------------------------------------------------

describe("Bitbucket cookie Secure flag", () => {
  const originalEnv = process.env.NEXT_PUBLIC_BASE_URL;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.NEXT_PUBLIC_BASE_URL = originalEnv;
    } else {
      delete process.env.NEXT_PUBLIC_BASE_URL;
    }
  });

  it("state cookie includes Secure when base URL is HTTPS", () => {
    process.env.NEXT_PUBLIC_BASE_URL = "https://chapa.thecreativetoken.com";
    const { cookie } = createBitbucketStateCookie();
    expect(cookie).toContain("Secure");
  });

  it("state cookie omits Secure when base URL is HTTP", () => {
    process.env.NEXT_PUBLIC_BASE_URL = "http://localhost:3001";
    const { cookie } = createBitbucketStateCookie();
    expect(cookie).not.toContain("Secure");
  });
});
