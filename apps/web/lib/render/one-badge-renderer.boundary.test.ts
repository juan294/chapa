import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * There is one badge implementation (#1191, `docs/decisions/2026-08-30-one-badge-artifact.md`).
 * S16 draws the v7 core, separate Craft and evidence state, and the cheapest way
 * to lose that again is a second renderer that drifts. This boundary keeps the
 * rule checkable instead of remembered: only `BadgeSvg.tsx` may open a
 * badge-sized SVG root, and every other surface goes through `renderBadgeSvg`.
 */
const repoRoot = resolve(__dirname, "../../../..");
const WEB = join(repoRoot, "apps/web");
const NOT_SOURCE = /(\.test\.|\.spec\.|__fixtures__|\/test-helpers\/)/;
/** An SVG root on the badge's own canvas. An `<img width={1200} height={630}>`
 * displaying a badge is not drawing one, so only a real `<svg>` root counts. */
const BADGE_SVG_ROOT = /<svg[^>]*viewBox="0 0 (?:1200 630|\$\{W\} \$\{H\})"/;
/**
 * Four other files use the badge's canvas without drawing a badge: the "cannot
 * render your badge right now" placeholder, the site-level social card, the
 * share page's leader-line overlay (borrows only the coordinate space), and
 * (#1335 phase 4) the scoring-status placeholder — collecting/action_needed/
 * unregistered — which draws an identity header and a state sentence, never
 * a score, heatmap or radar. They are allowed because none of them renders a
 * score, so none can drift from the real artifact — the assertion below
 * holds them to that.
 */
const SCORELESS_CANVASES = [
  "apps/web/app/og-image/route.ts",
  "apps/web/app/u/[handle]/badge.svg/route.ts",
  "apps/web/components/BadgeOverlay.tsx",
  "apps/web/lib/render/badge-state.ts",
];
/** Anything that turns a score into badge artwork. */
const DRAWS_A_SCORE = /renderRadarChart|renderHeatmapSvg|getTierColor|getArchetypeColor|buildHeatmapCells/;

function sources(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry !== "node_modules" && entry !== ".next") sources(path, found);
      continue;
    }
    if (/\.(ts|tsx)$/.test(path) && !NOT_SOURCE.test(path)) found.push(relative(repoRoot, path));
  }
  return found;
}

const files = sources(WEB);
const read = (path: string) => readFileSync(join(repoRoot, path), "utf8");

describe("one badge renderer", () => {
  it("lets only BadgeSvg.tsx open a badge-sized SVG root", () => {
    const producers = files.filter(path => BADGE_SVG_ROOT.test(read(path)));
    expect(producers.sort()).toEqual([...SCORELESS_CANVASES, "apps/web/lib/render/BadgeSvg.tsx"].sort());
  });

  it("lets no other file on that canvas draw a score", () => {
    for (const path of SCORELESS_CANVASES) expect(read(path)).not.toMatch(DRAWS_A_SCORE);
    expect(read("apps/web/lib/render/BadgeSvg.tsx")).toMatch(DRAWS_A_SCORE);
  });

  it("routes every badge surface through renderBadgeSvg", () => {
    const callers = files.filter(path => /\brenderBadgeSvg\b/.test(read(path)) && path !== "apps/web/lib/render/BadgeSvg.tsx");
    // Badge route, OG image, share page, Studio preview, landing and archetype
    // demos: every surface that shows a badge is in this list, and none of them
    // draws one itself.
    expect(callers.length).toBeGreaterThanOrEqual(5);
    for (const path of callers) {
      if (!SCORELESS_CANVASES.includes(path)) expect(read(path)).not.toMatch(BADGE_SVG_ROOT);
    }
  });

  it("keeps the evidence description in one module, shared by every surface", () => {
    const describers = files.filter(path => /describeScoringEvidence/.test(read(path)));
    expect(describers.sort()).toEqual([
      "apps/web/lib/render/BadgeSvg.tsx",
      "apps/web/lib/render/scoring-evidence-label.ts",
    ]);
  });
});
