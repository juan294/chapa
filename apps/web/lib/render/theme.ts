import type { ImpactTier, DeveloperArchetype } from "@chapa/shared";

interface BadgeTheme {
  bg: string;
  card: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  /** Lighter accent step. Used by the High tier and the aurora-glass sheen. */
  accentLight: string;
  stroke: string;
  heatmap: [string, string, string, string, string];
}

// Badge SVG renders on the server before app CSS is applied, so it cannot read
// a CSS custom property and the palette is resolved to literals here.
//
// #1225 — these are the Jade values, converted from the app's own tokens in
// apps/web/styles/globals.css. The badge always renders dark, so the accent
// takes the DARK half of `--color-amber` (`oklch(.76 .16 163)` -> #1BD093) and
// the archetypes take `oklch(.62 .14 <hue>)`, which globals.css uses in both
// themes. They are hex rather than `oklch()` because the OG-image route
// rasterizes this SVG through resvg, which parses a narrower colour syntax
// than a browser.
//
// The badge kept the pre-#1206 violet while Creator Studio previewed a
// separate DOM badge. #1191 made Studio render this SVG, so "jade in Studio,
// violet in the README" stopped being tenable.
//
// `bg`/`card`/`textStrong`/`textMuted` are deliberately NOT converged: they are
// a slightly cooler ground tuned for the badge's fixed-dark canvas, and moving
// the ground is a design decision separate from the accent (#1168 UX-L2).
//
// Contrast against the badge ground #0C0D14, measured: accent 9.68:1,
// accentLight 12.56:1, and every archetype between 4.96:1 (Quality Champion)
// and 5.70:1 (Builder) — all clear AA. The old violet accent measured 4.58:1,
// so this is an improvement, not a trade.

/**
 * The accent as an `r, g, b` triple, so every translucent tint derives from
 * ONE definition. The violet this replaced was spelled out as 28 separate
 * literals across six files, which is exactly how it survived the #1206
 * rebrand; `badge-palette.test.ts` now fails if a literal reappears.
 */
export const BADGE_ACCENT_RGB = "27, 208, 147";

/** An accent tint at the given alpha. Use this instead of writing `rgba(...)`. */
export function accentTint(alpha: number): string {
  return `rgba(${BADGE_ACCENT_RGB}, ${alpha})`;
}

const BADGE_BRAND_COLORS = {
  accent: "#1BD093",
  accentLight: "#65E7B0",
  textMuted: "#9AA4B2",
  textStrong: "#E6EDF3",
  archetypes: {
    Builder: "#009F6D",
    "Quality Champion": "#B464AE",
    Marathoner: "#479C4D",
    Polymath: "#8C8C00",
    Balanced: "#0A8FD1",
    Emerging: "#C7692C",
    Artificer: "#B67700",
  } satisfies Record<DeveloperArchetype, string>,
} as const;

export const WARM_AMBER: BadgeTheme = {
  bg: "#0C0D14",
  card: "#13141E",
  textPrimary: BADGE_BRAND_COLORS.textStrong,
  textSecondary: BADGE_BRAND_COLORS.textMuted,
  accent: BADGE_BRAND_COLORS.accent,
  accentLight: BADGE_BRAND_COLORS.accentLight,
  stroke: accentTint(0.12),
  heatmap: [
    accentTint(0.12), // 0: none
    accentTint(0.3), // 1: low
    accentTint(0.48), // 2: medium
    accentTint(0.68), // 3: high
    accentTint(0.92), // 4: intense
  ],
};

/**
 * Map a daily contribution count to a heatmap cell color (jade opacity ramp).
 *
 * Buckets: 0 = none (12%), 1--2 = low (30%), 3--5 = medium (48%),
 * 6--10 = high (68%), 11+ = intense (92%).
 *
 * @param count - Number of contributions on a given day
 * @returns An `rgba()` color string from the {@link WARM_AMBER} heatmap palette
 */
export function getHeatmapColor(count: number): string {
  if (count === 0) return WARM_AMBER.heatmap[0];
  if (count <= 2) return WARM_AMBER.heatmap[1];
  if (count <= 5) return WARM_AMBER.heatmap[2];
  if (count <= 10) return WARM_AMBER.heatmap[3];
  return WARM_AMBER.heatmap[4];
}

const TIER_COLORS: Record<ImpactTier, string> = {
  Emerging: BADGE_BRAND_COLORS.textMuted,
  Solid: BADGE_BRAND_COLORS.textStrong,
  High: BADGE_BRAND_COLORS.accentLight,
  Elite: BADGE_BRAND_COLORS.accent,
};

/**
 * Get the badge accent color for an Impact tier.
 *
 * Used in the score ring and tier label on the embeddable badge SVG.
 *
 * @param tier - The Impact tier (Emerging, Solid, High, or Elite)
 * @returns A hex color string
 */
export function getTierColor(tier: ImpactTier): string {
  return TIER_COLORS[tier];
}

const ARCHETYPE_COLORS: Record<DeveloperArchetype, string> =
  BADGE_BRAND_COLORS.archetypes;

/**
 * Get the badge accent color for a developer archetype.
 *
 * Used in the archetype pill and code-brackets icon on the embeddable badge SVG.
 *
 * @param archetype - The developer archetype label
 * @returns A hex color string unique to the archetype
 */
export function getArchetypeColor(archetype: DeveloperArchetype): string {
  return ARCHETYPE_COLORS[archetype];
}
