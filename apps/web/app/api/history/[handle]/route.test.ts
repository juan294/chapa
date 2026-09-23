import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/validation", () => ({
  isValidHandle: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/cache/redis", () => ({
  rateLimit: vi.fn().mockResolvedValue({ allowed: true, current: 1, limit: 100 }),
}));

vi.mock("@/lib/http/client-ip", () => ({
  getClientIp: vi.fn().mockReturnValue("1.2.3.4"),
}));

const mockReadObservedScoringHistory = vi.fn();
vi.mock("@/lib/history/observed-history", () => ({
  readObservedScoringHistory: (...args: unknown[]) => mockReadObservedScoringHistory(...args),
}));

import { isValidHandle } from "@/lib/validation";
import { rateLimit } from "@/lib/cache/redis";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(handle: string, params?: Record<string, string>): NextRequest {
  const search = new URLSearchParams(params).toString();
  const url = `https://chapa.test/api/history/${handle}${search ? `?${search}` : ""}`;
  return new NextRequest(url);
}

const OBSERVATION = {
  policyVersion: "v7.2",
  identity: { revisionId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" },
  window: { referenceDate: "2026-09-08", startInclusive: "2025-09-09", endExclusive: "2026-09-09" },
  composite: { exact: 46, display: 46 },
  dimensions: {},
  tier: "Solid",
  archetype: "Builder",
  craft: null,
};

const HISTORY = {
  observations: [OBSERVATION],
  trend: [{ policyVersion: "v7.2", referenceDate: "2026-09-08", receiptRevisionId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", rawPoint: 46, unroundedValue: 46, previousAnchorRevisionId: null }],
  comparisons: [{ status: "comparable", composite: { exact: 5, display: 5 } }],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isValidHandle).mockReturnValue(true);
  vi.mocked(rateLimit).mockResolvedValue({ allowed: true, current: 1, limit: 100 });
  mockReadObservedScoringHistory.mockResolvedValue({ status: "found", history: HISTORY });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/history/[handle]", () => {
  it("returns 400 for invalid handle", async () => {
    vi.mocked(isValidHandle).mockReturnValue(false);

    const res = await GET(makeRequest("inv@lid"), { params: Promise.resolve({ handle: "inv@lid" }) });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 429 when rate limited", async () => {
    vi.mocked(rateLimit).mockResolvedValue({ allowed: false, current: 101, limit: 100 });

    const res = await GET(makeRequest("testuser"), { params: Promise.resolve({ handle: "testuser" }) });

    expect(res.status).toBe(429);
  });

  it("returns snapshots and trend by default", async () => {
    const res = await GET(makeRequest("testuser"), { params: Promise.resolve({ handle: "testuser" }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.handle).toBe("testuser");
    expect(body.policyVersion).toBe("v7.2");
    expect(body.snapshots).toEqual(HISTORY.observations);
    expect(body.trend).toEqual(HISTORY.trend);
    expect(body.diff).toBeUndefined();
  });

  it("returns diff (the latest comparison) when include=diff", async () => {
    const res = await GET(
      makeRequest("testuser", { include: "snapshots,trend,diff" }),
      { params: Promise.resolve({ handle: "testuser" }) },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.diff).toEqual(HISTORY.comparisons.at(-1));
  });

  it("omits trend when include=snapshots", async () => {
    const res = await GET(
      makeRequest("testuser", { include: "snapshots" }),
      { params: Promise.resolve({ handle: "testuser" }) },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.snapshots).toBeDefined();
    expect(body.trend).toBeUndefined();
  });

  it("passes from/to date params to the observed history reader", async () => {
    await GET(
      makeRequest("testuser", { from: "2025-06-01", to: "2025-06-15" }),
      { params: Promise.resolve({ handle: "testuser" }) },
    );

    expect(mockReadObservedScoringHistory).toHaveBeenCalledWith("testuser", { from: "2025-06-01", to: "2025-06-15" });
  });

  it("returns 400 for an invalid 'from' date", async () => {
    const res = await GET(
      makeRequest("testuser", { from: "not-a-date" }),
      { params: Promise.resolve({ handle: "testuser" }) },
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/from/i);
  });

  it("returns 400 for an invalid 'to' date", async () => {
    const res = await GET(
      makeRequest("testuser", { to: "not-a-date" }),
      { params: Promise.resolve({ handle: "testuser" }) },
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/to/i);
  });

  it("sets cache control headers", async () => {
    const res = await GET(makeRequest("testuser"), { params: Promise.resolve({ handle: "testuser" }) });

    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("Cache-Control")).not.toContain("stale-while-revalidate");
  });

  it("returns empty history when no observations exist yet (not a registered scoring subject, or never scored)", async () => {
    mockReadObservedScoringHistory.mockResolvedValue({ status: "missing" });

    const res = await GET(makeRequest("testuser"), { params: Promise.resolve({ handle: "testuser" }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.snapshots).toEqual([]);
    expect(body.trend).toEqual([]);
  });

  it("returns null diff when there is no comparison yet", async () => {
    mockReadObservedScoringHistory.mockResolvedValue({ status: "missing" });

    const res = await GET(
      makeRequest("testuser", { include: "snapshots,diff" }),
      { params: Promise.resolve({ handle: "testuser" }) },
    );

    const body = await res.json();
    expect(body.diff).toBeNull();
  });

  it("returns 503 when the observed history authority is unavailable", async () => {
    mockReadObservedScoringHistory.mockResolvedValue({ status: "unavailable" });

    const res = await GET(makeRequest("testuser"), { params: Promise.resolve({ handle: "testuser" }) });

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("re-throws when an unexpected error is thrown (handled by withErrorCapture)", async () => {
    mockReadObservedScoringHistory.mockRejectedValue(new Error("unexpected boom"));

    await expect(GET(makeRequest("testuser"), { params: Promise.resolve({ handle: "testuser" }) })).rejects.toThrow("unexpected boom");
  });
});
