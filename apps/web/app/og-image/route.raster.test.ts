// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { renderAsync } from "@resvg/resvg-js";
import { getResvgFontOptions, svgToPng } from "@/lib/render/svg-to-png";
import { GET } from "./route";

vi.mock("@/lib/render/svg-to-png", async importOriginal => {
  const actual = await importOriginal<typeof import("@/lib/render/svg-to-png")>();
  return {...actual, svgToPng: vi.fn(actual.svgToPng)};
});

describe("root social card real raster", () => {
  it("renders complete wordmark, tagline and URL with the bundled font files", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const png = Buffer.from(await response.arrayBuffer());
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    const svg = vi.mocked(svgToPng).mock.calls.at(-1)![0];
    const painted = await renderAsync(svg, {font: getResvgFontOptions()});
    const empty = await renderAsync(svg, {font: {loadSystemFonts: false, fontFiles: []}});
    const pixels = painted.pixels;
    const missing = empty.pixels;
    for (const [x0, y0, x1, y1] of [[350, 110, 850, 205], [200, 220, 1000, 265], [350, 565, 850, 605]]) {
      let changed = 0;
      for (let y = y0!; y < y1!; y++) for (let x = x0!; x < x1!; x++) {
        const at = (y * painted.width + x) * 4;
        if (pixels[at] !== missing[at] || pixels[at + 1] !== missing[at + 1] || pixels[at + 2] !== missing[at + 2]) changed++;
      }
      expect(changed).toBeGreaterThan(100);
    }
  });
});
