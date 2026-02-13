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

export const WARM_AMBER: BadgeTheme = {
  bg: "#0C0D14",
  card: "#13141E",
  textPrimary: "#E6EDF3",
  textSecondary: "#9AA4B2",
  accent: "#7C6AEF",
  stroke: "rgba(124,106,239,0.12)",
  heatmap: [
    "rgba(124,106,239,0.06)", // 0: none
    "rgba(124,106,239,0.20)", // 1: low
    "rgba(124,106,239,0.38)", // 2: medium
    "rgba(124,106,239,0.58)", // 3: high
    "rgba(124,106,239,0.85)", // 4: intense
  ],
};

export function getHeatmapColor(count: number): string {
  if (count === 0) return WARM_AMBER.heatmap[0];
  if (count <= 2) return WARM_AMBER.heatmap[1];
  if (count <= 5) return WARM_AMBER.heatmap[2];
  if (count <= 10) return WARM_AMBER.heatmap[3];
  return WARM_AMBER.heatmap[4];
}

const TIER_COLORS: Record<ImpactTier, string> = {
  Emerging: "#9AA4B2",
  Solid: "#E6EDF3",
  High: "#9D8FFF",
  Elite: "#7C6AEF",
};

export function getTierColor(tier: ImpactTier): string {
  return TIER_COLORS[tier];
}

const ARCHETYPE_COLORS: Record<DeveloperArchetype, string> = {
  Builder: "#7C6AEF",   // signature purple
  Guardian: "#F472B6",  // pink
  Marathoner: "#4ADE80", // green
  Polymath: "#FBBF24",  // amber/gold
  Balanced: "#E6EDF3",  // light gray
  Emerging: "#9AA4B2",  // muted gray
};

export function getArchetypeColor(archetype: DeveloperArchetype): string {
  return ARCHETYPE_COLORS[archetype];
}
