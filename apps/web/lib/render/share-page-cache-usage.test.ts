/**
 * #720 — share page must try the badge SVG cache before re-rendering.
 *
 * The badge.svg route writes to `badge:<version>:<handle>:warm-amber-<render-version>:<date>`
 * after every successful render. The share page used to ignore this cache
 * and call renderBadgeSvg() unconditionally during SSR, duplicating render
 * work on every ISR regeneration. This test locks in the cache-first flow.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SHARE_PAGE = fs.readFileSync(
  path.resolve(__dirname, "../../app/u/[handle]/page.tsx"),
  "utf-8",
);

describe("share page (#720) cache-first SVG", () => {
  it("imports the shared badge-svg-cache helpers", () => {
    expect(SHARE_PAGE).toMatch(
      /from\s+["']@\/lib\/render\/badge-svg-cache["']/,
    );
  });

  it("calls readBadgeSvgCache before falling through to renderBadgeSvg", () => {
    // Skip past imports — only check ordering inside the SharePageContent body.
    const bodyStart = SHARE_PAGE.indexOf("export async function SharePageContent");
    expect(bodyStart).toBeGreaterThan(-1);
    const body = SHARE_PAGE.slice(bodyStart);
    const readIdx = body.indexOf("readBadgeSvgCache(");
    const renderIdx = body.indexOf("renderBadgeSvg(");
    expect(readIdx).toBeGreaterThan(-1);
    expect(renderIdx).toBeGreaterThan(-1);
    expect(readIdx).toBeLessThan(renderIdx);
  });

  it("writes the freshly rendered SVG back to cache (so future requests hit it)", () => {
    expect(SHARE_PAGE).toContain("writeBadgeSvgCache");
  });

  it("uses buildBadgeSvgCacheKey (does not duplicate the key format)", () => {
    expect(SHARE_PAGE).toContain("buildBadgeSvgCacheKey");
  });
});
