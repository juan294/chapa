import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// Mock dependencies before imports
vi.mock("@/lib/auth/require-session", () => ({
  requireSession: vi.fn(),
}));

vi.mock("@/lib/github/client", () => ({
  getStats: vi.fn(),
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

// #1335 phase 5 — the route no longer reads the retired scoring-render-
// selection flag; it always enqueues collection. Mocked here (rather than
// left to the real Supabase-backed implementation) so this unit suite stays
// isolated and fast, per the Test Conventions module-level mocking rule.
vi.mock("@/lib/profile/post-write-score", () => ({
  enqueueAndReportScoringStatus: vi.fn(async () => null),
}));

vi.mock("@/lib/analytics/server-errors", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/analytics/server-errors")>();
  return {
    ...actual,
    captureServerError: vi.fn().mockResolvedValue(undefined),
    captureServerEvent: vi.fn().mockResolvedValue(undefined),
  };
});

// Capture next/server's after() callbacks instead of running them, so a test
// can assert the warm happens only when the callback runs, never before the
// response (see .claude/rules/post-response-work.md).
const afterCallbacks: Array<() => void | Promise<void>> = [];
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: (cb: () => void | Promise<void>) => {
      afterCallbacks.push(cb);
    },
  };
});

import { POST } from "./route";
import { requireSession } from "@/lib/auth/require-session";
import { getStats } from "@/lib/github/client";
import { rateLimit } from "@/lib/cache/redis";
import { getSessionGitHubToken } from "@/lib/auth/github-session-token";
import { findUnusableSourceLinks } from "@/lib/platform/source-diagnostics";
import { captureServerError } from "@/lib/analytics/server-errors";
import { enqueueAndReportScoringStatus } from "@/lib/profile/post-write-score";
import type { StatsData } from "@chapa/shared";

const mockRequireSession = vi.mocked(requireSession);
const mockGetStats = vi.mocked(getStats);
const mockRateLimit = vi.mocked(rateLimit);
const mockGetSessionGitHubToken = vi.mocked(getSessionGitHubToken);
const mockFindUnusableSourceLinks = vi.mocked(findUnusableSourceLinks);
const mockCaptureServerError = vi.mocked(captureServerError);
const mockEnqueueAndReportScoringStatus = vi.mocked(enqueueAndReportScoringStatus);

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
    afterCallbacks.length = 0;
    mockRateLimit.mockResolvedValue({ allowed: true, current: 1, limit: 10 });
    mockGetSessionGitHubToken.mockResolvedValue("ghp_test");
    mockFindUnusableSourceLinks.mockResolvedValue([]);
    mockEnqueueAndReportScoringStatus.mockResolvedValue(null);
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
    mockGetStats.mockResolvedValue(fakeStats);

    const res = await POST(makeRequest("chapa_session=abc"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.handle).toBe("juan294");
  });

  it("calls getStats with the stored GitHub token", async () => {
    mockRequireSession.mockReturnValue({ session: SESSION });
    mockGetStats.mockResolvedValue({ handle: "juan294" } as unknown as StatsData);

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

  // #1353 — GitHub's contribution query runs close to its ~10s GraphQL
  // limit, so both live attempts can time out. The OAuth callback already
  // queued durable collection, which retries on its own, so a failed warm
  // must not block login: enqueue, report status, and say the warm failed.
  it("still enqueues and succeeds when both the session-token and server-token fetches fail", async () => {
    mockRequireSession.mockReturnValue({ session: SESSION });
    mockGetStats.mockResolvedValue(null);
    mockFindUnusableSourceLinks.mockResolvedValue([]);
    mockEnqueueAndReportScoringStatus.mockResolvedValue({ kind: "collecting", percent: 0, sources: [], hasPriorReceipt: false });

    const res = await POST(makeRequest("chapa_session=abc"));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      success: true,
      handle: "juan294",
      statsWarmed: false,
      scoringStatus: { kind: "collecting", percent: 0, sources: [], hasPriorReceipt: false },
    });
    expect(mockGetStats).toHaveBeenCalledTimes(2);
    expect(mockGetStats).toHaveBeenNthCalledWith(1, "juan294", "ghp_test");
    expect(mockGetStats).toHaveBeenNthCalledWith(2, "juan294");
    expect(mockEnqueueAndReportScoringStatus).toHaveBeenCalledWith("juan294", "signup");
  });

  it("does not enqueue when a stale connection blocked the fetch", async () => {
    mockRequireSession.mockReturnValue({ session: SESSION });
    mockGetStats.mockResolvedValue(null);
    mockFindUnusableSourceLinks.mockResolvedValue(["gitlab"]);

    const res = await POST(makeRequest("chapa_session=abc"));

    expect(res.status).toBe(409);
    expect(mockEnqueueAndReportScoringStatus).not.toHaveBeenCalled();
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

    const res = await POST(makeRequest("chapa_session=abc"));

    expect(res.status).toBe(200);
    // No scoringStatus (mocked null above): the response carries only
    // success + handle — there is no v6 policyVersion fallback any more.
    await expect(res.json()).resolves.toEqual({ success: true, handle: "juan294" });
    expect(mockGetStats).toHaveBeenCalledTimes(2);
    expect(mockGetStats).toHaveBeenNthCalledWith(1, "juan294", "ghp_test");
    // Exactly one argument: an explicit `undefined` token would be a
    // different call shape and is not what getStats' scope classifier expects.
    expect(mockGetStats.mock.calls[1]).toEqual(["juan294"]);
  });

  it("does not fall back when the session-token fetch succeeds", async () => {
    mockRequireSession.mockReturnValue({ session: SESSION });
    mockGetStats.mockResolvedValue({ handle: "juan294" } as unknown as StatsData);

    await POST(makeRequest("chapa_session=abc"));

    expect(mockGetStats).toHaveBeenCalledTimes(1);
  });

  it("re-throws when an unexpected error is thrown (handled by withErrorCapture)", async () => {
    mockRequireSession.mockReturnValue({ session: SESSION });
    mockGetStats.mockRejectedValue(new Error("unexpected boom"));

    await expect(POST(makeRequest("chapa_session=abc"))).rejects.toThrow("unexpected boom");
  });

  it("enqueues collection for the signup reason and reports the returned scoring status", async () => {
    mockRequireSession.mockReturnValue({ session: SESSION });
    mockGetStats.mockResolvedValue({ handle: "juan294" } as unknown as StatsData);
    mockEnqueueAndReportScoringStatus.mockResolvedValue({ kind: "collecting", percent: 0, sources: [], hasPriorReceipt: false });

    const res = await POST(makeRequest("chapa_session=abc"));

    expect(mockEnqueueAndReportScoringStatus).toHaveBeenCalledWith("juan294", "signup");
    await expect(res.json()).resolves.toEqual({
      success: true,
      handle: "juan294",
      scoringStatus: { kind: "collecting", percent: 0, sources: [], hasPriorReceipt: false },
    });
  });

  // LE-5-1 — the share page materializes tokenless (as the server
  // GITHUB_TOKEN), and the stats cache row is bound to the credential that
  // fetched it (lib/platform/source-context.ts hashes the token into
  // accessContextId). A generate that only warmed the session-token row left
  // the owner's very first share-page load on a cold live fetch, which can
  // time out and render the badge beside an empty Impact Breakdown.
  describe("warming the server-token stats row after the response (LE-5-1)", () => {
    it("schedules a tokenless getStats in after() and awaits it only when the callback runs", async () => {
      mockRequireSession.mockReturnValue({ session: SESSION });
      const fakeStats = { handle: "juan294", commitsTotal: 100 } as unknown as StatsData;
      mockGetStats.mockResolvedValue(fakeStats);

      const res = await POST(makeRequest("chapa_session=abc"));

      expect(res.status).toBe(200);
      // Before the callback runs: only the session-token fetch happened.
      expect(mockGetStats).toHaveBeenCalledTimes(1);
      expect(mockGetStats).toHaveBeenCalledWith("juan294", "ghp_test");
      expect(afterCallbacks).toHaveLength(1);

      let settled = false;
      mockGetStats.mockImplementationOnce(async () => {
        await new Promise((r) => setTimeout(r, 5));
        settled = true;
        return fakeStats;
      });
      await afterCallbacks[0]!();

      expect(settled).toBe(true);
      expect(mockGetStats).toHaveBeenCalledTimes(2);
      // Exactly one argument: the same call shape the share page's
      // materializer makes, so it binds the same cache row.
      expect(mockGetStats.mock.calls[1]).toEqual(["juan294"]);
      expect(mockCaptureServerError).not.toHaveBeenCalled();
    });

    it("captures a warm failure instead of letting the after() callback reject", async () => {
      mockRequireSession.mockReturnValue({ session: SESSION });
      mockGetStats.mockResolvedValue({ handle: "juan294" } as unknown as StatsData);

      const res = await POST(makeRequest("chapa_session=abc"));
      expect(res.status).toBe(200);

      mockGetStats.mockRejectedValueOnce(new Error("graphql timeout"));
      await expect(afterCallbacks[0]!()).resolves.toBeUndefined();

      expect(mockCaptureServerError).toHaveBeenCalledWith(
        expect.objectContaining({
          route: "/api/generate",
          error: expect.objectContaining({ message: "graphql timeout" }),
        }),
      );
    });

    it("schedules no warm when both live fetches fail", async () => {
      mockRequireSession.mockReturnValue({ session: SESSION });
      mockGetStats.mockResolvedValue(null);

      const res = await POST(makeRequest("chapa_session=abc"));

      expect(res.status).toBe(200);
      expect(afterCallbacks).toHaveLength(0);
    });

    it("schedules no warm when the tokenless fallback already fetched the server-token row", async () => {
      mockRequireSession.mockReturnValue({ session: SESSION });
      const fakeStats = { handle: "juan294", commitsTotal: 7 } as unknown as StatsData;
      mockGetStats.mockResolvedValueOnce(null).mockResolvedValueOnce(fakeStats);

      const res = await POST(makeRequest("chapa_session=abc"));

      expect(res.status).toBe(200);
      expect(afterCallbacks).toHaveLength(0);
      expect(mockGetStats).toHaveBeenCalledTimes(2);
    });
  });
});
