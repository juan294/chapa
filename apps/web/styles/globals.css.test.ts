import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "globals.css"),
  "utf-8",
);

// #1167 (UX-B1/UX-H1/UX-M3) — source-content assertions for CSS invariants
// that can't be observed through a jsdom render (jsdom does not load or
// apply this stylesheet). Mirrors the SOURCE-read pattern already used in
// components/InfoTooltip.test.tsx and app/LandingContent.test.ts.
describe("globals.css", () => {
  describe("complement-dark token (#1167 / UX-H1)", () => {
    it("defines --color-complement-dark for white-text-on-solid-fill verification CTAs", () => {
      // #1206 — Jade authors this token in oklch; the guard is that the token
      // exists as a real opaque color, not which notation expresses it.
      expect(SOURCE).toMatch(
        /--color-complement-dark:\s*(#[0-9A-Fa-f]{6}|oklch\([^)]+\))/,
      );
    });

    it("pins the --color-amber token value (accidental drift shifts the whole brand hue)", () => {
      // Originally (#1167) this asserted #8B5CF6, to stop a contrast fix from
      // rebranding the app as a side effect. #1206 replaced the violet accent
      // with Jade deliberately, so the guard now pins the new value and keeps
      // doing its real job: catching an UNINTENDED hue change. The accent is
      // theme-aware since Jade, hence a value per block.
      expect(SOURCE).toContain("--color-amber: oklch(.66 .15 163);");
      expect(SOURCE).toContain("--color-amber: oklch(.76 .16 163);");
    });
  });

  describe("nav active-link style (#1167 / UX-M3)", () => {
    it("styles [aria-current=page] inside a <nav> element", () => {
      expect(SOURCE).toMatch(/nav\s+\[aria-current(?:=|\*=)["']page["']\]/);
    });

    it("also styles [aria-current=page] inside a role=navigation region (MobileNav's panel)", () => {
      expect(SOURCE).toMatch(
        /\[role=["']navigation["']\]\s+\[aria-current(?:=|\*=)["']page["']\]/,
      );
    });

    it("active nav style is not amber (would be indistinguishable from the amber/50 '/' prefix already inside every link)", () => {
      const match = SOURCE.match(
        /nav \[aria-current="page"\][^{]*\{([^}]*)\}/,
      );
      expect(match).not.toBeNull();
      expect(match![1]).not.toContain("--color-amber)");
    });
  });
});
