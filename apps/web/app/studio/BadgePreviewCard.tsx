"use client";

import { useRef, useEffect, memo } from "react";
import type {
  BadgeConfig,
  StatsData,
  ImpactV4Result,
} from "@chapa/shared";
import type { GlassVariant } from "@/lib/effects/cards/glass-presets";
import { AuroraBackground } from "@/lib/effects/backgrounds/AuroraBackground";
import { useParticles, PARTICLE_PRESETS } from "@/lib/effects/backgrounds/ParticleBackground";
import { glassStyle } from "@/lib/effects/cards/glass-presets";
import { GradientBorder, GRADIENT_BORDER_CSS } from "@/lib/effects/borders/GradientBorder";
import { useTilt } from "@/lib/effects/interactions/use-tilt";
import { HolographicOverlay, HOLOGRAPHIC_CSS } from "@/lib/effects/interactions/HolographicOverlay";
import { fireSingleBurst } from "@/lib/effects/celebrations/confetti";
import { BadgeContent, getBadgeContentCSS } from "@/components/badge/BadgeContent";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BadgePreviewCardProps {
  config: BadgeConfig;
  stats: StatsData;
  impact: ImpactV4Result;
  interactive?: boolean;
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

function BadgePreviewCardInner({
  config,
  stats,
  impact,
  interactive = true,
}: BadgePreviewCardProps) {
  // --- Tilt interaction ---
  const { ref: tiltRef, tilt, handleMouseMove, handleMouseLeave } = useTilt(15);
  const useTiltInteraction = interactive && config.interaction === "tilt-3d";

  // --- Confetti celebration on mount ---
  useEffect(() => {
    if (config.celebration === "confetti" && interactive) {
      const timer = setTimeout(() => fireSingleBurst(50, "amber"), 800);
      return () => clearTimeout(timer);
    }
  }, [config.celebration, interactive]);

  // --- Collect CSS for active effects ---
  const css = getBadgeContentCSS({
    scoreEffect: config.scoreEffect,
    tierTreatment: config.tierTreatment,
  });
  if (config.border === "gradient-rotating") css.push(GRADIENT_BORDER_CSS);
  if (config.interaction === "holographic") css.push(HOLOGRAPHIC_CSS);

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
      <BadgeContent
        stats={stats}
        impact={impact}
        scoreEffect={config.scoreEffect}
        heatmapAnimation={config.heatmapAnimation}
        statsDisplay={config.statsDisplay}
        tierTreatment={config.tierTreatment}
      />
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

export const BadgePreviewCard = memo(BadgePreviewCardInner);
