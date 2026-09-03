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
 * 4. A candidate is validated, not just stat'ed. The fix's first preview
 *    found all four bundler assets on disk and still drew no glyph: a file
 *    that exists is not yet a font. A candidate counts only if it is larger
 *    than a stub and starts with a TrueType/OpenType signature, and the
 *    resolution records its byte size so the health probe can show it.
 */
import { closeSync, openSync, readSync, statSync } from "node:fs";
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
  /** The path to read. The first candidate that validates, else the first candidate. */
  path: string;
  found: boolean;
  /** Byte size of `path`, 0 when it could not be read. */
  bytes: number;
  /** Every candidate that was checked, in order. Kept for diagnostics. */
  tried: string[];
}

/** Smaller than this cannot be a real font; the smallest bundled file is 63 KB. */
const MIN_FONT_BYTES = 1024;

/** sfnt signatures: TrueType (0x00010000 or 'true'), CFF OpenType ('OTTO'), collection ('ttcf'). */
const SFNT_SIGNATURES = new Set(["00010000", "74727565", "4f54544f", "74746366"]);

interface CandidateProbe {
  valid: boolean;
  bytes: number;
}

function probeCandidate(path: string): CandidateProbe {
  try {
    const bytes = statSync(path).size;
    if (bytes < MIN_FONT_BYTES) return { valid: false, bytes };
    const fd = openSync(path, "r");
    try {
      const head = Buffer.alloc(4);
      const read = readSync(fd, head, 0, 4, 0);
      const valid = read === 4 && SFNT_SIGNATURES.has(head.toString("hex"));
      return { valid, bytes };
    } finally {
      closeSync(fd);
    }
  } catch {
    return { valid: false, bytes: 0 };
  }
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

/**
 * Resolve every bundled font to a readable path, or record that none of its
 * candidates exist. Pure apart from the filesystem probe; cheap enough to
 * call from a health check.
 */
export function resolveFontFiles(): FontFileResolution[] {
  return FONT_FILES.map((name) => {
    const tried = candidatePaths(name);
    for (const path of tried) {
      const probe = probeCandidate(path);
      if (probe.valid) return { name, path, found: true, bytes: probe.bytes, tried };
    }
    return { name, path: tried[0]!, found: false, bytes: probeCandidate(tried[0]!).bytes, tried };
  });
}

/** Absolute paths for the four fonts, one per `FONT_FILES` entry, in order. */
export function getFontPaths(): string[] {
  return resolveFontFiles().map((r) => r.path);
}

/** Names of the fonts with no valid file under any candidate path. */
export function getMissingFontFiles(): FontFileName[] {
  return resolveFontFiles()
    .filter((r) => !r.found)
    .map((r) => r.name);
}
