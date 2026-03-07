import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// buildCodebergAuthUrl
// ---------------------------------------------------------------------------

import {
  buildCodebergAuthUrl,
  exchangeCodebergCode,
  refreshCodebergToken,
  fetchCodebergUser,
  createCodebergStateCookie,
  validateCodebergState,
  clearCodebergStateCookie,
} from "./codeberg";
import { computeTokenExpiry, isTokenExpired } from "./bitbucket";

describe("buildCodebergAuthUrl", () => {
  it("returns a Codeberg OAuth URL with correct client_id", () => {
    const url = buildCodebergAuthUrl(
      "test-client-id",
      "http://localhost:3001/api/auth/codeberg/callback",
      "test-state",
    );
    const parsed = new URL(url);
    expect(parsed.origin).toBe("https://codeberg.org");
    expect(parsed.pathname).toBe("/login/oauth/authorize");
    expect(parsed.searchParams.get("client_id")).toBe("test-client-id");
  });

  it("includes the redirect_uri", () => {
    const url = buildCodebergAuthUrl(
      "cid",
      "http://localhost:3001/api/auth/codeberg/callback",
      "test-state",
    );
    const parsed = new URL(url);
    expect(parsed.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3001/api/auth/codeberg/callback",
    );
  });

  it("includes the provided state parameter for CSRF protection", () => {
    const url = buildCodebergAuthUrl(
      "cid",
      "http://localhost:3001/api/auth/codeberg/callback",
      "my-csrf-state-123",
    );
    const parsed = new URL(url);
    expect(parsed.searchParams.get("state")).toBe("my-csrf-state-123");
  });

  it("includes response_type=code", () => {
    const url = buildCodebergAuthUrl("cid", "http://localhost:3001/cb", "s");
    const parsed = new URL(url);
    expect(parsed.searchParams.get("response_type")).toBe("code");
  });
});

// ---------------------------------------------------------------------------
// exchangeCodebergCode
// ---------------------------------------------------------------------------

describe("exchangeCodebergCode", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sends JSON body (not form-encoded) to Codeberg token endpoint", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: "cb_access_123",
          token_type: "bearer",
        }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await exchangeCodebergCode("code123", "cid", "csecret", "http://localhost:3001/cb");

    const [url, opts] = mockFetch.mock.calls[0]!;
    expect(url).toBe("https://codeberg.org/login/oauth/access_token");
    expect(opts.method).toBe("POST");
    expect(opts.headers["Content-Type"]).toBe("application/json");
    // Body should be JSON string (not URLSearchParams)
    const body = JSON.parse(opts.body);
    expect(body.grant_type).toBe("authorization_code");
    expect(body.code).toBe("code123");
    expect(body.redirect_uri).toBe("http://localhost:3001/cb");
  });

  it("returns tokens on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "cb_access_123",
            token_type: "bearer",
            expires_in: 28800,
            refresh_token: "cb_refresh_456",
          }),
      }),
    );

    const result = await exchangeCodebergCode("code123", "cid", "csecret", "http://localhost:3001/cb");
    expect(result).not.toBeNull();
    expect(result!.access_token).toBe("cb_access_123");
    expect(result!.expires_in).toBe(28800);
    expect(result!.refresh_token).toBe("cb_refresh_456");
  });

  it("returns tokens even without expires_in (long-lived token)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "cb_access_long",
            token_type: "bearer",
          }),
      }),
    );

    const result = await exchangeCodebergCode("code123", "cid", "csecret", "http://localhost:3001/cb");
    expect(result).not.toBeNull();
    expect(result!.access_token).toBe("cb_access_long");
    expect(result!.expires_in).toBeUndefined();
    expect(result!.refresh_token).toBeUndefined();
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

    const result = await exchangeCodebergCode("bad", "cid", "csecret", "http://localhost:3001/cb");
    expect(result).toBeNull();
  });

  it("returns null on network error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network error")),
    );

    const result = await exchangeCodebergCode("code", "cid", "csecret", "http://localhost:3001/cb");
    expect(result).toBeNull();
  });

  it("includes client_id and client_secret in JSON body (not Basic auth)", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: "cb_access_123",
          token_type: "bearer",
        }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await exchangeCodebergCode("code", "my-client-id", "my-client-secret", "http://localhost:3001/cb");

    const [, opts] = mockFetch.mock.calls[0]!;
    // Should NOT have Basic auth header
    expect(opts.headers["Authorization"]).toBeUndefined();
    // Credentials should be in JSON body
    const body = JSON.parse(opts.body);
    expect(body.client_id).toBe("my-client-id");
    expect(body.client_secret).toBe("my-client-secret");
  });
});

// ---------------------------------------------------------------------------
// refreshCodebergToken
// ---------------------------------------------------------------------------

describe("refreshCodebergToken", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sends grant_type=refresh_token with JSON body", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: "new_access",
          token_type: "bearer",
          refresh_token: "new_refresh",
        }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await refreshCodebergToken("old_refresh", "cid", "csecret");

    const [, opts] = mockFetch.mock.calls[0]!;
    const body = JSON.parse(opts.body);
    expect(body.grant_type).toBe("refresh_token");
    expect(body.refresh_token).toBe("old_refresh");
  });

  it("returns new tokens on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "new_access",
            token_type: "bearer",
            refresh_token: "new_refresh",
          }),
      }),
    );

    const result = await refreshCodebergToken("old_refresh", "cid", "csecret");
    expect(result).not.toBeNull();
    expect(result!.access_token).toBe("new_access");
    expect(result!.refresh_token).toBe("new_refresh");
  });

  it("returns null on error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: "invalid_grant" }),
      }),
    );

    const result = await refreshCodebergToken("revoked", "cid", "csecret");
    expect(result).toBeNull();
  });

  it("returns null on network error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network error")),
    );

    const result = await refreshCodebergToken("refresh", "cid", "csecret");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// fetchCodebergUser
// ---------------------------------------------------------------------------

describe("fetchCodebergUser", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns { login, full_name, avatar_url } on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            login: "cb-user",
            full_name: "CB User",
            avatar_url: "https://codeberg.org/avatars/12345",
          }),
      }),
    );

    const user = await fetchCodebergUser("cb_access_token");
    expect(user).not.toBeNull();
    expect(user!.login).toBe("cb-user");
    expect(user!.full_name).toBe("CB User");
    expect(user!.avatar_url).toBe("https://codeberg.org/avatars/12345");
  });

  it("sends 'token' prefix in Authorization header", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          login: "cb-user",
          full_name: "CB User",
          avatar_url: "https://codeberg.org/avatars/12345",
        }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await fetchCodebergUser("my_token");

    const [url, opts] = mockFetch.mock.calls[0]!;
    expect(url).toBe("https://codeberg.org/api/v1/user");
    expect(opts.headers["Authorization"]).toBe("token my_token");
  });

  it("returns null on 401 (invalid token)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401 }),
    );

    const user = await fetchCodebergUser("bad-token");
    expect(user).toBeNull();
  });

  it("returns null on network error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network error")),
    );

    const user = await fetchCodebergUser("token");
    expect(user).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// CSRF state helpers
// ---------------------------------------------------------------------------

describe("createCodebergStateCookie", () => {
  it("returns a state value and a Set-Cookie header string", () => {
    const { state, cookie } = createCodebergStateCookie();
    expect(state).toBeTruthy();
    expect(state.length).toBe(32); // 16 bytes hex
    expect(cookie).toContain("chapa_cb_oauth_state=");
    expect(cookie).toContain(state);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Max-Age=600");
  });

  it("generates unique state values each call", () => {
    const a = createCodebergStateCookie();
    const b = createCodebergStateCookie();
    expect(a.state).not.toBe(b.state);
  });
});

describe("validateCodebergState", () => {
  it("returns true when cookie state matches query state", () => {
    const { state, cookie } = createCodebergStateCookie();
    const cookieHeader = cookie.split(";")[0]!;
    expect(validateCodebergState(cookieHeader, state)).toBe(true);
  });

  it("returns false when state values do not match", () => {
    const { cookie } = createCodebergStateCookie();
    const cookieHeader = cookie.split(";")[0]!;
    expect(validateCodebergState(cookieHeader, "wrong-state-value")).toBe(false);
  });

  it("returns false when cookie header is null", () => {
    expect(validateCodebergState(null, "some-state")).toBe(false);
  });

  it("returns false when state param is null", () => {
    const { cookie } = createCodebergStateCookie();
    const cookieHeader = cookie.split(";")[0]!;
    expect(validateCodebergState(cookieHeader, null)).toBe(false);
  });

  it("uses timing-safe comparison", () => {
    const { state, cookie } = createCodebergStateCookie();
    const cookieHeader = cookie.split(";")[0]!;
    expect(validateCodebergState(cookieHeader, state)).toBe(true);
    // Mismatched length should also fail
    expect(validateCodebergState(cookieHeader, state + "extra")).toBe(false);
  });
});

describe("clearCodebergStateCookie", () => {
  it("returns a cookie with Max-Age=0", () => {
    const cookie = clearCodebergStateCookie();
    expect(cookie).toContain("chapa_cb_oauth_state=");
    expect(cookie).toContain("Max-Age=0");
  });
});

// ---------------------------------------------------------------------------
// AbortSignal timeout on all fetch calls
// ---------------------------------------------------------------------------

describe("Codeberg OAuth fetch AbortSignal timeout", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exchangeCodebergCode passes an AbortSignal to fetch", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: "tok",
          token_type: "bearer",
        }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await exchangeCodebergCode("code", "cid", "csecret", "http://localhost:3001/cb");

    const [, opts] = mockFetch.mock.calls[0]!;
    expect(opts.signal).toBeInstanceOf(AbortSignal);
  });

  it("refreshCodebergToken passes an AbortSignal to fetch", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: "tok",
          token_type: "bearer",
        }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await refreshCodebergToken("refresh_tok", "cid", "csecret");

    const [, opts] = mockFetch.mock.calls[0]!;
    expect(opts.signal).toBeInstanceOf(AbortSignal);
  });

  it("fetchCodebergUser passes an AbortSignal to fetch", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          login: "cb-user",
          full_name: "CB User",
          avatar_url: "https://codeberg.org/avatars/12345",
        }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await fetchCodebergUser("access_tok");

    const [, opts] = mockFetch.mock.calls[0]!;
    expect(opts.signal).toBeInstanceOf(AbortSignal);
  });

  it("returns null when fetch aborts due to timeout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("signal timed out", "AbortError")),
    );

    const result = await exchangeCodebergCode("code", "cid", "csecret", "http://localhost:3001/cb");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Cookie Secure flag (conditional on HTTPS)
// ---------------------------------------------------------------------------

describe("Codeberg cookie Secure flag", () => {
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
    const { cookie } = createCodebergStateCookie();
    expect(cookie).toContain("Secure");
  });

  it("state cookie omits Secure when base URL is HTTP", () => {
    process.env.NEXT_PUBLIC_BASE_URL = "http://localhost:3001";
    const { cookie } = createCodebergStateCookie();
    expect(cookie).not.toContain("Secure");
  });
});

// ---------------------------------------------------------------------------
// Token expiry helpers — reused from bitbucket module
// ---------------------------------------------------------------------------

describe("Token expiry helpers (reused from bitbucket)", () => {
  it("computeTokenExpiry returns a date in the future", () => {
    const before = Date.now();
    const result = computeTokenExpiry(28800);
    const after = Date.now();
    expect(result.getTime()).toBeGreaterThanOrEqual(before + 28800 * 1000);
    expect(result.getTime()).toBeLessThanOrEqual(after + 28800 * 1000);
  });

  it("isTokenExpired returns true for null expiresAt", () => {
    expect(isTokenExpired(null)).toBe(true);
  });

  it("isTokenExpired returns false for fresh token", () => {
    const future = new Date(Date.now() + 60 * 60 * 1000);
    expect(isTokenExpired(future)).toBe(false);
  });
});
