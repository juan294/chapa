import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BADGE_CONFIG_OPTIONS, type BadgePalette } from "@chapa/shared";
import { badgeTheme, WARM_AMBER, getArchetypeColor } from "./theme";

/**
 * #1225 — the badge kept the pre-Jade violet after the app moved to Jade in
 * #1206. The violet was not confined to `theme.ts`: it was spelled out as 28
 * literals across six files, which is how it survived the rebrand in the first
 * place. These tests pin each accent to ONE definition and fail if a literal
 * reappears anywhere on the render path.
 *
 * #1242 — the badge now has five palettes, so "defined once" is asserted per
 * palette rather than once globally, and the ground moves with the accent.
 */
const RENDER_PATH_FILES = [
  "apps/web/lib/render/BadgeSvg.tsx",
  "apps/web/lib/render/BadgeBranding.tsx",
  "apps/web/lib/render/badge-effects.ts",
  "apps/web/lib/render/heatmap.ts",
  "apps/web/lib/render/RadarChart.ts",
  "apps/web/lib/render/VerificationStrip.ts",
  "apps/web/app/og-image/route.ts",
  "apps/web/app/u/[handle]/badge.svg/route.ts",
];

const REPO_ROOT = resolve(__dirname, "../../../..");
const PALETTES = BADGE_CONFIG_OPTIONS.colorPalette;

/** sRGB relative luminance, per WCAG 2.x. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe("the badge palettes (#1225, #1242)", () => {
  it("keeps jade as the default, at the app's dark-half jade token", () => {
    // globals.css: --color-amber dark half is oklch(.76 .16 163) -> #1BD093.
    // The badge always renders dark, so it takes the dark half.
    expect(WARM_AMBER).toBe(badgeTheme("jade"));
    expect(badgeTheme().accent).toBe("#1BD093");
    expect(badgeTheme("jade").accentRgb).toBe("27, 208, 147");
    expect(badgeTheme("jade").bg).toBe("#0C0D14");
    expect(badgeTheme("jade").card).toBe("#13141E");
  });

  it.each(PALETTES)("derives every %s tint from that palette's one accent", (palette) => {
    const theme = badgeTheme(palette);
    expect(theme.tint(0.12)).toBe(`rgba(${theme.accentRgb}, 0.12)`);
    expect(theme.stroke).toBe(theme.tint(0.12));
    for (const step of theme.heatmap) {
      expect(step).toContain(theme.accentRgb);
    }
  });

  it("gives every palette a distinct accent and ground", () => {
    const accents = new Set(PALETTES.map((p) => badgeTheme(p).accent));
    const grounds = new Set(PALETTES.map((p) => badgeTheme(p).bg));
    expect(accents.size).toBe(PALETTES.length);
    expect(grounds.size).toBe(PALETTES.length);
  });

  it("falls back to jade for an id that escaped validation, rather than throwing", () => {
    expect(badgeTheme("chartreuse" as BadgePalette)).toBe(badgeTheme("jade"));
  });

  it.each(PALETTES)("clears AA for the %s accent and text on its own ground", (palette) => {
    const theme = badgeTheme(palette);
    expect(contrast(theme.accent, theme.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.accentLight, theme.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.accent, theme.card)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.textSecondary, theme.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.textPrimary, theme.bg)).toBeGreaterThanOrEqual(4.5);
  });

  // The archetype hues do not follow the palette (#1242) — one hue per
  // archetype is a semantic signal. That only holds if all seven stay legible
  // on all five grounds.
  it.each(PALETTES)("keeps all seven archetype colours legible on the %s ground", (palette) => {
    const ground = badgeTheme(palette).bg;
    const archetypes = [
      "Builder",
      "Quality Champion",
      "Marathoner",
      "Polymath",
      "Balanced",
      "Emerging",
      "Artificer",
    ] as const;
    for (const archetype of archetypes) {
      expect(
        contrast(getArchetypeColor(archetype), ground),
        archetype,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps the archetype colours identical in every palette", () => {
    // Guards against a future "make it cohesive" change collapsing seven
    // signals into the palette accent.
    const builder = getArchetypeColor("Builder");
    expect(builder).toBe("#009F6D");
    expect(new Set(PALETTES.map(() => getArchetypeColor("Builder"))).size).toBe(1);
  });

  it.each(RENDER_PATH_FILES)("writes no colour literal by hand in %s", (file) => {
    const source = readFileSync(resolve(REPO_ROOT, file), "utf8");
    // The pre-#1206 violet, in both spellings.
    expect(source).not.toMatch(/139\s*,\s*92\s*,\s*246/);
    expect(source.toUpperCase()).not.toContain("#8B5CF6");
    expect(source.toUpperCase()).not.toContain("#A78BFA");
    // Any hand-written accent tint. Every translucent use goes through
    // `theme.tint(alpha)`, so a bare numeric rgba() is how a palette gets
    // stranded on jade.
    expect(source).not.toMatch(/rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+/);
  });

  it("keeps the verification coral, which is not part of any accent", () => {
    // #1168/#1183: coral is the badge's one "verified" colour and is
    // deliberately NOT the brand accent. No palette may claim it.
    const source = readFileSync(
      resolve(REPO_ROOT, "apps/web/lib/badge-visual-metadata.ts"),
      "utf8",
    );
    expect(source).toContain("#E05A47");
    expect(PALETTES.map((p) => badgeTheme(p).accent)).not.toContain("#E05A47");
  });
});
