import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "globals.css"),
  "utf-8",
);

describe("globals.css", () => {
  describe("reduced motion", () => {
    it("has prefers-reduced-motion media query", () => {
      expect(SOURCE).toContain("prefers-reduced-motion: reduce");
    });

    it("disables animation-duration in reduced motion", () => {
      expect(SOURCE).toContain("animation-duration: 0.01ms !important");
    });

    it("disables transition-duration in reduced motion", () => {
      expect(SOURCE).toContain("transition-duration: 0.01ms !important");
    });

    it("sets scroll-behavior: auto in reduced motion (R11)", () => {
      expect(SOURCE).toContain("scroll-behavior: auto !important");
    });
  });

  describe("focus indicators", () => {
    it("has focus-visible outline using amber color", () => {
      expect(SOURCE).toContain(":focus-visible");
      expect(SOURCE).toContain("--color-amber");
    });
  });

  describe("dimension color tokens (#233)", () => {
    const DIMENSION_TOKENS = [
      "--color-dimension-building",
      "--color-dimension-guarding",
      "--color-dimension-consistency",
      "--color-dimension-breadth",
    ];

    for (const token of DIMENSION_TOKENS) {
      it(`defines ${token} in @theme block`, () => {
        const themeBlock = SOURCE.match(/@theme\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
        expect(themeBlock).toContain(token);
      });

      it(`defines ${token} in :root block`, () => {
        const rootBlock = SOURCE.match(/:root\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
        expect(rootBlock).toContain(token);
      });

      it(`defines ${token} in [data-theme="dark"] block`, () => {
        const darkBlock =
          SOURCE.match(/\[data-theme="dark"\]\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
        expect(darkBlock).toContain(token);
      });
    }
  });

  describe("fade-in-up animation (#285)", () => {
    it("ends with transform: none to avoid creating stacking contexts", () => {
      // The animation must end with `transform: none` (not `translateY(0)`)
      // so that animated cards don't create permanent stacking contexts
      // that trap child z-index values (e.g., tooltips with z-50).
      const keyframeBlock = SOURCE.match(
        /@keyframes\s+fade-in-up\s*\{([\s\S]*?)\n\}/,
      );
      expect(keyframeBlock).not.toBeNull();
      const body = keyframeBlock![1]!;
      expect(body).toMatch(/to\s*\{[^}]*transform:\s*none/);
    });
  });

  describe("archetype color tokens (#233)", () => {
    const ARCHETYPE_TOKENS = [
      "--color-archetype-builder",
      "--color-archetype-guardian",
      "--color-archetype-marathoner",
      "--color-archetype-polymath",
      "--color-archetype-balanced",
      "--color-archetype-emerging",
    ];

    for (const token of ARCHETYPE_TOKENS) {
      it(`defines ${token} in @theme block`, () => {
        const themeBlock = SOURCE.match(/@theme\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
        expect(themeBlock).toContain(token);
      });

      it(`defines ${token} in :root block`, () => {
        const rootBlock = SOURCE.match(/:root\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
        expect(rootBlock).toContain(token);
      });

      it(`defines ${token} in [data-theme="dark"] block`, () => {
        const darkBlock =
          SOURCE.match(/\[data-theme="dark"\]\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
        expect(darkBlock).toContain(token);
      });
    }
  });
});
