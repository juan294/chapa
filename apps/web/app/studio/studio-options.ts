import type { BadgeConfig } from "@chapa/shared";
import type { LanguageContextValue } from "@/lib/i18n";

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

export type StudioTranslate = LanguageContextValue["t"];

function translatedOrFallback(
  t: StudioTranslate | undefined,
  key: string,
  fallback: string,
): string {
  if (!t) return fallback;
  const translated = t(key);
  return typeof translated === "string" && translated !== key
    ? translated
    : fallback;
}

/**
 * The badge's customizable categories, every one of which renders in the
 * embeddable SVG (#1191). Interaction, stats display and celebration used to
 * sit here too; they needed a pointer, a JavaScript loop and an "on load"
 * moment respectively, none of which a cached image has, so they were removed
 * rather than shown beside controls that ship.
 */
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
    key: "tierTreatment",
    label: "Tier Treatment",
    options: [
      { value: "standard", label: "Standard", description: "Simple tier pill" },
      { value: "enhanced", label: "Enhanced", description: "Sparkle dots for high tiers" },
    ],
  },
];

/** Get the display label for a specific option value */
export function getCategoryLabel(
  category: CategoryMeta,
  t?: StudioTranslate,
): string {
  return translatedOrFallback(
    t,
    `studio.categories.${category.key}.label`,
    category.label,
  );
}

export function getOptionLabel(
  key: keyof BadgeConfig,
  value: string,
  t?: StudioTranslate,
): string {
  const category = STUDIO_CATEGORIES.find((c) => c.key === key);
  if (!category) return value;
  const option = category.options.find((o) => o.value === value);
  if (!option) return value;
  return translatedOrFallback(
    t,
    `studio.categories.${key}.options.${value}`,
    option.label,
  );
}

/**
 * The one-line explanation of what an option does. Quick Controls shows this
 * under every option label since #1216 — before that the descriptions existed
 * in this file but nothing rendered them, so picking an effect meant guessing
 * from its name.
 */
export function getOptionDescription(
  key: keyof BadgeConfig,
  value: string,
  t?: StudioTranslate,
): string {
  const category = STUDIO_CATEGORIES.find((c) => c.key === key);
  const option = category?.options.find((o) => o.value === value);
  if (!option) return "";
  return translatedOrFallback(
    t,
    `studio.categories.${key}.descriptions.${value}`,
    option.description,
  );
}

export function getPresetLabel(
  id: string,
  fallback: string,
  t?: StudioTranslate,
): string {
  return translatedOrFallback(t, `studio.presetLabels.${id}`, fallback);
}
