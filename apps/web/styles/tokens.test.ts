import { describe, it, expect } from "vitest";
import {
  GLOBALS_CSS,
  themeBlock,
  themedTokenValue,
  contrastRatio,
  LIGHT_SURFACES,
  DARK_SURFACES,
} from "@/lib/test-helpers/css-tokens";

/**
 * #1211 / #1212 — the v2 token layer.
 *
 * Every themed color is declared ONCE, as `light-dark(<light>, <dark>)`, inside
 * the `@theme` block. `color-scheme` on the root element decides which half
 * resolves, which also makes native form controls, scrollbars and focus rings
 * follow the theme for free. The paired `:root` / `[data-theme="dark"]` color
 * blocks that preceded this are gone; `data-theme` now carries `color-scheme`
 * only.
 */

const THEME = themeBlock();

const THEMED_TOKENS = [
  "--color-bg",
  "--color-card",
  "--color-text-primary",
  "--color-text-secondary",
  "--color-stroke",
  "--color-stroke-strong",
  "--color-amber",
  "--color-amber-light",
  "--color-amber-dark",
  "--color-warm-bg",
  "--color-warm-card",
  "--color-warm-stroke",
  "--color-dark-section",
  "--color-dark-card",
  "--color-hero-band",
  "--color-purple-tint",
  "--color-complement",
  "--color-complement-light",
  "--color-complement-text",
  "--color-complement-text-hover",
  "--color-terminal-green",
  "--color-terminal-red",
  "--color-terminal-yellow",
  "--color-terminal-dim",
  "--color-track",
  "--color-dimension-delivery",
  "--color-dimension-quality",
  "--color-dimension-consistency",
  "--color-dimension-breadth",
  "--color-dimension-craft",
  "--color-dimension-delivery-light",
  "--color-dimension-quality-light",
  "--color-dimension-consistency-light",
  "--color-dimension-breadth-light",
  "--color-dimension-craft-light",
];

describe("v2 token layer (#1211)", () => {
  describe("single-declaration themed tokens", () => {
    for (const token of THEMED_TOKENS) {
      it(`declares ${token} once, with light-dark()`, () => {
        const declarations = GLOBALS_CSS.match(
          new RegExp(`^\\s*${token}:`, "gm"),
        );
        expect(declarations).toHaveLength(1);
        expect(THEME).toMatch(
          new RegExp(`${token}:\\s*light-dark\\(`),
        );
      });
    }

    it("has no [data-theme=\"dark\"] custom property overrides left", () => {
      const darkBlocks =
        GLOBALS_CSS.match(/^\[data-theme="dark"\][^{]*\{[\s\S]*?\n\}/gm) ?? [];
      for (const block of darkBlocks) {
        expect(block).not.toMatch(/--color-[a-z-]+:/);
        expect(block).not.toMatch(/--shadow-[a-z-]+:/);
      }
    });
  });

  describe("color-scheme wiring", () => {
    it("lets the root follow the OS by default", () => {
      expect(GLOBALS_CSS).toMatch(/:root\s*\{[^}]*color-scheme:\s*light dark/);
    });

    it("forces the scheme when a theme is explicitly chosen", () => {
      expect(GLOBALS_CSS).toMatch(
        /\[data-theme="light"\]\s*\{[^}]*color-scheme:\s*light\s*;/,
      );
      expect(GLOBALS_CSS).toMatch(
        /\[data-theme="dark"\]\s*\{[^}]*color-scheme:\s*dark\s*;/,
      );
    });
  });

  describe("always-dark band tokens", () => {
    // The hero band, badge panel and CLI blocks stay dark in both themes, so
    // these are deliberately NOT light-dark() values.
    const FOREST_TOKENS = [
      "--color-forest",
      "--color-forest-card",
      "--color-forest-line",
      "--color-forest-text",
      "--color-forest-dim",
      "--color-forest-grid",
      "--color-forest-ok",
      "--color-forest-warn",
      "--color-forest-err",
    ];

    for (const token of FOREST_TOKENS) {
      it(`${token} resolves to one value in both themes`, () => {
        const { light, dark } = themedTokenValue(token, THEME);
        expect(light).toBe(dark);
      });
    }

    it.each([
      // Was #42574c on #0b2018 = 2.19:1 (#1212).
      "--color-forest-dim",
      // A forest block on a LIGHT page would otherwise resolve the status
      // colors to their light-theme values, which measure 3.72:1
      // (terminal-green) and 3.19:1 (terminal-red) on this ground (#1215).
      "--color-forest-ok",
      "--color-forest-warn",
      "--color-forest-err",
      "--color-forest-text",
    ])("%s clears AA against the forest ground", (token) => {
      const { light } = themedTokenValue(token, THEME);
      const { light: ground } = themedTokenValue("--color-forest", THEME);
      expect(contrastRatio(light, ground)).toBeGreaterThanOrEqual(4.5);
    });
  });

  describe("terminal-dim contrast (#1212)", () => {
    it("clears AA normal text against both light surfaces", () => {
      // Was #93a89d on #f7fbf8 = 2.41:1, used for step numbers, section
      // counts, eyebrows and meta lines — all informational, not decorative.
      const { light } = themedTokenValue("--color-terminal-dim", THEME);
      for (const surface of LIGHT_SURFACES) {
        expect(contrastRatio(light, surface)).toBeGreaterThanOrEqual(4.5);
      }
    });

    it("clears AA normal text against both dark surfaces", () => {
      const { dark } = themedTokenValue("--color-terminal-dim", THEME);
      for (const surface of DARK_SURFACES) {
        expect(contrastRatio(dark, surface)).toBeGreaterThanOrEqual(4.5);
      }
    });
  });

  describe("secondary text contrast", () => {
    it("clears AA normal text in both themes", () => {
      const { light, dark } = themedTokenValue("--color-text-secondary", THEME);
      for (const surface of LIGHT_SURFACES) {
        expect(contrastRatio(light, surface)).toBeGreaterThanOrEqual(4.5);
      }
      for (const surface of DARK_SURFACES) {
        expect(contrastRatio(dark, surface)).toBeGreaterThanOrEqual(4.5);
      }
    });
  });

  describe("palette decisions that must not be 'corrected'", () => {
    it("keeps success green off the accent hue (145 vs 163)", () => {
      expect(themedTokenValue("--color-terminal-green", THEME).light).toContain(
        "145",
      );
      expect(themedTokenValue("--color-amber", THEME).light).toContain("163");
    });

    it("keeps verification in the slate-blue family, never jade", () => {
      const verify = themedTokenValue("--color-complement-text", THEME);
      expect(verify.light).toMatch(/oklch\([\d.]+ [\d.]+ 22[0-9]/);
      expect(verify.dark).toMatch(/oklch\([\d.]+ [\d.]+ 22[0-9]/);
    });
  });
});
