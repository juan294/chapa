import type { BadgeConfig } from "@chapa/shared";

/** Metadata for a single selectable option */
export interface OptionMeta {
  value: string;
  label: string;
  description: string;
}

/** Metadata for one effect category in the Studio controls */
export interface CategoryMeta {
  key: keyof BadgeConfig;
  label: string;
  options: OptionMeta[];
}

export const STUDIO_CATEGORIES: CategoryMeta[] = [
  {
    key: "background",
    label: "Background",
    options: [
      { value: "solid", label: "Solid Dark", description: "Clean dark background" },
      { value: "aurora", label: "Aurora Glow", description: "Animated color waves" },
      { value: "particles", label: "Particles", description: "Floating sparkle particles" },
    ],
  },
  {
    key: "cardStyle",
    label: "Card Style",
    options: [
      { value: "flat", label: "Flat", description: "Solid card surface" },
      { value: "frost", label: "Frosted Glass", description: "Cool frosted blur" },
      { value: "smoke", label: "Smoke Glass", description: "Warm smoky blur" },
      { value: "crystal", label: "Crystal Glass", description: "Clear crystal refraction" },
      { value: "aurora-glass", label: "Aurora Glass", description: "Color-shifting glass" },
    ],
  },
  {
    key: "border",
    label: "Border",
    options: [
      { value: "solid-amber", label: "Amber", description: "Subtle amber border" },
      { value: "gradient-rotating", label: "Gradient Spin", description: "Animated rotating gradient" },
      { value: "none", label: "None", description: "No border" },
    ],
  },
  {
    key: "scoreEffect",
    label: "Score Effect",
    options: [
      { value: "standard", label: "Standard", description: "Plain text score" },
      { value: "gold-shimmer", label: "Gold Shimmer", description: "Shimmering gold gradient" },
      { value: "gold-leaf", label: "Gold Leaf", description: "Metallic gold leaf texture" },
      { value: "chrome", label: "Chrome", description: "Polished chrome reflection" },
      { value: "embossed", label: "Embossed", description: "Raised embossed text" },
      { value: "neon-amber", label: "Neon Amber", description: "Glowing neon amber" },
      { value: "holographic", label: "Holographic", description: "Rainbow holographic shift" },
    ],
  },
  {
    key: "heatmapAnimation",
    label: "Heatmap Animation",
    options: [
      { value: "fade-in", label: "Fade In", description: "Uniform gentle fade" },
      { value: "diagonal", label: "Diagonal Wave", description: "Top-left to bottom-right" },
      { value: "ripple", label: "Center Ripple", description: "Expanding from center" },
      { value: "scatter", label: "Random Scatter", description: "Random appearance order" },
      { value: "cascade", label: "Column Cascade", description: "Column by column reveal" },
      { value: "waterfall", label: "Row Waterfall", description: "Row by row reveal" },
    ],
  },
  {
    key: "interaction",
    label: "Interaction",
    options: [
      { value: "static", label: "Static", description: "No mouse interaction" },
      { value: "tilt-3d", label: "3D Tilt", description: "Perspective tilt on hover" },
      { value: "holographic", label: "Holographic", description: "Rainbow overlay on hover" },
    ],
  },
  {
    key: "statsDisplay",
    label: "Stats Display",
    options: [
      { value: "static", label: "Static", description: "Plain numbers" },
      { value: "animated-ease", label: "Smooth Count", description: "Eased counting animation" },
      { value: "animated-spring", label: "Spring Count", description: "Bouncy spring animation" },
    ],
  },
  {
    key: "tierTreatment",
    label: "Tier Treatment",
    options: [
      { value: "standard", label: "Standard", description: "Simple tier pill" },
      { value: "enhanced", label: "Enhanced", description: "Sparkle dots for high tiers" },
    ],
  },
  {
    key: "celebration",
    label: "Celebration",
    options: [
      { value: "none", label: "None", description: "No celebration effect" },
      { value: "confetti", label: "Confetti", description: "Burst of confetti on load" },
    ],
  },
];

/** Get the display label for a specific option value */
export function getOptionLabel(key: keyof BadgeConfig, value: string): string {
  const category = STUDIO_CATEGORIES.find((c) => c.key === key);
  if (!category) return value;
  const option = category.options.find((o) => o.value === value);
  return option ? option.label : value;
}
