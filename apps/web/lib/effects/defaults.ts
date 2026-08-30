import type { BadgeConfig } from "@chapa/shared";
import { DEFAULT_BADGE_CONFIG } from "@chapa/shared";

export interface StudioPreset {
  id: string;
  label: string;
  config: BadgeConfig;
}

/**
 * #1191 — "Holographic" was named for interaction: "holographic", a hover
 * overlay that never reached the badge. It now takes the name from the score
 * effect, which does.
 */
export const STUDIO_PRESETS: StudioPreset[] = [
  {
    id: "minimal",
    label: "Minimal",
    config: { ...DEFAULT_BADGE_CONFIG },
  },
  {
    id: "premium",
    label: "Premium",
    config: {
      background: "aurora",
      cardStyle: "smoke",
      border: "solid-amber",
      scoreEffect: "gold-leaf",
      heatmapAnimation: "diagonal",
      tierTreatment: "enhanced",
    },
  },
  {
    id: "holographic",
    label: "Holographic",
    config: {
      background: "solid",
      cardStyle: "frost",
      border: "gradient-rotating",
      scoreEffect: "holographic",
      heatmapAnimation: "ripple",
      tierTreatment: "enhanced",
    },
  },
  {
    id: "maximum",
    label: "Maximum",
    config: {
      background: "aurora",
      cardStyle: "crystal",
      border: "gradient-rotating",
      scoreEffect: "gold-shimmer",
      heatmapAnimation: "scatter",
      tierTreatment: "enhanced",
    },
  },
];
