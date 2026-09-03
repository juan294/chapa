// @vitest-environment node
import { describe, it, expect } from "vitest";
import { countBrightPixels, MIN_GLYPH_PIXELS, probeRasterizer } from "./raster-probe";

// #1275 — real resvg, no mocks. This is the same probe /api/health runs in
// the deployed function; here it proves the probe itself is sound.
describe("probeRasterizer", () => {
  it("reports ok with a healthy glyph count on this host", async () => {
    const probe = await probeRasterizer();
    expect(probe.status).toBe("ok");
    expect(probe.glyphPixels).toBeGreaterThanOrEqual(MIN_GLYPH_PIXELS);
    expect(probe.fonts).toHaveLength(4);
    expect(probe.fonts.every((f) => f.found && f.bytes > 60_000)).toBe(true);
    expect(probe.platform).toMatch(/^[a-z]+-[a-z0-9]+$/);
  });
});

describe("countBrightPixels", () => {
  it("counts only pixels that are bright on every channel", () => {
    // 2x2 RGBA: white, red, near-white, black
    const px = new Uint8Array([
      255, 255, 255, 255,
      255, 0, 0, 255,
      201, 201, 201, 255,
      0, 0, 0, 255,
    ]);
    expect(countBrightPixels(px, 2, 2)).toBe(2);
  });
});
