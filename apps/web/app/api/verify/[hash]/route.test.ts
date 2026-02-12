import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetVerificationRecord, mockRateLimit } = vi.hoisted(() => ({
  mockGetVerificationRecord: vi.fn(),
  mockRateLimit: vi.fn(),
}));

vi.mock("@/lib/verification/store", () => ({
  getVerificationRecord: mockGetVerificationRecord,
}));

vi.mock("@/lib/cache/redis", () => ({
  rateLimit: mockRateLimit,
}));

import { GET } from "./route";
import { NextRequest } from "next/server";

function makeRequest(
  hash: string,
  ip?: string,
): [NextRequest, { params: Promise<{ hash: string }> }] {
  const headers: Record<string, string> = {};
  if (ip) headers["x-forwarded-for"] = ip;
  const req = new NextRequest(
    `https://chapa.thecreativetoken.com/api/verify/${hash}`,
    { headers },
  );
  return [req, { params: Promise.resolve({ hash }) }];
}

const FAKE_RECORD = {
  handle: "testuser",
  displayName: "Test User",
  adjustedComposite: 52,
  confidence: 85,
  tier: "Solid",
  archetype: "Builder",
  dimensions: { building: 70, guarding: 50, consistency: 60, breadth: 40 },
  commitsTotal: 200,
  prsMergedCount: 30,
  reviewsSubmittedCount: 50,
  generatedAt: "2025-06-15",
  profileType: "collaborative",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRateLimit.mockResolvedValue({ allowed: true, current: 1, limit: 30 });
  mockGetVerificationRecord.mockResolvedValue(null);
});

describe("GET /api/verify/[hash]", () => {
  describe("validation", () => {
    it("returns 400 for non-hex hash", async () => {
      const [req, ctx] = makeRequest("not-hex!", "1.2.3.4");
      const res = await GET(req, ctx);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBeDefined();
    });

    it("returns 400 for hash longer than 8 characters", async () => {
      const [req, ctx] = makeRequest("abc123456", "1.2.3.4");
      const res = await GET(req, ctx);
      expect(res.status).toBe(400);
    });

    it("returns 400 for hash shorter than 8 characters", async () => {
      const [req, ctx] = makeRequest("abc12", "1.2.3.4");
      const res = await GET(req, ctx);
      expect(res.status).toBe(400);
    });

    it("accepts valid 8-char hex hash", async () => {
      mockGetVerificationRecord.mockResolvedValue(FAKE_RECORD);
      const [req, ctx] = makeRequest("abc12345", "1.2.3.4");
      const res = await GET(req, ctx);
      expect(res.status).toBe(200);
    });
  });

  describe("rate limiting", () => {
    it("calls rateLimit with verify-specific key", async () => {
      const [req, ctx] = makeRequest("abc12345", "9.8.7.6");
      await GET(req, ctx);
      expect(mockRateLimit).toHaveBeenCalledWith(
        "ratelimit:verify:9.8.7.6",
        30,
        60,
      );
    });

    it("returns 429 when rate limited", async () => {
      mockRateLimit.mockResolvedValue({ allowed: false, current: 31, limit: 30 });
      const [req, ctx] = makeRequest("abc12345", "1.2.3.4");
      const res = await GET(req, ctx);
      expect(res.status).toBe(429);
    });
  });

  describe("lookup", () => {
    it("returns 404 when record not found", async () => {
      mockGetVerificationRecord.mockResolvedValue(null);
      const [req, ctx] = makeRequest("abc12345", "1.2.3.4");
      const res = await GET(req, ctx);
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.status).toBe("not_found");
    });

    it("returns 200 with full record when found", async () => {
      mockGetVerificationRecord.mockResolvedValue(FAKE_RECORD);
      const [req, ctx] = makeRequest("abc12345", "1.2.3.4");
      const res = await GET(req, ctx);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("verified");
      expect(body.hash).toBe("abc12345");
      expect(body.data).toEqual(FAKE_RECORD);
    });

    it("includes verifyUrl and badgeUrl in response", async () => {
      mockGetVerificationRecord.mockResolvedValue(FAKE_RECORD);
      const [req, ctx] = makeRequest("abc12345", "1.2.3.4");
      const res = await GET(req, ctx);
      const body = await res.json();
      expect(body.verifyUrl).toContain("/verify/abc12345");
      expect(body.badgeUrl).toContain("/u/testuser/badge.svg");
    });

    it("looks up using the hash from params", async () => {
      const [req, ctx] = makeRequest("deadbeef", "1.2.3.4");
      await GET(req, ctx);
      expect(mockGetVerificationRecord).toHaveBeenCalledWith("deadbeef");
    });
  });

  describe("response headers", () => {
    it("returns JSON content type", async () => {
      mockGetVerificationRecord.mockResolvedValue(FAKE_RECORD);
      const [req, ctx] = makeRequest("abc12345", "1.2.3.4");
      const res = await GET(req, ctx);
      expect(res.headers.get("Content-Type")).toContain("application/json");
    });

    it("allows CORS from any origin", async () => {
      mockGetVerificationRecord.mockResolvedValue(FAKE_RECORD);
      const [req, ctx] = makeRequest("abc12345", "1.2.3.4");
      const res = await GET(req, ctx);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });
  });
});
