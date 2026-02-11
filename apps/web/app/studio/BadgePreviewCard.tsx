"use client";

import { useRef, useEffect } from "react";
import type {
  BadgeConfig,
  Stats90d,
  ImpactV3Result,
  ImpactTier,
} from "@chapa/shared";
import type { GlassVariant } from "@/lib/effects/cards/glass-presets";
import type { ScoreEffect } from "@/lib/effects/text/ScoreEffectText";
import { AuroraBackground } from "@/lib/effects/backgrounds/AuroraBackground";
import { useParticles, PARTICLE_PRESETS } from "@/lib/effects/backgrounds/ParticleBackground";
import { glassStyle } from "@/lib/effects/cards/glass-presets";
import { GradientBorder, GRADIENT_BORDER_CSS } from "@/lib/effects/borders/GradientBorder";
import { ScoreEffectText, SCORE_EFFECT_CSS } from "@/lib/effects/text/ScoreEffectText";
import { useTilt } from "@/lib/effects/interactions/use-tilt";
import { HolographicOverlay, HOLOGRAPHIC_CSS } from "@/lib/effects/interactions/HolographicOverlay";
import { useAnimatedCounter } from "@/lib/effects/counters/use-animated-counter";
import { useInView } from "@/lib/effects/counters/use-in-view";
import { tierPillClasses, SparkleDots, TIER_VISUALS_CSS } from "@/lib/effects/tier/TierVisuals";
import { fireSingleBurst } from "@/lib/effects/celebrations/confetti";
import { HeatmapGrid, HEATMAP_GRID_CSS } from "@/lib/effects/heatmap/HeatmapGrid";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BadgePreviewCardProps {
  config: BadgeConfig;
  stats: Stats90d;
  impact: ImpactV3Result;
  interactive?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TIER_SYMBOLS: Record<ImpactTier, string> = {
  Emerging: "○",
  Solid: "◉",
  High: "◆",
  Elite: "★",
};

function hasEnhancedTier(tier: ImpactTier): boolean {
  return tier === "High" || tier === "Elite";
}

// ---------------------------------------------------------------------------
// Animated stat sub-component (hook is always called — static just skips anim)
// ---------------------------------------------------------------------------

function AnimatedStat({
  value,
  label,
  statsDisplay,
}: {
  value: number;
  label: string;
  statsDisplay: BadgeConfig["statsDisplay"];
}) {
  const isAnimated = statsDisplay !== "static";
  const easing = statsDisplay === "animated-spring" ? "spring" : "easeOut";
  const { value: counter } = useAnimatedCounter(
    value,
    2000,
    easing,
    isAnimated, // startOnMount — animates from 0 when true
  );

  return (
    <span className="text-text-secondary text-sm">
      <span className="text-text-primary font-semibold tabular-nums">
        {isAnimated ? counter : value}
      </span>{" "}
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Particles sub-component (isolates hook to conditional mount)
// ---------------------------------------------------------------------------

function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useParticles(canvasRef, PARTICLE_PRESETS.sparkle);
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function BadgePreviewCard({
  config,
  stats,
  impact,
  interactive = true,
}: BadgePreviewCardProps) {
  // --- Tilt interaction ---
  const { ref: tiltRef, tilt, handleMouseMove, handleMouseLeave } = useTilt(15);
  const useTiltInteraction = interactive && config.interaction === "tilt-3d";

  // --- Stats in-view trigger (for animated counters) ---
  const statsRef = useRef<HTMLDivElement>(null);
  const statsInView = useInView(statsRef);
  // statsInView isn't directly used in render since AnimatedStat uses startOnMount,
  // but the ref must be attached to trigger potential scroll-based triggers later.
  void statsInView;

  // --- Confetti celebration on mount ---
  useEffect(() => {
    if (config.celebration === "confetti" && interactive) {
      const timer = setTimeout(() => fireSingleBurst(50, "amber"), 800);
      return () => clearTimeout(timer);
    }
  }, [config.celebration, interactive]);

  // --- Collect CSS for active effects ---
  const css = [HEATMAP_GRID_CSS];
  if (config.scoreEffect !== "standard") css.push(SCORE_EFFECT_CSS);
  if (config.border === "gradient-rotating") css.push(GRADIENT_BORDER_CSS);
  if (config.interaction === "holographic") css.push(HOLOGRAPHIC_CSS);
  if (config.tierTreatment === "enhanced") css.push(TIER_VISUALS_CSS);

  // --- Glass / flat card styles ---
  const isGlass = config.cardStyle !== "flat";
  const glass = isGlass
    ? glassStyle(config.cardStyle as GlassVariant)
    : null;

  const cardInlineStyle: React.CSSProperties = glass
    ? {
        ...glass,
        // When gradient border wraps the card, strip card's own border
        ...(config.border === "gradient-rotating" ? { border: "none" } : {}),
        ...(config.border === "none" ? { border: "none" } : {}),
      }
    : {};

  // --- Tilt transform ---
  const tiltStyle: React.CSSProperties | undefined =
    useTiltInteraction
      ? {
          transform: `perspective(600px) rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg)`,
          transition: "transform 0.15s ease-out",
        }
      : undefined;

  // ------------------------------------------------------------------
  // Card content (shared between all border/interaction wrappers)
  // ------------------------------------------------------------------

  const cardContent = (
    <div
      ref={useTiltInteraction ? tiltRef : undefined}
      onMouseMove={useTiltInteraction ? handleMouseMove : undefined}
      onMouseLeave={useTiltInteraction ? handleMouseLeave : undefined}
      className={`relative overflow-hidden rounded-2xl p-6 ${
        !isGlass ? "bg-card" : ""
      } ${
        config.border === "solid-amber" && !isGlass
          ? "border border-warm-stroke"
          : ""
      }`}
      style={{ ...cardInlineStyle, ...tiltStyle }}
      data-card-style={config.cardStyle}
      data-testid="badge-card"
    >
      {/* --- Header --- */}
      <div className="flex items-center gap-3 mb-5">
        {stats.avatarUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element -- dynamic external avatar URL */
          <img
            src={stats.avatarUrl}
            alt=""
            className="w-8 h-8 rounded-full ring-2 ring-amber/30"
            width={32}
            height={32}
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-amber/20 ring-2 ring-amber/30" />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-text-primary font-heading font-bold text-sm truncate">
            {stats.handle}
          </div>
          <div className="text-text-secondary text-xs">Last 90 days</div>
        </div>
      </div>

      {/* --- Body: two columns --- */}
      <div className="flex gap-6">
        {/* Left: Heatmap */}
        <div className="flex-1 min-w-0">
          <div className="text-text-secondary text-xs uppercase tracking-wider mb-2">
            Contributions
          </div>
          <HeatmapGrid
            data={stats.heatmapData}
            animation={config.heatmapAnimation}
          />
        </div>

        {/* Right: Score + Tier */}
        <div className="flex flex-col items-center justify-center gap-2 w-[140px] flex-shrink-0">
          <div className="text-text-secondary text-xs uppercase tracking-wider">
            Impact Score
          </div>
          <div data-score-effect={config.scoreEffect}>
            <ScoreEffectText
              effect={config.scoreEffect as ScoreEffect}
              className="text-5xl font-heading font-extrabold"
            >
              {impact.adjustedScore}
            </ScoreEffectText>
          </div>
          <div
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold border ${tierPillClasses(impact.tier)}`}
          >
            <span>{TIER_SYMBOLS[impact.tier]}</span>
            <span>{impact.tier}</span>
          </div>
          <div className="text-text-secondary text-xs">
            {impact.confidence}% Confidence
          </div>
        </div>
      </div>

      {/* --- Stats row --- */}
      <div
        ref={statsRef}
        className="flex items-center justify-center gap-4 mt-5 pt-4 border-t border-warm-stroke"
      >
        <AnimatedStat
          value={stats.commitsTotal}
          label="commits"
          statsDisplay={config.statsDisplay}
        />
        <span className="text-warm-stroke">·</span>
        <AnimatedStat
          value={stats.prsMergedCount}
          label="PRs"
          statsDisplay={config.statsDisplay}
        />
        <span className="text-warm-stroke">·</span>
        <AnimatedStat
          value={stats.reviewsSubmittedCount}
          label="reviews"
          statsDisplay={config.statsDisplay}
        />
      </div>

      {/* --- Tier sparkles (enhanced tier only) --- */}
      {config.tierTreatment === "enhanced" && hasEnhancedTier(impact.tier) && (
        <SparkleDots />
      )}
    </div>
  );

  // ------------------------------------------------------------------
  // Wrap with interaction layer
  // ------------------------------------------------------------------

  const withInteraction =
    config.interaction === "holographic" && interactive ? (
      <HolographicOverlay variant="amber" autoAnimate>
        {cardContent}
      </HolographicOverlay>
    ) : (
      cardContent
    );

  // ------------------------------------------------------------------
  // Wrap with border layer
  // ------------------------------------------------------------------

  const withBorder =
    config.border === "gradient-rotating" ? (
      <div data-effect="gradient-border">
        <GradientBorder>{withInteraction}</GradientBorder>
      </div>
    ) : (
      withInteraction
    );

  // ------------------------------------------------------------------
  // Final render
  // ------------------------------------------------------------------

  return (
    <div className="relative" data-testid="badge-preview">
      {/* Inject CSS */}
      <style>{css.join("\n")}</style>

      {/* Layer 1: Background */}
      {config.background === "aurora" && (
        <div
          data-effect="aurora"
          className="absolute inset-0 rounded-2xl overflow-hidden"
        >
          <AuroraBackground positioning="absolute" />
        </div>
      )}
      {config.background === "particles" && (
        <div
          data-effect="particles"
          className="absolute inset-0 rounded-2xl overflow-hidden"
        >
          <ParticleCanvas />
        </div>
      )}

      {/* Layers 2-6: Border + Card + Interaction + Content + Celebration */}
      {withBorder}
    </div>
  );
}
