import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

// The landing page body (and its responsive classes) lives in the client
// component since #982 made page.tsx a thin static server wrapper.
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
 * #1215 replaced that with one fluid layout: type sizes are
 * `clamp(min, Ncqi, max)` inside an element carrying container-type, and grids
 * collapse to a single column rather than reflowing labels. These tests assert
 * the new mechanism, and that the old fixed widths did not creep back.
 */
describe("landing layout is fluid, not breakpoint-driven (#240, #1215)", () => {
  it("sizes hero type with a container-relative clamp", () => {
    expect(SOURCE).toContain("@container");
    expect(SOURCE).toMatch(/text-\[clamp\([^\]]*cqi[^\]]*\)\]/);
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
