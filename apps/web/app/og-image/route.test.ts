import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSvgToPng } = vi.hoisted(() => ({
  mockSvgToPng: vi.fn(),
}));

vi.mock("@/lib/render/svg-to-png", () => ({
  svgToPng: mockSvgToPng,
}));

import { GET } from "./route";

const FAKE_PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

describe("GET /og-image", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSvgToPng.mockReturnValue(FAKE_PNG);
  });

  it("returns 200 with Content-Type image/png", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
  });

  it("returns PNG buffer as response body", async () => {
    const res = await GET();
    const body = await res.arrayBuffer();
    expect(new Uint8Array(body)).toEqual(
      new Uint8Array(Buffer.from(FAKE_PNG)),
    );
  });

  it("sets Cache-Control with 24h s-maxage", async () => {
    const res = await GET();
    expect(res.headers.get("Cache-Control")).toBe(
      "public, s-maxage=86400, stale-while-revalidate=604800",
    );
  });

  it("calls svgToPng with width 1200", async () => {
    await GET();
    expect(mockSvgToPng).toHaveBeenCalledWith(expect.any(String), 1200);
  });

  it("passes valid SVG with Chapa branding", async () => {
    await GET();
    const svgArg = mockSvgToPng.mock.calls[0]![0] as string;
    expect(svgArg).toContain("<svg");
    expect(svgArg).toContain('viewBox="0 0 1200 630"');
    expect(svgArg).toContain("Chapa");
    expect(svgArg).toContain("Developer Impact, Decoded");
  });

  it("includes full-year heatmap grid (52 cols x 7 rows)", async () => {
    await GET();
    const svgArg = mockSvgToPng.mock.calls[0]![0] as string;
    // 7 x 52 = 364 heatmap cells + 1 background rect = 365
    const rectCount = (svgArg.match(/<rect /g) ?? []).length;
    expect(rectCount).toBe(365);
  });

  it("includes site URL in the SVG", async () => {
    await GET();
    const svgArg = mockSvgToPng.mock.calls[0]![0] as string;
    expect(svgArg).toContain("chapa.thecreativetoken.com");
  });

  it("returns 500 when svgToPng throws", async () => {
    // Silence expected console.error from the error-handling code path
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    mockSvgToPng.mockImplementation(() => {
      throw new Error("PNG conversion failed");
    });
    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.text();
    expect(body).toBe("Failed to generate image");

    consoleSpy.mockRestore();
  });
});
