import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks — hoisted before any imports that depend on them
// ---------------------------------------------------------------------------

const { mockRateLimit, mockGetClientIp, mockIsValidHandle, mockReadPublicObservedScore, mockReadScoringStatus } =
  vi.hoisted(() => ({
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

import { GET } from "./route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(handle: string): NextRequest {
  return new NextRequest(
    `https://chapa.thecreativetoken.com/api/insights/${handle}`,
  );
}

function makeParams(handle: string) {
  return { params: Promise.resolve({ handle }) };
}

const MOCK_PROJECTION = {
  policyVersion: "v7.2" as const,
  identity: { revisionId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" },
  craft: { status: "scored" as const, report: { result: { point: { exact: 60, displayValue: 60 } } } },
};

const MOCK_SCORING_STATUS = { kind: "unregistered" as const };

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

describe("GET /api/insights/:handle", () => {
  it("returns 200 with the receipt's craft outcome for a current subject", async () => {
    const resp = await GET(makeRequest("juan294"), makeParams("juan294"));

    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body).toEqual({
      handle: "juan294",
      policyVersion: MOCK_PROJECTION.policyVersion,
      identity: MOCK_PROJECTION.identity,
      craft: MOCK_PROJECTION.craft,
    });
    expect(mockReadScoringStatus).not.toHaveBeenCalled();
  });

  it("returns 200 with scoringStatus when there is no drawable current receipt", async () => {
    mockReadPublicObservedScore.mockResolvedValue({ status: "missing" });

    const resp = await GET(makeRequest("newuser"), makeParams("newuser"));

    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body).toEqual({ handle: "newuser", scoringStatus: MOCK_SCORING_STATUS });
  });

  it("returns 503 when the current-receipt authority is unavailable", async () => {
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

  it("returns 400 for invalid handle (starts with hyphen)", async () => {
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
      "ratelimit:insights:192.168.1.42",
      60,
      60,
    );
  });

  // --- Misc ---

  it("is a public endpoint — no auth required", async () => {
    const resp = await GET(makeRequest("anyone"), makeParams("anyone"));

    expect(resp.status).toBe(200);
  });

  it("returns JSON content type", async () => {
    const resp = await GET(makeRequest("testuser"), makeParams("testuser"));

    expect(resp.headers.get("content-type")).toContain("application/json");
  });

  // --- Error handling ---

  it("re-throws when readPublicObservedScore throws (handled by withErrorCapture)", async () => {
    mockReadPublicObservedScore.mockRejectedValue(new Error("DB connection lost"));

    await expect(GET(makeRequest("juan294"), makeParams("juan294"))).rejects.toThrow("DB connection lost");
  });

  it("re-throws when rateLimit throws (handled by withErrorCapture)", async () => {
    mockRateLimit.mockRejectedValue(new Error("Redis unavailable"));

    await expect(GET(makeRequest("juan294"), makeParams("juan294"))).rejects.toThrow("Redis unavailable");
  });
});
