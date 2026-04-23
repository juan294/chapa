import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock dependencies BEFORE importing the route handler.
// ---------------------------------------------------------------------------

const { mockRateLimit, mockDbInsertTelemetry, mockGetClientIp } = vi.hoisted(() => ({
  mockRateLimit: vi.fn(),
  mockDbInsertTelemetry: vi.fn(),
  mockGetClientIp: vi.fn(),
}));

vi.mock("@/lib/cache/redis", () => ({
  rateLimit: mockRateLimit,
}));

vi.mock("@/lib/db/telemetry", () => ({
  dbInsertTelemetry: mockDbInsertTelemetry,
}));

vi.mock("@/lib/http/client-ip", () => ({
  getClientIp: mockGetClientIp,
}));

// Re-export real validation functions through the mock
vi.mock("@/lib/validation", async () => {
  const actual = await import("../../../lib/validation");
  return actual;
});

import { POST } from "./route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const validPayload = {
  operationId: "550e8400-e29b-41d4-a716-446655440000",
  targetHandle: "juan294",
  sourceHandle: "juan_corp",
  success: true,
  stats: {
    commitsTotal: 30,
    reposContributed: 3,
    prsMergedCount: 5,
    activeDays: 20,
    reviewsSubmittedCount: 10,
  },
  timing: {
    fetchMs: 1200,
    uploadMs: 300,
    totalMs: 1500,
  },
  cliVersion: "0.3.1",
};

function makeRequest(body: unknown): Request {
  return new Request("https://chapa.thecreativetoken.com/api/telemetry", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeInvalidJsonRequest(): Request {
  return new Request("https://chapa.thecreativetoken.com/api/telemetry", {
    method: "POST",
    body: "not json!!!",
    headers: { "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/telemetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimit.mockResolvedValue({ allowed: true, current: 1, limit: 10 });
    mockDbInsertTelemetry.mockResolvedValue(true);
    mockGetClientIp.mockReturnValue("127.0.0.1");
  });

  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  it("returns 200 with { ok: true } on valid payload", async () => {
    const res = await POST(makeRequest(validPayload));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true });
  });

  it("calls dbInsertTelemetry with the payload", async () => {
    await POST(makeRequest(validPayload));
    expect(mockDbInsertTelemetry).toHaveBeenCalledWith({
      ...validPayload,
      verified: false,
    });
  });

  it("returns 200 even when Supabase insert fails (graceful degradation)", async () => {
    mockDbInsertTelemetry.mockResolvedValue(false);
    const res = await POST(makeRequest(validPayload));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true });
  });

  it("logs DB insert failure but still returns 200", async () => {
    mockDbInsertTelemetry.mockResolvedValue(false);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await POST(makeRequest(validPayload));
    await Promise.resolve();

    expect(res.status).toBe(200);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[telemetry] insert failed",
      { handle: validPayload.targetHandle },
    );
  });

  it("does not await DB insert — response resolves before insert completes (fire-and-forget)", async () => {
    // The insert should NOT be awaited — response must return even if insert hangs
    let insertResolve!: () => void;
    const neverResolvingInsert = new Promise<boolean>((resolve) => {
      insertResolve = () => resolve(true);
    });
    mockDbInsertTelemetry.mockReturnValue(neverResolvingInsert);

    // Race: route should resolve quickly without waiting for the insert
    const result = await Promise.race([
      POST(makeRequest(validPayload)),
      new Promise<null>((res) => setTimeout(() => res(null), 50)),
    ]);

    // If fire-and-forget: route won the race and result is a Response
    // If await: route hung waiting, and timeout won (result is null)
    expect(result).not.toBeNull();
    expect((result as Response).status).toBe(200);

    // Clean up the dangling promise
    insertResolve();
  });

  // -------------------------------------------------------------------------
  // Validation errors (400)
  // -------------------------------------------------------------------------

  it("returns 400 on invalid JSON body", async () => {
    const res = await POST(makeInvalidJsonRequest());
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/invalid json/i);
  });

  it("returns 400 on invalid payload structure", async () => {
    const res = await POST(makeRequest({ bad: true }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/invalid/i);
  });

  it("returns 400 when operationId is not a UUID", async () => {
    const res = await POST(makeRequest({ ...validPayload, operationId: "not-uuid" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when targetHandle is invalid", async () => {
    const res = await POST(makeRequest({ ...validPayload, targetHandle: "<script>" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when stats fields are missing", async () => {
    const res = await POST(makeRequest({ ...validPayload, stats: { commitsTotal: 1 } }));
    expect(res.status).toBe(400);
  });

  // -------------------------------------------------------------------------
  // Rate limiting (429)
  // -------------------------------------------------------------------------

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, current: 11, limit: 10 });
    const res = await POST(makeRequest(validPayload));
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toMatch(/too many/i);
  });

  it("rate limits by targetHandle with correct key and window (10 req / 60s)", async () => {
    await POST(makeRequest(validPayload));
    expect(mockRateLimit).toHaveBeenCalledWith(
      "ratelimit:telemetry:juan294",
      10,
      60,
    );
  });

  it("applies IP-based floor rate limit (60 req/min) in addition to handle rate limit", async () => {
    mockGetClientIp.mockReturnValue("1.2.3.4");
    await POST(makeRequest(validPayload));
    expect(mockRateLimit).toHaveBeenCalledWith(
      "ratelimit:telemetry-ip:1.2.3.4",
      60,
      60,
    );
    // Both rate limits must be checked
    expect(mockRateLimit).toHaveBeenCalledWith(
      "ratelimit:telemetry-ip-day:1.2.3.4",
      600,
      86400,
    );
    expect(mockRateLimit).toHaveBeenCalledTimes(3);
  });

  it("returns 429 when IP rate limit is exceeded (before handle check)", async () => {
    mockGetClientIp.mockReturnValue("1.2.3.4");
    // First call (IP) hits limit; second call (handle) is allowed — but route returns 429
    mockRateLimit
      .mockResolvedValueOnce({ allowed: false, current: 61, limit: 60 }) // IP
      .mockResolvedValueOnce({ allowed: true, current: 1, limit: 600 }) // IP/day (not reached)
      .mockResolvedValueOnce({ allowed: true, current: 1, limit: 10 }); // handle (not reached)
    const res = await POST(makeRequest(validPayload));
    expect(res.status).toBe(429);
    // Only the IP rate limit should have been checked (short-circuit)
    expect(mockRateLimit).toHaveBeenCalledTimes(1);
  });

  it("returns 429 when daily IP rate limit is exceeded", async () => {
    mockGetClientIp.mockReturnValue("1.2.3.4");
    mockRateLimit.mockReset();
    mockRateLimit.mockImplementation(async (key: string) => {
      if (key === "ratelimit:telemetry-ip-day:1.2.3.4") {
        return { allowed: false, current: 601, limit: 600 };
      }
      return { allowed: true, current: 1, limit: 60 };
    });

    const res = await POST(makeRequest(validPayload));
    expect(res.status).toBe(429);
    expect(mockRateLimit).toHaveBeenCalledTimes(2);
    expect(res.headers.get("Retry-After")).toBe("3600");
  });

  it("includes Retry-After header when rate limited", async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, current: 11, limit: 10 });
    const res = await POST(makeRequest(validPayload));
    expect(res.headers.get("Retry-After")).toBe("60");
  });

  // -------------------------------------------------------------------------
  // No auth required
  // -------------------------------------------------------------------------

  it("does not require authorization header", async () => {
    const res = await POST(makeRequest(validPayload));
    expect(res.status).toBe(200);
  });
});
