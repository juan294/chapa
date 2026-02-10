import type { BadgeConfig } from "@chapa/shared";
import { DEFAULT_BADGE_CONFIG } from "@chapa/shared";

export { DEFAULT_BADGE_CONFIG };

export interface StudioPreset {
  id: string;
  label: string;
  config: BadgeConfig;
}

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
      interaction: "tilt-3d",
      statsDisplay: "animated-ease",
      tierTreatment: "enhanced",
      celebration: "none",
    },
  },
  {
    id: "holographic",
    label: "Holographic",
    config: {
      background: "solid",
      cardStyle: "frost",
      border: "gradient-rotating",
      scoreEffect: "gold-shimmer",
      heatmapAnimation: "ripple",
      interaction: "holographic",
      statsDisplay: "animated-ease",
      tierTreatment: "enhanced",
      celebration: "none",
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
      interaction: "tilt-3d",
      statsDisplay: "animated-spring",
      tierTreatment: "enhanced",
      celebration: "confetti",
    },
  },
];
