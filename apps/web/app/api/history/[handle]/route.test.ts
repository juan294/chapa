import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";
import { NextRequest } from "next/server";
import { makeSnapshot } from "../../../../lib/test-helpers/fixtures";

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

const mockGetSnapshots = vi.fn();
vi.mock("@/lib/history/history", () => ({
  getSnapshots: (...args: unknown[]) => mockGetSnapshots(...args),
}));

const mockCompareSnapshots = vi.fn();
vi.mock("@/lib/history/diff", () => ({
  compareSnapshots: (...args: unknown[]) => mockCompareSnapshots(...args),
}));

const mockComputeTrend = vi.fn();
vi.mock("@/lib/history/trend", () => ({
  computeTrend: (...args: unknown[]) => mockComputeTrend(...args),
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

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isValidHandle).mockReturnValue(true);
  vi.mocked(rateLimit).mockResolvedValue({ allowed: true, current: 1, limit: 100 });
  mockGetSnapshots.mockResolvedValue([]);
  mockComputeTrend.mockReturnValue(null);
  mockCompareSnapshots.mockReturnValue(null);
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
    const s1 = makeSnapshot({ date: "2025-06-14", adjustedComposite: 50 });
    const s2 = makeSnapshot({ date: "2025-06-15", adjustedComposite: 55 });
    mockGetSnapshots.mockResolvedValue([s1, s2]);
    mockComputeTrend.mockReturnValue({
      direction: "improving",
      avgDelta: 5,
      compositeValues: [
        { date: "2025-06-14", value: 50 },
        { date: "2025-06-15", value: 55 },
      ],
      dimensions: {},
    });

    const res = await GET(makeRequest("testuser"), { params: Promise.resolve({ handle: "testuser" }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.handle).toBe("testuser");
    expect(body.snapshots).toHaveLength(2);
    expect(body.trend).toBeDefined();
    expect(body.trend.direction).toBe("improving");
  });

  it("returns diff when include=diff", async () => {
    const s1 = makeSnapshot({ date: "2025-06-14", adjustedComposite: 50 });
    const s2 = makeSnapshot({ date: "2025-06-15", adjustedComposite: 55 });
    mockGetSnapshots.mockResolvedValue([s1, s2]);
    mockCompareSnapshots.mockReturnValue({
      direction: "improving",
      adjustedComposite: 5,
      daysBetween: 1,
    });
    mockComputeTrend.mockReturnValue({
      direction: "improving",
      avgDelta: 5,
      compositeValues: [],
      dimensions: {},
    });

    const res = await GET(
      makeRequest("testuser", { include: "snapshots,trend,diff" }),
      { params: Promise.resolve({ handle: "testuser" }) },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.diff).toBeDefined();
    expect(body.diff.direction).toBe("improving");
  });

  it("omits trend when include=snapshots", async () => {
    const s1 = makeSnapshot({ date: "2025-06-14" });
    mockGetSnapshots.mockResolvedValue([s1]);

    const res = await GET(
      makeRequest("testuser", { include: "snapshots" }),
      { params: Promise.resolve({ handle: "testuser" }) },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.snapshots).toBeDefined();
    expect(body.trend).toBeUndefined();
  });

  it("passes from/to date params to getSnapshots", async () => {
    mockGetSnapshots.mockResolvedValue([]);

    await GET(
      makeRequest("testuser", { from: "2025-06-01", to: "2025-06-15" }),
      { params: Promise.resolve({ handle: "testuser" }) },
    );

    expect(mockGetSnapshots).toHaveBeenCalledWith("testuser", "2025-06-01", "2025-06-15");
  });

  it("passes window param to computeTrend", async () => {
    const snapshots = Array.from({ length: 10 }, (_, i) =>
      makeSnapshot({
        date: `2025-06-${String(i + 1).padStart(2, "0")}`,
        adjustedComposite: 50 + i,
      }),
    );
    mockGetSnapshots.mockResolvedValue(snapshots);
    mockComputeTrend.mockReturnValue({
      direction: "improving",
      avgDelta: 1,
      compositeValues: Array.from({ length: 5 }, (_, i) => ({
        date: `2025-06-${String(i + 6).padStart(2, "0")}`,
        value: 55 + i,
      })),
      dimensions: {},
    });

    await GET(
      makeRequest("testuser", { window: "5" }),
      { params: Promise.resolve({ handle: "testuser" }) },
    );

    // Verify computeTrend was called with the snapshots and parsed window
    expect(mockComputeTrend).toHaveBeenCalledWith(snapshots, 5);
  });

  it("sets cache control headers", async () => {
    mockGetSnapshots.mockResolvedValue([makeSnapshot()]);

    const res = await GET(makeRequest("testuser"), { params: Promise.resolve({ handle: "testuser" }) });

    expect(res.headers.get("Cache-Control")).toContain("s-maxage=3600");
    expect(res.headers.get("Cache-Control")).toContain("stale-while-revalidate=86400");
  });

  it("returns empty snapshots array when no data exists", async () => {
    mockGetSnapshots.mockResolvedValue([]);

    const res = await GET(makeRequest("testuser"), { params: Promise.resolve({ handle: "testuser" }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.snapshots).toEqual([]);
    expect(body.trend).toBeNull();
  });

  it("returns null diff when fewer than 2 snapshots", async () => {
    mockGetSnapshots.mockResolvedValue([makeSnapshot()]);

    const res = await GET(
      makeRequest("testuser", { include: "snapshots,diff" }),
      { params: Promise.resolve({ handle: "testuser" }) },
    );

    const body = await res.json();
    expect(body.diff).toBeNull();
  });

  it("returns 400 when window param is not a valid number", async () => {
    const res = await GET(
      makeRequest("testuser", { window: "abc" }),
      { params: Promise.resolve({ handle: "testuser" }) },
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/window/i);
  });

  it("returns 400 when window param is a float", async () => {
    const res = await GET(
      makeRequest("testuser", { window: "3.5" }),
      { params: Promise.resolve({ handle: "testuser" }) },
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/window/i);
  });

  it("returns 400 when window param is negative", async () => {
    const res = await GET(
      makeRequest("testuser", { window: "-5" }),
      { params: Promise.resolve({ handle: "testuser" }) },
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/window/i);
  });

  it("returns 400 when window param is zero", async () => {
    const res = await GET(
      makeRequest("testuser", { window: "0" }),
      { params: Promise.resolve({ handle: "testuser" }) },
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/window/i);
  });

  it("accepts valid integer window param", async () => {
    const snapshots = Array.from({ length: 10 }, (_, i) =>
      makeSnapshot({
        date: `2025-06-${String(i + 1).padStart(2, "0")}`,
        adjustedComposite: 50 + i,
      }),
    );
    mockGetSnapshots.mockResolvedValue(snapshots);
    mockComputeTrend.mockReturnValue({
      direction: "improving",
      avgDelta: 1,
      compositeValues: [],
      dimensions: {},
    });

    const res = await GET(
      makeRequest("testuser", { window: "7" }),
      { params: Promise.resolve({ handle: "testuser" }) },
    );

    expect(res.status).toBe(200);
    expect(mockComputeTrend).toHaveBeenCalledWith(snapshots, 7);
  });
});
