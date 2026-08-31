import type {
  ImpactTier,
  DeveloperArchetype,
  BadgePalette,
} from "@chapa/shared";

export interface BadgeTheme {
  palette: BadgePalette;
  bg: string;
  card: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  /** Lighter accent step. Used by the High tier and the aurora-glass sheen. */
  accentLight: string;
  /**
   * The accent as an `r, g, b` triple — the ONE definition every translucent
   * use in this palette derives from, via {@link BadgeTheme.tint}.
   */
  accentRgb: string;
  stroke: string;
  heatmap: [string, string, string, string, string];
  /** This palette's accent at the given alpha. Never write `rgba(...)` by hand. */
  tint(alpha: number): string;
}

// Badge SVG renders on the server before app CSS is applied, so it cannot read
// a CSS custom property and every palette is resolved to literals here.
//
// #1225 — `jade` is the app's own token set, converted. The badge always
// renders dark, so the accent takes the DARK half of `--color-amber`
// (`oklch(.76 .16 163)` -> #1BD093) and the archetypes take
// `oklch(.62 .14 <hue>)`, which globals.css uses in both themes. They are hex
// rather than `oklch()` because the OG-image route rasterizes this SVG through
// resvg, which parses a narrower colour syntax than a browser.
//
// #1242 — the ground stopped being fixed. A Studio palette is "accent on
// ground", so `bg`/`card` move with it. The five grounds are the SAME oklch
// lightness and chroma as jade's (`.1615 .0149` and `.1952 .0202`), hue-shifted
// to the palette, which is why contrast barely varies across them:
//
//   palette   accent   accent/bg  accentLight/bg  worst archetype/bg
//   jade      #1BD093       9.68           12.56   4.96 (Quality Champion)
//   indigo    #96ACFF       8.91           11.78   4.97
//   amber     #DEA800       8.96           11.79   4.96
//   crimson   #FF879C       8.51           11.51   4.97
//   mono      #AEB2B6       9.07           11.86   4.95
//
// Archetype colours deliberately do NOT follow the palette: one hue per
// archetype is a semantic signal, and collapsing seven into the palette accent
// would mean the hue stops carrying meaning. All seven measure between 4.95:1
// and 5.72:1 on every ground above, so they clear AA in all five.
//
// `crimson` is a rose, not the coral its design brief named. `VERIFICATION_CORAL`
// (#E05A47) is the badge's one "verified" colour and is deliberately not the
// accent (#1168/#1183); a coral accent sat 2.4 degrees from it in hue and would
// have collapsed that distinction. The shipped rose sits 20.5 degrees away with
// a 12.4pp lightness gap.

interface PaletteDefinition {
  accent: string;
  accentLight: string;
  accentRgb: string;
  bg: string;
  card: string;
}

const PALETTE_DEFINITIONS: Record<BadgePalette, PaletteDefinition> = {
  jade: {
    accent: "#1BD093",
    accentLight: "#65E7B0",
    accentRgb: "27, 208, 147",
    bg: "#0C0D14",
    card: "#13141E",
  },
  indigo: {
    accent: "#96ACFF",
    accentLight: "#B8C8FF",
    accentRgb: "150, 172, 255",
    bg: "#0B0D14",
    card: "#12141E",
  },
  amber: {
    accent: "#DEA800",
    accentLight: "#F4C351",
    accentRgb: "222, 168, 0",
    bg: "#100D09",
    card: "#18150E",
  },
  crimson: {
    accent: "#FF879C",
    accentLight: "#FFB3BD",
    accentRgb: "255, 135, 156",
    bg: "#130B0B",
    card: "#1D1111",
  },
  mono: {
    accent: "#AEB2B6",
    accentLight: "#C7CBCF",
    accentRgb: "174, 178, 182",
    bg: "#0C0E0F",
    card: "#131517",
  },
};

/**
 * Text sits on every ground at the same lightness, so it is palette-independent:
 * `textMuted` measures 7.67-7.71:1 and `textStrong` 16.37-16.45:1 across all five.
 */
const BADGE_TEXT = {
  muted: "#9AA4B2",
  strong: "#E6EDF3",
} as const;

const BADGE_ARCHETYPE_COLORS = {
  Builder: "#009F6D",
  "Quality Champion": "#B464AE",
  Marathoner: "#479C4D",
  Polymath: "#8C8C00",
  Balanced: "#0A8FD1",
  Emerging: "#C7692C",
  Artificer: "#B67700",
} satisfies Record<DeveloperArchetype, string>;

function buildTheme(
  palette: BadgePalette,
  definition: PaletteDefinition,
): BadgeTheme {
  const tint = (alpha: number) => `rgba(${definition.accentRgb}, ${alpha})`;
  return {
    palette,
    bg: definition.bg,
    card: definition.card,
    textPrimary: BADGE_TEXT.strong,
    textSecondary: BADGE_TEXT.muted,
    accent: definition.accent,
    accentLight: definition.accentLight,
    accentRgb: definition.accentRgb,
    stroke: tint(0.12),
    heatmap: [
      tint(0.12), // 0: none
      tint(0.3), // 1: low
      tint(0.48), // 2: medium
      tint(0.68), // 3: high
      tint(0.92), // 4: intense
    ],
    tint,
  };
}

/**
 * Every palette, built once at module load.
 *
 * `renderBadgeSvg` must stay pure and allocation-light — that purity is what
 * makes the SVG cacheable per handle/day/locale — so resolving a palette is a
 * lookup, never a construction.
 */
const BADGE_THEMES: Record<BadgePalette, BadgeTheme> = Object.fromEntries(
  Object.entries(PALETTE_DEFINITIONS).map(([palette, definition]) => [
    palette,
    buildTheme(palette as BadgePalette, definition),
  ]),
) as Record<BadgePalette, BadgeTheme>;

/**
 * Resolve a Studio palette id to its badge theme.
 *
 * An unknown id falls back to jade rather than throwing: this runs on the
 * public badge path, and a config that somehow escaped validation must render
 * the default badge, not a 500.
 */
export function badgeTheme(palette: BadgePalette = "jade"): BadgeTheme {
  return BADGE_THEMES[palette] ?? BADGE_THEMES.jade;
}

/**
 * The default (jade) theme, for the render paths that have no Studio config to
 * resolve: the OG-image route and the badge route's error fallback.
 */
export const WARM_AMBER: BadgeTheme = BADGE_THEMES.jade;

/**
 * Map a daily contribution count to a heatmap cell color (accent opacity ramp).
 *
 * Buckets: 0 = none (12%), 1--2 = low (30%), 3--5 = medium (48%),
 * 6--10 = high (68%), 11+ = intense (92%).
 *
 * @param count - Number of contributions on a given day
 * @param theme - Resolved badge theme; defaults to jade
 * @returns An `rgba()` color string from that theme's heatmap ramp
 */
export function getHeatmapColor(
  count: number,
  theme: BadgeTheme = WARM_AMBER,
): string {
  if (count === 0) return theme.heatmap[0];
  if (count <= 2) return theme.heatmap[1];
  if (count <= 5) return theme.heatmap[2];
  if (count <= 10) return theme.heatmap[3];
  return theme.heatmap[4];
}

/**
 * Get the badge accent color for an Impact tier.
 *
 * Used in the score ring and tier label on the embeddable badge SVG.
 *
 * @param tier - The Impact tier (Emerging, Solid, High, or Elite)
 * @param theme - Resolved badge theme; defaults to jade
 * @returns A hex color string
 */
export function getTierColor(
  tier: ImpactTier,
  theme: BadgeTheme = WARM_AMBER,
): string {
  switch (tier) {
    case "Emerging":
      return theme.textSecondary;
    case "Solid":
      return theme.textPrimary;
    case "High":
      return theme.accentLight;
    case "Elite":
      return theme.accent;
  }
}

/**
 * Get the badge accent color for a developer archetype.
 *
 * Used in the archetype pill and code-brackets icon on the embeddable badge SVG.
 *
 * Deliberately palette-independent (#1242): the seven hues are a semantic
 * signal, one per archetype, and every one clears AA on every palette ground.
 *
 * @param archetype - The developer archetype label
 * @returns A hex color string unique to the archetype
 */
export function getArchetypeColor(archetype: DeveloperArchetype): string {
  return BADGE_ARCHETYPE_COLORS[archetype];
}
