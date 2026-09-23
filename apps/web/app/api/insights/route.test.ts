import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { MAX_INSIGHTS_BYTES } from "@/lib/insights/validation";

// ---------------------------------------------------------------------------
// Mocks — hoisted before any imports that depend on them
// ---------------------------------------------------------------------------

const {
  mockResolveRequestAuth,
  mockRateLimit,
  mockIsInsightsEnabled,
  mockGetClientIp,
} = vi.hoisted(() => ({
  mockResolveRequestAuth: vi.fn(),
  mockRateLimit: vi.fn(),
  mockIsInsightsEnabled: vi.fn(),
  mockGetClientIp: vi.fn(),
}));

vi.mock("@/lib/auth/resolve-request-auth", () => ({
  resolveRequestAuth: mockResolveRequestAuth,
}));

vi.mock("@/lib/cache/redis", () => ({
  rateLimit: mockRateLimit,
  rateLimitStrict: mockRateLimit,
}));

vi.mock("@/lib/feature-flags", () => ({
  isInsightsEnabled: mockIsInsightsEnabled,
}));

vi.mock("@/lib/http/client-ip", () => ({
  NO_TRUSTED_IP: "unknown",
  getClientIp: mockGetClientIp,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import handler AFTER mocks
// ---------------------------------------------------------------------------

import { POST } from "./route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AUTH = { handle: "juan294" };

/** The retired v6 InsightsUpload shape — carries no `schemaVersion`, so it
 * now falls through every recognized branch to the generic 400. */
function legacyUploadShape(): Record<string, unknown> {
  return {
    tool: "claude-code",
    reportPeriod: { start: "2026-02-20", end: "2026-03-07" },
    volume: { messages: 549, linesAdded: 16843, linesDeleted: 1230, files: 290, days: 9, msgsPerDay: 61 },
    totalSessions: 66,
    totalToolCalls: 2521,
  };
}

function makePostRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("https://chapa.thecreativetoken.com/api/insights", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockIsInsightsEnabled.mockResolvedValue(true);
  mockResolveRequestAuth.mockResolvedValue(AUTH);
  mockRateLimit.mockResolvedValue({ allowed: true, current: 1, limit: 10 });
  mockGetClientIp.mockReturnValue("127.0.0.1");
});

// ---------------------------------------------------------------------------
// POST /api/insights
// ---------------------------------------------------------------------------

describe("POST /api/insights", () => {
  // #1335 phase 5 — the v6 legacy InsightsUpload/computeCraftScore/
  // dbUpsertToolInsights path is retired. A shape with no schemaVersion is
  // now simply invalid input.
  it("returns 400 for the retired legacy upload shape (no schemaVersion)", async () => {
    const resp = await POST(makePostRequest(legacyUploadShape()));
    expect(resp.status).toBe(400);
    const body = await resp.json();
    expect(body.error).toBe("Invalid insights data");
  });

  it("returns 401 when no auth", async () => {
    mockResolveRequestAuth.mockResolvedValue(null);
    const resp = await POST(makePostRequest(legacyUploadShape()));
    expect(resp.status).toBe(401);
  });

  it("accepts Bearer token authentication before evaluating the body", async () => {
    mockResolveRequestAuth.mockResolvedValue({ handle: "cli-user" });
    const req = new NextRequest("https://chapa.thecreativetoken.com/api/insights", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer cli.token.here",
      },
      body: JSON.stringify(legacyUploadShape()),
    });
    const resp = await POST(req);
    expect(mockResolveRequestAuth).toHaveBeenCalled();
    expect(resp.status).toBe(400); // still invalid shape, but auth ran
  });

  it("returns 400 on invalid JSON body", async () => {
    const req = new NextRequest("https://chapa.thecreativetoken.com/api/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    const resp = await POST(req);
    expect(resp.status).toBe(400);
    const body = await resp.json();
    expect(body.error).toBe("Invalid JSON body");
  });

  it("returns 413 for bodies larger than 256 KB before parsing", async () => {
    const tooLargeRequest = new NextRequest(
      "https://chapa.thecreativetoken.com/api/insights",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_data: "x".repeat(MAX_INSIGHTS_BYTES + 1) }),
      },
    );

    const resp = await POST(tooLargeRequest);

    expect(resp.status).toBe(413);
  });

  it("returns 403 when feature is disabled", async () => {
    mockIsInsightsEnabled.mockResolvedValue(false);
    const resp = await POST(makePostRequest(legacyUploadShape()));
    expect(resp.status).toBe(403);
  });

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, current: 11, limit: 10 });
    const resp = await POST(makePostRequest(legacyUploadShape()));
    expect(resp.status).toBe(429);
  });

  it("rejects a negotiated non-v7.2 policy header before reading the body", async () => {
    const resp = await POST(makePostRequest(legacyUploadShape(), { "X-Chapa-Scoring-Policy": "v6" }));
    expect(resp.status).toBe(409);
    const body = await resp.json();
    expect(body).toMatchObject({ error: "policy_changed", persisted: false });
  });

  it("accepts a negotiated v7.2 policy header and proceeds to shape validation", async () => {
    const resp = await POST(makePostRequest(legacyUploadShape(), { "X-Chapa-Scoring-Policy": "v7.2" }));
    // Header matches; falls through to the ordinary invalid-shape 400, not 409.
    expect(resp.status).toBe(400);
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  it("re-throws when resolveRequestAuth throws (handled by withErrorCapture)", async () => {
    mockResolveRequestAuth.mockRejectedValue(new Error("Auth service down"));

    await expect(POST(makePostRequest(legacyUploadShape()))).rejects.toThrow("Auth service down");
  });

  // -------------------------------------------------------------------------
  // BE-H2 (#860): IP rate-limit must fire BEFORE resolveRequestAuth
  // -------------------------------------------------------------------------

  it("applies IP rate-limit before resolveRequestAuth to prevent resource amplification (BE-H2)", async () => {
    const ipRlCallOrder: number[] = [];
    const authCallOrder: number[] = [];
    let callCounter = 0;

    mockRateLimit.mockImplementation((key: string) => {
      if (key.startsWith("ratelimit:insights-ip:")) {
        ipRlCallOrder.push(++callCounter);
      }
      return Promise.resolve({ allowed: true, current: 1, limit: 10 });
    });

    mockResolveRequestAuth.mockImplementation(() => {
      authCallOrder.push(++callCounter);
      return Promise.resolve(AUTH);
    });

    await POST(makePostRequest(legacyUploadShape()));

    expect(ipRlCallOrder.length).toBeGreaterThan(0);
    expect(authCallOrder.length).toBeGreaterThan(0);
    expect(ipRlCallOrder[0]).toBeLessThan(authCallOrder[0]!);
  });

  it("returns 429 on IP rate-limit exceeded without calling resolveRequestAuth", async () => {
    mockRateLimit.mockImplementation((key: string) => {
      if (key.startsWith("ratelimit:insights-ip:")) {
        return Promise.resolve({ allowed: false, current: 11, limit: 10 });
      }
      return Promise.resolve({ allowed: true, current: 1, limit: 10 });
    });

    const resp = await POST(makePostRequest(legacyUploadShape()));

    expect(resp.status).toBe(429);
    expect(mockResolveRequestAuth).not.toHaveBeenCalled();
  });
});
