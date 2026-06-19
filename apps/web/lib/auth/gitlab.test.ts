import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  buildGitlabAuthUrl,
  exchangeGitlabCode,
  refreshGitlabToken,
  fetchGitlabUser,
  createGitlabStateCookie,
  validateGitlabState,
  clearGitlabStateCookie,
} from "./gitlab";
import { computeTokenExpiry, isTokenExpired } from "./bitbucket";

// ---------------------------------------------------------------------------
// buildGitlabAuthUrl
// ---------------------------------------------------------------------------

describe("buildGitlabAuthUrl", () => {
  it("returns a GitLab OAuth URL with correct client_id", () => {
    const url = buildGitlabAuthUrl(
      "test-client-id",
      "http://localhost:3001/api/auth/gitlab/callback",
      "test-state",
    );
    const parsed = new URL(url);
    expect(parsed.origin).toBe("https://gitlab.com");
    expect(parsed.pathname).toBe("/oauth/authorize");
    expect(parsed.searchParams.get("client_id")).toBe("test-client-id");
  });

  it("includes the redirect_uri", () => {
    const url = buildGitlabAuthUrl(
      "cid",
      "http://localhost:3001/api/auth/gitlab/callback",
      "test-state",
    );
    const parsed = new URL(url);
    expect(parsed.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3001/api/auth/gitlab/callback",
    );
  });

  it("includes the provided state parameter for CSRF protection", () => {
    const url = buildGitlabAuthUrl(
      "cid",
      "http://localhost:3001/api/auth/gitlab/callback",
      "my-csrf-state-123",
    );
    const parsed = new URL(url);
    expect(parsed.searchParams.get("state")).toBe("my-csrf-state-123");
  });

  it("includes response_type=code", () => {
    const url = buildGitlabAuthUrl("cid", "http://localhost:3001/cb", "s");
    const parsed = new URL(url);
    expect(parsed.searchParams.get("response_type")).toBe("code");
  });

  it("requests read_user and read_api scopes (GitLab supports scopes)", () => {
    const url = buildGitlabAuthUrl("cid", "http://localhost:3001/cb", "s");
    const parsed = new URL(url);
    expect(parsed.searchParams.get("scope")).toBe("read_user read_api");
  });
});

// ---------------------------------------------------------------------------
// exchangeGitlabCode
// ---------------------------------------------------------------------------

describe("exchangeGitlabCode", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sends a form-encoded body (not JSON) to GitLab token endpoint", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: "gl_access_123",
          token_type: "bearer",
        }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await exchangeGitlabCode("code123", "cid", "csecret", "http://localhost:3001/cb");

    const [url, opts] = mockFetch.mock.calls[0]!;
    expect(url).toBe("https://gitlab.com/oauth/token");
    expect(opts.method).toBe("POST");
    expect(opts.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    // Body should be a form-encoded string parseable by URLSearchParams
    const body = new URLSearchParams(opts.body);
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
            access_token: "gl_access_123",
            token_type: "bearer",
            expires_in: 7200,
            refresh_token: "gl_refresh_456",
          }),
      }),
    );

    const result = await exchangeGitlabCode("code123", "cid", "csecret", "http://localhost:3001/cb");
    expect(result).not.toBeNull();
    expect(result!.access_token).toBe("gl_access_123");
    expect(result!.expires_in).toBe(7200);
    expect(result!.refresh_token).toBe("gl_refresh_456");
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

    const result = await exchangeGitlabCode("bad", "cid", "csecret", "http://localhost:3001/cb");
    expect(result).toBeNull();
  });

  it("returns null on network error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network error")),
    );

    const result = await exchangeGitlabCode("code", "cid", "csecret", "http://localhost:3001/cb");
    expect(result).toBeNull();
  });

  it("includes client_id and client_secret in the form body (not Basic auth)", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: "gl_access_123",
          token_type: "bearer",
        }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await exchangeGitlabCode("code", "my-client-id", "my-client-secret", "http://localhost:3001/cb");

    const [, opts] = mockFetch.mock.calls[0]!;
    expect(opts.headers["Authorization"]).toBeUndefined();
    const body = new URLSearchParams(opts.body);
    expect(body.get("client_id")).toBe("my-client-id");
    expect(body.get("client_secret")).toBe("my-client-secret");
  });
});

// ---------------------------------------------------------------------------
// refreshGitlabToken
// ---------------------------------------------------------------------------

describe("refreshGitlabToken", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sends grant_type=refresh_token with a form-encoded body", async () => {
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

    await refreshGitlabToken("old_refresh", "cid", "csecret");

    const [, opts] = mockFetch.mock.calls[0]!;
    expect(opts.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    const body = new URLSearchParams(opts.body);
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
            token_type: "bearer",
            refresh_token: "new_refresh",
          }),
      }),
    );

    const result = await refreshGitlabToken("old_refresh", "cid", "csecret");
    expect(result).toEqual({
      ok: true,
      tokens: {
        access_token: "new_access",
        token_type: "bearer",
        refresh_token: "new_refresh",
      },
    });
  });

  it("returns revoked when 400 + invalid_grant", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: "invalid_grant" }),
      }),
    );

    const result = await refreshGitlabToken("revoked", "cid", "csecret");
    expect(result).toEqual({ ok: false, reason: "revoked" });
  });

  it("returns transient on network error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network error")),
    );

    const result = await refreshGitlabToken("refresh", "cid", "csecret");
    expect(result).toEqual({ ok: false, reason: "transient" });
  });

  it("returns transient on 500 server error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }),
    );

    const result = await refreshGitlabToken("refresh", "cid", "csecret");
    expect(result).toEqual({ ok: false, reason: "transient" });
  });

  it("returns transient on timeout (AbortError)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("signal timed out", "AbortError")),
    );

    const result = await refreshGitlabToken("refresh", "cid", "csecret");
    expect(result).toEqual({ ok: false, reason: "transient" });
  });
});

// ---------------------------------------------------------------------------
// fetchGitlabUser
// ---------------------------------------------------------------------------

describe("fetchGitlabUser", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("maps GitLab's username/name/id onto { id, login, full_name, avatar_url }", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 4242,
            username: "gl-user",
            name: "GL User",
            avatar_url: "https://gitlab.com/avatars/4242",
          }),
      }),
    );

    const user = await fetchGitlabUser("gl_access_token");
    expect(user).not.toBeNull();
    expect(user!.id).toBe(4242);
    expect(user!.login).toBe("gl-user");
    expect(user!.full_name).toBe("GL User");
    expect(user!.avatar_url).toBe("https://gitlab.com/avatars/4242");
  });

  it("sends 'Bearer' prefix in Authorization header", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          id: 1,
          username: "gl-user",
          name: "GL User",
          avatar_url: "https://gitlab.com/avatars/1",
        }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await fetchGitlabUser("my_token");

    const [url, opts] = mockFetch.mock.calls[0]!;
    expect(url).toBe("https://gitlab.com/api/v4/user");
    expect(opts.headers["Authorization"]).toBe("Bearer my_token");
  });

  it("returns null on 401 (invalid token)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401 }),
    );

    const user = await fetchGitlabUser("bad-token");
    expect(user).toBeNull();
  });

  it("returns null on network error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network error")),
    );

    const user = await fetchGitlabUser("token");
    expect(user).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// CSRF state helpers
// ---------------------------------------------------------------------------

describe("createGitlabStateCookie", () => {
  it("returns a state value and a Set-Cookie header string", () => {
    const { state, cookie } = createGitlabStateCookie();
    expect(state).toBeTruthy();
    expect(state.length).toBe(32); // 16 bytes hex
    expect(cookie).toContain("chapa_gl_oauth_state=");
    expect(cookie).toContain(state);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Max-Age=600");
  });

  it("generates unique state values each call", () => {
    const a = createGitlabStateCookie();
    const b = createGitlabStateCookie();
    expect(a.state).not.toBe(b.state);
  });
});

describe("validateGitlabState", () => {
  it("returns true when cookie state matches query state", () => {
    const { state, cookie } = createGitlabStateCookie();
    const cookieHeader = cookie.split(";")[0]!;
    expect(validateGitlabState(cookieHeader, state)).toBe(true);
  });

  it("returns false when state values do not match", () => {
    const { cookie } = createGitlabStateCookie();
    const cookieHeader = cookie.split(";")[0]!;
    expect(validateGitlabState(cookieHeader, "wrong-state-value")).toBe(false);
  });

  it("returns false when cookie header is null", () => {
    expect(validateGitlabState(null, "some-state")).toBe(false);
  });

  it("returns false when state param is null", () => {
    const { cookie } = createGitlabStateCookie();
    const cookieHeader = cookie.split(";")[0]!;
    expect(validateGitlabState(cookieHeader, null)).toBe(false);
  });

  it("uses timing-safe comparison (mismatched length fails)", () => {
    const { state, cookie } = createGitlabStateCookie();
    const cookieHeader = cookie.split(";")[0]!;
    expect(validateGitlabState(cookieHeader, state)).toBe(true);
    expect(validateGitlabState(cookieHeader, state + "extra")).toBe(false);
  });
});

describe("clearGitlabStateCookie", () => {
  it("returns a cookie with Max-Age=0", () => {
    const cookie = clearGitlabStateCookie();
    expect(cookie).toContain("chapa_gl_oauth_state=");
    expect(cookie).toContain("Max-Age=0");
  });
});

// ---------------------------------------------------------------------------
// AbortSignal timeout on all fetch calls
// ---------------------------------------------------------------------------

describe("GitLab OAuth fetch AbortSignal timeout", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exchangeGitlabCode passes an AbortSignal to fetch", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ access_token: "tok", token_type: "bearer" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await exchangeGitlabCode("code", "cid", "csecret", "http://localhost:3001/cb");

    const [, opts] = mockFetch.mock.calls[0]!;
    expect(opts.signal).toBeInstanceOf(AbortSignal);
  });

  it("refreshGitlabToken passes an AbortSignal to fetch", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ access_token: "tok", token_type: "bearer" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await refreshGitlabToken("refresh_tok", "cid", "csecret");

    const [, opts] = mockFetch.mock.calls[0]!;
    expect(opts.signal).toBeInstanceOf(AbortSignal);
  });

  it("fetchGitlabUser passes an AbortSignal to fetch", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          id: 1,
          username: "gl-user",
          name: "GL User",
          avatar_url: "https://gitlab.com/avatars/1",
        }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await fetchGitlabUser("access_tok");

    const [, opts] = mockFetch.mock.calls[0]!;
    expect(opts.signal).toBeInstanceOf(AbortSignal);
  });

  it("returns null when fetch aborts due to timeout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("signal timed out", "AbortError")),
    );

    const result = await exchangeGitlabCode("code", "cid", "csecret", "http://localhost:3001/cb");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Cookie Secure flag (conditional on HTTPS)
// ---------------------------------------------------------------------------

describe("GitLab cookie Secure flag", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("state cookie includes Secure when base URL is HTTPS", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://chapa.thecreativetoken.com");
    const { cookie } = createGitlabStateCookie();
    expect(cookie).toContain("Secure");
  });

  it("state cookie omits Secure when base URL is HTTP", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "http://localhost:3001");
    const { cookie } = createGitlabStateCookie();
    expect(cookie).not.toContain("Secure");
  });
});

// ---------------------------------------------------------------------------
// Token expiry helpers — reused from bitbucket module
// ---------------------------------------------------------------------------

describe("Token expiry helpers (reused from bitbucket)", () => {
  it("computeTokenExpiry returns a date in the future", () => {
    const before = Date.now();
    const result = computeTokenExpiry(7200);
    const after = Date.now();
    expect(result.getTime()).toBeGreaterThanOrEqual(before + 7200 * 1000);
    expect(result.getTime()).toBeLessThanOrEqual(after + 7200 * 1000);
  });

  it("isTokenExpired returns true for null expiresAt", () => {
    expect(isTokenExpired(null)).toBe(true);
  });

  it("isTokenExpired returns false for fresh token", () => {
    const future = new Date(Date.now() + 60 * 60 * 1000);
    expect(isTokenExpired(future)).toBe(false);
  });
});
