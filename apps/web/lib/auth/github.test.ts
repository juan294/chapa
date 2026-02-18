import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildAuthUrl,
  exchangeCodeForToken,
  fetchGitHubUser,
  fetchGitHubUserEmail,
  encryptToken,
  decryptToken,
  createStateCookie,
  validateState,
  createSessionCookie,
  clearSessionCookie,
  clearStateCookie,
  readSessionCookie,
} from "./github";

// ---------------------------------------------------------------------------
// buildAuthUrl
// ---------------------------------------------------------------------------

describe("buildAuthUrl", () => {
  it("returns a GitHub OAuth URL with correct client_id", () => {
    const url = buildAuthUrl("test-client-id", "http://localhost:3000/api/auth/callback", "test-state");
    const parsed = new URL(url);
    expect(parsed.origin).toBe("https://github.com");
    expect(parsed.pathname).toBe("/login/oauth/authorize");
    expect(parsed.searchParams.get("client_id")).toBe("test-client-id");
  });

  it("includes the redirect_uri", () => {
    const url = buildAuthUrl("cid", "http://localhost:3000/api/auth/callback", "test-state");
    const parsed = new URL(url);
    expect(parsed.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3000/api/auth/callback"
    );
  });

  it("requests read:user and user:email scopes", () => {
    const url = buildAuthUrl("cid", "http://localhost:3000/api/auth/callback", "test-state");
    const parsed = new URL(url);
    const scope = parsed.searchParams.get("scope")!;
    expect(scope).toContain("read:user");
    expect(scope).toContain("user:email");
  });

  it("includes the provided state parameter for CSRF protection", () => {
    const url = buildAuthUrl("cid", "http://localhost:3000/api/auth/callback", "my-csrf-state-123");
    const parsed = new URL(url);
    expect(parsed.searchParams.get("state")).toBe("my-csrf-state-123");
  });
});

// ---------------------------------------------------------------------------
// exchangeCodeForToken
// ---------------------------------------------------------------------------

describe("exchangeCodeForToken", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sends code to GitHub and returns access_token on success", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ access_token: "gho_abc123", token_type: "bearer" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const token = await exchangeCodeForToken("code123", "cid", "csecret");
    expect(token).toBe("gho_abc123");
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [url, opts] = mockFetch.mock.calls[0]!;
    expect(url).toBe("https://github.com/login/oauth/access_token");
    expect(opts.method).toBe("POST");
    expect(opts.headers["Accept"]).toBe("application/json");
  });

  it("returns null when GitHub returns an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ error: "bad_verification_code" }),
      })
    );

    const token = await exchangeCodeForToken("bad", "cid", "csecret");
    expect(token).toBeNull();
  });

  it("returns null when fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network error"))
    );

    const token = await exchangeCodeForToken("code", "cid", "csecret");
    expect(token).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// fetchGitHubUser
// ---------------------------------------------------------------------------

describe("fetchGitHubUser", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns user data on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            login: "juan294",
            name: "Juan",
            avatar_url: "https://avatars.githubusercontent.com/u/123",
          }),
      })
    );

    const user = await fetchGitHubUser("gho_abc123");
    expect(user).not.toBeNull();
    expect(user!.login).toBe("juan294");
    expect(user!.name).toBe("Juan");
    expect(user!.avatar_url).toBeTruthy();
  });

  it("returns null on API failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401 })
    );

    const user = await fetchGitHubUser("bad-token");
    expect(user).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// fetchGitHubUserEmail
// ---------------------------------------------------------------------------

describe("fetchGitHubUserEmail", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the primary verified email", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            { email: "secondary@example.com", primary: false, verified: true },
            { email: "primary@example.com", primary: true, verified: true },
          ]),
      })
    );

    const email = await fetchGitHubUserEmail("gho_abc123");
    expect(email).toBe("primary@example.com");
  });

  it("returns null when no primary verified email exists", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            { email: "unverified@example.com", primary: true, verified: false },
            { email: "secondary@example.com", primary: false, verified: true },
          ]),
      })
    );

    const email = await fetchGitHubUserEmail("gho_abc123");
    expect(email).toBeNull();
  });

  it("returns null when email list is empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      })
    );

    const email = await fetchGitHubUserEmail("gho_abc123");
    expect(email).toBeNull();
  });

  it("returns null on API failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 403 })
    );

    const email = await fetchGitHubUserEmail("bad-token");
    expect(email).toBeNull();
  });

  it("returns null on network error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network error"))
    );

    const email = await fetchGitHubUserEmail("gho_abc123");
    expect(email).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// encryptToken / decryptToken
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// CSRF state cookie
// ---------------------------------------------------------------------------

describe("createStateCookie", () => {
  it("returns a state value and a Set-Cookie header string", () => {
    const { state, cookie } = createStateCookie();
    expect(state).toBeTruthy();
    expect(state.length).toBe(32); // 16 bytes hex
    expect(cookie).toContain("chapa_oauth_state=");
    expect(cookie).toContain(state);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Max-Age=600");
  });

  it("generates unique state values each call", () => {
    const a = createStateCookie();
    const b = createStateCookie();
    expect(a.state).not.toBe(b.state);
  });
});

describe("validateState", () => {
  it("returns true when cookie state matches query state", () => {
    const { state, cookie } = createStateCookie();
    // Extract just the cookie key=value part (before the flags)
    const cookieHeader = cookie.split(";")[0]!;
    expect(validateState(cookieHeader, state)).toBe(true);
  });

  it("returns false when state values do not match", () => {
    const { cookie } = createStateCookie();
    const cookieHeader = cookie.split(";")[0]!;
    expect(validateState(cookieHeader, "wrong-state-value")).toBe(false);
  });

  it("returns false when cookie header is null", () => {
    expect(validateState(null, "some-state")).toBe(false);
  });

  it("returns false when state param is null", () => {
    const { cookie } = createStateCookie();
    const cookieHeader = cookie.split(";")[0]!;
    expect(validateState(cookieHeader, null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Token encryption
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Cookie Secure flag (conditional on HTTPS)
// ---------------------------------------------------------------------------

describe("cookie Secure flag", () => {
  const originalEnv = process.env.NEXT_PUBLIC_BASE_URL;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.NEXT_PUBLIC_BASE_URL = originalEnv;
    } else {
      delete process.env.NEXT_PUBLIC_BASE_URL;
    }
  });

  it("session cookie includes Secure when base URL is HTTPS", () => {
    process.env.NEXT_PUBLIC_BASE_URL = "https://chapa.thecreativetoken.com";
    const cookie = createSessionCookie(
      { token: "t", login: "u", name: null, avatar_url: "" },
      "secret-key-for-test-32-chars!!!!",
    );
    expect(cookie).toContain("Secure");
  });

  it("session cookie omits Secure when base URL is HTTP", () => {
    process.env.NEXT_PUBLIC_BASE_URL = "http://localhost:3001";
    const cookie = createSessionCookie(
      { token: "t", login: "u", name: null, avatar_url: "" },
      "secret-key-for-test-32-chars!!!!",
    );
    expect(cookie).not.toContain("Secure");
  });

  it("state cookie omits Secure when base URL is HTTP", () => {
    process.env.NEXT_PUBLIC_BASE_URL = "http://localhost:3001";
    const { cookie } = createStateCookie();
    expect(cookie).not.toContain("Secure");
  });

  it("clear cookies omit Secure when base URL is HTTP", () => {
    process.env.NEXT_PUBLIC_BASE_URL = "http://localhost:3001";
    expect(clearSessionCookie()).not.toContain("Secure");
    expect(clearStateCookie()).not.toContain("Secure");
  });

  it("session cookie roundtrips correctly (encrypt+decrypt)", () => {
    process.env.NEXT_PUBLIC_BASE_URL = "http://localhost:3001";
    const secret = "secret-key-for-test-32-chars!!!!";
    const payload = { token: "gho_abc", login: "juan294", name: "Juan", avatar_url: "https://img" };
    const cookie = createSessionCookie(payload, secret);
    const cookieHeader = cookie.split(";")[0]!; // just the name=value part
    const result = readSessionCookie(cookieHeader, secret);
    expect(result).toEqual(payload);
  });
});

describe("token encryption", () => {
  const secret = "test-secret-key-at-least-32-chars!!";

  it("encrypts and decrypts a token roundtrip", () => {
    const token = "gho_abc123456789";
    const encrypted = encryptToken(token, secret);
    expect(encrypted).not.toBe(token);
    expect(encrypted.length).toBeGreaterThan(0);

    const decrypted = decryptToken(encrypted, secret);
    expect(decrypted).toBe(token);
  });

  it("returns different ciphertext for same plaintext (random IV)", () => {
    const token = "gho_same_token";
    const a = encryptToken(token, secret);
    const b = encryptToken(token, secret);
    expect(a).not.toBe(b);
  });

  it("returns null for tampered ciphertext", () => {
    const encrypted = encryptToken("gho_test", secret);
    const tampered = encrypted.slice(0, -2) + "xx";
    const result = decryptToken(tampered, secret);
    expect(result).toBeNull();
  });

  it("returns null for wrong secret", () => {
    const encrypted = encryptToken("gho_test", secret);
    const result = decryptToken(encrypted, "wrong-secret-key-at-least-32-char!!");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// readSessionCookie — shape validation
// ---------------------------------------------------------------------------

describe("readSessionCookie — shape validation", () => {
  const secret = "secret-key-for-test-32-chars!!!!";

  beforeEach(() => {
    process.env.NEXT_PUBLIC_BASE_URL = "http://localhost:3001";
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_BASE_URL;
  });

  it("returns null for session with missing login field", () => {
    // Encrypt an object that lacks the `login` field
    const badPayload = JSON.stringify({ token: "t", name: null, avatar_url: "https://img" });
    const encrypted = encryptToken(badPayload, secret);
    const cookieHeader = `chapa_session=${encrypted}`;
    const result = readSessionCookie(cookieHeader, secret);
    expect(result).toBeNull();
  });

  it("returns null for session with missing token field", () => {
    const badPayload = JSON.stringify({ login: "user", name: null, avatar_url: "https://img" });
    const encrypted = encryptToken(badPayload, secret);
    const cookieHeader = `chapa_session=${encrypted}`;
    const result = readSessionCookie(cookieHeader, secret);
    expect(result).toBeNull();
  });

  it("returns null for session where name is a number instead of string|null", () => {
    const badPayload = JSON.stringify({ token: "t", login: "user", name: 42, avatar_url: "https://img" });
    const encrypted = encryptToken(badPayload, secret);
    const cookieHeader = `chapa_session=${encrypted}`;
    const result = readSessionCookie(cookieHeader, secret);
    expect(result).toBeNull();
  });

  it("returns a valid payload when shape is correct", () => {
    const goodPayload = { token: "gho_abc", login: "juan294", name: "Juan", avatar_url: "https://img" };
    const cookie = createSessionCookie(goodPayload, secret);
    const cookieHeader = cookie.split(";")[0]!;
    const result = readSessionCookie(cookieHeader, secret);
    expect(result).toEqual(goodPayload);
  });
});
