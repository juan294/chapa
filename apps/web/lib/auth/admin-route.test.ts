import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: vi.fn(),
}));

vi.mock("@/lib/auth/admin", () => ({
  isAdminHandle: vi.fn(),
}));

vi.mock("@/lib/cache/redis", () => ({
  rateLimit: vi.fn(),
}));

vi.mock("@/lib/http/client-ip", () => ({
  getClientIp: vi.fn(() => "127.0.0.1"),
}));

import { requireSession } from "@/lib/auth/require-session";
import { isAdminHandle } from "@/lib/auth/admin";
import { rateLimit } from "@/lib/cache/redis";
import { adminAuth } from "./admin-route";

const mockRequireSession = vi.mocked(requireSession);
const mockIsAdmin = vi.mocked(isAdminHandle);
const mockRateLimit = vi.mocked(rateLimit);

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost:3001/api/admin/campaigns", {
    headers: { cookie: "chapa_session=valid" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRateLimit.mockResolvedValue({ allowed: true, current: 1, limit: 10 });
  mockRequireSession.mockReturnValue({
    session: {
      token: "ghp_test",
      login: "admin-user",
      name: "Admin",
      avatar_url: "https://example.com/avatar.png",
    },
  });
  mockIsAdmin.mockReturnValue(true);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("adminAuth", () => {
  it("returns null when auth passes (rate limit + session + admin)", async () => {
    const result = await adminAuth(makeRequest());
    expect(result).toBeNull();
  });

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, current: 11, limit: 10 });

    const result = await adminAuth(makeRequest());

    expect(result).not.toBeNull();
    expect(result!.status).toBe(429);
    const body = await result!.json();
    expect(body.error).toBe("Too many requests");
  });

  it("returns session error when session is invalid", async () => {
    const { NextResponse } = await import("next/server");
    mockRequireSession.mockReturnValue({
      error: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    });

    const result = await adminAuth(makeRequest());

    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  it("returns 403 when user is not admin", async () => {
    mockIsAdmin.mockReturnValue(false);

    const result = await adminAuth(makeRequest());

    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
    const body = await result!.json();
    expect(body.error).toBe("Forbidden");
  });

  it("uses provided rate limit key prefix", async () => {
    await adminAuth(makeRequest(), "ratelimit:custom");

    expect(mockRateLimit).toHaveBeenCalledWith(
      "ratelimit:custom:127.0.0.1",
      10,
      60,
    );
  });

  it("uses custom maxRequests and windowSeconds", async () => {
    await adminAuth(makeRequest(), "ratelimit:test", 5, 120);

    expect(mockRateLimit).toHaveBeenCalledWith(
      "ratelimit:test:127.0.0.1",
      5,
      120,
    );
  });

  it("checks admin handle from the session login", async () => {
    mockRequireSession.mockReturnValue({
      session: {
        token: "ghp_test",
        login: "specific-user",
        name: "User",
        avatar_url: "https://example.com/avatar.png",
      },
    });

    await adminAuth(makeRequest());

    expect(mockIsAdmin).toHaveBeenCalledWith("specific-user");
  });
});
