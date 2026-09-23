import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetReceiptVerificationV7, mockRateLimit } = vi.hoisted(() => ({
  mockGetReceiptVerificationV7: vi.fn(),
  mockRateLimit: vi.fn(),
}));

vi.mock("@/lib/verification/store", () => ({
  getReceiptVerificationV7: mockGetReceiptVerificationV7,
}));

vi.mock("@/lib/cache/redis", () => ({
  rateLimit: mockRateLimit,
}));

vi.mock("@/lib/http/client-ip", () => ({
  getClientIp: (req: Request) =>
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown",
}));

import { GET, OPTIONS } from "./route";
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

beforeEach(() => {
  vi.clearAllMocks();
  mockRateLimit.mockResolvedValue({ allowed: true, current: 1, limit: 30 });
});

describe("GET /api/verify/[hash]", () => {
  describe("retired v6 codes (#1335)", () => {
    it.each(["abc12345", "abc12345abc12345", "abc12345abc12345abc12345abc12345"])(
      "returns 410 retired_v6_code for a well-formed legacy hash %s",
      async (hash) => {
        const [req, ctx] = makeRequest(hash, "1.2.3.4");
        const res = await GET(req, ctx);
        expect(res.status).toBe(410);
        const body = await res.json();
        expect(body.status).toBe("retired_v6_code");
        expect(body.message).toMatch(/retired v6 verification code/i);
      },
    );

    it("never looks up or rate limits for a retired code", async () => {
      const [req, ctx] = makeRequest("abc12345", "1.2.3.4");
      await GET(req, ctx);
      expect(mockGetReceiptVerificationV7).not.toHaveBeenCalled();
      expect(mockRateLimit).not.toHaveBeenCalled();
    });

    it("includes CORS header on the 410 response", async () => {
      const [req, ctx] = makeRequest("abc12345", "1.2.3.4");
      const res = await GET(req, ctx);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });
  });

  describe("malformed input", () => {
    it("returns 400 for non-hex hash", async () => {
      const [req, ctx] = makeRequest("not-hex!", "1.2.3.4");
      const res = await GET(req, ctx);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBeDefined();
    });

    it("returns 400 for hash of 9 characters (neither 8 nor 16)", async () => {
      const [req, ctx] = makeRequest("abc123456", "1.2.3.4");
      const res = await GET(req, ctx);
      expect(res.status).toBe(400);
    });

    it("returns 400 for hash longer than 32 characters", async () => {
      const [req, ctx] = makeRequest("abc12345abc12345abc12345abc12345a", "1.2.3.4");
      const res = await GET(req, ctx);
      expect(res.status).toBe(400);
    });

    it("includes CORS header on 400 responses", async () => {
      const [req, ctx] = makeRequest("not-hex!", "1.2.3.4");
      const res = await GET(req, ctx);
      expect(res.status).toBe(400);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });
  });

  describe("OPTIONS preflight", () => {
    it("returns 204 with no body", async () => {
      const res = await OPTIONS();
      expect(res.status).toBe(204);
    });

    it("returns CORS headers", async () => {
      const res = await OPTIONS();
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(res.headers.get("Access-Control-Allow-Methods")).toBe("GET, POST, OPTIONS");
      expect(res.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type");
    });
  });
});
