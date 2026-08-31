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
 *
 * #1242 — every preset pins `palette: "jade"`. A preset sets every category by
 * contract ("preset X applied - N categories set"), so leaving palette out
 * would make it the one field a preset silently preserved. Applying a preset
 * therefore returns the palette to jade, the same way it returns every other
 * category to the preset's own value.
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
      palette: "jade",
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
      palette: "jade",
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
      palette: "jade",
    },
  },
];
