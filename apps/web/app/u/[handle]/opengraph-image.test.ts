import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock dependencies BEFORE importing the module under test.
// ---------------------------------------------------------------------------

const { mockGetStats, mockComputeImpactV4, mockIsValidHandle, mockLoadOgFonts } =
  vi.hoisted(() => ({
    mockGetStats: vi.fn(),
    mockComputeImpactV4: vi.fn(),
    mockIsValidHandle: vi.fn(),
    mockLoadOgFonts: vi.fn(),
  }));

vi.mock("@/lib/github/client", () => ({
  getStats: mockGetStats,
}));

vi.mock("@/lib/impact/v4", () => ({
  computeImpactV4: mockComputeImpactV4,
}));

vi.mock("@/lib/validation", () => ({
  isValidHandle: mockIsValidHandle,
}));

vi.mock("@/lib/render/fonts", () => ({
  loadOgFonts: mockLoadOgFonts,
}));

// Mock next/og — ImageResponse is just a Response wrapper in tests
vi.mock("next/og", () => ({
  ImageResponse: class MockImageResponse extends Response {
    constructor(
      _element: unknown,
      _options?: { width?: number; height?: number },
    ) {
      super("mock-png-data", {
        headers: { "Content-Type": "image/png" },
      });
    }
  },
}));

import OgImage, { contentType, size, alt } from "./opengraph-image";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FAKE_FONTS: [ArrayBuffer, ArrayBuffer] = [
  new ArrayBuffer(8),
  new ArrayBuffer(8),
];

const FAKE_STATS = {
  handle: "testuser",
  displayName: "Test User",
  commitsTotal: 42,
  prsMergedCount: 10,
  reviewsSubmittedCount: 5,
  avatarUrl: "https://avatars.githubusercontent.com/u/12345",
  totalStars: 100,
  totalForks: 25,
  totalWatchers: 50,
};

const FAKE_IMPACT = {
  handle: "testuser",
  profileType: "collaborative",
  adjustedComposite: 75,
  compositeScore: 80,
  tier: "High",
  confidence: 85,
  dimensions: { building: 72, guarding: 60, consistency: 85, breadth: 68 },
  archetype: "Builder",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("opengraph-image", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsValidHandle.mockReturnValue(true);
    mockGetStats.mockResolvedValue(FAKE_STATS);
    mockComputeImpactV4.mockReturnValue(FAKE_IMPACT);
    mockLoadOgFonts.mockResolvedValue(FAKE_FONTS);
  });

  // -------------------------------------------------------------------------
  // Exports
  // -------------------------------------------------------------------------

  describe("exports", () => {
    it("exports correct size (1200x630)", () => {
      expect(size).toEqual({ width: 1200, height: 630 });
    });

    it("exports content type as image/png", () => {
      expect(contentType).toBe("image/png");
    });

    it("exports alt text", () => {
      expect(alt).toBeDefined();
      expect(typeof alt).toBe("string");
    });
  });

  // -------------------------------------------------------------------------
  // Successful generation
  // -------------------------------------------------------------------------

  describe("successful generation", () => {
    it("returns a Response for a valid handle", async () => {
      const res = await OgImage({
        params: Promise.resolve({ handle: "testuser" }),
      });
      expect(res).toBeInstanceOf(Response);
    });

    it("calls getStats with the handle", async () => {
      await OgImage({ params: Promise.resolve({ handle: "testuser" }) });
      expect(mockGetStats).toHaveBeenCalledWith("testuser");
    });

    it("calls computeImpactV4 with stats", async () => {
      await OgImage({ params: Promise.resolve({ handle: "testuser" }) });
      expect(mockComputeImpactV4).toHaveBeenCalledWith(FAKE_STATS);
    });
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  describe("error handling", () => {
    it("returns a fallback image when handle is invalid", async () => {
      mockIsValidHandle.mockReturnValue(false);
      const res = await OgImage({
        params: Promise.resolve({ handle: "bad!!user" }),
      });
      expect(res).toBeInstanceOf(Response);
    });

    it("does not call getStats when handle is invalid", async () => {
      mockIsValidHandle.mockReturnValue(false);
      await OgImage({ params: Promise.resolve({ handle: "bad!!user" }) });
      expect(mockGetStats).not.toHaveBeenCalled();
    });

    it("returns a fallback image when stats fetch fails", async () => {
      mockGetStats.mockResolvedValue(null);
      const res = await OgImage({
        params: Promise.resolve({ handle: "testuser" }),
      });
      expect(res).toBeInstanceOf(Response);
    });

    it("does not call computeImpactV4 when stats fetch fails", async () => {
      mockGetStats.mockResolvedValue(null);
      await OgImage({ params: Promise.resolve({ handle: "testuser" }) });
      expect(mockComputeImpactV4).not.toHaveBeenCalled();
    });
  });
});
