import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const {
  mockVerifyCronSecret,
  mockCaptureOperationalAlert,
  mockGetBaseUrl,
  mockGetWarmCachePriorityHandles,
} = vi.hoisted(() => ({
  mockVerifyCronSecret: vi.fn(),
  mockCaptureOperationalAlert: vi.fn(),
  mockGetBaseUrl: vi.fn(),
  mockGetWarmCachePriorityHandles: vi.fn(),
}));

vi.mock("@/lib/auth/cron", () => ({
  verifyCronSecret: (...args: unknown[]) => mockVerifyCronSecret(...args),
}));

vi.mock("@/lib/analytics/server-errors", () => ({
  captureOperationalAlert: (...args: unknown[]) =>
    mockCaptureOperationalAlert(...args),
  withErrorCapture: (_route: string, handler: unknown) => handler,
}));

vi.mock("@/lib/env", () => ({
  getBaseUrl: (...args: unknown[]) => mockGetBaseUrl(...args),
  getWarmCachePriorityHandles: (...args: unknown[]) =>
    mockGetWarmCachePriorityHandles(...args),
}));

import { GET } from "./route";

function makeRequest(): NextRequest {
  return new NextRequest("https://chapa.thecreativetoken.com/api/cron/latency-check");
}

function makeBadgeResponse(serverTiming: string, status = 200): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (name: string) => (name === "Server-Timing" ? serverTiming : null) },
    arrayBuffer: async () => new ArrayBuffer(0),
  } as unknown as Response;
}

describe("GET /api/cron/latency-check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyCronSecret.mockReturnValue(null);
    mockCaptureOperationalAlert.mockResolvedValue(undefined);
    mockGetBaseUrl.mockReturnValue("https://chapa.thecreativetoken.com");
    mockGetWarmCachePriorityHandles.mockReturnValue(["octocat"]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("returns the cron auth failure response when the secret is invalid", async () => {
    const denied = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    mockVerifyCronSecret.mockReturnValue(denied);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await GET(makeRequest());

    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports ok and does not alert when a cache-hit response is within budget", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        makeBadgeResponse('cache;desc="hit";dur=3, total;dur=5'),
      ),
    );

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.status).toBe("ok");
    expect(body.cacheHit).toBe(true);
    expect(mockCaptureOperationalAlert).not.toHaveBeenCalled();
  });

  it("alerts P2 when the measured latency breaches the cache-hit budget", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () => resolve(makeBadgeResponse('cache;desc="hit";dur=900, total;dur=900')),
              1500,
            );
          }),
      ),
    );

    const promise = GET(makeRequest());
    await vi.advanceTimersByTimeAsync(1500);
    const res = await promise;
    const body = await res.json();

    expect(body.status).toBe("breached");
    expect(mockCaptureOperationalAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        signal: "badge_latency_slo_breach",
        severity: "P2",
      }),
    );
  });

  it("alerts when the probe fails to reach the badge route", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.status).toBe("error");
    expect(mockCaptureOperationalAlert).toHaveBeenCalledWith(
      expect.objectContaining({ signal: "badge_latency_slo_breach" }),
    );
  });

  it("falls back to a default handle when no priority handles are configured", async () => {
    mockGetWarmCachePriorityHandles.mockReturnValue([]);
    const fetchMock = vi
      .fn()
      .mockResolvedValue(makeBadgeResponse("cache;dur=2, total;dur=4"));
    vi.stubGlobal("fetch", fetchMock);

    await GET(makeRequest());

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/u/octocat/badge.svg?__chapa_smoke=1"),
      expect.anything(),
    );
  });
});
