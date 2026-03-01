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
  accent: "#8B5CF6",
  stroke: "rgba(139,92,246,0.12)",
  heatmap: [
    "rgba(139,92,246,0.12)", // 0: none
    "rgba(139,92,246,0.30)", // 1: low
    "rgba(139,92,246,0.48)", // 2: medium
    "rgba(139,92,246,0.68)", // 3: high
    "rgba(139,92,246,0.92)", // 4: intense
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
  High: "#A78BFA",
  Elite: "#8B5CF6",
};

export function getTierColor(tier: ImpactTier): string {
  return TIER_COLORS[tier];
}

const ARCHETYPE_COLORS: Record<DeveloperArchetype, string> = {
  Builder: "#8B5CF6",   // signature violet
  "Quality Champion": "#EC4899",  // pink
  Marathoner: "#22C55E", // green
  Polymath: "#EAB308",  // amber/gold
  Balanced: "#0EA5E9",  // sky blue
  Emerging: "#F97316",  // warm orange
};

export function getArchetypeColor(archetype: DeveloperArchetype): string {
  return ARCHETYPE_COLORS[archetype];
}
