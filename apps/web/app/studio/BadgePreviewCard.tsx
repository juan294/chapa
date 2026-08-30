"use client";

import { memo } from "react";
import dynamic from "next/dynamic";
import type {
  BadgeConfig,
  StatsData,
  ImpactV6Result,
  Platform,
} from "@chapa/shared";
import type { GlassVariant } from "@/lib/effects/cards/glass-presets";
import { glassStyle } from "@/lib/effects/cards/glass-presets";
import { GRADIENT_BORDER_CSS } from "@/lib/effects/borders/gradient-border-css";
import { BadgeContent, getBadgeContentCSS } from "@/components/badge/BadgeContent";
import {
  PreviewFooter,
  type PreviewVerification,
} from "./PreviewFooter";

// ---------------------------------------------------------------------------
// Lazy-loaded effect components (code-split, client-only)
// ---------------------------------------------------------------------------

const LazyAuroraBackground = dynamic(
  () => import("@/lib/effects/backgrounds/AuroraBackground").then((m) => m.AuroraBackground),
  { ssr: false, loading: () => <div className="absolute inset-0" aria-hidden="true" /> }
);

const LazyParticleCanvas = dynamic(
  () => import("@/lib/effects/backgrounds/ParticleCanvas"),
  { ssr: false, loading: () => <div className="absolute inset-0" aria-hidden="true" /> }
);

const LazyGradientBorder = dynamic(
  () => import("@/lib/effects/borders/GradientBorder").then((m) => m.GradientBorder),
  { ssr: false, loading: () => <div data-effect="gradient-border-loading" /> }
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BadgePreviewCardProps {
  config: BadgeConfig;
  stats: StatsData;
  impact: ImpactV6Result;
  verification?: PreviewVerification | null;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

function BadgePreviewCardInner({
  config,
  stats,
  impact,
  verification = null,
}: BadgePreviewCardProps) {
  const linkedPlatforms: Platform[] = [
    "github",
    ...(stats.linkedPlatforms?.filter(
      (platform): platform is Platform => platform !== "github",
    ) ?? []),
  ];

  // --- Collect CSS for active effects ---
  const css = getBadgeContentCSS({
    scoreEffect: config.scoreEffect,
    tierTreatment: config.tierTreatment,
  });
  if (config.border === "gradient-rotating") css.push(GRADIENT_BORDER_CSS);

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

  // ------------------------------------------------------------------
  // Card content (shared between all border wrappers)
  // ------------------------------------------------------------------

  const cardContent = (
    <div
      className={`relative overflow-hidden rounded-2xl p-6 ${
        !isGlass ? "bg-card" : ""
      } ${
        config.border === "solid-amber" && !isGlass
          ? "border border-stroke"
          : ""
      }`}
      style={cardInlineStyle}
      data-card-style={config.cardStyle}
      data-testid="badge-card"
    >
      <BadgeContent
        stats={stats}
        impact={impact}
        scoreEffect={config.scoreEffect}
        heatmapAnimation={config.heatmapAnimation}
        tierTreatment={config.tierTreatment}
        showFooter={false}
      />
      <PreviewFooter
        linkedPlatforms={linkedPlatforms}
        verification={verification}
      />
    </div>
  );

  // ------------------------------------------------------------------
  // Wrap with border layer
  // ------------------------------------------------------------------

  const withBorder =
    config.border === "gradient-rotating" ? (
      <div data-effect="gradient-border">
        <LazyGradientBorder>{cardContent}</LazyGradientBorder>
      </div>
    ) : (
      cardContent
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
          <LazyAuroraBackground positioning="absolute" />
        </div>
      )}
      {config.background === "particles" && (
        <div
          data-effect="particles"
          className="absolute inset-0 rounded-2xl overflow-hidden"
        >
          <LazyParticleCanvas />
        </div>
      )}

      {/* Layers 2-4: Border + Card + Content */}
      {withBorder}
    </div>
  );
}

export const BadgePreviewCard = memo(BadgePreviewCardInner);
