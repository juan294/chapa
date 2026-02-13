import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth/github", () => ({
  readSessionCookie: vi.fn(),
}));

vi.mock("@/lib/cache/redis", () => ({
  cacheSet: vi.fn(),
}));

import { POST } from "./route";
import { readSessionCookie } from "@/lib/auth/github";
import { cacheSet } from "@/lib/cache/redis";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: unknown, cookie?: string): Request {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (cookie) headers["cookie"] = cookie;

  return new Request("https://chapa.thecreativetoken.com/api/cli/auth/approve", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXTAUTH_SECRET", "test-secret");
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/cli/auth/approve", () => {
  it("returns 503 when Redis write fails", async () => {
    vi.mocked(readSessionCookie).mockReturnValue({
      token: "ghp_fake",
      login: "testuser",
      name: "Test User",
      avatar_url: "https://example.com/avatar.png",
    });
    vi.mocked(cacheSet).mockResolvedValue(false);

    const res = await POST(
      makeRequest(
        { sessionId: "1feae8e3-6bc0-47da-84aa-0e24e2510454" },
        "chapa_session=valid",
      ),
    );

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toMatch(/unavailable/i);
  });

  it("returns 200 with success when Redis write succeeds", async () => {
    vi.mocked(readSessionCookie).mockReturnValue({
      token: "ghp_fake",
      login: "testuser",
      name: "Test User",
      avatar_url: "https://example.com/avatar.png",
    });
    vi.mocked(cacheSet).mockResolvedValue(true);

    const res = await POST(
      makeRequest(
        { sessionId: "1feae8e3-6bc0-47da-84aa-0e24e2510454" },
        "chapa_session=valid",
      ),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.handle).toBe("testuser");
  });

  it("returns 401 when session cookie is invalid", async () => {
    vi.mocked(readSessionCookie).mockReturnValue(null);

    const res = await POST(
      makeRequest(
        { sessionId: "1feae8e3-6bc0-47da-84aa-0e24e2510454" },
        "chapa_session=invalid",
      ),
    );

    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid session ID format", async () => {
    vi.mocked(readSessionCookie).mockReturnValue({
      token: "ghp_fake",
      login: "testuser",
      name: "Test User",
      avatar_url: "https://example.com/avatar.png",
    });

    const res = await POST(
      makeRequest({ sessionId: "not-a-uuid" }, "chapa_session=valid"),
    );

    expect(res.status).toBe(400);
  });

  it("returns 500 when NEXTAUTH_SECRET is missing", async () => {
    vi.stubEnv("NEXTAUTH_SECRET", "");

    const res = await POST(
      makeRequest(
        { sessionId: "1feae8e3-6bc0-47da-84aa-0e24e2510454" },
        "chapa_session=valid",
      ),
    );

    expect(res.status).toBe(500);
  });
});
