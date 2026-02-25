import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// Mock dependencies before imports
vi.mock("@/lib/auth/require-session", () => ({
  requireSession: vi.fn(),
}));

vi.mock("@/lib/github/client", () => ({
  getStats: vi.fn(),
}));

vi.mock("@/lib/impact/v4", () => ({
  computeImpactV4: vi.fn(),
}));

vi.mock("@/lib/cache/redis", () => ({
  rateLimit: vi.fn(),
}));

import { POST } from "./route";
import { requireSession } from "@/lib/auth/require-session";
import { getStats } from "@/lib/github/client";
import { computeImpactV4 } from "@/lib/impact/v4";
import { rateLimit } from "@/lib/cache/redis";
import type { StatsData, ImpactV4Result } from "@chapa/shared";

const mockRequireSession = vi.mocked(requireSession);
const mockGetStats = vi.mocked(getStats);
const mockComputeImpact = vi.mocked(computeImpactV4);
const mockRateLimit = vi.mocked(rateLimit);

function makeRequest(cookie?: string): NextRequest {
  const req = new NextRequest("http://localhost:3001/api/generate", {
    method: "POST",
    headers: cookie ? { cookie } : {},
  });
  return req;
}

const SESSION = {
  token: "ghp_test",
  login: "juan294",
  name: "Juan",
  avatar_url: "https://example.com/avatar.png",
};

describe("POST /api/generate", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockRateLimit.mockResolvedValue({ allowed: true, current: 1, limit: 10 });
  });

  it("returns 401 when no session cookie is present", async () => {
    mockRequireSession.mockReturnValue({
      error: NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      ),
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Authentication required");
  });

  it("returns 500 when NEXTAUTH_SECRET is missing", async () => {
    mockRequireSession.mockReturnValue({
      error: NextResponse.json(
        { error: "Server misconfigured" },
        { status: 500 },
      ),
    });
    const res = await POST(makeRequest("chapa_session=abc"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Server misconfigured");
  });

  it("returns 429 when rate-limited", async () => {
    mockRequireSession.mockReturnValue({ session: SESSION });
    mockRateLimit.mockResolvedValue({ allowed: false, current: 11, limit: 10 });

    const res = await POST(makeRequest("chapa_session=abc"));
    expect(res.status).toBe(429);
  });

  it("returns 200 with success when stats are generated", async () => {
    mockRequireSession.mockReturnValue({ session: SESSION });
    const fakeStats = { handle: "juan294", commitsTotal: 100 } as unknown as StatsData;
    const fakeImpact = { archetype: "Builder", adjustedComposite: 72 } as unknown as ImpactV4Result;
    mockGetStats.mockResolvedValue(fakeStats);
    mockComputeImpact.mockReturnValue(fakeImpact);

    const res = await POST(makeRequest("chapa_session=abc"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.handle).toBe("juan294");
  });

  it("calls getStats with the session handle and token", async () => {
    mockRequireSession.mockReturnValue({ session: SESSION });
    mockGetStats.mockResolvedValue({ handle: "juan294" } as unknown as StatsData);
    mockComputeImpact.mockReturnValue({ archetype: "Builder" } as unknown as ImpactV4Result);

    await POST(makeRequest("chapa_session=abc"));

    expect(mockGetStats).toHaveBeenCalledWith("juan294", "ghp_test");
  });

  it("returns 502 when GitHub API fails", async () => {
    mockRequireSession.mockReturnValue({ session: SESSION });
    mockGetStats.mockResolvedValue(null);

    const res = await POST(makeRequest("chapa_session=abc"));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toContain("Failed to fetch");
  });
});
