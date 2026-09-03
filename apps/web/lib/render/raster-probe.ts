/**
 * Rasterizer self-probe (#1275).
 *
 * Renders a tiny SVG with one word in each bundled family through the same
 * resvg configuration the OG route uses, then counts the bright pixels. If
 * the count is zero, resvg had no usable font and every OG image on this
 * host is shipping without text. That was the production state up to
 * v2.29.4 and nothing reported it: a file-existence check is not enough,
 * because the fonts can be present, valid, loaded, and still not reach the
 * glyph rasterizer.
 *
 * When the production path draws nothing, the probe also renders the same
 * sample through alternative resvg entry points and font sources, so the
 * health response says which path works on this host instead of costing a
 * redeploy per guess. That is how #1275 was diagnosed: on linux-x64 the
 * `fontBuffers` variants drew 0 glyph pixels and every file-based variant
 * drew 1118, which is why production passes files.
 *
 * The probe is cheap (a 160x60 canvas) and runs inside `/api/health`, so the
 * answer comes from the deployed function, not from a developer machine.
 */
import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { Resvg, renderAsync, type ResvgRenderOptions } from "@resvg/resvg-js";
import { getResvgFontOptions } from "./svg-to-png";
import { resolveFontFiles } from "./font-files";

export interface RasterProbe {
  status: "ok" | "no_glyphs";
  /** Bright pixels found in the sample through the production path. */
  glyphPixels: number;
  fonts: Array<{ name: string; found: boolean; bytes: number; path: string }>;
  platform: string;
  /** Glyph pixels per alternative render path; only computed when the production path drew nothing. */
  variants?: Record<string, number | string>;
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

// `fontBuffers` is accepted at runtime by some resvg-js 2.6.2 binaries and
// ignored by the linux-x64 one; it is absent from the type definitions.
// It stays here only as a diagnostic variant.
type FontOptions = NonNullable<ResvgRenderOptions["font"]> & { fontBuffers?: Buffer[] };

async function glyphsAsync(font: FontOptions): Promise<number> {
  const image = await renderAsync(SAMPLE_SVG, {
    fitTo: { mode: "original" },
    font,
    logLevel: "warn",
  });
  return countBrightPixels(image.pixels, image.width, image.height);
}

function glyphsSync(font: FontOptions): number {
  const image = new Resvg(SAMPLE_SVG, {
    fitTo: { mode: "original" },
    font,
    logLevel: "warn",
  }).render();
  return countBrightPixels(image.pixels, image.width, image.height);
}

async function tryVariant(run: () => number | Promise<number>): Promise<number | string> {
  try {
    return await run();
  } catch (e) {
    return `error: ${e instanceof Error ? e.message : String(e)}`;
  }
}

/**
 * Alternative render paths, run only when the production path drew nothing.
 * Each answers one question about the host: does the sync entry point draw,
 * does a font directory draw (fontdb directory loading), do in-memory
 * buffers draw (the path that fails on linux-x64), and are there any
 * system fonts at all.
 */
async function probeVariants(): Promise<Record<string, number | string>> {
  const files = resolveFontFiles().map((r) => r.path);
  const dirs = [...new Set(files.map((f) => dirname(f)))];
  const out: Record<string, number | string> = {};
  out.syncFiles = await tryVariant(() => glyphsSync({ loadSystemFonts: false, fontFiles: files }));
  out.asyncDirs = await tryVariant(() => glyphsAsync({ loadSystemFonts: false, fontDirs: dirs }));
  out.asyncBuffers = await tryVariant(() =>
    glyphsAsync({ loadSystemFonts: false, fontBuffers: files.map((f) => readFileSync(f)) }),
  );
  out.asyncSystemFonts = await tryVariant(() => glyphsAsync({ loadSystemFonts: true }));
  return out;
}

export async function probeRasterizer(): Promise<RasterProbe> {
  const glyphPixels = await glyphsAsync(getResvgFontOptions());
  const probe: RasterProbe = {
    status: glyphPixels >= MIN_GLYPH_PIXELS ? "ok" : "no_glyphs",
    glyphPixels,
    fonts: resolveFontFiles().map(({ name, found, bytes, path }) => ({ name, found, bytes, path })),
    platform: `${process.platform}-${process.arch}`,
  };
  if (probe.status === "no_glyphs") probe.variants = await probeVariants();
  return probe;
}
