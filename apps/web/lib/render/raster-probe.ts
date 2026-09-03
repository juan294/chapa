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
 * The probe also renders the same sample through alternative resvg entry
 * points and font sources (sync vs async, buffers vs files vs directory),
 * so a host where the production path fails reports which path works. The
 * fix's preview deployment on linux-x64 had all four fonts present and
 * valid, buffers loaded, and zero glyphs; the variants are how that gets
 * diagnosed from a health response instead of a redeploy per guess.
 *
 * The probe is cheap (a 160x60 canvas) and runs inside `/api/health`, so the
 * answer comes from the deployed function, not from a developer machine.
 */
import { dirname } from "node:path";
import { Resvg, renderAsync, type ResvgRenderOptions } from "@resvg/resvg-js";
import { getFontBuffers, getResvgFontOptions } from "./svg-to-png";
import { resolveFontFiles } from "./font-files";

export interface RasterProbe {
  status: "ok" | "no_glyphs";
  /** Bright pixels found in the sample through the production path. */
  glyphPixels: number;
  /** Whether resvg received pre-loaded buffers or file paths. */
  fontSource: "buffers" | "files";
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

// resvg-js 2.6.2 accepts `fontBuffers` at runtime (since 2.5.0) but its
// type definitions do not declare it, which is also why the production
// path's use of it never failed a typecheck.
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
 * Each answers one question about the host: does the sync entry point draw
 * (async task marshalling), do file paths draw (buffer marshalling), does a
 * font directory draw (fontdb file loading), does a default family help
 * (family-name matching).
 */
async function probeVariants(): Promise<Record<string, number | string>> {
  const resolved = resolveFontFiles();
  const files = resolved.map((r) => r.path);
  const dirs = [...new Set(files.map((f) => dirname(f)))];
  const buffers = getFontBuffers();
  const out: Record<string, number | string> = {};
  if (buffers) out.syncBuffers = await tryVariant(() => glyphsSync({ loadSystemFonts: false, fontBuffers: buffers }));
  out.asyncFiles = await tryVariant(() => glyphsAsync({ loadSystemFonts: false, fontFiles: files }));
  out.syncFiles = await tryVariant(() => glyphsSync({ loadSystemFonts: false, fontFiles: files }));
  out.asyncDirs = await tryVariant(() => glyphsAsync({ loadSystemFonts: false, fontDirs: dirs }));
  out.asyncFilesDefaultFamily = await tryVariant(() =>
    glyphsAsync({ loadSystemFonts: false, fontFiles: files, defaultFontFamily: "JetBrains Mono" }),
  );
  out.asyncSystemFonts = await tryVariant(() => glyphsAsync({ loadSystemFonts: true }));
  return out;
}

export async function probeRasterizer(): Promise<RasterProbe> {
  const glyphPixels = await glyphsAsync(getResvgFontOptions());
  const probe: RasterProbe = {
    status: glyphPixels >= MIN_GLYPH_PIXELS ? "ok" : "no_glyphs",
    glyphPixels,
    fontSource: getFontBuffers() ? "buffers" : "files",
    fonts: resolveFontFiles().map(({ name, found, bytes, path }) => ({ name, found, bytes, path })),
    platform: `${process.platform}-${process.arch}`,
  };
  if (probe.status === "no_glyphs") probe.variants = await probeVariants();
  return probe;
}
