/**
 * Bundled TTF fonts for server-side rasterization (resvg).
 *
 * These files are ONLY read by `svgToPng` (OG images). They are deliberately
 * not in `public/`; the browser gets the same families through
 * `next/font/google` in `layout.tsx`.
 *
 * #1275 — why this module exists on its own, and why it is shaped this way.
 *
 * From v2.8.0 to v2.29.4 every production OG image rendered with NO text:
 * no name, score, labels or footer. `getFontPaths()` resolved the four files
 * with `new URL(\`./fonts/${name}\`, import.meta.url)`. Turbopack cannot
 * statically resolve a template literal, so it compiled the whole expression
 * to ONE traced asset (Plus Jakarta Sans Regular) and, in the deployed
 * function, even that path did not open. The module-scope read failed
 * silently, the `fontFiles` fallback pointed at the same dead paths, and
 * resvg drops every `<text>` node it has no font for, without logging.
 *
 * Three rules follow:
 *
 * 1. One STATIC `new URL("<literal>", import.meta.url)` per file. That is the
 *    form bundlers rewrite into a traced asset; there is no loop over names.
 * 2. More than one candidate per file. The bundler asset is tried first, then
 *    the source path under `process.cwd()` for both a root-directory deploy
 *    (`apps/web` is the Vercel root) and a monorepo-root process. The
 *    `outputFileTracingIncludes` entries in `next.config.ts` are what keep
 *    the source copies inside the function bundle.
 * 3. Missing is a state, not an exception. `resolveFontFiles()` reports what
 *    was tried and what was found, so `svgToPng` can capture an error and
 *    `/api/health` can report it, instead of a silent fallback.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const FONT_FILES = [
  "PlusJakartaSans-Regular.ttf",
  "PlusJakartaSans-SemiBold.ttf",
  "JetBrainsMono-Regular.ttf",
  "JetBrainsMono-Bold.ttf",
] as const;

export type FontFileName = (typeof FONT_FILES)[number];

// One literal per file, on purpose: see rule 1 above.
const FONT_ASSET_URLS: Record<FontFileName, URL> = {
  "PlusJakartaSans-Regular.ttf": new URL(
    "./fonts/PlusJakartaSans-Regular.ttf",
    import.meta.url,
  ),
  "PlusJakartaSans-SemiBold.ttf": new URL(
    "./fonts/PlusJakartaSans-SemiBold.ttf",
    import.meta.url,
  ),
  "JetBrainsMono-Regular.ttf": new URL(
    "./fonts/JetBrainsMono-Regular.ttf",
    import.meta.url,
  ),
  "JetBrainsMono-Bold.ttf": new URL(
    "./fonts/JetBrainsMono-Bold.ttf",
    import.meta.url,
  ),
};

export interface FontFileResolution {
  name: FontFileName;
  /** The path to read. The first candidate that exists, else the first candidate. */
  path: string;
  found: boolean;
  /** Every candidate that was checked, in order. Kept for diagnostics. */
  tried: string[];
}

function assetPath(url: URL): string | undefined {
  try {
    return fileURLToPath(url);
  } catch {
    return undefined;
  }
}

function candidatePaths(name: FontFileName): string[] {
  const cwd = process.cwd();
  const candidates = [
    assetPath(FONT_ASSET_URLS[name]),
    join(/* turbopackIgnore: true */ cwd, "lib", "render", "fonts", name),
    join(/* turbopackIgnore: true */ cwd, "apps", "web", "lib", "render", "fonts", name),
  ];
  return candidates.filter((p): p is string => p !== undefined);
}

function exists(path: string): boolean {
  try {
    return existsSync(path);
  } catch {
    return false;
  }
}

/**
 * Resolve every bundled font to a readable path, or record that none of its
 * candidates exist. Pure apart from the filesystem probe; cheap enough to
 * call from a health check.
 */
export function resolveFontFiles(): FontFileResolution[] {
  return FONT_FILES.map((name) => {
    const tried = candidatePaths(name);
    const hit = tried.find(exists);
    return {
      name,
      path: hit ?? tried[0]!,
      found: hit !== undefined,
      tried,
    };
  });
}

/** Absolute paths for the four fonts, one per `FONT_FILES` entry, in order. */
export function getFontPaths(): string[] {
  return resolveFontFiles().map((r) => r.path);
}

/** Names of the fonts that could not be found under any candidate path. */
export function getMissingFontFiles(): FontFileName[] {
  return resolveFontFiles()
    .filter((r) => !r.found)
    .map((r) => r.name);
}
