import type { ImpactTier } from "@chapa/shared";

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
  bg: "#12100D",
  card: "#1A1610",
  textPrimary: "#E6EDF3",
  textSecondary: "#9AA4B2",
  accent: "#E2A84B",
  stroke: "rgba(226,168,75,0.12)",
  heatmap: [
    "rgba(226,168,75,0.06)", // 0: none
    "rgba(226,168,75,0.20)", // 1: low
    "rgba(226,168,75,0.38)", // 2: medium
    "rgba(226,168,75,0.58)", // 3: high
    "rgba(226,168,75,0.85)", // 4: intense
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
  High: "#F0C97D",
  Elite: "#E2A84B",
};

export function getTierColor(tier: ImpactTier): string {
  return TIER_COLORS[tier];
}
