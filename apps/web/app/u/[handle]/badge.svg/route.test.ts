import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock dependencies BEFORE importing the route handler.
// ---------------------------------------------------------------------------

const {
  mockGetStatsData,
  mockComputeImpactV4,
  mockRenderBadgeSvg,
  mockReadSessionCookie,
  mockIsValidHandle,
  mockRateLimit,
  mockFetchAvatarBase64,
  mockGenerateVerificationCode,
  mockStoreVerificationRecord,
} = vi.hoisted(() => ({
  mockGetStatsData: vi.fn(),
  mockComputeImpactV4: vi.fn(),
  mockRenderBadgeSvg: vi.fn(),
  mockReadSessionCookie: vi.fn(),
  mockIsValidHandle: vi.fn(),
  mockRateLimit: vi.fn(),
  mockFetchAvatarBase64: vi.fn(),
  mockGenerateVerificationCode: vi.fn(),
  mockStoreVerificationRecord: vi.fn(),
}));

vi.mock("@/lib/github/client", () => ({
  getStats: mockGetStatsData,
}));

vi.mock("@/lib/impact/v4", () => ({
  computeImpactV4: mockComputeImpactV4,
}));

vi.mock("@/lib/render/BadgeSvg", () => ({
  renderBadgeSvg: mockRenderBadgeSvg,
}));

vi.mock("@/lib/auth/github", () => ({
  readSessionCookie: mockReadSessionCookie,
}));

vi.mock("@/lib/validation", () => ({
  isValidHandle: mockIsValidHandle,
}));

vi.mock("@/lib/cache/redis", () => ({
  rateLimit: mockRateLimit,
}));

vi.mock("@/lib/render/avatar", () => ({
  fetchAvatarBase64: mockFetchAvatarBase64,
}));

vi.mock("@/lib/verification/hmac", () => ({
  generateVerificationCode: mockGenerateVerificationCode,
}));

vi.mock("@/lib/verification/store", () => ({
  storeVerificationRecord: mockStoreVerificationRecord,
}));

vi.mock("@/lib/http/client-ip", () => ({
  getClientIp: (req: Request) =>
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown",
}));

// escapeXml is used in fallbackSvg — provide real implementation
vi.mock("@/lib/render/escape", () => ({
  escapeXml: (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/'/g, "&apos;")
      .replace(/"/g, "&quot;"),
}));

import { GET } from "./route";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(handle: string, ip?: string): [NextRequest, { params: Promise<{ handle: string }> }] {
  const headers: Record<string, string> = {};
  if (ip) headers["x-forwarded-for"] = ip;
  const req = new NextRequest(
    `https://chapa.thecreativetoken.com/u/${handle}/badge.svg`,
    { headers },
  );
  return [req, { params: Promise.resolve({ handle }) }];
}

const FAKE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">BADGE</svg>';

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /u/[handle]/badge.svg", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXTAUTH_SECRET", "test-secret");
    mockIsValidHandle.mockReturnValue(true);
    mockRateLimit.mockResolvedValue({ allowed: true, current: 1, limit: 100 });
    mockReadSessionCookie.mockReturnValue(null);
    mockGetStatsData.mockResolvedValue(FAKE_STATS);
    mockComputeImpactV4.mockReturnValue(FAKE_IMPACT);
    mockRenderBadgeSvg.mockReturnValue(FAKE_SVG);
    mockFetchAvatarBase64.mockResolvedValue("data:image/png;base64,abc123");
    mockGenerateVerificationCode.mockReturnValue(null);
    mockStoreVerificationRecord.mockResolvedValue(undefined);
  });

  // -------------------------------------------------------------------------
  // W1: Response headers
  // -------------------------------------------------------------------------

  describe("response headers", () => {
    it("returns Content-Type: image/svg+xml for a valid handle", async () => {
      const [req, ctx] = makeRequest("testuser", "1.2.3.4");
      const res = await GET(req, ctx);
      expect(res.headers.get("Content-Type")).toBe("image/svg+xml");
    });

    it("returns correct Cache-Control for a valid badge", async () => {
      const [req, ctx] = makeRequest("testuser", "1.2.3.4");
      const res = await GET(req, ctx);
      expect(res.headers.get("Cache-Control")).toBe(
        "public, s-maxage=21600, stale-while-revalidate=604800",
      );
    });
  });

  // -------------------------------------------------------------------------
  // W1: Valid SVG output
  // -------------------------------------------------------------------------

  describe("valid handle", () => {
    it("returns valid SVG for a valid handle", async () => {
      const [req, ctx] = makeRequest("testuser", "1.2.3.4");
      const res = await GET(req, ctx);
      const body = await res.text();
      expect(body).toBe(FAKE_SVG);
      expect(res.status).toBe(200);
    });

    it("calls getStats with the handle", async () => {
      const [req, ctx] = makeRequest("testuser", "1.2.3.4");
      await GET(req, ctx);
      expect(mockGetStatsData).toHaveBeenCalledWith("testuser", undefined);
    });

    it("passes stats to computeImpactV4", async () => {
      const [req, ctx] = makeRequest("testuser", "1.2.3.4");
      await GET(req, ctx);
      expect(mockComputeImpactV4).toHaveBeenCalledWith(FAKE_STATS);
    });

    it("passes stats, impact, and options to renderBadgeSvg", async () => {
      const [req, ctx] = makeRequest("testuser", "1.2.3.4");
      await GET(req, ctx);
      expect(mockRenderBadgeSvg).toHaveBeenCalledWith(FAKE_STATS, FAKE_IMPACT, {
        avatarDataUri: "data:image/png;base64,abc123",
        verificationHash: undefined,
        verificationDate: undefined,
      });
    });

    it("fetches avatar base64 from stats.avatarUrl", async () => {
      const [req, ctx] = makeRequest("testuser", "1.2.3.4");
      await GET(req, ctx);
      expect(mockFetchAvatarBase64).toHaveBeenCalledWith(
        "https://avatars.githubusercontent.com/u/12345",
      );
    });

    it("passes undefined avatarDataUri when avatar fetch fails", async () => {
      mockFetchAvatarBase64.mockResolvedValue(undefined);
      const [req, ctx] = makeRequest("testuser", "1.2.3.4");
      await GET(req, ctx);
      expect(mockRenderBadgeSvg).toHaveBeenCalledWith(FAKE_STATS, FAKE_IMPACT, {
        avatarDataUri: undefined,
        verificationHash: undefined,
        verificationDate: undefined,
      });
    });

    it("passes undefined avatarDataUri when stats has no avatarUrl", async () => {
      mockGetStatsData.mockResolvedValue({ ...FAKE_STATS, avatarUrl: undefined });
      const [req, ctx] = makeRequest("testuser", "1.2.3.4");
      await GET(req, ctx);
      expect(mockFetchAvatarBase64).not.toHaveBeenCalled();
      expect(mockRenderBadgeSvg).toHaveBeenCalledWith(
        { ...FAKE_STATS, avatarUrl: undefined },
        FAKE_IMPACT,
        { avatarDataUri: undefined, verificationHash: undefined, verificationDate: undefined },
      );
    });
  });

  // -------------------------------------------------------------------------
  // W1: Invalid handle
  // -------------------------------------------------------------------------

  describe("invalid handle", () => {
    it("returns fallback SVG with status 400 for invalid handle", async () => {
      mockIsValidHandle.mockReturnValue(false);
      const [req, ctx] = makeRequest("bad!!handle", "1.2.3.4");
      const res = await GET(req, ctx);
      expect(res.status).toBe(400);
      const body = await res.text();
      expect(body).toContain("<svg");
      expect(body).toContain("Invalid GitHub handle");
    });

    it("returns Content-Type: image/svg+xml even for invalid handle", async () => {
      mockIsValidHandle.mockReturnValue(false);
      const [req, ctx] = makeRequest("bad!!handle", "1.2.3.4");
      const res = await GET(req, ctx);
      expect(res.headers.get("Content-Type")).toBe("image/svg+xml");
    });

    it("validates handle before processing (does not call getStats)", async () => {
      mockIsValidHandle.mockReturnValue(false);
      const [req, ctx] = makeRequest("bad!!handle", "1.2.3.4");
      await GET(req, ctx);
      expect(mockGetStatsData).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // W1: Stats fetch failure
  // -------------------------------------------------------------------------

  describe("stats fetch failure", () => {
    it("returns fallback SVG when stats fetch returns null", async () => {
      mockGetStatsData.mockResolvedValue(null);
      const [req, ctx] = makeRequest("testuser", "1.2.3.4");
      const res = await GET(req, ctx);
      const body = await res.text();
      expect(body).toContain("<svg");
      expect(body).toContain("Could not load data");
    });

    it("returns shorter cache TTL on error fallback (s-maxage=300)", async () => {
      mockGetStatsData.mockResolvedValue(null);
      const [req, ctx] = makeRequest("testuser", "1.2.3.4");
      const res = await GET(req, ctx);
      expect(res.headers.get("Cache-Control")).toBe(
        "public, s-maxage=300, stale-while-revalidate=600",
      );
    });

    it("returns Content-Type: image/svg+xml on error fallback", async () => {
      mockGetStatsData.mockResolvedValue(null);
      const [req, ctx] = makeRequest("testuser", "1.2.3.4");
      const res = await GET(req, ctx);
      expect(res.headers.get("Content-Type")).toBe("image/svg+xml");
    });
  });

  // -------------------------------------------------------------------------
  // W2: Rate limiting
  // -------------------------------------------------------------------------

  describe("rate limiting", () => {
    it("calls rateLimit with correct key, limit, and window", async () => {
      const [req, ctx] = makeRequest("testuser", "9.8.7.6");
      await GET(req, ctx);
      expect(mockRateLimit).toHaveBeenCalledWith(
        "ratelimit:badge:9.8.7.6",
        100,
        60,
      );
    });

    it("returns 429 with plain text when rate limited", async () => {
      mockRateLimit.mockResolvedValue({ allowed: false, current: 101, limit: 100 });
      const [req, ctx] = makeRequest("testuser", "1.2.3.4");
      const res = await GET(req, ctx);
      expect(res.status).toBe(429);
      const body = await res.text();
      expect(body).toMatch(/too many requests/i);
    });

    it("returns Retry-After header when rate limited", async () => {
      mockRateLimit.mockResolvedValue({ allowed: false, current: 101, limit: 100 });
      const [req, ctx] = makeRequest("testuser", "1.2.3.4");
      const res = await GET(req, ctx);
      expect(res.headers.get("Retry-After")).toBe("60");
    });

    it("does not return SVG content-type when rate limited", async () => {
      mockRateLimit.mockResolvedValue({ allowed: false, current: 101, limit: 100 });
      const [req, ctx] = makeRequest("testuser", "1.2.3.4");
      const res = await GET(req, ctx);
      expect(res.headers.get("Content-Type")).not.toContain("svg");
    });

    it("uses 'unknown' when x-forwarded-for is absent", async () => {
      const [req, ctx] = makeRequest("testuser");
      await GET(req, ctx);
      expect(mockRateLimit).toHaveBeenCalledWith(
        "ratelimit:badge:unknown",
        100,
        60,
      );
    });

    it("does not call getStats when rate limited", async () => {
      mockRateLimit.mockResolvedValue({ allowed: false, current: 101, limit: 100 });
      const [req, ctx] = makeRequest("testuser", "1.2.3.4");
      await GET(req, ctx);
      expect(mockGetStatsData).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Verification integration
  // -------------------------------------------------------------------------

  describe("verification", () => {
    it("calls generateVerificationCode with stats and impact", async () => {
      const [req, ctx] = makeRequest("testuser", "1.2.3.4");
      await GET(req, ctx);
      expect(mockGenerateVerificationCode).toHaveBeenCalledWith(FAKE_STATS, FAKE_IMPACT);
    });

    it("passes verification hash and date to renderBadgeSvg when code is generated", async () => {
      mockGenerateVerificationCode.mockReturnValue({ hash: "abc12345", date: "2025-06-15" });
      const [req, ctx] = makeRequest("testuser", "1.2.3.4");
      await GET(req, ctx);
      expect(mockRenderBadgeSvg).toHaveBeenCalledWith(FAKE_STATS, FAKE_IMPACT, {
        avatarDataUri: "data:image/png;base64,abc123",
        verificationHash: "abc12345",
        verificationDate: "2025-06-15",
      });
    });

    it("stores verification record when code is generated", async () => {
      mockGenerateVerificationCode.mockReturnValue({ hash: "abc12345", date: "2025-06-15" });
      const [req, ctx] = makeRequest("testuser", "1.2.3.4");
      await GET(req, ctx);
      expect(mockStoreVerificationRecord).toHaveBeenCalledWith("abc12345", expect.objectContaining({
        handle: "testuser",
        adjustedComposite: 65,
        tier: "Solid",
        confidence: 85,
        generatedAt: "2025-06-15",
      }));
    });

    it("does not store verification record when code is null", async () => {
      mockGenerateVerificationCode.mockReturnValue(null);
      const [req, ctx] = makeRequest("testuser", "1.2.3.4");
      await GET(req, ctx);
      expect(mockStoreVerificationRecord).not.toHaveBeenCalled();
    });
  });
});
