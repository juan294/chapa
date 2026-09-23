import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const { mockVerifyCronSecret, mockRunCollectionTick, mockCacheSet } = vi.hoisted(() => ({
  mockVerifyCronSecret: vi.fn(),
  mockRunCollectionTick: vi.fn(),
  mockCacheSet: vi.fn(),
}));

vi.mock("@/lib/auth/cron", () => ({
  verifyCronSecret: (...args: unknown[]) => mockVerifyCronSecret(...args),
}));
vi.mock("@/lib/analytics/server-errors", () => ({
  withErrorCapture: (_route: string, handler: unknown) => handler,
}));
vi.mock("@/lib/collection/worker", () => ({
  runCollectionTick: (...args: unknown[]) => mockRunCollectionTick(...args),
}));
vi.mock("@/lib/cache/redis", () => ({
  cacheSet: (...args: unknown[]) => mockCacheSet(...args),
}));

import { GET } from "./route";

function makeRequest(): NextRequest {
  return new NextRequest("https://chapa.thecreativetoken.com/api/cron/collect-evidence");
}

describe("GET /api/cron/collect-evidence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyCronSecret.mockReturnValue(null);
    mockRunCollectionTick.mockResolvedValue({ slicesRun: 3 });
    mockCacheSet.mockResolvedValue(true);
  });

  it("returns the cron auth failure response when the secret is invalid, without running any slices", async () => {
    const denied = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    mockVerifyCronSecret.mockReturnValue(denied);

    const res = await GET(makeRequest());

    expect(res.status).toBe(401);
    expect(mockRunCollectionTick).not.toHaveBeenCalled();
    expect(mockCacheSet).not.toHaveBeenCalled();
  });

  it("runs a collection tick, writes the heartbeat, and reports the slice count", async () => {
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(mockRunCollectionTick).toHaveBeenCalledWith(expect.any(Number));
    expect(mockCacheSet).toHaveBeenCalledWith("cron:lastrun:collect-evidence", expect.any(Number), 60 * 60 * 48);
    expect(body).toMatchObject({ slicesRun: 3 });
    expect(typeof body.durationMs).toBe("number");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("passes a tick budget with headroom under the route's own maxDuration", async () => {
    const routeModule = await import("./route");
    await GET(makeRequest());
    const budgetMs = mockRunCollectionTick.mock.calls[0]?.[0];
    expect(budgetMs).toBeLessThan(routeModule.maxDuration * 1000);
    expect(budgetMs).toBeGreaterThan(0);
  });
});
