/**
 * Server-side SVG-to-PNG conversion using resvg.
 *
 * Used by the OG image route to render the actual badge SVG as a PNG
 * for social card previews (X/Twitter, LinkedIn, etc.).
 */

import { Resvg } from "@resvg/resvg-js";
import { join } from "path";

/** Font files bundled in public/fonts/ for server-side SVG rendering. */
const FONT_FILES = [
  "PlusJakartaSans-Regular.ttf",
  "PlusJakartaSans-SemiBold.ttf",
  "JetBrainsMono-Regular.ttf",
  "JetBrainsMono-Bold.ttf",
];

/**
 * Resolve absolute paths to the bundled TTF font files.
 *
 * Uses `process.cwd()` which points to the Next.js app root both locally
 * and on Vercel serverless functions.
 */
export function getFontPaths(): string[] {
  return FONT_FILES.map((f) => join(process.cwd(), "public", "fonts", f));
}

/**
 * Strip all animations from an SVG string so it renders as a static image.
 *
 * Removes:
 * - CSS @keyframes blocks
 * - CSS animation properties in style attributes
 * - SMIL <animate> elements (used by heatmap fade-in)
 * - Sets opacity="0" → opacity="1" (heatmap rects start hidden)
 */
export function stripSvgAnimations(svg: string): string {
  let result = svg;
  // CSS @keyframes blocks
  result = result.replace(/@keyframes[^}]*\{[^}]*\{[^}]*\}[^}]*\}/g, "");
  // CSS animation properties in style attributes
  result = result.replace(/animation[^;"]*/g, "");
  // SMIL <animate> elements (self-closing and with content)
  result = result.replace(/<animate [^>]*\/>/g, "");
  result = result.replace(/<animate [^>]*>[^<]*<\/animate>/g, "");
  // Set hidden heatmap rects to fully visible
  result = result.replace(/opacity="0"/g, 'opacity="1"');
  return result;
}

/**
 * Convert an SVG string to a PNG buffer at the given dimensions.
 *
 * Loads bundled TTF fonts (Plus Jakarta Sans, JetBrains Mono) so text
 * renders correctly in serverless environments where these fonts are
 * not installed (e.g. Vercel).
 *
 * @param svg - Complete SVG markup string
 * @param width - Target PNG width in pixels (default: 1200)
 * @returns PNG image as a Uint8Array buffer
 */
export function svgToPng(svg: string, width = 1200): Uint8Array {
  const staticSvg = stripSvgAnimations(svg);
  const resvg = new Resvg(staticSvg, {
    fitTo: { mode: "width", value: width },
    font: {
      loadSystemFonts: false,
      fontFiles: getFontPaths(),
    },
  });
  const rendered = resvg.render();
  return rendered.asPng();
}
