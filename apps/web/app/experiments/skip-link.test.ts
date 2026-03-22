import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * The skip-to-content link in the global layout targets `#main-content`.
 * Every experiment page must have exactly one element with `id="main-content"`
 * on its outermost content wrapper so the skip link lands correctly.
 */

const EXPERIMENTS_DIR = path.resolve(__dirname);

const experimentDirs = fs
  .readdirSync(EXPERIMENTS_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
  .map((d) => d.name);

describe("experiment pages skip-link target", () => {
  it.each(experimentDirs)(
    "%s/page.tsx contains id=\"main-content\"",
    (dir) => {
      const pagePath = path.join(EXPERIMENTS_DIR, dir, "page.tsx");
      expect(
        fs.existsSync(pagePath),
        `${dir}/page.tsx should exist`,
      ).toBe(true);

      const source = fs.readFileSync(pagePath, "utf-8");
      expect(
        source,
        `${dir}/page.tsx must include id="main-content" on its content wrapper`,
      ).toContain('id="main-content"');
    },
  );

  it("has at least 10 experiment pages", () => {
    // Guard against accidentally deleting experiments and having a vacuous test
    expect(experimentDirs.length).toBeGreaterThanOrEqual(10);
  });
});
