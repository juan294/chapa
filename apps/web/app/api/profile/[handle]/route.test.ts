import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks — hoisted before any imports that depend on them
// ---------------------------------------------------------------------------

const {
  mockRateLimit,
  mockGetClientIp,
  mockIsValidHandle,
  mockReadPublicObservedScore,
  mockReadScoringStatus,
} = vi.hoisted(() => ({
  mockRateLimit: vi.fn(),
  mockGetClientIp: vi.fn(),
  mockIsValidHandle: vi.fn(),
  mockReadPublicObservedScore: vi.fn(),
  mockReadScoringStatus: vi.fn(),
}));

vi.mock("@/lib/validation", () => ({
  isValidHandle: mockIsValidHandle,
}));

vi.mock("@/lib/cache/redis", () => ({
  rateLimit: mockRateLimit,
}));

vi.mock("@/lib/http/client-ip", () => ({
  getClientIp: mockGetClientIp,
}));

vi.mock("@/lib/profile/post-write-score", () => ({
  readPublicObservedScore: mockReadPublicObservedScore,
}));

vi.mock("@/lib/collection/read-scoring-status", () => ({
  readScoringStatus: mockReadScoringStatus,
}));

// ---------------------------------------------------------------------------
// Import handler AFTER mocks
// ---------------------------------------------------------------------------

import { GET, OPTIONS } from "./route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(handle: string): NextRequest {
  return new NextRequest(
    `https://chapa.thecreativetoken.com/api/profile/${handle}`,
  );
}

function makeParams(handle: string) {
  return { params: Promise.resolve({ handle }) };
}

const MOCK_PROJECTION = {
  policyVersion: "v7.2" as const,
  identity: { revisionId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" },
  displayScore: 68,
  exactScore: 67.8,
  dimensions: { delivery: 70, quality: 60, consistency: 65, breadth: 62 },
  tier: "High",
  archetype: "Builder",
  craft: null,
};

const MOCK_SCORING_STATUS = {
  kind: "collecting" as const,
  percent: 40,
  sources: [],
  hasPriorReceipt: false,
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockIsValidHandle.mockReturnValue(true);
  mockRateLimit.mockResolvedValue({ allowed: true, current: 1, limit: 60 });
  mockGetClientIp.mockReturnValue("127.0.0.1");
  mockReadPublicObservedScore.mockResolvedValue({ status: "current", projection: MOCK_PROJECTION });
  mockReadScoringStatus.mockResolvedValue(MOCK_SCORING_STATUS);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/profile/:handle", () => {
  it("returns 200 with the current receipt projection", async () => {
    const resp = await GET(makeRequest("juan294"), makeParams("juan294"));

    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body).toEqual({ handle: "juan294", ...MOCK_PROJECTION });
    expect(mockReadScoringStatus).not.toHaveBeenCalled();
  });

  it("returns 200 with scoringStatus when there is no drawable current receipt", async () => {
    mockReadPublicObservedScore.mockResolvedValue({ status: "missing" });

    const resp = await GET(makeRequest("juan294"), makeParams("juan294"));

    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body).toEqual({ handle: "juan294", scoringStatus: MOCK_SCORING_STATUS });
  });

  // #1342 -- a still-discovering job reports percent: null, not a number.
  it("passes through a null percent when collection is still discovering", async () => {
    mockReadPublicObservedScore.mockResolvedValue({ status: "missing" });
    mockReadScoringStatus.mockResolvedValue({ kind: "collecting", percent: null, sources: [], hasPriorReceipt: false });

    const resp = await GET(makeRequest("juan294"), makeParams("juan294"));

    const body = await resp.json();
    expect(body).toEqual({ handle: "juan294", scoringStatus: { kind: "collecting", percent: null, sources: [], hasPriorReceipt: false } });
  });

  it("returns 503 when the current-receipt authority is unavailable, without falling back", async () => {
    mockReadPublicObservedScore.mockResolvedValue({ status: "unavailable" });

    const resp = await GET(makeRequest("juan294"), makeParams("juan294"));

    expect(resp.status).toBe(503);
    expect(mockReadScoringStatus).not.toHaveBeenCalled();
  });

  it("returns 503 when the scoring status authority read itself fails", async () => {
    mockReadPublicObservedScore.mockResolvedValue({ status: "missing" });
    mockReadScoringStatus.mockResolvedValue(null);

    const resp = await GET(makeRequest("juan294"), makeParams("juan294"));

    expect(resp.status).toBe(503);
  });

  // --- Validation ---

  it("returns 400 for invalid handle", async () => {
    mockIsValidHandle.mockReturnValue(false);

    const resp = await GET(makeRequest("-invalid"), makeParams("-invalid"));

    expect(resp.status).toBe(400);
    const body = await resp.json();
    expect(body.error).toContain("Invalid handle");
  });

  it("does not read scoring for an invalid handle", async () => {
    mockIsValidHandle.mockReturnValue(false);

    await GET(makeRequest("-bad"), makeParams("-bad"));

    expect(mockReadPublicObservedScore).not.toHaveBeenCalled();
    expect(mockReadScoringStatus).not.toHaveBeenCalled();
  });

  // --- Rate limiting ---

  it("returns 429 when IP rate limited", async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, current: 61, limit: 60 });

    const resp = await GET(makeRequest("juan294"), makeParams("juan294"));

    expect(resp.status).toBe(429);
    const body = await resp.json();
    expect(body.error).toContain("Too many requests");
  });

  it("returns Retry-After header on 429", async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, current: 61, limit: 60 });

    const resp = await GET(makeRequest("juan294"), makeParams("juan294"));

    expect(resp.headers.get("Retry-After")).toBe("60");
  });

  it("does not read scoring when rate limited", async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, current: 61, limit: 60 });

    await GET(makeRequest("juan294"), makeParams("juan294"));

    expect(mockReadPublicObservedScore).not.toHaveBeenCalled();
  });

  it("passes correct rate limit key based on client IP", async () => {
    mockGetClientIp.mockReturnValue("192.168.1.42");

    await GET(makeRequest("juan294"), makeParams("juan294"));

    expect(mockRateLimit).toHaveBeenCalledWith(
      "ratelimit:profile:192.168.1.42",
      60,
      60,
    );
  });

  // --- CORS headers ---

  it("includes CORS header on success response", async () => {
    const resp = await GET(makeRequest("juan294"), makeParams("juan294"));

    expect(resp.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("includes CORS header on 400 response", async () => {
    mockIsValidHandle.mockReturnValue(false);

    const resp = await GET(makeRequest("-bad"), makeParams("-bad"));

    expect(resp.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("includes CORS header on 429 response", async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, current: 61, limit: 60 });

    const resp = await GET(makeRequest("juan294"), makeParams("juan294"));

    expect(resp.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("includes CORS header on 503 response", async () => {
    mockReadPublicObservedScore.mockResolvedValue({ status: "unavailable" });

    const resp = await GET(makeRequest("juan294"), makeParams("juan294"));

    expect(resp.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  // --- Cache headers ---

  it("includes no-store Cache-Control on success", async () => {
    const resp = await GET(makeRequest("juan294"), makeParams("juan294"));

    expect(resp.headers.get("Cache-Control")).toBe("no-store");
  });

  // --- Error handling ---

  it("re-throws when readPublicObservedScore throws (handled by withErrorCapture)", async () => {
    mockReadPublicObservedScore.mockRejectedValue(new Error("DB down"));

    await expect(GET(makeRequest("juan294"), makeParams("juan294"))).rejects.toThrow("DB down");
  });
});

// ---------------------------------------------------------------------------
// OPTIONS (CORS preflight)
// ---------------------------------------------------------------------------

describe("OPTIONS /api/profile/:handle", () => {
  it("returns 204 with CORS headers", async () => {
    const resp = await OPTIONS();

    expect(resp.status).toBe(204);
    expect(resp.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(resp.headers.get("Access-Control-Allow-Methods")).toBe(
      "GET, OPTIONS",
    );
    expect(resp.headers.get("Access-Control-Allow-Headers")).toBe(
      "Content-Type",
    );
  });
});
