// @vitest-environment node
import { describe, it, expect } from "vitest";
import { renderAsync, type ResvgRenderOptions } from "@resvg/resvg-js";
import { getResvgFontOptions } from "./svg-to-png";
import { renderBadgeSvg } from "./BadgeSvg";
import { DEMO_STATS } from "./demoData";
import { DEMO_SCORING } from "./__fixtures__/demo-scoring";

/**
 * #1275 — real-resvg regression tests.
 *
 * The unit suite mocks `@resvg/resvg-js`, so it could never notice that the
 * fonts resvg was handed did not reach it. From v2.11.0 to v2.29.4 every
 * production OG image shipped without a single glyph and nothing failed.
 * These tests rasterize for real and count pixels, so "no text" is a red
 * test rather than an invisible social card.
 *
 * The negative cases render with fonts that cannot be found. They document
 * the exact failure mode: resvg silently drops every `<text>` node and the
 * PNG still comes back well-formed.
 */

const NO_FONTS: ResvgRenderOptions["font"] = {
  loadSystemFonts: false,
  fontFiles: ["/nonexistent/chapa-font-a.ttf", "/nonexistent/chapa-font-b.ttf"],
};

function textSample(family: string, weight: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="80">
  <rect width="240" height="80" fill="#000"/>
  <text x="12" y="52" font-family="${family}" font-size="40" font-weight="${weight}" fill="#fff">Chapa 82</text>
</svg>`;
}

async function brightPixels(
  svg: string,
  fontOptions: ResvgRenderOptions["font"],
  region?: { x0: number; y0: number; x1: number; y1: number },
): Promise<number> {
  const image = await renderAsync(svg, {
    fitTo: { mode: "original" },
    font: fontOptions,
  });
  const { width, height, pixels } = image;
  const box = region ?? { x0: 0, y0: 0, x1: width, y1: height };
  let count = 0;
  for (let y = Math.max(0, box.y0); y < Math.min(height, box.y1); y++) {
    for (let x = Math.max(0, box.x0); x < Math.min(width, box.x1); x++) {
      const i = (y * width + x) * 4;
      const r = pixels[i]!;
      const g = pixels[i + 1]!;
      const b = pixels[i + 2]!;
      if (r > 200 && g > 200 && b > 200) count++;
    }
  }
  return count;
}

describe("svgToPng fonts — glyphs actually rasterize (#1275)", () => {
  const cases: Array<[string, number]> = [
    ["'Plus Jakarta Sans', system-ui, sans-serif", 400],
    ["'Plus Jakarta Sans', system-ui, sans-serif", 600],
    ["'JetBrains Mono', monospace", 400],
    ["'JetBrains Mono', monospace", 700],
  ];

  for (const [family, weight] of cases) {
    it(`renders ${family.split(",")[0]} weight ${weight} with the bundled fonts`, async () => {
      const lit = await brightPixels(textSample(family, weight), getResvgFontOptions());
      expect(lit).toBeGreaterThan(200);
    });
  }

  it("renders NO glyphs when the fonts cannot be found, and does not throw (the #1275 failure mode)", async () => {
    const lit = await brightPixels(textSample("'JetBrains Mono', monospace", 700), NO_FONTS);
    expect(lit).toBe(0);
  });

  // Files, never buffers: the linux-x64 resvg-js binary ignores fontBuffers
  // (measured in the deployed function: 0 glyph pixels vs 1118 with files).
  it("hands resvg the four validated font FILES and never buffers", () => {
    const options = getResvgFontOptions() as Record<string, unknown>;
    expect(options.loadSystemFonts).toBe(false);
    expect(options.fontFiles).toHaveLength(4);
    expect(options.fontBuffers).toBeUndefined();
  });
});

describe("OG badge — the score number is visible in the rasterized badge (#1275)", () => {
  const svg = renderBadgeSvg(DEMO_STATS, {
    scoring: DEMO_SCORING,
    demoMode: true,
    disableAnimation: true,
  });

  // Locate the score text from the SVG itself rather than hard-coding the
  // layout: a stable data-element marker, including static output..
  const match = svg.match(
    /<text data-element="score"[^>]*x="([\d.]+)" y="([\d.]+)"/,
  );
  const cx = Number(match?.[1]);
  const cy = Number(match?.[2]);
  const region = { x0: cx - 30, y0: cy - 22, x1: cx + 30, y1: cy + 22 };

  it("locates the score glyph box from the SVG", () => {
    expect(match).not.toBeNull();
    expect(Number.isFinite(cx) && Number.isFinite(cy)).toBe(true);
  });

  it("has near-white digit pixels inside the score ring with the bundled fonts", async () => {
    const lit = await brightPixels(svg, getResvgFontOptions(), region);
    expect(lit).toBeGreaterThan(100);
  });

  it("has none of them when fonts are missing (what production shipped from v2.11.0 to v2.29.4)", async () => {
    const lit = await brightPixels(svg, NO_FONTS, region);
    expect(lit).toBe(0);
  });
});


describe("Ice Terminal complete raster at embed sizes", () => {
  it("keeps the maximum score glyphs inside the opaque ring interior", async () => {
    const svg = renderBadgeSvg(DEMO_STATS, { scoring: { ...DEMO_SCORING, composite: { kind: "point", value: 100, display: 100 } }, disableAnimation: true });
    const painted = await renderAsync(svg, { font: getResvgFontOptions() });
    const missing = await renderAsync(svg, { font: NO_FONTS });
    const paintedPixels = painted.pixels;
    const missingPixels = missing.pixels;
    let glyphPixels = 0;
    for (let y = 414; y < 518; y++) {
      for (let x = 875; x < 985; x++) {
        const at = (y * painted.width + x) * 4;
        if (paintedPixels[at] !== missingPixels[at] || paintedPixels[at + 1] !== missingPixels[at + 1] || paintedPixels[at + 2] !== missingPixels[at + 2]) {
          glyphPixels++;
          // r46 minus half of the 4px ring stroke leaves an opaque r44 interior.
          expect(Math.hypot(x + 0.5 - 930, y + 0.5 - 466)).toBeLessThan(44);
        }
      }
    }
    expect(glyphPixels).toBeGreaterThan(100);
  });

  for (const width of [1200, 600]) {
    it(`paints name and score glyphs at ${width}px with a real missing-font negative control`, async () => {
      const svg = renderBadgeSvg(DEMO_STATS, { scoring: DEMO_SCORING, demoMode: true, disableAnimation: true });
      const withFonts = await renderAsync(svg, { fitTo: { mode: "width", value: width }, font: getResvgFontOptions() });
      const withoutFonts = await renderAsync(svg, { fitTo: { mode: "width", value: width }, font: NO_FONTS });
      // resvg's native pixels getter copies the buffer. Read it once per image,
      // not once per pixel in the crop scan (tens of thousands of full copies).
      const paintedPixels = withFonts.pixels;
      const missingFontPixels = withoutFonts.pixels;
      expect(withFonts.width).toBe(width);
      expect(withFonts.height).toBe(width * 630 / 1200);
      for (const [x0, y0, x1, y1] of [[132, 42, 800, 78], [900, 444, 960, 488]]) {
        let changed = 0;
        const scale = width / 1200;
        for (let y = Math.floor(y0! * scale); y < Math.floor(y1! * scale); y++) {
          for (let x = Math.floor(x0! * scale); x < Math.floor(x1! * scale); x++) {
            const at = (y * width + x) * 4;
            if (paintedPixels[at] !== missingFontPixels[at]) changed++;
          }
        }
        expect(changed).toBeGreaterThan(40);
      }
    });
  }
});
