import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

// The translated landing body remains a server component.
const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "LandingContent.tsx"),
  "utf-8",
);

/**
 * #240 asked for a landing page that survives 390px. It was originally met
 * with viewport breakpoints (`text-3xl sm:text-4xl`, `flex-col sm:flex-row`,
 * `sm:w-48`), which meant maintaining two layouts and guessing where the
 * seams fell.
 *
 * The redesign keeps bounded fluid type with viewport-relative clamps and
 * lets sections collapse to one column. Browser tests verify actual reflow;
 * these structural guards retain intrinsic badge sizing and fluid type.
 */
describe("landing layout retains fluid type and bounded badge sizing", () => {
  it("sizes hero type with a bounded fluid clamp", () => {
    expect(SOURCE).toMatch(/text-\[clamp\([^\]]*(?:vw|cqi)[^\]]*\)\]/);
  });

  it("does not size the hero heading off viewport breakpoints", () => {
    expect(SOURCE).not.toMatch(/text-3xl sm:text-4xl/);
  });

  it("has no fixed label column that would crowd a 390px screen", () => {
    // The old two-column label/description rows needed a fixed 12rem gutter.
    expect(SOURCE).not.toMatch(/(?<!\S)w-44(?!\S)/);
    expect(SOURCE).not.toMatch(/(?<!\S)sm:w-48(?!\S)/);
  });

  it("collapses multi-column sections to one column by default", () => {
    const grids = SOURCE.match(/grid-cols-\d/g) ?? [];
    expect(grids.length).toBeGreaterThan(0);
    // Every column count is behind a breakpoint prefix, so the base state is
    // a single column.
    for (const match of SOURCE.matchAll(/(\S*)grid-cols-\d/g)) {
      expect(match[1]).toMatch(/(sm|md|lg):$/);
    }
  });

  it("keeps the badge from growing past its intrinsic width on wide screens", () => {
    // #1237 dropped the fake browser frame and the 16:5 letterbox. The badge
    // now renders at its natural 1200x630 aspect, capped at its intrinsic
    // width, so the cap is horizontal and the height follows.
    expect(SOURCE).toContain("max-w-[1200px]");
    expect(SOURCE).toContain("[&>svg]:h-auto");
    expect(SOURCE).not.toContain("max-h-[360px]");
    expect(SOURCE).not.toContain("aspect-[16/5]");
  });
});
