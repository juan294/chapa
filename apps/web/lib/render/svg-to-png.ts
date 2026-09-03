/**
 * Server-side SVG-to-PNG conversion using resvg.
 *
 * Used by the OG image route to render the actual badge SVG as a PNG
 * for social card previews (X/Twitter, LinkedIn, etc.).
 */

import { renderAsync } from "@resvg/resvg-js";
import { captureServerError } from "@/lib/analytics/server-errors";
import { resolveFontFiles } from "./font-files";

export { getFontPaths } from "./font-files";

/**
 * Font paths resolved once at module scope and handed to resvg as FILES.
 *
 * #1275 — never as buffers. From v2.11.0 (2026-06-19, the font-buffer-reuse
 * change) to v2.29.4 the fonts were read into memory once and passed as
 * `fontBuffers`. The resvg-js 2.6.2 binary for linux-x64, which is what a
 * Vercel function runs, silently ignores that option: measured inside the
 * function, `fontBuffers` drew 0 glyph pixels and `fontFiles` with the same
 * four files drew 1118, sync and async alike. The darwin-arm64 binary
 * honours it, which is why every local render and every mocked test
 * passed while every production OG image shipped without text. The option
 * is absent from the package's own type definitions; it only typechecked
 * because it was never written as an object literal.
 *
 * A missing font is recorded, not swallowed: `svgToPng` reports it through
 * `captureServerError` (once per instance) and resvg logs missing-font
 * warnings, so a font regression is observable in PostHog and in the
 * function logs. The module still loads without fonts so a unit-test
 * sandbox can exercise the rest of the pipeline.
 */
const _fontResolution = resolveFontFiles();
const _fontPaths: string[] = _fontResolution.map((r) => r.path);
const _missingFonts = _fontResolution.filter((r) => !r.found);
const _fontLoadError: Error | undefined =
  _missingFonts.length > 0
    ? new Error(
        `Bundled fonts not found: ${_missingFonts
          .map((r) => `${r.name} (tried ${r.tried.join(", ")})`)
          .join("; ")}`,
      )
    : undefined;

/**
 * The `font` option handed to resvg: the four validated file paths, system
 * fonts never consulted, so the badge renders identically on every host.
 *
 * @internal exported for the raster probe and the real-resvg tests
 */
export function getResvgFontOptions(): { loadSystemFonts: false; fontFiles: string[] } {
  return { loadSystemFonts: false, fontFiles: _fontPaths };
}

let _fontFailureReported = false;

function reportFontFailureOnce(): void {
  if (_fontFailureReported || _fontLoadError === undefined) return;
  _fontFailureReported = true;
  console.error("[svg-to-png] bundled fonts unavailable; text will not rasterize:", _fontLoadError.message);
  void captureServerError({
    route: "lib/render/svg-to-png",
    statusCode: 500,
    error: _fontLoadError,
  });
}

/**
 * Remove every `@keyframes name { ... }` block from a CSS string, correctly
 * consuming ANY number of nested `{ ... }` rule blocks inside it.
 *
 * #1168 UX-M6 (critical note): the previous implementation used a fixed
 * 2-brace-deep regex (`/@keyframes[^}]*\{[^}]*\{[^}]*\}[^}]*\}/`), which only
 * matches a @keyframes block with exactly ONE inner rule. The real badge's
 * `pulse-glow` keyframes has TWO inner rules ("0%, 100% {...}" and "50%
 * {...}"), so the old regex stopped after the first one and left the
 * @keyframes block's own outer closing brace unconsumed — a stray "}" bleeding
 * into whatever CSS followed (here, the new `prefers-reduced-motion` @media
 * block). Verified this didn't visibly corrupt rasterization via real resvg
 * output, but it's fragile: a brace-depth counter handles it exactly instead.
 */
function stripKeyframesBlocks(css: string): string {
  const KEYFRAMES = "@keyframes";
  let result = "";
  let i = 0;
  for (;;) {
    const start = css.indexOf(KEYFRAMES, i);
    if (start === -1) {
      result += css.slice(i);
      break;
    }
    result += css.slice(i, start);
    const braceStart = css.indexOf("{", start);
    if (braceStart === -1) {
      // Malformed (no opening brace) — leave the rest untouched rather than
      // risk eating unrelated CSS.
      result += css.slice(start);
      break;
    }
    let depth = 1;
    let j = braceStart + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") depth--;
      j++;
    }
    i = j; // Resume right after the matching outer closing brace.
  }
  return result;
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
  // CSS @keyframes blocks (brace-depth aware — see stripKeyframesBlocks)
  result = stripKeyframesBlocks(result);
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
 * not installed (e.g. Vercel). Passed as file paths on purpose; see the
 * note on `_fontPaths` above (#1275).
 *
 * PE-M5 (#1090): Uses resvg-js's `renderAsync`, a genuinely async native
 * binding (offloaded to libuv's threadpool by the underlying napi-rs
 * addon), instead of the synchronous `Resvg.render()`. The old synchronous
 * call ran the entire rasterization on the JS main thread with no yield
 * point, so `withTimeout`'s `setTimeout` — a macrotask — could never be
 * serviced until rasterization finished, making its timeout branch dead
 * code. `renderAsync` returns a real pending Promise, so the event loop
 * (and any concurrent request on the same warm instance, including a
 * badge.svg cache hit) stays responsive while rasterization runs, and a
 * slow render can now actually be interrupted by `withTimeout`.
 *
 * @param svg - Complete SVG markup string
 * @param width - Target PNG width in pixels (default: 1200)
 * @returns PNG image as a Uint8Array buffer
 */
export async function svgToPng(svg: string, width = 1200): Promise<Uint8Array> {
  const staticSvg = stripSvgAnimations(svg);
  reportFontFailureOnce();
  const rendered = await renderAsync(staticSvg, {
    fitTo: { mode: "width", value: width },
    font: getResvgFontOptions(),
    // #1275 — resvg drops text it has no font for. "warn" makes that visible
    // in the function logs instead of a silently empty social card.
    logLevel: "warn",
  });
  return rendered.asPng();
}
