"use client";

import { useRef } from "react";
import Image from "next/image";
import type {
  BadgeConfig,
  StatsData,
  ImpactV4Result,
  ImpactTier,
} from "@chapa/shared";
import type { ScoreEffect } from "@/lib/effects/text/ScoreEffectText";
import { ScoreEffectText, SCORE_EFFECT_CSS } from "@/lib/effects/text/ScoreEffectText";
import { useAnimatedCounter } from "@/lib/effects/counters/use-animated-counter";
import { useInView } from "@/lib/effects/counters/use-in-view";
import { tierPillClasses, SparkleDots, TIER_VISUALS_CSS } from "@/lib/effects/tier/TierVisuals";
import { HeatmapGrid, HEATMAP_GRID_CSS } from "@/lib/effects/heatmap/HeatmapGrid";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BadgeContentProps {
  stats: StatsData;
  impact: ImpactV4Result;
  scoreEffect?: BadgeConfig["scoreEffect"];
  heatmapAnimation?: BadgeConfig["heatmapAnimation"];
  statsDisplay?: BadgeConfig["statsDisplay"];
  tierTreatment?: BadgeConfig["tierTreatment"];
  className?: string;
  style?: React.CSSProperties;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TIER_SYMBOLS: Record<ImpactTier, string> = {
  Emerging: "\u25CB",
  Solid: "\u25C9",
  High: "\u25C6",
  Elite: "\u2605",
};

function hasEnhancedTier(tier: ImpactTier): boolean {
  return tier === "High" || tier === "Elite";
}

/**
 * Returns an array of CSS strings needed for the active config options.
 * Inject these into a `<style>` tag in the page.
 */
export function getBadgeContentCSS(opts: {
  scoreEffect?: BadgeConfig["scoreEffect"];
  tierTreatment?: BadgeConfig["tierTreatment"];
}): string[] {
  const css = [HEATMAP_GRID_CSS];
  if (opts.scoreEffect && opts.scoreEffect !== "standard") css.push(SCORE_EFFECT_CSS);
  if (opts.tierTreatment === "enhanced") css.push(TIER_VISUALS_CSS);
  return css;
}

// ---------------------------------------------------------------------------
// Animated stat card sub-component
// ---------------------------------------------------------------------------

function AnimatedStatCard({
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
    isAnimated,
  );

  return (
    <div className="rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-3 text-center">
      <span className="block text-2xl font-heading font-bold tracking-tight text-text-primary leading-none">
        {isAnimated ? counter : value}
      </span>
      <span className="block text-[10px] uppercase tracking-wider text-text-secondary mt-1.5">
        {label}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BadgeContent — inner card content (no wrapper, no background/border/interaction)
// ---------------------------------------------------------------------------

export function BadgeContent({
  stats,
  impact,
  scoreEffect = "standard",
  heatmapAnimation = "fade-in",
  statsDisplay = "static",
  tierTreatment = "standard",
  className = "",
  style,
}: BadgeContentProps) {
  const statsRef = useRef<HTMLDivElement>(null);
  const statsInView = useInView(statsRef);
  void statsInView;

  return (
    <div className={className} style={style} data-testid="badge-content">
      {/* --- Header --- */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          {stats.avatarUrl ? (
            <Image
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
                {stats.displayName ?? `@${stats.handle}`}
              </div>
              <svg className="w-3.5 h-3.5 text-amber opacity-40 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5L12 1zm-1.5 14.5l-4-4 1.41-1.41L10.5 12.67l5.59-5.59L17.5 8.5l-7 7z" />
              </svg>
            </div>
            <div className="text-text-secondary text-xs">Last 12 months</div>
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
          <div className="text-[10px] tracking-widest uppercase text-text-primary/50 mb-2">
            Activity
          </div>
          <HeatmapGrid
            data={stats.heatmapData}
            animation={heatmapAnimation}
          />
        </div>

        {/* Right: Developer Profile */}
        <div ref={statsRef} className="w-[40%] sm:w-[320px] flex-shrink-0 flex flex-col">
          <div className="text-[10px] tracking-widest uppercase text-text-primary/50 mb-1">
            Developer Profile
          </div>

          {/* Radar chart */}
          <div className="flex justify-center my-3">
            <div className="relative w-[140px] h-[140px]">
              <svg viewBox="0 0 140 140" className="absolute inset-0 w-full h-full" aria-hidden="true">
                {/* Guide rings */}
                {[0.25, 0.5, 0.75, 1].map((scale) => (
                  <polygon
                    key={scale}
                    points={`70,${70 - 55 * scale} ${70 + 55 * scale},70 70,${70 + 55 * scale} ${70 - 55 * scale},70`}
                    fill="none"
                    stroke="rgba(124,106,239,0.12)"
                    strokeWidth="1"
                  />
                ))}
                {/* Axes */}
                <line x1="70" y1="15" x2="70" y2="125" stroke="rgba(124,106,239,0.08)" strokeWidth="1" />
                <line x1="15" y1="70" x2="125" y2="70" stroke="rgba(124,106,239,0.08)" strokeWidth="1" />
                {/* Data polygon */}
                <polygon
                  points={`70,${70 - (impact.dimensions.building / 100) * 55} ${70 + (impact.dimensions.guarding / 100) * 55},70 70,${70 + (impact.dimensions.consistency / 100) * 55} ${70 - (impact.dimensions.breadth / 100) * 55},70`}
                  fill="rgba(124,106,239,0.20)"
                  stroke="#7C6AEF"
                  strokeWidth="1.5"
                />
                {/* Vertex dots */}
                <circle cx="70" cy={70 - (impact.dimensions.building / 100) * 55} r="3" fill="#7C6AEF" />
                <circle cx={70 + (impact.dimensions.guarding / 100) * 55} cy="70" r="3" fill="#7C6AEF" />
                <circle cx="70" cy={70 + (impact.dimensions.consistency / 100) * 55} r="3" fill="#7C6AEF" />
                <circle cx={70 - (impact.dimensions.breadth / 100) * 55} cy="70" r="3" fill="#7C6AEF" />
              </svg>
              {/* Axis labels */}
              <span className="absolute -top-1 left-1/2 -translate-x-1/2 text-[9px] text-text-secondary">Build</span>
              <span className="absolute top-1/2 -right-2 -translate-y-1/2 text-[9px] text-text-secondary">Guard</span>
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[9px] text-text-secondary">Consist</span>
              <span className="absolute top-1/2 -left-3 -translate-y-1/2 text-[9px] text-text-secondary">Breadth</span>
            </div>
          </div>

          {/* Archetype pill */}
          <div className="flex justify-center mb-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber/10 border border-amber/25 px-3 py-1">
              <span className="text-xs font-semibold text-amber">
                {TIER_SYMBOLS[impact.tier]} {impact.archetype}
              </span>
            </div>
          </div>

          {/* Composite score + tier + confidence */}
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-baseline gap-2">
              <div data-score-effect={scoreEffect}>
                <ScoreEffectText
                  effect={scoreEffect as ScoreEffect}
                  className="text-3xl font-heading font-bold tracking-tighter leading-none"
                >
                  {impact.adjustedComposite}
                </ScoreEffectText>
              </div>
              <div
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border w-fit ${tierPillClasses(impact.tier)}`}
              >
                <span>{impact.tier}</span>
              </div>
            </div>
            <div className="text-xs text-text-secondary">
              {impact.confidence}% Confidence
            </div>
          </div>
        </div>
      </div>

      {/* --- Dimension cards (4 across) --- */}
      <div className="mt-5 grid grid-cols-4 gap-3">
        <AnimatedStatCard
          value={impact.dimensions.building}
          label="Building"
          statsDisplay={statsDisplay}
        />
        <AnimatedStatCard
          value={impact.dimensions.guarding}
          label="Guarding"
          statsDisplay={statsDisplay}
        />
        <AnimatedStatCard
          value={impact.dimensions.consistency}
          label="Consistency"
          statsDisplay={statsDisplay}
        />
        <AnimatedStatCard
          value={impact.dimensions.breadth}
          label="Breadth"
          statsDisplay={statsDisplay}
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
      {tierTreatment === "enhanced" && hasEnhancedTier(impact.tier) && (
        <SparkleDots />
      )}
    </div>
  );
}
