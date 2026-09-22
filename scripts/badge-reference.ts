/**
 * Badge reference PNG: the demo badge rendered through the production
 * pipeline (`renderBadgeSvg` + `svgToPng`).
 *
 * #1277 — `docs/assets/badge-reference.png` is a documentation asset. It is
 * regenerated on purpose with `pnpm run generate:badge-reference`, never as a
 * side effect of the test suite: the test used to rewrite the tracked file on
 * every run, and because the bytes depend on the machine's resvg binary and
 * font resolution, the file showed as modified after almost every
 * `pnpm run test`, including the pre-commit hook.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderBadgeSvg } from "../apps/web/lib/render/BadgeSvg";
import { svgToPng } from "../apps/web/lib/render/svg-to-png";
import { DEMO_STATS, DEMO_IMPACT } from "../apps/web/lib/render/demoData";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The committed documentation asset, referenced by docs/badge-svg-spec-v1.2.md. */
export const REFERENCE_PNG_PATH = join(REPO_ROOT, "docs", "assets", "badge-reference.png");

export const REFERENCE_PNG_WIDTH = 1200;

export async function renderBadgeReferencePng(): Promise<Uint8Array> {
  const svg = renderBadgeSvg(DEMO_STATS, DEMO_IMPACT, {
    includeBranding: true,
    demoMode: true,
  });
  return svgToPng(svg, REFERENCE_PNG_WIDTH);
}

export async function writeBadgeReferencePng(path: string): Promise<number> {
  const png = await renderBadgeReferencePng();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, png);
  return png.length;
}
