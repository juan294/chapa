import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { InsightsUpload } from "@chapa/shared";

// ---------------------------------------------------------------------------
// Mocks — hoisted before any imports that depend on them
// ---------------------------------------------------------------------------

const {
  mockRequireSession,
  mockRateLimit,
  mockCacheDel,
  mockIsInsightsEnabled,
  mockDbUpsert,
  mockDbGet,
  mockGetClientIp,
  mockInvalidateSnapshotCache,
} = vi.hoisted(() => ({
  mockRequireSession: vi.fn(),
  mockRateLimit: vi.fn(),
  mockCacheDel: vi.fn(),
  mockIsInsightsEnabled: vi.fn(),
  mockDbUpsert: vi.fn(),
  mockDbGet: vi.fn(),
  mockGetClientIp: vi.fn(),
  mockInvalidateSnapshotCache: vi.fn(),
}));

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: mockRequireSession,
}));

vi.mock("@/lib/cache/redis", () => ({
  rateLimit: mockRateLimit,
  cacheDel: mockCacheDel,
}));

vi.mock("@/lib/cache/snapshot-cache", () => ({
  invalidateSnapshotCache: mockInvalidateSnapshotCache,
}));

vi.mock("@/lib/feature-flags", () => ({
  isInsightsEnabled: mockIsInsightsEnabled,
}));

vi.mock("@/lib/db/tool-insights", () => ({
  dbUpsertToolInsights: mockDbUpsert,
  dbGetToolInsights: mockDbGet,
}));

vi.mock("@/lib/http/client-ip", () => ({
  getClientIp: mockGetClientIp,
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

const SESSION = {
  token: "ghp_test123",
  login: "juan294",
  name: "Juan",
  avatar_url: "https://avatars.githubusercontent.com/u/1",
};

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

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockIsInsightsEnabled.mockResolvedValue(true);
  mockRequireSession.mockReturnValue({ session: SESSION });
  mockRateLimit.mockResolvedValue({ allowed: true, current: 1, limit: 10 });
  mockCacheDel.mockResolvedValue(undefined);
  mockInvalidateSnapshotCache.mockResolvedValue(undefined);
  mockDbUpsert.mockResolvedValue(null); // null = fallback to computed scores
  mockDbGet.mockResolvedValue(null);
  mockGetClientIp.mockReturnValue("127.0.0.1");
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

  it("returns 401 when no session", async () => {
    mockRequireSession.mockReturnValue({
      error: new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    });
    const resp = await POST(makePostRequest(makeValidUpload()));
    expect(resp.status).toBe(401);
  });

  it("returns 400 on invalid data (missing fields)", async () => {
    const resp = await POST(makePostRequest({ tool: "claude-code" }));
    expect(resp.status).toBe(400);
    const body = await resp.json();
    expect(body.error).toContain("Invalid insights data");
    expect(body.reason).toBeDefined();
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
    expect(mockCacheDel).toHaveBeenCalledWith("stats:v2:merged:juan294");
  });

  it("invalidates snapshot cache after successful upload", async () => {
    await POST(makePostRequest(makeValidUpload()));
    expect(mockInvalidateSnapshotCache).toHaveBeenCalledWith("juan294");
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
});
