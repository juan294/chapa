"use client";

import { useRef, useEffect } from "react";
import type { ImpactV4Result } from "@chapa/shared";
import { ScoreRing } from "@/components/dashboard/ScoreRing";
import { useAnimatedCounter } from "@/lib/effects/counters/use-animated-counter";
import { useInView } from "@/lib/effects/counters/use-in-view";
import {
  tierPillClasses,
  SparkleDots,
  TIER_VISUALS_CSS,
} from "@/lib/effects/tier/TierVisuals";
import {
  ScoreEffectText,
  SCORE_EFFECT_CSS,
} from "@/lib/effects/text/ScoreEffectText";
import { getArchetypeProfile } from "@/components/ImpactBreakdown";

interface HeroScoreProps {
  impact: ImpactV4Result;
  className?: string;
}

const TIER_RING_COLORS: Record<string, string> = {
  Emerging: "var(--color-text-secondary)",
  Solid: "var(--color-text-primary)",
  High: "var(--color-amber)",
  Elite: "var(--color-amber-light)",
};

export function ScoreRingGauge({ impact, className = "" }: HeroScoreProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, 0.3);
  const { value, animate } = useAnimatedCounter(
    impact.adjustedComposite,
    1500,
    "easeOut",
    false,
  );

  useEffect(() => {
    if (inView) {
      animate();
    }
  }, [inView, animate]);

  const isElite = impact.tier === "Elite";
  const ringColor = TIER_RING_COLORS[impact.tier] ?? "var(--color-amber)";
  const profileText = getArchetypeProfile(impact);

  const scoreDisplay = (
    <span className="font-heading text-5xl font-extrabold">{value}</span>
  );

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: TIER_VISUALS_CSS + SCORE_EFFECT_CSS }} />
      <div
        ref={containerRef}
        className={`flex flex-col items-center gap-4 animate-fade-in-up ${isElite ? "relative" : ""} ${className}`}
      >
        <ScoreRing
          value={impact.adjustedComposite}
          size={200}
          strokeWidth={10}
          color={ringColor}
        >
          {isElite ? (
            <ScoreEffectText effect="gold-shimmer" className="font-heading text-5xl font-extrabold">
              {value}
            </ScoreEffectText>
          ) : (
            scoreDisplay
          )}
        </ScoreRing>

        <span
          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-heading font-semibold uppercase tracking-wider ${tierPillClasses(impact.tier)}`}
        >
          {impact.tier}
        </span>

        <span className="font-heading text-2xl text-amber tracking-tight">
          {impact.archetype}
        </span>

        <p
          data-testid="profile-text"
          className="text-sm text-text-secondary leading-relaxed max-w-md text-center"
        >
          {profileText}
        </p>

        {isElite && <SparkleDots />}
      </div>
    </>
  );
}
