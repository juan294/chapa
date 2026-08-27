import type { ImpactTier, DeveloperArchetype } from "@chapa/shared";

interface BadgeTheme {
  bg: string;
  card: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  stroke: string;
  heatmap: [string, string, string, string, string];
}

// Badge SVG renders on the server before app CSS is applied, so the palette
// is duplicated here. Invariant (narrower than it sounds): only the brand
// `accent`/`accentLight` and the 7 `archetypes` colors below must stay
// aligned with apps/web/styles/globals.css — enforced by theme.test.ts.
// `bg`/`card`/`textStrong`/`textMuted` (used to build WARM_AMBER.bg/card/
// textPrimary/textSecondary below) are an intentionally SEPARATE, slightly
// cooler palette tuned for the badge's fixed-dark canvas; they do not match
// --color-bg/--color-card/--color-text-primary/--color-text-secondary, and
// that is by design, not drift. Prefer correcting this comment over changing
// those values — a value change alters every cached badge SVG and every
// already-embedded README image for a ~2-RGB-step difference that's
// imperceptible in practice (#1168 UX-L2).
const BADGE_BRAND_COLORS = {
  accent: "#8B5CF6",
  accentLight: "#A78BFA",
  textMuted: "#9AA4B2",
  textStrong: "#E6EDF3",
  archetypes: {
    Builder: "#8B5CF6",
    "Quality Champion": "#EC4899",
    Marathoner: "#22C55E",
    Polymath: "#EAB308",
    Balanced: "#0EA5E9",
    Emerging: "#F97316",
    Artificer: "#F59E0B",
  } satisfies Record<DeveloperArchetype, string>,
} as const;

export const WARM_AMBER: BadgeTheme = {
  bg: "#0C0D14",
  card: "#13141E",
  textPrimary: BADGE_BRAND_COLORS.textStrong,
  textSecondary: BADGE_BRAND_COLORS.textMuted,
  accent: BADGE_BRAND_COLORS.accent,
  stroke: "rgba(139,92,246,0.12)",
  heatmap: [
    "rgba(139,92,246,0.12)", // 0: none
    "rgba(139,92,246,0.30)", // 1: low
    "rgba(139,92,246,0.48)", // 2: medium
    "rgba(139,92,246,0.68)", // 3: high
    "rgba(139,92,246,0.92)", // 4: intense
  ],
};

/**
 * Map a daily contribution count to a heatmap cell color (purple opacity ramp).
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
