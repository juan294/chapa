// Barrel exports for all effect modules

// Backgrounds
export { AuroraBackground } from "./backgrounds/AuroraBackground";
export type { AuroraBackgroundProps } from "./backgrounds/AuroraBackground";
export { useParticles, PARTICLE_PRESETS } from "./backgrounds/ParticleBackground";
export type { ParticleConfig, Particle } from "./backgrounds/ParticleBackground";

// Cards
export { glassStyle, GLASS_PRESETS } from "./cards/glass-presets";
export type { GlassVariant } from "./cards/glass-presets";

// Borders
export { GradientBorder, GRADIENT_BORDER_CSS } from "./borders/GradientBorder";
export type { GradientBorderProps } from "./borders/GradientBorder";

// Text effects
export { ScoreEffectText, SCORE_EFFECT_CSS } from "./text/ScoreEffectText";
export type { ScoreEffect, ScoreEffectTextProps } from "./text/ScoreEffectText";

// Heatmap animations
export {
  getDelayFn,
  fadeInDelay,
  diagonalDelay,
  rippleDelay,
  scatterDelay,
  columnCascadeDelay,
  rowWaterfallDelay,
  generateMockHeatmap,
  INTENSITY_COLORS,
  VARIANTS as HEATMAP_VARIANTS,
  WEEKS,
  DAYS,
} from "./heatmap/animations";
export type { AnimationVariant } from "./heatmap/animations";

// Heatmap grid component
export { HeatmapGrid, getIntensityLevel, HEATMAP_GRID_CSS } from "./heatmap/HeatmapGrid";
export type { HeatmapGridProps } from "./heatmap/HeatmapGrid";

// Interactions
export { computeTilt, useTilt } from "./interactions/use-tilt";
export type { TiltState } from "./interactions/use-tilt";
export { HolographicOverlay, HOLOGRAPHIC_CSS } from "./interactions/HolographicOverlay";
export type { HolographicVariant, HolographicOverlayProps } from "./interactions/HolographicOverlay";

// Counters
export { useAnimatedCounter, easings } from "./counters/use-animated-counter";
export { useInView } from "./counters/use-in-view";

// Tier
export {
  tierPillClasses,
  tierScoreClass,
  tierCardClass,
  SparkleDots,
  TIER_VISUALS_CSS,
} from "./tier/TierVisuals";

// Celebrations
export {
  fireSingleBurst,
  fireMultiBurst,
  fireFireworks,
  fireSubtleSparkle,
} from "./celebrations/confetti";
export type { ConfettiPalette } from "./celebrations/confetti";

// Defaults & Presets
export { DEFAULT_BADGE_CONFIG, STUDIO_PRESETS } from "./defaults";
export type { StudioPreset } from "./defaults";
