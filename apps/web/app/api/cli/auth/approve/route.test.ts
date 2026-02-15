import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: vi.fn(),
}));

vi.mock("@/lib/cache/redis", () => ({
  cacheSet: vi.fn(),
}));

import { POST } from "./route";
import { requireSession } from "@/lib/auth/require-session";
import { cacheSet } from "@/lib/cache/redis";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SESSION = {
  token: "ghp_fake",
  login: "testuser",
  name: "Test User",
  avatar_url: "https://example.com/avatar.png",
};

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
  vi.mocked(requireSession).mockReturnValue({ session: SESSION });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/cli/auth/approve", () => {
  it("returns 503 when Redis write fails", async () => {
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
    vi.mocked(requireSession).mockReturnValue({
      error: NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      ),
    });

    const res = await POST(
      makeRequest(
        { sessionId: "1feae8e3-6bc0-47da-84aa-0e24e2510454" },
        "chapa_session=invalid",
      ),
    );

    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid session ID format", async () => {
    const res = await POST(
      makeRequest({ sessionId: "not-a-uuid" }, "chapa_session=valid"),
    );

    expect(res.status).toBe(400);
  });

  it("returns 500 when NEXTAUTH_SECRET is missing", async () => {
    vi.mocked(requireSession).mockReturnValue({
      error: NextResponse.json(
        { error: "Server misconfigured" },
        { status: 500 },
      ),
    });

    const res = await POST(
      makeRequest(
        { sessionId: "1feae8e3-6bc0-47da-84aa-0e24e2510454" },
        "chapa_session=valid",
      ),
    );

    expect(res.status).toBe(500);
  });
});
