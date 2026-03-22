"use client";

import { useRef, useEffect } from "react";
import type { ImpactV4Result } from "@chapa/shared";
import { useAnimatedCounter } from "@/lib/effects/counters/use-animated-counter";
import { useInView } from "@/lib/effects/counters/use-in-view";
import {
  tierPillClasses,
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

export function ScoreBoldNumber({ impact, className = "" }: HeroScoreProps) {
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
  const profileText = getArchetypeProfile(impact);

  const scoreNumber = (
    <span className="font-heading text-7xl sm:text-8xl font-extrabold">
      {value}
    </span>
  );

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: TIER_VISUALS_CSS + SCORE_EFFECT_CSS }} />
      <div
        ref={containerRef}
        className={`animate-fade-in-up ${className}`}
      >
        <div className="flex items-baseline gap-4">
          {isElite ? (
            <ScoreEffectText
              effect="gold-shimmer"
              className="font-heading text-7xl sm:text-8xl font-extrabold"
            >
              {value}
            </ScoreEffectText>
          ) : (
            scoreNumber
          )}

          <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-heading font-semibold uppercase tracking-wider ${tierPillClasses(impact.tier)}`}
          >
            {impact.tier}
          </span>
        </div>

        <p className="font-heading text-xl text-amber tracking-tight mt-2">
          {impact.archetype}
        </p>

        <div data-testid="divider" className="border-t border-stroke my-4" />

        <p
          data-testid="profile-text"
          className="text-sm text-text-secondary leading-relaxed"
        >
          {profileText}
        </p>
      </div>
    </>
  );
}
