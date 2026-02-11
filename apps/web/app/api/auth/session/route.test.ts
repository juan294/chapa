import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock dependencies BEFORE importing the route handler.
// ---------------------------------------------------------------------------

const { mockReadSessionCookie } = vi.hoisted(() => ({
  mockReadSessionCookie: vi.fn(),
}));

vi.mock("@/lib/auth/github", () => ({
  readSessionCookie: mockReadSessionCookie,
}));

import { GET } from "./route";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(cookie?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (cookie) headers["cookie"] = cookie;
  return new NextRequest(
    "https://chapa.thecreativetoken.com/api/auth/session",
    { headers },
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/auth/session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXTAUTH_SECRET", "test-secret-key");
  });

  it("returns { user: null } when no session cookie is present", async () => {
    mockReadSessionCookie.mockReturnValue(null);

    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ user: null });
  });

  it("returns user data when a valid session cookie exists", async () => {
    mockReadSessionCookie.mockReturnValue({
      token: "gho_secret_token_123",
      login: "octocat",
      name: "The Octocat",
      avatar_url: "https://avatars.githubusercontent.com/u/583231",
    });

    const res = await GET(
      makeRequest("chapa_session=encrypted-cookie-value"),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.user).toEqual({
      login: "octocat",
      name: "The Octocat",
      avatar_url: "https://avatars.githubusercontent.com/u/583231",
    });
  });

  it("does NOT expose the token in the response", async () => {
    mockReadSessionCookie.mockReturnValue({
      token: "gho_secret_token_123",
      login: "octocat",
      name: "The Octocat",
      avatar_url: "https://avatars.githubusercontent.com/u/583231",
    });

    const res = await GET(
      makeRequest("chapa_session=encrypted-cookie-value"),
    );

    const json = await res.json();
    expect(json.user.token).toBeUndefined();
    expect(JSON.stringify(json)).not.toContain("gho_secret_token_123");
  });

  it("returns { user: null } when session cookie is invalid/corrupted", async () => {
    mockReadSessionCookie.mockReturnValue(null);

    const res = await GET(
      makeRequest("chapa_session=corrupted-garbage-data"),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ user: null });
  });

  it("passes the cookie header and secret to readSessionCookie", async () => {
    mockReadSessionCookie.mockReturnValue(null);

    const cookieStr = "chapa_session=some-encrypted-value";
    await GET(makeRequest(cookieStr));

    expect(mockReadSessionCookie).toHaveBeenCalledWith(
      cookieStr,
      "test-secret-key",
    );
  });

  it("returns { user: null } when NEXTAUTH_SECRET is not set", async () => {
    vi.stubEnv("NEXTAUTH_SECRET", "");

    const res = await GET(
      makeRequest("chapa_session=encrypted-cookie-value"),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ user: null });
    // readSessionCookie should NOT be called when no secret
    expect(mockReadSessionCookie).not.toHaveBeenCalled();
  });

  it("handles user with null name", async () => {
    mockReadSessionCookie.mockReturnValue({
      token: "gho_token",
      login: "anonymous-dev",
      name: null,
      avatar_url: "https://avatars.githubusercontent.com/u/1",
    });

    const res = await GET(
      makeRequest("chapa_session=encrypted-cookie-value"),
    );

    const json = await res.json();
    expect(json.user).toEqual({
      login: "anonymous-dev",
      name: null,
      avatar_url: "https://avatars.githubusercontent.com/u/1",
    });
  });

  it("sets Cache-Control: no-store, private header", async () => {
    mockReadSessionCookie.mockReturnValue({
      token: "gho_token",
      login: "octocat",
      name: "The Octocat",
      avatar_url: "https://avatars.githubusercontent.com/u/583231",
    });

    const res = await GET(
      makeRequest("chapa_session=encrypted-cookie-value"),
    );

    expect(res.headers.get("Cache-Control")).toBe("no-store, private");
  });

  it("sets Cache-Control: no-store, private even when no session", async () => {
    mockReadSessionCookie.mockReturnValue(null);

    const res = await GET(makeRequest());

    expect(res.headers.get("Cache-Control")).toBe("no-store, private");
  });
});
