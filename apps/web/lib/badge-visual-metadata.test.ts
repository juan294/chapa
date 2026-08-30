import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BADGE_PLATFORM_LOGOS,
  BADGE_PLATFORM_ORDER,
  VERIFICATION_CORAL,
  orderBadgePlatforms,
} from "./badge-visual-metadata";

describe("badge visual metadata", () => {
  it("keeps the canonical platform order and removes duplicate inputs", () => {
    expect(
      orderBadgePlatforms([
        "gitlab",
        "github",
        "codeberg",
        "github",
        "bitbucket",
      ]),
    ).toEqual(["github", "bitbucket", "codeberg", "gitlab"]);
    expect(BADGE_PLATFORM_ORDER).toEqual([
      "github",
      "bitbucket",
      "codeberg",
      "gitlab",
    ]);
  });

  it("preserves the visual constants shared by preview and SVG rendering", () => {
    expect(BADGE_PLATFORM_LOGOS.github).toMatch(/^M12 0C5\.37/);
    expect(BADGE_PLATFORM_LOGOS.bitbucket).toMatch(/^M\.778 1\.211/);
    expect(BADGE_PLATFORM_LOGOS.codeberg).toMatch(/^M11\.955\.49/);
    expect(BADGE_PLATFORM_LOGOS.gitlab).toMatch(/^m23\.6004/);
    expect(VERIFICATION_CORAL).toBe("#E05A47");
  });

  it("is client-safe and exposes metadata without renderer implementations", () => {
    const source = readFileSync(
      resolve(__dirname, "badge-visual-metadata.ts"),
      "utf8",
    );

    const runtimeImports = source
      .split("\n")
      .filter((line) => /^\s*import\s+(?!type\b)/.test(line));

    expect(runtimeImports).toEqual([]);
    expect(source).not.toMatch(/lib\/render|\.\/render/);
    expect(source).not.toMatch(/renderBadge|renderVerification/);
  });

  /**
   * #1191 step 6 reverses this module's earlier relationship with Studio.
   *
   * This file existed as a NEUTRAL boundary: Studio drew its own badge in the
   * DOM, so it needed the platform logos and the coral token without importing
   * the SVG renderer, and the old test asserted `PreviewFooter.tsx` stayed off
   * `@/lib/render/`. That was the right rule while there were two badge
   * implementations to keep apart.
   *
   * There is one now. Studio renders `renderBadgeSvg` output directly, so
   * importing the renderer is the correct behaviour and `PreviewFooter` is
   * gone — the SVG draws its own branding row and verification strip. What
   * still matters is the direction of the dependency: this module must stay
   * free of renderer imports (asserted above) so the server renderer and any
   * client surface can both consume it.
   */
  it("has Studio consume the shared renderer rather than redrawing the badge", () => {
    const source = readFileSync(
      resolve(__dirname, "../app/studio/BadgePreviewCard.tsx"),
      "utf8",
    );

    expect(source).toMatch(/from ["']@\/lib\/render\/BadgeSvg["']/);
    expect(source).toContain("renderBadgeSvg");

    // It must not compose the DOM lookalike any more. Checked against the
    // import statements, not the whole file: the component documents what it
    // replaced, and naming that is not depending on it.
    const imports = source
      .split("\n")
      .filter((line) => /^\s*import\b/.test(line));
    for (const line of imports) {
      expect(line).not.toMatch(/\bBadgeContent\b/);
    }
  });
});

/**
 * #1183 (UX-M10, second half) — Wave 2 decision record.
 *
 * Wave 1 (#1168) gave the badge exactly one verified color (VERIFICATION_CORAL).
 * This wave evaluated carrying that coral onto the light/dark-capable
 * `/verify/:hash` page for continuity, and decided AGAINST it, keeping the
 * existing teal (`--color-complement`) tokens there instead. Two independent
 * reasons, both measured below:
 *
 * 1. Contrast: coral clears AA against the badge's own fixed dark background,
 *    but on a light background it only clears the *large/bold-text* AA floor
 *    (3:1), not the normal-text floor (4.5:1) the verify page's body copy
 *    (hash, handle, dimension labels) would need.
 * 2. Colorblind-safe separation from the error/red semantic: coral and
 *    `--color-terminal-red` sit ~7 degrees apart in hue, and the lightness
 *    gap between them narrows on light theme (the site's default theme) to
 *    the point of being hard to distinguish — an unacceptable risk on a page
 *    whose entire job is to assert "verified" without being mistaken for
 *    "error".
 *
 * These two guard tests keep that decision honest: if VERIFICATION_CORAL's
 * value or the badge's fixed background ever change, the contrast numbers
 * this decision relied on are re-derived and checked against the documented
 * thresholds (see docs/design-system.md's "Verification-related UI" section)
 * rather than silently going stale; and the badge-only usage boundary
 * (coral never leaking into the site's teal-branded verification UI) is
 * enforced structurally.
 */
describe("verification color decision (#1183)", () => {
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
    return (
      0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
    );
  }

  function contrastRatio(hexA: string, hexB: string): number {
    const lumA = relativeLuminance(hexToRgb(hexA));
    const lumB = relativeLuminance(hexToRgb(hexB));
    const lighter = Math.max(lumA, lumB);
    const darker = Math.min(lumA, lumB);
    return (lighter + 0.05) / (darker + 0.05);
  }

  function hueDegrees(hex: string): number {
    const [r0, g0, b0] = hexToRgb(hex);
    const r = r0 / 255;
    const g = g0 / 255;
    const b = b0 / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    if (delta === 0) return 0;
    let h: number;
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
    return h < 0 ? h + 360 : h;
  }

  // Badge's own fixed dark canvas (never themed — see BadgeSvg.tsx).
  const BADGE_DARK_BG = "#0C0D14";
  // Site light theme backgrounds (--color-bg / --color-card).
  const SITE_LIGHT_BG = "#FFFFFF";
  const SITE_LIGHT_CARD = "#F9FAFB";
  // Site terminal-red per theme.
  const TERMINAL_RED_LIGHT = "#DC2626";
  const TERMINAL_RED_DARK = "#F87171";

  it("clears AA against the badge's own fixed dark background", () => {
    const ratio = contrastRatio(VERIFICATION_CORAL, BADGE_DARK_BG);
    // ~5.3:1 — comfortably AA (>= 4.5) for any text size on the badge itself.
    expect(ratio).toBeGreaterThanOrEqual(5.0);
    expect(ratio).toBeLessThan(5.6);
  });

  it("only clears large/bold-text AA on a light background, not normal text", () => {
    const ratioBg = contrastRatio(VERIFICATION_CORAL, SITE_LIGHT_BG);
    const ratioCard = contrastRatio(VERIFICATION_CORAL, SITE_LIGHT_CARD);
    // ~3.7:1 — above the 3:1 large/bold-text AA floor...
    expect(ratioBg).toBeGreaterThanOrEqual(3.0);
    expect(ratioCard).toBeGreaterThanOrEqual(3.0);
    // ...but below the 4.5:1 normal-text AA floor the verify page's body
    // copy (hash, handle, dimension values) would need if coral were used
    // as a general text color there.
    expect(ratioBg).toBeLessThan(4.5);
    expect(ratioCard).toBeLessThan(4.5);
  });

  it("sits close enough to terminal-red in hue that light-theme separation is unsafe", () => {
    const coralHue = hueDegrees(VERIFICATION_CORAL);
    const redLightHue = hueDegrees(TERMINAL_RED_LIGHT);
    const redDarkHue = hueDegrees(TERMINAL_RED_DARK);

    // ~7.5 degrees apart in both themes — a colorblind viewer (especially
    // protanopia/deuteranopia, which collapse the red-orange range) cannot
    // rely on hue alone to tell "verified" from "error".
    expect(Math.abs(coralHue - redLightHue)).toBeLessThan(10);
    expect(Math.abs(coralHue - redDarkHue)).toBeLessThan(10);
  });

  it("keeps coral scoped to the badge — the site's verification UI stays on teal", () => {
    const verifyPageSource = readFileSync(
      resolve(__dirname, "../app/verify/[hash]/page.tsx"),
      "utf8",
    );
    const statusCalloutSource = readFileSync(
      resolve(__dirname, "../components/StatusCallout.tsx"),
      "utf8",
    );

    for (const source of [verifyPageSource, statusCalloutSource]) {
      expect(source).not.toMatch(/VERIFICATION_CORAL/);
      expect(source).not.toMatch(/#E05A47/i);
    }

    // The site's verification affordances stay on the documented teal tokens.
    expect(statusCalloutSource).toContain("border-complement/30");
    expect(statusCalloutSource).toContain("text-complement");
  });
});
