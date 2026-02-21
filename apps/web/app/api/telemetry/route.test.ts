import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock dependencies BEFORE importing the route handler.
// ---------------------------------------------------------------------------

const { mockRateLimit, mockDbInsertTelemetry } = vi.hoisted(() => ({
  mockRateLimit: vi.fn(),
  mockDbInsertTelemetry: vi.fn(),
}));

vi.mock("@/lib/cache/redis", () => ({
  rateLimit: mockRateLimit,
}));

vi.mock("@/lib/db/telemetry", () => ({
  dbInsertTelemetry: mockDbInsertTelemetry,
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
    expect(mockDbInsertTelemetry).toHaveBeenCalledWith(validPayload);
  });

  it("returns 200 even when Supabase insert fails (graceful degradation)", async () => {
    mockDbInsertTelemetry.mockResolvedValue(false);
    const res = await POST(makeRequest(validPayload));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true });
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
