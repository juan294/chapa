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
  return <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 w-full h-full" />;
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
          ? "border border-stroke"
          : ""
      }`}
      style={{ ...cardInlineStyle, ...tiltStyle }}
      data-card-style={config.cardStyle}
      data-testid="badge-card"
    >
      {/* --- Header --- */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
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
            <div className="flex items-center gap-1.5">
              <div className="text-text-primary font-heading font-bold text-sm truncate">
                @{stats.handle}
              </div>
              <svg className="w-3.5 h-3.5 text-amber opacity-40 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5L12 1zm-1.5 14.5l-4-4 1.41-1.41L10.5 12.67l5.59-5.59L17.5 8.5l-7 7z" />
              </svg>
            </div>
            <div className="text-text-secondary text-xs">Last 90 days</div>
          </div>
        </div>
        <span className="text-sm font-heading text-text-secondary/50 tracking-tight">
          Chapa<span className="text-amber">_</span>
        </span>
      </div>

      {/* --- Body: two columns --- */}
      <div className="flex gap-6">
        {/* Left: Heatmap */}
        <div className="flex-1 min-w-0">
          <div className="text-text-secondary text-xs uppercase tracking-wider mb-2">
            Activity
          </div>
          <HeatmapGrid
            data={stats.heatmapData}
            animation={config.heatmapAnimation}
          />
        </div>

        {/* Right: Score + Tier */}
        <div className="flex flex-col items-center justify-center gap-2 w-[35%] sm:w-[200px] flex-shrink-0">
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
        className="flex items-center justify-center gap-4 mt-5 pt-4 border-t border-stroke"
      >
        <AnimatedStat
          value={stats.commitsTotal}
          label="commits"
          statsDisplay={config.statsDisplay}
        />
        <span className="text-text-secondary/30">|</span>
        <AnimatedStat
          value={stats.prsMergedCount}
          label="PRs merged"
          statsDisplay={config.statsDisplay}
        />
        <span className="text-text-secondary/30">|</span>
        <AnimatedStat
          value={stats.reviewsSubmittedCount}
          label="reviews"
          statsDisplay={config.statsDisplay}
        />
      </div>

      {/* --- Footer: GitHub branding --- */}
      <div className="mt-4 pt-3 border-t border-stroke/50 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-text-secondary/60">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
          </svg>
          <span>Powered by GitHub</span>
        </div>
        <span className="text-xs text-text-secondary/60 font-heading">
          chapa.thecreativetoken.com
        </span>
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
