import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock dependencies BEFORE importing the route handler.
// ---------------------------------------------------------------------------

const {
  mockGetStats,
  mockComputeImpactV4,
  mockRenderBadgeSvg,
  mockIsValidHandle,
  mockGetAvatarBase64,
  mockGenerateVerificationCode,
  mockSvgToPng,
} = vi.hoisted(() => ({
  mockGetStats: vi.fn(),
  mockComputeImpactV4: vi.fn(),
  mockRenderBadgeSvg: vi.fn(),
  mockIsValidHandle: vi.fn(),
  mockGetAvatarBase64: vi.fn(),
  mockGenerateVerificationCode: vi.fn(),
  mockSvgToPng: vi.fn(),
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /u/[handle]/og-image", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsValidHandle.mockReturnValue(true);
    mockGetStats.mockResolvedValue(FAKE_STATS);
    mockComputeImpactV4.mockReturnValue(FAKE_IMPACT);
    mockRenderBadgeSvg.mockReturnValue(FAKE_SVG);
    mockGetAvatarBase64.mockResolvedValue("data:image/png;base64,abc123");
    mockGenerateVerificationCode.mockReturnValue(null);
    mockSvgToPng.mockReturnValue(FAKE_PNG);
  });

  // -------------------------------------------------------------------------
  // Valid handle — success path
  // -------------------------------------------------------------------------

  describe("valid handle", () => {
    it("returns 200 with Content-Type image/png", async () => {
      const [req, ctx] = makeRequest("testuser");
      const res = await GET(req, ctx);
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("image/png");
    });

    it("returns PNG buffer as the response body", async () => {
      const [req, ctx] = makeRequest("testuser");
      const res = await GET(req, ctx);
      const body = await res.arrayBuffer();
      expect(new Uint8Array(body)).toEqual(
        new Uint8Array(Buffer.from(FAKE_PNG)),
      );
    });

    it("sets correct Cache-Control headers", async () => {
      const [req, ctx] = makeRequest("testuser");
      const res = await GET(req, ctx);
      expect(res.headers.get("Cache-Control")).toBe(
        "public, s-maxage=21600, stale-while-revalidate=604800",
      );
    });

    it("calls getStats with the handle", async () => {
      const [req, ctx] = makeRequest("testuser");
      await GET(req, ctx);
      expect(mockGetStats).toHaveBeenCalledWith("testuser");
    });

    it("passes stats to computeImpactV4", async () => {
      const [req, ctx] = makeRequest("testuser");
      await GET(req, ctx);
      expect(mockComputeImpactV4).toHaveBeenCalledWith(FAKE_STATS);
    });

    it("passes stats, impact, and options to renderBadgeSvg", async () => {
      const [req, ctx] = makeRequest("testuser");
      await GET(req, ctx);
      expect(mockRenderBadgeSvg).toHaveBeenCalledWith(
        FAKE_STATS,
        FAKE_IMPACT,
        {
          avatarDataUri: "data:image/png;base64,abc123",
          verificationHash: undefined,
          verificationDate: undefined,
        },
      );
    });

    it("passes SVG and width 1200 to svgToPng", async () => {
      const [req, ctx] = makeRequest("testuser");
      await GET(req, ctx);
      expect(mockSvgToPng).toHaveBeenCalledWith(FAKE_SVG, 1200);
    });

    it("fetches avatar base64 from stats.avatarUrl", async () => {
      const [req, ctx] = makeRequest("testuser");
      await GET(req, ctx);
      expect(mockGetAvatarBase64).toHaveBeenCalledWith(
        "testuser",
        "https://avatars.githubusercontent.com/u/12345",
      );
    });
  });

  // -------------------------------------------------------------------------
  // Avatar edge cases
  // -------------------------------------------------------------------------

  describe("avatar handling", () => {
    it("passes undefined avatarDataUri when stats has no avatarUrl", async () => {
      mockGetStats.mockResolvedValue({ ...FAKE_STATS, avatarUrl: undefined });
      const [req, ctx] = makeRequest("testuser");
      await GET(req, ctx);
      expect(mockGetAvatarBase64).not.toHaveBeenCalled();
      expect(mockRenderBadgeSvg).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ avatarDataUri: undefined }),
      );
    });

    it("passes undefined avatarDataUri when avatar fetch fails", async () => {
      mockGetAvatarBase64.mockResolvedValue(undefined);
      const [req, ctx] = makeRequest("testuser");
      await GET(req, ctx);
      expect(mockRenderBadgeSvg).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ avatarDataUri: undefined }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Invalid handle
  // -------------------------------------------------------------------------

  describe("invalid handle", () => {
    it("returns 400 with 'Invalid handle' text", async () => {
      mockIsValidHandle.mockReturnValue(false);
      const [req, ctx] = makeRequest("bad!!handle");
      const res = await GET(req, ctx);
      expect(res.status).toBe(400);
      const body = await res.text();
      expect(body).toBe("Invalid handle");
    });

    it("does not call getStats for invalid handle", async () => {
      mockIsValidHandle.mockReturnValue(false);
      const [req, ctx] = makeRequest("bad!!handle");
      await GET(req, ctx);
      expect(mockGetStats).not.toHaveBeenCalled();
    });

    it("does not call svgToPng for invalid handle", async () => {
      mockIsValidHandle.mockReturnValue(false);
      const [req, ctx] = makeRequest("bad!!handle");
      await GET(req, ctx);
      expect(mockSvgToPng).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Stats fetch returns null
  // -------------------------------------------------------------------------

  describe("stats fetch returns null", () => {
    it("returns 404 with 'Could not load data'", async () => {
      mockGetStats.mockResolvedValue(null);
      const [req, ctx] = makeRequest("testuser");
      const res = await GET(req, ctx);
      expect(res.status).toBe(404);
      const body = await res.text();
      expect(body).toBe("Could not load data");
    });

    it("does not call computeImpactV4 when stats is null", async () => {
      mockGetStats.mockResolvedValue(null);
      const [req, ctx] = makeRequest("testuser");
      await GET(req, ctx);
      expect(mockComputeImpactV4).not.toHaveBeenCalled();
    });

    it("does not call svgToPng when stats is null", async () => {
      mockGetStats.mockResolvedValue(null);
      const [req, ctx] = makeRequest("testuser");
      await GET(req, ctx);
      expect(mockSvgToPng).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Verification integration
  // -------------------------------------------------------------------------

  describe("verification", () => {
    it("calls generateVerificationCode with stats and impact", async () => {
      const [req, ctx] = makeRequest("testuser");
      await GET(req, ctx);
      expect(mockGenerateVerificationCode).toHaveBeenCalledWith(
        FAKE_STATS,
        FAKE_IMPACT,
      );
    });

    it("passes verification hash and date to renderBadgeSvg when generated", async () => {
      mockGenerateVerificationCode.mockReturnValue({
        hash: "abc12345",
        date: "2025-06-15",
      });
      const [req, ctx] = makeRequest("testuser");
      await GET(req, ctx);
      expect(mockRenderBadgeSvg).toHaveBeenCalledWith(
        FAKE_STATS,
        FAKE_IMPACT,
        {
          avatarDataUri: "data:image/png;base64,abc123",
          verificationHash: "abc12345",
          verificationDate: "2025-06-15",
        },
      );
    });

    it("passes undefined hash/date when generateVerificationCode returns null", async () => {
      mockGenerateVerificationCode.mockReturnValue(null);
      const [req, ctx] = makeRequest("testuser");
      await GET(req, ctx);
      expect(mockRenderBadgeSvg).toHaveBeenCalledWith(
        FAKE_STATS,
        FAKE_IMPACT,
        {
          avatarDataUri: "data:image/png;base64,abc123",
          verificationHash: undefined,
          verificationDate: undefined,
        },
      );
    });
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  describe("error handling", () => {
    it("returns 500 when getStats throws", async () => {
      mockGetStats.mockRejectedValue(new Error("GitHub API error"));
      const [req, ctx] = makeRequest("testuser");
      const res = await GET(req, ctx);
      expect(res.status).toBe(500);
      const body = await res.text();
      expect(body).toBe("Failed to generate image");
    });

    it("returns 500 when computeImpactV4 throws", async () => {
      mockComputeImpactV4.mockImplementation(() => {
        throw new Error("Impact compute error");
      });
      const [req, ctx] = makeRequest("testuser");
      const res = await GET(req, ctx);
      expect(res.status).toBe(500);
      const body = await res.text();
      expect(body).toBe("Failed to generate image");
    });

    it("returns 500 when renderBadgeSvg throws", async () => {
      mockRenderBadgeSvg.mockImplementation(() => {
        throw new Error("Render error");
      });
      const [req, ctx] = makeRequest("testuser");
      const res = await GET(req, ctx);
      expect(res.status).toBe(500);
    });

    it("returns 500 when svgToPng throws", async () => {
      mockSvgToPng.mockImplementation(() => {
        throw new Error("PNG conversion failed");
      });
      const [req, ctx] = makeRequest("testuser");
      const res = await GET(req, ctx);
      expect(res.status).toBe(500);
      const body = await res.text();
      expect(body).toBe("Failed to generate image");
    });
  });
});
