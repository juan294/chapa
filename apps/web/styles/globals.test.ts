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

    it("turns named animation utilities off in reduced motion", () => {
      const reducedMotionBlock =
        SOURCE.match(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n\}/g)?.join("\n") ?? "";
      expect(reducedMotionBlock).toContain(".animate-fade-in-up");
      expect(reducedMotionBlock).toContain(".animate-scale-in");
      expect(reducedMotionBlock).toContain("animation: none !important");
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
      "--color-dimension-delivery",
      "--color-dimension-quality",
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

  // Phase 3 — img-outline utility
  describe("image outline utility (Phase 3)", () => {
    it("defines .img-outline utility class", () => {
      expect(SOURCE).toContain(".img-outline");
    });
  });

  // Phase 4 — layered shadow tokens
  describe("shadow tokens (Phase 4)", () => {
    it("defines --shadow-card and --shadow-card-hover tokens", () => {
      expect(SOURCE).toContain("--shadow-card:");
      expect(SOURCE).toContain("--shadow-card-hover:");
    });

    it("defines shadow tokens in @theme block for Tailwind utility generation", () => {
      const themeBlock = SOURCE.match(/@theme\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
      expect(themeBlock).toContain("--shadow-card:");
      expect(themeBlock).toContain("--shadow-card-hover:");
    });
  });

  // Phase 8 — collapse-grid utility
  describe("collapse-grid utility (Phase 8)", () => {
    it("defines collapse-grid utility for smooth expand/collapse", () => {
      expect(SOURCE).toContain(".collapse-grid");
      expect(SOURCE).toContain("grid-template-rows");
    });
  });

  // #1189 — --color-complement (#10B981) measures ~2.54:1 as TEXT against
  // the site's light-theme backgrounds, well below the WCAG AA 4.5:1 floor
  // for normal text (and even below the 3:1 large/bold-text floor). The
  // dark-theme use of the same value as text is fine (~7.8:1). This is a
  // theme-aware TEXT-ONLY token — it must never replace --color-complement
  // itself, which is used non-textually (fills, tints, borders) elsewhere.
  describe("complement text token (#1189)", () => {
    const TOKEN = "--color-complement-text";

    function extractTokenValue(block: string): string {
      const match = block.match(
        new RegExp(`${TOKEN}:\\s*([^;]+);`),
      );
      if (!match) {
        throw new Error(`${TOKEN} not found in provided block`);
      }
      return match[1]!.trim();
    }

    function hexToRgb(hex: string): [number, number, number] {
      const clean = hex.replace("#", "");
      return [
        parseInt(clean.slice(0, 2), 16),
        parseInt(clean.slice(2, 4), 16),
        parseInt(clean.slice(4, 6), 16),
      ];
    }

    function relativeLuminance([r, g, b]: [number, number, number]): number {
      const channel = (c: number) => {
        const v = c / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    }

    function contrastRatio(hexA: string, hexB: string): number {
      const lumA = relativeLuminance(hexToRgb(hexA));
      const lumB = relativeLuminance(hexToRgb(hexB));
      const lighter = Math.max(lumA, lumB);
      const darker = Math.min(lumA, lumB);
      return (lighter + 0.05) / (darker + 0.05);
    }

    it(`defines ${TOKEN} in @theme block`, () => {
      const themeBlock = SOURCE.match(/@theme\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
      expect(themeBlock).toContain(TOKEN);
    });

    it(`defines ${TOKEN} in :root block`, () => {
      const rootBlock = SOURCE.match(/:root\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
      expect(rootBlock).toContain(TOKEN);
    });

    it(`defines ${TOKEN} in [data-theme="dark"] block`, () => {
      const darkBlock =
        SOURCE.match(/\[data-theme="dark"\]\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
      expect(darkBlock).toContain(TOKEN);
    });

    it("light-theme value clears 4.5:1 (AA normal text) against both light surfaces", () => {
      const rootBlock = SOURCE.match(/:root\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
      const lightValue = extractTokenValue(rootBlock);
      expect(contrastRatio(lightValue, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(lightValue, "#F9FAFB")).toBeGreaterThanOrEqual(4.5);
    });

    it("dark-theme value clears 4.5:1 (AA normal text) against both dark surfaces", () => {
      const darkBlock =
        SOURCE.match(/\[data-theme="dark"\]\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
      const darkValue = extractTokenValue(darkBlock);
      expect(contrastRatio(darkValue, "#0A0A0F")).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(darkValue, "#111118")).toBeGreaterThanOrEqual(4.5);
    });

    it("does not redefine --color-complement itself (fill/tint/border usages must not shift hue)", () => {
      const rootBlock = SOURCE.match(/:root\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
      const darkBlock =
        SOURCE.match(/\[data-theme="dark"\]\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
      // --color-complement is intentionally defined once (in @theme only —
      // same value in both themes), not redefined per-theme here.
      expect(rootBlock).not.toMatch(/--color-complement:\s*/);
      expect(darkBlock).not.toMatch(/--color-complement:\s*/);
    });
  });

  // #1189 follow-up — a hover state for complement-colored text/icon links
  // must be a real text color that clears AA in its own theme, not
  // --color-complement-light (a translucent BACKGROUND tint that renders
  // near-invisible as text — pale mint on white in light theme, 15%-alpha
  // green in dark theme). Found via `apps/web/app/verify/[hash]/page.tsx`'s
  // handle link and "view badge" link both using
  // `hover:text-complement-light`.
  describe("complement text hover token (#1189 follow-up)", () => {
    const TOKEN = "--color-complement-text-hover";

    function extractTokenValue(block: string, token: string): string {
      const match = block.match(new RegExp(`${token}:\\s*([^;]+);`));
      if (!match) {
        throw new Error(`${token} not found in provided block`);
      }
      return match[1]!.trim();
    }

    function hexToRgb(hex: string): [number, number, number] {
      const clean = hex.replace("#", "");
      return [
        parseInt(clean.slice(0, 2), 16),
        parseInt(clean.slice(2, 4), 16),
        parseInt(clean.slice(4, 6), 16),
      ];
    }

    function relativeLuminance([r, g, b]: [number, number, number]): number {
      const channel = (c: number) => {
        const v = c / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    }

    function contrastRatio(hexA: string, hexB: string): number {
      const lumA = relativeLuminance(hexToRgb(hexA));
      const lumB = relativeLuminance(hexToRgb(hexB));
      const lighter = Math.max(lumA, lumB);
      const darker = Math.min(lumA, lumB);
      return (lighter + 0.05) / (darker + 0.05);
    }

    it(`defines ${TOKEN} in @theme block`, () => {
      const themeBlock = SOURCE.match(/@theme\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
      expect(themeBlock).toContain(TOKEN);
    });

    it(`defines ${TOKEN} in :root block`, () => {
      const rootBlock = SOURCE.match(/:root\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
      expect(rootBlock).toContain(TOKEN);
    });

    it(`defines ${TOKEN} in [data-theme="dark"] block`, () => {
      const darkBlock =
        SOURCE.match(/\[data-theme="dark"\]\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
      expect(darkBlock).toContain(TOKEN);
    });

    it("light-theme hover value clears 4.5:1 (AA normal text) against both light surfaces", () => {
      const rootBlock = SOURCE.match(/:root\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
      const hoverValue = extractTokenValue(rootBlock, TOKEN);
      expect(contrastRatio(hoverValue, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(hoverValue, "#F9FAFB")).toBeGreaterThanOrEqual(4.5);
    });

    it("dark-theme hover value clears 4.5:1 (AA normal text) against both dark surfaces", () => {
      const darkBlock =
        SOURCE.match(/\[data-theme="dark"\]\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
      const hoverValue = extractTokenValue(darkBlock, TOKEN);
      expect(contrastRatio(hoverValue, "#0A0A0F")).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(hoverValue, "#111118")).toBeGreaterThanOrEqual(4.5);
    });

    it("hover is a visibly different color from rest in both themes (not a contrast-neutral swap)", () => {
      const rootBlock = SOURCE.match(/:root\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
      const darkBlock =
        SOURCE.match(/\[data-theme="dark"\]\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
      const lightRest = extractTokenValue(rootBlock, "--color-complement-text");
      const lightHover = extractTokenValue(rootBlock, TOKEN);
      const darkRest = extractTokenValue(darkBlock, "--color-complement-text");
      const darkHover = extractTokenValue(darkBlock, TOKEN);

      expect(lightHover.toUpperCase()).not.toBe(lightRest.toUpperCase());
      expect(darkHover.toUpperCase()).not.toBe(darkRest.toUpperCase());

      // Light theme hover moves DARKER (rest is already the lightest value
      // that clears AA, so hover has nowhere to go but darker — verified as
      // a strictly higher contrast ratio against the white surface).
      expect(contrastRatio(lightHover, "#FFFFFF")).toBeGreaterThan(
        contrastRatio(lightRest, "#FFFFFF"),
      );
      // Dark theme hover moves LIGHTER/brighter (headroom to spare), which
      // also strictly increases contrast against the dark surface.
      expect(contrastRatio(darkHover, "#0A0A0F")).toBeGreaterThan(
        contrastRatio(darkRest, "#0A0A0F"),
      );
    });
  });

  // #1189 follow-up — guards against re-introducing the fixed bug: a tint
  // token used as text/hover-text color. --color-complement-light is a
  // BACKGROUND tint only; it must never appear as a `text-` or
  // `hover:text-` Tailwind utility anywhere in the app.
  describe("complement-light tint token never used as text (#1189 follow-up)", () => {
    const APPS_WEB_ROOT = path.resolve(__dirname, "..");
    const SKIP_DIRS = new Set([
      "node_modules",
      ".next",
      "dist",
      "build",
      "coverage",
    ]);

    function walk(dir: string, files: string[] = []): string[] {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          if (!SKIP_DIRS.has(entry.name)) {
            walk(path.join(dir, entry.name), files);
          }
        } else if (/\.(ts|tsx)$/.test(entry.name)) {
          files.push(path.join(dir, entry.name));
        }
      }
      return files;
    }

    it("no source file uses text-complement-light or hover:text-complement-light", () => {
      // "TEXT" + "-" + "COMPLEMENT" + "-" + "LIGHT" assembled at runtime so
      // this guard's own source doesn't trip its own check.
      const forbidden = ["text", "complement", "light"].join("-");
      const offenders: string[] = [];
      for (const file of walk(APPS_WEB_ROOT)) {
        if (path.resolve(file) === path.resolve(__filename)) continue;
        const contents = fs.readFileSync(file, "utf-8");
        if (contents.includes(forbidden)) {
          offenders.push(path.relative(APPS_WEB_ROOT, file));
        }
      }
      expect(offenders).toEqual([]);
    });
  });

});
