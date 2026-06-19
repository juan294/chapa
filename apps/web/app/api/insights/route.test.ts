import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { InsightsUpload } from "@chapa/shared";
import { MAX_INSIGHTS_BYTES } from "@/lib/insights/validation";

// ---------------------------------------------------------------------------
// Mocks — hoisted before any imports that depend on them
// ---------------------------------------------------------------------------

const {
  mockResolveRequestAuth,
  mockRateLimit,
  mockCacheDel,
  mockIsInsightsEnabled,
  mockDbUpsert,
  mockDbGet,
  mockGetClientIp,
  mockBuildSnapshotKey,
  mockBuildCraftKey,
  mockInvalidateHistoryCache,
  mockRevalidatePath,
} = vi.hoisted(() => ({
  mockResolveRequestAuth: vi.fn(),
  mockRateLimit: vi.fn(),
  mockCacheDel: vi.fn(),
  mockIsInsightsEnabled: vi.fn(),
  mockDbUpsert: vi.fn(),
  mockDbGet: vi.fn(),
  mockGetClientIp: vi.fn(),
  mockBuildSnapshotKey: vi.fn(),
  mockBuildCraftKey: vi.fn(),
  mockInvalidateHistoryCache: vi.fn(),
  mockRevalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/resolve-request-auth", () => ({
  resolveRequestAuth: mockResolveRequestAuth,
}));

vi.mock("@/lib/cache/redis", () => ({
  rateLimit: mockRateLimit,
  cacheDel: mockCacheDel,
}));

vi.mock("@/lib/cache/snapshot-cache", () => ({
  buildSnapshotKey: mockBuildSnapshotKey,
}));

vi.mock("@/lib/cache/craft-cache", () => ({
  buildCraftKey: mockBuildCraftKey,
}));

vi.mock("@/lib/history/history", () => ({
  invalidateHistoryCache: mockInvalidateHistoryCache,
}));

vi.mock("@/lib/feature-flags", () => ({
  isInsightsEnabled: mockIsInsightsEnabled,
}));

vi.mock("@/lib/db/tool-insights", () => ({
  dbUpsertToolInsights: mockDbUpsert,
  dbGetToolInsights: mockDbGet,
}));

vi.mock("@/lib/http/client-ip", () => ({
  NO_TRUSTED_IP: "unknown",
  getClientIp: mockGetClientIp,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

// Mock next/server's after() to execute callbacks synchronously in tests
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: (cb: () => void | Promise<void>) => { void cb(); },
  };
});

// Re-export real validation and scoring through mocks
vi.mock("@/lib/insights/validation", async () => {
  const actual = await import("../../../lib/insights/validation");
  return actual;
});

vi.mock("@/lib/insights/scoring", async () => {
  const actual = await import("../../../lib/insights/scoring");
  return actual;
});

vi.mock("@/lib/validation", async () => {
  const actual = await import("../../../lib/validation");
  return actual;
});

// ---------------------------------------------------------------------------
// Import handlers AFTER mocks
// ---------------------------------------------------------------------------

import { POST } from "./route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AUTH = { handle: "juan294" };

function makeValidUpload(): InsightsUpload {
  return {
    tool: "claude-code",
    reportPeriod: { start: "2026-02-20", end: "2026-03-07" },
    volume: { messages: 549, linesAdded: 16843, linesDeleted: 1230, files: 290, days: 9, msgsPerDay: 61 },
    toolUsage: { Bash: 1213, Read: 572, Edit: 377, Write: 134, Grep: 115, Agent: 110 },
    sessionTypes: { "Single Task": 16, "Multi Task": 11, "Iterative Refinement": 4, Exploration: 1 },
    outcomes: { fullyAchieved: 24, mostlyAchieved: 6, partiallyAchieved: 2 },
    friction: { buggyCode: 15, wrongApproach: 12, misunderstoodRequest: 4 },
    satisfaction: { dissatisfied: 5, likelySatisfied: 50, satisfied: 19 },
    multiClauding: { overlapEvents: 52, sessionsInvolved: 45, messagePercent: 31 },
    responseTime: { medianSeconds: 80.6, averageSeconds: 188.4 },
    toolErrors: { Other: 87, "Command Failed": 64 },
    totalSessions: 66,
    totalToolCalls: 2521,
  };
}

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest("https://chapa.thecreativetoken.com/api/insights", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function flushAfterCallbacks(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockIsInsightsEnabled.mockResolvedValue(true);
  mockResolveRequestAuth.mockResolvedValue(AUTH);
  mockRateLimit.mockResolvedValue({ allowed: true, current: 1, limit: 10 });
  mockCacheDel.mockResolvedValue(undefined);
  mockDbUpsert.mockResolvedValue(null); // null = fallback to computed scores
  mockDbGet.mockResolvedValue(null);
  mockGetClientIp.mockReturnValue("127.0.0.1");
  mockBuildSnapshotKey.mockImplementation((handle: string) => `snapshot:v2:latest:${handle}`);
  mockBuildCraftKey.mockImplementation((handle: string) => `craft:v2:${handle}`);
  mockInvalidateHistoryCache.mockResolvedValue(undefined);
  mockRevalidatePath.mockImplementation(() => undefined);
});

// ---------------------------------------------------------------------------
// POST /api/insights
// ---------------------------------------------------------------------------

describe("POST /api/insights", () => {
  it("returns 200 with craft score on valid upload", async () => {
    const resp = await POST(makePostRequest(makeValidUpload()));
    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.success).toBe(true);
    expect(body.craftScore).toBeDefined();
    expect(body.craftScore.tool).toBe("claude-code");
    expect(body.craftScore.craftScore).toBeGreaterThan(0);
    expect(body.craftScore.tier).toBeDefined();
    expect(body.craftScore.dimensions.proficiency).toBeGreaterThan(0);
  });

  it("returns 401 when no auth", async () => {
    mockResolveRequestAuth.mockResolvedValue(null);
    const resp = await POST(makePostRequest(makeValidUpload()));
    expect(resp.status).toBe(401);
  });

  it("accepts Bearer token authentication", async () => {
    mockResolveRequestAuth.mockResolvedValue({ handle: "cli-user" });
    const req = new NextRequest("https://chapa.thecreativetoken.com/api/insights", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer cli.token.here",
      },
      body: JSON.stringify(makeValidUpload()),
    });
    const resp = await POST(req);
    expect(resp.status).toBe(200);
    expect(mockResolveRequestAuth).toHaveBeenCalled();
  });

  it("returns 400 on invalid data (missing fields)", async () => {
    const resp = await POST(makePostRequest({ tool: "claude-code" }));
    expect(resp.status).toBe(400);
    const body = await resp.json();
    expect(body.error).toBe("Invalid insights data");
  });

  it("returns 413 for bodies larger than 256 KB before DB insert", async () => {
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
    expect(mockDbUpsert).not.toHaveBeenCalled();
  });

  it("does not expose Zod/validation schema details to caller on invalid data", async () => {
    const resp = await POST(makePostRequest({ tool: "claude-code" }));
    expect(resp.status).toBe(400);
    const body = await resp.json();
    // Must only contain the generic error message — no internal reason/details
    expect(body.reason).toBeUndefined();
    expect(Object.keys(body)).toEqual(["error"]);
  });

  it("returns 403 when feature is disabled", async () => {
    mockIsInsightsEnabled.mockResolvedValue(false);
    const resp = await POST(makePostRequest(makeValidUpload()));
    expect(resp.status).toBe(403);
  });

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, current: 11, limit: 10 });
    const resp = await POST(makePostRequest(makeValidUpload()));
    expect(resp.status).toBe(429);
  });

  it("invalidates badge cache after successful upload", async () => {
    await POST(makePostRequest(makeValidUpload()));
    await flushAfterCallbacks();
    expect(mockCacheDel).toHaveBeenCalledWith("stats:v2:merged:juan294");
  });

  it("invalidates snapshot cache after successful upload", async () => {
    await POST(makePostRequest(makeValidUpload()));
    await flushAfterCallbacks();
    expect(mockCacheDel).toHaveBeenCalledWith("snapshot:v2:latest:juan294");
  });

  it("invalidates craft cache after successful upload", async () => {
    await POST(makePostRequest(makeValidUpload()));
    await flushAfterCallbacks();
    expect(mockCacheDel).toHaveBeenCalledWith("craft:v2:juan294");
  });

  it("invalidates history cache after successful upload", async () => {
    await POST(makePostRequest(makeValidUpload()));
    await flushAfterCallbacks();
    expect(mockInvalidateHistoryCache).toHaveBeenCalledWith("juan294");
  });

  it("revalidates the share page after successful upload", async () => {
    const resp = await POST(makePostRequest(makeValidUpload()));
    await flushAfterCallbacks();

    expect(resp.status).toBe(200);
    expect(mockRevalidatePath).toHaveBeenCalledWith("/u/juan294");
  });

  it("calls dbUpsert with correct arguments", async () => {
    const upload = makeValidUpload();
    await POST(makePostRequest(upload));
    expect(mockDbUpsert).toHaveBeenCalledTimes(1);
    const [handle, data, scores] = mockDbUpsert.mock.calls[0]!;
    expect(handle).toBe("juan294");
    expect(data.tool).toBe("claude-code");
    expect(scores.craftScore).toBeGreaterThan(0);
  });

  it("returns computed scores when DB upsert fails (graceful degradation)", async () => {
    mockDbUpsert.mockResolvedValue(null);
    const resp = await POST(makePostRequest(makeValidUpload()));
    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.success).toBe(true);
    expect(body.craftScore.craftScore).toBeGreaterThan(0);
  });

  it("upserts replace previous data (same handle+tool)", async () => {
    const stored = {
      tool: "claude-code",
      dimensions: { proficiency: 60, effectiveness: 70, sophistication: 50 },
      craftScore: 60,
      tier: "Expert",
      reportPeriod: { start: "2026-02-20", end: "2026-03-07" },
      computedAt: new Date().toISOString(),
    };
    mockDbUpsert.mockResolvedValue(stored);
    const resp = await POST(makePostRequest(makeValidUpload()));
    const body = await resp.json();
    expect(body.craftScore.craftScore).toBe(60);
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  it("re-throws when dbUpsertToolInsights throws (handled by withErrorCapture)", async () => {
    mockDbUpsert.mockRejectedValue(new Error("DB connection lost"));

    await expect(POST(makePostRequest(makeValidUpload()))).rejects.toThrow("DB connection lost");
  });

  it("re-throws when resolveRequestAuth throws (handled by withErrorCapture)", async () => {
    mockResolveRequestAuth.mockRejectedValue(new Error("Auth service down"));

    await expect(POST(makePostRequest(makeValidUpload()))).rejects.toThrow("Auth service down");
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
      } else if (key.startsWith("ratelimit:insights:")) {
        // Per-handle rate limit fires after auth
      }
      return Promise.resolve({ allowed: true, current: 1, limit: 10 });
    });

    mockResolveRequestAuth.mockImplementation(() => {
      authCallOrder.push(++callCounter);
      return Promise.resolve(AUTH);
    });

    await POST(makePostRequest(makeValidUpload()));

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

    const resp = await POST(makePostRequest(makeValidUpload()));

    expect(resp.status).toBe(429);
    expect(mockResolveRequestAuth).not.toHaveBeenCalled();
  });
});
