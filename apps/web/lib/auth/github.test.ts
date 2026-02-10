import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildAuthUrl,
  exchangeCodeForToken,
  fetchGitHubUser,
  encryptToken,
  decryptToken,
} from "./github";

// ---------------------------------------------------------------------------
// buildAuthUrl
// ---------------------------------------------------------------------------

describe("buildAuthUrl", () => {
  it("returns a GitHub OAuth URL with correct client_id", () => {
    const url = buildAuthUrl("test-client-id", "http://localhost:3000/api/auth/callback");
    const parsed = new URL(url);
    expect(parsed.origin).toBe("https://github.com");
    expect(parsed.pathname).toBe("/login/oauth/authorize");
    expect(parsed.searchParams.get("client_id")).toBe("test-client-id");
  });

  it("includes the redirect_uri", () => {
    const url = buildAuthUrl("cid", "http://localhost:3000/api/auth/callback");
    const parsed = new URL(url);
    expect(parsed.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3000/api/auth/callback"
    );
  });

  it("requests read:user scope", () => {
    const url = buildAuthUrl("cid", "http://localhost:3000/api/auth/callback");
    const parsed = new URL(url);
    expect(parsed.searchParams.get("scope")).toContain("read:user");
  });

  it("includes a state parameter for CSRF protection", () => {
    const url = buildAuthUrl("cid", "http://localhost:3000/api/auth/callback");
    const parsed = new URL(url);
    const state = parsed.searchParams.get("state");
    expect(state).toBeTruthy();
    expect(state!.length).toBeGreaterThanOrEqual(16);
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

    const [url, opts] = mockFetch.mock.calls[0];
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
// encryptToken / decryptToken
// ---------------------------------------------------------------------------

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
