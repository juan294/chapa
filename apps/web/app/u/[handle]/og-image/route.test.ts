import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — must be set up BEFORE importing the route handler
// ---------------------------------------------------------------------------

const {
  mockGetStats,
  mockComputeImpactV4,
  mockRenderBadgeSvg,
  mockIsValidHandle,
  mockGetAvatarBase64,
  mockGenerateVerificationCode,
  mockSvgToPng,
  mockCacheGet,
  mockCacheSet,
} = vi.hoisted(() => ({
  mockGetStats: vi.fn(),
  mockComputeImpactV4: vi.fn(),
  mockRenderBadgeSvg: vi.fn(),
  mockIsValidHandle: vi.fn(),
  mockGetAvatarBase64: vi.fn(),
  mockGenerateVerificationCode: vi.fn(),
  mockSvgToPng: vi.fn(),
  mockCacheGet: vi.fn(),
  mockCacheSet: vi.fn(),
}));

vi.mock("@/lib/github/client", () => ({
  getStats: mockGetStats,
}));

vi.mock("@/lib/impact/v4", () => ({
  computeImpactV4: mockComputeImpactV4,
}));

vi.mock("@/lib/render/BadgeSvg", () => ({
  renderBadgeSvg: mockRenderBadgeSvg,
}));

vi.mock("@/lib/validation", () => ({
  isValidHandle: mockIsValidHandle,
}));

vi.mock("@/lib/render/avatar", () => ({
  getAvatarBase64: mockGetAvatarBase64,
}));

vi.mock("@/lib/verification/hmac", () => ({
  generateVerificationCode: mockGenerateVerificationCode,
}));

vi.mock("@/lib/render/svg-to-png", () => ({
  svgToPng: mockSvgToPng,
}));

vi.mock("@/lib/cache/redis", () => ({
  cacheGet: mockCacheGet,
  cacheSet: mockCacheSet,
}));

import { GET } from "./route";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(
  handle: string,
): [NextRequest, { params: Promise<{ handle: string }> }] {
  const req = new NextRequest(
    `https://chapa.thecreativetoken.com/u/${handle}/og-image`,
  );
  return [req, { params: Promise.resolve({ handle }) }];
}

const FAKE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">BADGE</svg>';

const FAKE_PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const FAKE_STATS = {
  handle: "testuser",
  commitsTotal: 42,
  prsMergedCount: 10,
  reviewsSubmittedCount: 5,
  avatarUrl: "https://avatars.githubusercontent.com/u/12345",
};

const FAKE_IMPACT = {
  handle: "testuser",
  profileType: "collaborative",
  adjustedComposite: 65,
  tier: "Solid",
  confidence: 85,
  dimensions: { building: 70, guarding: 60, consistency: 65, breadth: 55 },
  archetype: "Builder",
};

/** The base64-encoded form of FAKE_PNG that the route stores in Redis. */
const FAKE_PNG_BASE64 = Buffer.from(FAKE_PNG).toString("base64");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /u/[handle]/og-image", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-14T12:00:00Z"));

    mockIsValidHandle.mockReturnValue(true);
    mockGetStats.mockResolvedValue(FAKE_STATS);
    mockComputeImpactV4.mockReturnValue(FAKE_IMPACT);
    mockRenderBadgeSvg.mockReturnValue(FAKE_SVG);
    mockGetAvatarBase64.mockResolvedValue("data:image/png;base64,abc123");
    mockGenerateVerificationCode.mockReturnValue(null);
    mockSvgToPng.mockReturnValue(FAKE_PNG);
    mockCacheGet.mockResolvedValue(null); // default: cache miss
    mockCacheSet.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -----------------------------------------------------------------------
  // Cache miss — full render pipeline
  // -----------------------------------------------------------------------

  describe("cache miss", () => {
    it("returns 200 with Content-Type image/png", async () => {
      const [req, ctx] = makeRequest("testuser");
      const res = await GET(req, ctx);
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("image/png");
    });

    it("stores the generated PNG as base64 in Redis with 24h TTL", async () => {
      const [req, ctx] = makeRequest("testuser");
      await GET(req, ctx);
      expect(mockCacheSet).toHaveBeenCalledWith(
        "og-image:v1:testuser:2026-02-14",
        FAKE_PNG_BASE64,
        86400,
      );
    });

    it("calls the full render pipeline", async () => {
      const [req, ctx] = makeRequest("testuser");
      await GET(req, ctx);
      expect(mockGetStats).toHaveBeenCalledWith("testuser");
      expect(mockComputeImpactV4).toHaveBeenCalledWith(FAKE_STATS);
      expect(mockSvgToPng).toHaveBeenCalledWith(FAKE_SVG, 1200);
    });
  });

  // -----------------------------------------------------------------------
  // Cache hit — skip render pipeline
  // -----------------------------------------------------------------------

  describe("cache hit", () => {
    beforeEach(() => {
      mockCacheGet.mockResolvedValue(FAKE_PNG_BASE64);
    });

    it("returns 200 with Content-Type image/png", async () => {
      const [req, ctx] = makeRequest("testuser");
      const res = await GET(req, ctx);
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("image/png");
    });

    it("returns the cached PNG buffer", async () => {
      const [req, ctx] = makeRequest("testuser");
      const res = await GET(req, ctx);
      const body = await res.arrayBuffer();
      expect(new Uint8Array(body)).toEqual(FAKE_PNG);
    });

    it("does NOT call getStats", async () => {
      const [req, ctx] = makeRequest("testuser");
      await GET(req, ctx);
      expect(mockGetStats).not.toHaveBeenCalled();
    });

    it("does NOT call renderBadgeSvg or svgToPng", async () => {
      const [req, ctx] = makeRequest("testuser");
      await GET(req, ctx);
      expect(mockRenderBadgeSvg).not.toHaveBeenCalled();
      expect(mockSvgToPng).not.toHaveBeenCalled();
    });

    it("does NOT call cacheSet (no re-store needed)", async () => {
      const [req, ctx] = makeRequest("testuser");
      await GET(req, ctx);
      expect(mockCacheSet).not.toHaveBeenCalled();
    });

    it("checks the correct cache key with handle and date", async () => {
      const [req, ctx] = makeRequest("testuser");
      await GET(req, ctx);
      expect(mockCacheGet).toHaveBeenCalledWith(
        "og-image:v1:testuser:2026-02-14",
      );
    });
  });

  // -----------------------------------------------------------------------
  // Cache key format
  // -----------------------------------------------------------------------

  describe("cache key", () => {
    it("changes when the date changes", async () => {
      vi.setSystemTime(new Date("2026-02-15T12:00:00Z"));
      const [req, ctx] = makeRequest("testuser");
      await GET(req, ctx);
      expect(mockCacheGet).toHaveBeenCalledWith(
        "og-image:v1:testuser:2026-02-15",
      );
    });
  });

  // -----------------------------------------------------------------------
  // Cache degradation — Redis errors fall through to generation
  // -----------------------------------------------------------------------

  describe("cache degradation", () => {
    it("generates PNG normally when cacheGet throws", async () => {
      mockCacheGet.mockRejectedValue(new Error("Redis down"));
      const [req, ctx] = makeRequest("testuser");
      const res = await GET(req, ctx);
      expect(res.status).toBe(200);
      expect(mockGetStats).toHaveBeenCalled();
      expect(mockSvgToPng).toHaveBeenCalled();
    });

    it("still returns PNG even when cacheSet throws", async () => {
      mockCacheSet.mockRejectedValue(new Error("Redis down"));
      const [req, ctx] = makeRequest("testuser");
      const res = await GET(req, ctx);
      expect(res.status).toBe(200);
    });
  });

  // -----------------------------------------------------------------------
  // Error paths
  // -----------------------------------------------------------------------

  describe("error handling", () => {
    it("returns 400 for invalid handle", async () => {
      mockIsValidHandle.mockReturnValue(false);
      const [req, ctx] = makeRequest("bad!!handle");
      const res = await GET(req, ctx);
      expect(res.status).toBe(400);
    });

    it("returns 404 when getStats returns null", async () => {
      mockGetStats.mockResolvedValue(null);
      const [req, ctx] = makeRequest("testuser");
      const res = await GET(req, ctx);
      expect(res.status).toBe(404);
    });

    it("returns 500 when render pipeline throws", async () => {
      mockSvgToPng.mockImplementation(() => {
        throw new Error("PNG conversion failed");
      });
      const [req, ctx] = makeRequest("testuser");
      const res = await GET(req, ctx);
      expect(res.status).toBe(500);
    });
  });
});
