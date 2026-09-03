/**
 * Rasterizer self-probe (#1275).
 *
 * Renders a tiny SVG with one word in each bundled family through the same
 * resvg configuration the OG route uses, then counts the bright pixels. If
 * the count is zero, resvg had no usable font and every OG image on this
 * host is shipping without text. That was the production state from v2.8.0
 * to v2.29.4 and nothing reported it: a file-existence check is not enough,
 * because the fonts can be present and still not reach resvg.
 *
 * The probe is cheap (a 160x60 canvas) and runs inside `/api/health`, so the
 * answer comes from the deployed function, not from a developer machine.
 */
import { renderAsync } from "@resvg/resvg-js";
import { getFontBuffers, getResvgFontOptions } from "./svg-to-png";
import { resolveFontFiles } from "./font-files";

export interface RasterProbe {
  status: "ok" | "no_glyphs";
  /** Bright pixels found in the sample. Zero means no glyph was drawn. */
  glyphPixels: number;
  /** Whether resvg received pre-loaded buffers or file paths. */
  fontSource: "buffers" | "files";
  fonts: Array<{ name: string; found: boolean; path: string }>;
  platform: string;
}

/** Bright pixels are the glyph fill (#fff) on a black ground. */
const BRIGHT = 200;
/** Two 40px words leave far more than this; a stray anti-alias edge does not. */
export const MIN_GLYPH_PIXELS = 50;

const SAMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="60">
  <rect width="160" height="60" fill="#000"/>
  <text x="6" y="44" font-family="'JetBrains Mono', monospace" font-size="40" font-weight="700" fill="#fff">Ab</text>
  <text x="84" y="44" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="40" font-weight="600" fill="#fff">Ab</text>
</svg>`;

export function countBrightPixels(pixels: Uint8Array, width: number, height: number): number {
  let count = 0;
  for (let i = 0; i < width * height * 4; i += 4) {
    if (pixels[i]! > BRIGHT && pixels[i + 1]! > BRIGHT && pixels[i + 2]! > BRIGHT) count++;
  }
  return count;
}

export async function probeRasterizer(): Promise<RasterProbe> {
  const image = await renderAsync(SAMPLE_SVG, {
    fitTo: { mode: "original" },
    font: getResvgFontOptions(),
    logLevel: "warn",
  });
  const glyphPixels = countBrightPixels(image.pixels, image.width, image.height);
  return {
    status: glyphPixels >= MIN_GLYPH_PIXELS ? "ok" : "no_glyphs",
    glyphPixels,
    fontSource: getFontBuffers() ? "buffers" : "files",
    fonts: resolveFontFiles().map(({ name, found, path }) => ({ name, found, path })),
    platform: `${process.platform}-${process.arch}`,
  };
}
