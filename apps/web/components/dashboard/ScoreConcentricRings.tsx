"use client";

import { useRef, useEffect } from "react";
import type { ImpactV4Result, DimensionScores } from "@chapa/shared";
import { ScoreRing } from "@/components/dashboard/ScoreRing";
import { useAnimatedCounter } from "@/lib/effects/counters/use-animated-counter";
import { useInView } from "@/lib/effects/counters/use-in-view";
import { tierPillClasses, TIER_VISUALS_CSS } from "@/lib/effects/tier/TierVisuals";
import { ScoreEffectText, SCORE_EFFECT_CSS } from "@/lib/effects/text/ScoreEffectText";

const DIMENSION_RING_COLORS: Record<keyof DimensionScores, string> = {
  delivery: "var(--color-dimension-delivery)",
  quality: "var(--color-dimension-quality)",
  consistency: "var(--color-dimension-consistency)",
  breadth: "var(--color-dimension-breadth)",
};

const DIMENSION_LABELS: Record<keyof DimensionScores, string> = {
  delivery: "Delivery",
  quality: "Quality",
  consistency: "Consistency",
  breadth: "Breadth",
};

/** Ring sizes: outermost to innermost, 36px step for ~10px visual gap */
const RING_SIZES = [200, 164, 128, 92] as const;
const RING_STROKE = 8;

/** Dimension order from outermost to innermost ring */
const DIMENSION_ORDER: (keyof DimensionScores)[] = [
  "delivery",
  "quality",
  "consistency",
  "breadth",
];

interface ScoreConcentricRingsProps {
  impact: ImpactV4Result;
  className?: string;
}

export function ScoreConcentricRings({ impact, className = "" }: ScoreConcentricRingsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, 0.3);
  const counter = useAnimatedCounter(impact.adjustedComposite, 2000, "easeOut");

  const isElite = impact.tier === "Elite";

  useEffect(() => {
    if (inView) counter.animate();
  }, [inView]); // eslint-disable-line react-hooks/exhaustive-deps

  const centerContent = (
    <span className="font-heading text-3xl font-extrabold text-text-primary">
      {isElite ? (
        <ScoreEffectText effect="gold-shimmer">{counter.value}</ScoreEffectText>
      ) : (
        counter.value
      )}
    </span>
  );

  // Build nested rings from innermost to outermost
  let nested: React.ReactNode = centerContent;
  for (let i = DIMENSION_ORDER.length - 1; i >= 0; i--) {
    const dim = DIMENSION_ORDER[i]!;
    nested = (
      <ScoreRing
        value={impact.dimensions[dim]}
        size={RING_SIZES[i]!}
        strokeWidth={RING_STROKE}
        color={DIMENSION_RING_COLORS[dim]}
        animated={true}
      >
        {nested}
      </ScoreRing>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`flex flex-col items-center animate-fade-in-up ${className}`}
    >
      <style dangerouslySetInnerHTML={{ __html: TIER_VISUALS_CSS + SCORE_EFFECT_CSS }} />

      {/* Concentric rings */}
      <div className="flex items-center justify-center">
        {nested}
      </div>

      {/* Tier + Archetype */}
      <div className="mt-4 flex items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-semibold ${tierPillClasses(impact.tier)}`}
        >
          {impact.tier}
        </span>
        <span className="text-text-secondary text-sm" aria-hidden="true">
          &middot;
        </span>
        <span className="font-heading text-sm font-medium text-text-primary">
          {impact.archetype}
        </span>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1">
        {DIMENSION_ORDER.map((dim) => (
          <div key={dim} className="flex items-center gap-1.5 text-xs text-text-secondary">
            <span
              data-testid="legend-dot"
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: DIMENSION_RING_COLORS[dim] }}
              aria-hidden="true"
            />
            <span>{DIMENSION_LABELS[dim]}</span>
            <span className="font-heading font-semibold text-text-primary">
              {impact.dimensions[dim]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
