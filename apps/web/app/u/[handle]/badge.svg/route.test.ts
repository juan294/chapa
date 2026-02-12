import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock dependencies BEFORE importing the route handler.
// ---------------------------------------------------------------------------

const {
  mockGetStats90d,
  mockComputeImpactV4,
  mockRenderBadgeSvg,
  mockReadSessionCookie,
  mockIsValidHandle,
  mockRateLimit,
  mockFetchAvatarBase64,
} = vi.hoisted(() => ({
  mockGetStats90d: vi.fn(),
  mockComputeImpactV4: vi.fn(),
  mockRenderBadgeSvg: vi.fn(),
  mockReadSessionCookie: vi.fn(),
  mockIsValidHandle: vi.fn(),
  mockRateLimit: vi.fn(),
  mockFetchAvatarBase64: vi.fn(),
}));

vi.mock("@/lib/github/client", () => ({
  getStats90d: mockGetStats90d,
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
    mockGetStats90d.mockResolvedValue(FAKE_STATS);
    mockComputeImpactV4.mockReturnValue(FAKE_IMPACT);
    mockRenderBadgeSvg.mockReturnValue(FAKE_SVG);
    mockFetchAvatarBase64.mockResolvedValue("data:image/png;base64,abc123");
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
        "public, s-maxage=86400, stale-while-revalidate=604800",
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

    it("calls getStats90d with the handle", async () => {
      const [req, ctx] = makeRequest("testuser", "1.2.3.4");
      await GET(req, ctx);
      expect(mockGetStats90d).toHaveBeenCalledWith("testuser", undefined);
    });

    it("passes stats to computeImpactV4", async () => {
      const [req, ctx] = makeRequest("testuser", "1.2.3.4");
      await GET(req, ctx);
      expect(mockComputeImpactV4).toHaveBeenCalledWith(FAKE_STATS);
    });

    it("passes stats, impact, and avatarDataUri to renderBadgeSvg", async () => {
      const [req, ctx] = makeRequest("testuser", "1.2.3.4");
      await GET(req, ctx);
      expect(mockRenderBadgeSvg).toHaveBeenCalledWith(FAKE_STATS, FAKE_IMPACT, {
        avatarDataUri: "data:image/png;base64,abc123",
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
      });
    });

    it("passes undefined avatarDataUri when stats has no avatarUrl", async () => {
      mockGetStats90d.mockResolvedValue({ ...FAKE_STATS, avatarUrl: undefined });
      const [req, ctx] = makeRequest("testuser", "1.2.3.4");
      await GET(req, ctx);
      expect(mockFetchAvatarBase64).not.toHaveBeenCalled();
      expect(mockRenderBadgeSvg).toHaveBeenCalledWith(
        { ...FAKE_STATS, avatarUrl: undefined },
        FAKE_IMPACT,
        { avatarDataUri: undefined },
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

    it("validates handle before processing (does not call getStats90d)", async () => {
      mockIsValidHandle.mockReturnValue(false);
      const [req, ctx] = makeRequest("bad!!handle", "1.2.3.4");
      await GET(req, ctx);
      expect(mockGetStats90d).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // W1: Stats fetch failure
  // -------------------------------------------------------------------------

  describe("stats fetch failure", () => {
    it("returns fallback SVG when stats fetch returns null", async () => {
      mockGetStats90d.mockResolvedValue(null);
      const [req, ctx] = makeRequest("testuser", "1.2.3.4");
      const res = await GET(req, ctx);
      const body = await res.text();
      expect(body).toContain("<svg");
      expect(body).toContain("Could not load data");
    });

    it("returns shorter cache TTL on error fallback (s-maxage=300)", async () => {
      mockGetStats90d.mockResolvedValue(null);
      const [req, ctx] = makeRequest("testuser", "1.2.3.4");
      const res = await GET(req, ctx);
      expect(res.headers.get("Cache-Control")).toBe(
        "public, s-maxage=300, stale-while-revalidate=600",
      );
    });

    it("returns Content-Type: image/svg+xml on error fallback", async () => {
      mockGetStats90d.mockResolvedValue(null);
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

    it("does not call getStats90d when rate limited", async () => {
      mockRateLimit.mockResolvedValue({ allowed: false, current: 101, limit: 100 });
      const [req, ctx] = makeRequest("testuser", "1.2.3.4");
      await GET(req, ctx);
      expect(mockGetStats90d).not.toHaveBeenCalled();
    });
  });
});
