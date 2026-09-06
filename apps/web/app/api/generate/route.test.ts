import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// Mock dependencies before imports
vi.mock("@/lib/auth/require-session", () => ({
  requireSession: vi.fn(),
}));

vi.mock("@/lib/github/client", () => ({
  getStats: vi.fn(),
}));

vi.mock("@/lib/impact/v6", () => ({
  computeImpactV6: vi.fn(),
}));

vi.mock("@/lib/cache/redis", () => ({
  rateLimit: vi.fn(),
}));

vi.mock("@/lib/auth/github-session-token", () => ({
  getSessionGitHubToken: vi.fn(),
}));

vi.mock("@/lib/platform/source-diagnostics", () => ({
  findUnusableSourceLinks: vi.fn(),
}));

import { POST } from "./route";
import { requireSession } from "@/lib/auth/require-session";
import { getStats } from "@/lib/github/client";
import { computeImpactV6 } from "@/lib/impact/v6";
import { rateLimit } from "@/lib/cache/redis";
import { getSessionGitHubToken } from "@/lib/auth/github-session-token";
import { findUnusableSourceLinks } from "@/lib/platform/source-diagnostics";
import type { StatsData, ImpactV6Result } from "@chapa/shared";

const mockRequireSession = vi.mocked(requireSession);
const mockGetStats = vi.mocked(getStats);
const mockComputeImpact = vi.mocked(computeImpactV6);
const mockRateLimit = vi.mocked(rateLimit);
const mockGetSessionGitHubToken = vi.mocked(getSessionGitHubToken);
const mockFindUnusableSourceLinks = vi.mocked(findUnusableSourceLinks);

function makeRequest(cookie?: string): NextRequest {
  const req = new NextRequest("http://localhost:3001/api/generate", {
    method: "POST",
    headers: cookie ? { cookie } : {},
  });
  return req;
}

const SESSION = {
  login: "juan294",
  name: "Juan",
  avatar_url: "https://example.com/avatar.png",
};

describe("POST /api/generate", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockRateLimit.mockResolvedValue({ allowed: true, current: 1, limit: 10 });
    mockGetSessionGitHubToken.mockResolvedValue("ghp_test");
    mockFindUnusableSourceLinks.mockResolvedValue([]);
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
    const fakeImpact = { archetype: "Builder", adjustedComposite: 72 } as unknown as ImpactV6Result;
    mockGetStats.mockResolvedValue(fakeStats);
    mockComputeImpact.mockReturnValue(fakeImpact);

    const res = await POST(makeRequest("chapa_session=abc"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.handle).toBe("juan294");
  });

  it("calls getStats with the stored GitHub token", async () => {
    mockRequireSession.mockReturnValue({ session: SESSION });
    mockGetStats.mockResolvedValue({ handle: "juan294" } as unknown as StatsData);
    mockComputeImpact.mockReturnValue({ archetype: "Builder" } as unknown as ImpactV6Result);

    await POST(makeRequest("chapa_session=abc"));

    expect(mockGetStats).toHaveBeenCalledWith("juan294", "ghp_test");
  });

  it("returns 401 when no GitHub token is stored for the session", async () => {
    mockRequireSession.mockReturnValue({ session: SESSION });
    mockGetSessionGitHubToken.mockResolvedValue(null);

    const res = await POST(makeRequest("chapa_session=abc"));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Reauthentication required" });
    expect(mockGetStats).not.toHaveBeenCalled();
  });

  it("returns 502 when both the session-token and server-token fetches fail", async () => {
    mockRequireSession.mockReturnValue({ session: SESSION });
    mockGetStats.mockResolvedValue(null);
    mockFindUnusableSourceLinks.mockResolvedValue([]);

    const res = await POST(makeRequest("chapa_session=abc"));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toContain("Failed to fetch");
    expect(mockGetStats).toHaveBeenCalledTimes(2);
    expect(mockGetStats).toHaveBeenNthCalledWith(1, "juan294", "ghp_test");
    expect(mockGetStats).toHaveBeenNthCalledWith(2, "juan294");
  });

  // A connected platform whose token cannot be refreshed makes getStats null.
  // Retrying is useless, so the response has to name the connection.
  it("returns 409 naming the connections that blocked the fetch", async () => {
    mockRequireSession.mockReturnValue({ session: SESSION });
    mockGetStats.mockResolvedValue(null);
    mockFindUnusableSourceLinks.mockResolvedValue(["bitbucket", "gitlab"]);

    const res = await POST(makeRequest("chapa_session=abc"));

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.staleSources).toEqual(["bitbucket", "gitlab"]);
    expect(body.error).toContain("bitbucket");
    expect(mockFindUnusableSourceLinks).toHaveBeenCalledWith("juan294");
  });

  // #1282/#1283 — a first-time handle has no baseline, so a session-token
  // fetch that times out or is rejected by the integrity guard (private-only
  // PR history under a token with no `repo` scope) returns null. Retrying
  // with the SAME token cannot succeed; the tokenless call authenticates as
  // the repo-scoped server GITHUB_TOKEN and can.
  it("falls back to a tokenless (server-token) fetch when the session-token fetch returns null", async () => {
    mockRequireSession.mockReturnValue({ session: SESSION });
    const fakeStats = { handle: "juan294", commitsTotal: 7 } as unknown as StatsData;
    mockGetStats.mockResolvedValueOnce(null).mockResolvedValueOnce(fakeStats);
    mockComputeImpact.mockReturnValue({ archetype: "Emerging" } as unknown as ImpactV6Result);

    const res = await POST(makeRequest("chapa_session=abc"));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ success: true, handle: "juan294" });
    expect(mockGetStats).toHaveBeenCalledTimes(2);
    expect(mockGetStats).toHaveBeenNthCalledWith(1, "juan294", "ghp_test");
    // Exactly one argument: an explicit `undefined` token would be a
    // different call shape and is not what getStats' scope classifier expects.
    expect(mockGetStats.mock.calls[1]).toEqual(["juan294"]);
    expect(mockComputeImpact).toHaveBeenCalledWith(fakeStats);
  });

  it("does not fall back when the session-token fetch succeeds", async () => {
    mockRequireSession.mockReturnValue({ session: SESSION });
    mockGetStats.mockResolvedValue({ handle: "juan294" } as unknown as StatsData);
    mockComputeImpact.mockReturnValue({ archetype: "Builder" } as unknown as ImpactV6Result);

    await POST(makeRequest("chapa_session=abc"));

    expect(mockGetStats).toHaveBeenCalledTimes(1);
  });

  it("re-throws when an unexpected error is thrown (handled by withErrorCapture)", async () => {
    mockRequireSession.mockReturnValue({ session: SESSION });
    mockGetStats.mockRejectedValue(new Error("unexpected boom"));

    await expect(POST(makeRequest("chapa_session=abc"))).rejects.toThrow("unexpected boom");
  });
});
