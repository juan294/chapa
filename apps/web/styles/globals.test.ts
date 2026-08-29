import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  GLOBALS_CSS as SOURCE,
  themeBlock,
  themedTokenValue,
  contrastRatio,
  LIGHT_SURFACES,
  DARK_SURFACES,
} from "@/lib/test-helpers/css-tokens";

const THEME = themeBlock();

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

  // #233 — the tokens exist. Since #1211 each is a single light-dark()
  // declaration in @theme rather than a pair of per-theme blocks, so the
  // structural guard is "declared once, themed", not "present in both blocks".
  describe("dimension color tokens (#233)", () => {
    const DIMENSION_TOKENS = [
      "--color-dimension-delivery",
      "--color-dimension-quality",
      "--color-dimension-consistency",
      "--color-dimension-breadth",
    ];

    for (const token of DIMENSION_TOKENS) {
      it(`defines ${token} once in @theme, with a value per theme`, () => {
        expect(THEME).toContain(token);
        const { light, dark } = themedTokenValue(token, THEME);
        expect(light).not.toBe(dark);
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
      "--color-archetype-artificer",
    ];

    for (const token of ARCHETYPE_TOKENS) {
      it(`defines ${token} in @theme block`, () => {
        expect(THEME).toContain(token);
      });
    }

    it("shares one lightness and chroma across the family, varying only hue", () => {
      const hues = new Set<string>();
      for (const token of ARCHETYPE_TOKENS) {
        const value = themedTokenValue(token, THEME).light;
        expect(value).toMatch(/^oklch\(\.62 \.14 \d+\)$/);
        hues.add(value);
      }
      expect(hues.size).toBe(ARCHETYPE_TOKENS.length);
    });
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
      expect(THEME).toContain("--shadow-card:");
      expect(THEME).toContain("--shadow-card-hover:");
    });
  });

  // Phase 8 — collapse-grid utility
  describe("collapse-grid utility (Phase 8)", () => {
    it("defines collapse-grid utility for smooth expand/collapse", () => {
      expect(SOURCE).toContain(".collapse-grid");
      expect(SOURCE).toContain("grid-template-rows");
    });
  });

  // #1189 — --color-complement measures ~2.54:1 as TEXT against the site's
  // light-theme backgrounds, well below the WCAG AA 4.5:1 floor for normal
  // text (and even below the 3:1 large/bold-text floor). The dark-theme use of
  // the same value as text is fine (~7.8:1). This is a theme-aware TEXT-ONLY
  // token — it must never replace --color-complement itself, which is used
  // non-textually (fills, tints, borders) elsewhere.
  describe("complement text token (#1189)", () => {
    const TOKEN = "--color-complement-text";

    it(`defines ${TOKEN} in @theme block`, () => {
      expect(THEME).toContain(TOKEN);
    });

    it("light-theme value clears 4.5:1 (AA normal text) against both light surfaces", () => {
      const { light } = themedTokenValue(TOKEN, THEME);
      for (const surface of LIGHT_SURFACES) {
        expect(contrastRatio(light, surface)).toBeGreaterThanOrEqual(4.5);
      }
    });

    it("dark-theme value clears 4.5:1 (AA normal text) against both dark surfaces", () => {
      const { dark } = themedTokenValue(TOKEN, THEME);
      for (const surface of DARK_SURFACES) {
        expect(contrastRatio(dark, surface)).toBeGreaterThanOrEqual(4.5);
      }
    });

    it("keeps --color-complement theme-aware, and distinct from the text token (#1206)", () => {
      const fill = themedTokenValue("--color-complement", THEME);
      expect(fill.light).not.toBe(fill.dark);
      expect(fill.light).not.toBe(themedTokenValue(TOKEN, THEME).light);
    });
  });

  // #1189 follow-up — a hover state for complement-colored text/icon links
  // must be a real text color that clears AA in its own theme, not
  // --color-complement-light (a translucent BACKGROUND tint that renders
  // near-invisible as text — pale mint on white in light theme, 15%-alpha
  // green in dark theme).
  describe("complement text hover token (#1189 follow-up)", () => {
    const TOKEN = "--color-complement-text-hover";

    it(`defines ${TOKEN} in @theme block`, () => {
      expect(THEME).toContain(TOKEN);
    });

    it("clears 4.5:1 (AA normal text) in both themes", () => {
      const { light, dark } = themedTokenValue(TOKEN, THEME);
      for (const surface of LIGHT_SURFACES) {
        expect(contrastRatio(light, surface)).toBeGreaterThanOrEqual(4.5);
      }
      for (const surface of DARK_SURFACES) {
        expect(contrastRatio(dark, surface)).toBeGreaterThanOrEqual(4.5);
      }
    });

    it("hover is a visibly different color from rest in both themes (not a contrast-neutral swap)", () => {
      const rest = themedTokenValue("--color-complement-text", THEME);
      const hover = themedTokenValue(TOKEN, THEME);

      expect(hover.light).not.toBe(rest.light);
      expect(hover.dark).not.toBe(rest.dark);

      // Light theme hover moves DARKER (rest is already the lightest value
      // that clears AA, so hover has nowhere to go but darker). Dark theme
      // hover moves LIGHTER. Both strictly increase contrast against their
      // own ground, which is what makes hover a legible change.
      expect(contrastRatio(hover.light, LIGHT_SURFACES[0])).toBeGreaterThan(
        contrastRatio(rest.light, LIGHT_SURFACES[0]),
      );
      expect(contrastRatio(hover.dark, DARK_SURFACES[0])).toBeGreaterThan(
        contrastRatio(rest.dark, DARK_SURFACES[0]),
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
