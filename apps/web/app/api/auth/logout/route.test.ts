import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock dependencies BEFORE importing the route handler.
// ---------------------------------------------------------------------------

const { mockClearSessionCookie } = vi.hoisted(() => ({
  mockClearSessionCookie: vi.fn(),
}));

vi.mock("@/lib/auth/github", () => ({
  clearSessionCookie: mockClearSessionCookie,
}));

import { POST } from "./route";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(): NextRequest {
  return new NextRequest(
    "https://chapa.thecreativetoken.com/api/auth/logout",
    { method: "POST" },
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClearSessionCookie.mockReturnValue(
      "chapa_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0",
    );
  });

  it("returns a redirect response (307)", async () => {
    const res = await POST(makeRequest());

    expect(res.status).toBe(307);
  });

  it("redirects to the root URL", async () => {
    const res = await POST(makeRequest());

    const location = res.headers.get("Location");
    expect(location).toBeTruthy();
    const redirectUrl = new URL(location!);
    expect(redirectUrl.pathname).toBe("/");
  });

  it("sets Set-Cookie header to clear the session cookie", async () => {
    const res = await POST(makeRequest());

    const setCookie = res.headers.get("Set-Cookie");
    expect(setCookie).toBe(
      "chapa_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0",
    );
  });

  it("calls clearSessionCookie to generate the cookie string", async () => {
    await POST(makeRequest());

    expect(mockClearSessionCookie).toHaveBeenCalledOnce();
  });
});
