"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { CraftResult, DimensionScores, StatsData, ProfileType } from "@chapa/shared";
import type { DimensionTrend } from "@/lib/history/trend";
import { useAnimatedCounter } from "@/lib/effects/counters/use-animated-counter";
import { useInView } from "@/lib/effects/counters/use-in-view";
import { Sparkline } from "./Sparkline";
import { DeltaIndicator } from "./DeltaIndicator";
import { SubMetricPanel } from "./SubMetricPanel";
import { InfoTooltip } from "@/components/InfoTooltip";
import { useTranslation } from "@/lib/i18n";
import { interpolate } from "@/lib/i18n/interpolate";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DIMENSION_COLORS: Record<
  keyof DimensionScores,
  { from: string; to: string }
> = {
  delivery: {
    from: "var(--color-dimension-delivery)",
    to: "var(--color-dimension-delivery-light)",
  },
  quality: {
    from: "var(--color-dimension-quality)",
    to: "var(--color-dimension-quality-light)",
  },
  consistency: {
    from: "var(--color-dimension-consistency)",
    to: "var(--color-dimension-consistency-light)",
  },
  breadth: {
    from: "var(--color-dimension-breadth)",
    to: "var(--color-dimension-breadth-light)",
  },
  craft: {
    from: "var(--color-dimension-craft)",
    to: "var(--color-dimension-craft-light)",
  },
};

const DIMENSION_TOOLTIP_IDS: Record<keyof DimensionScores, string> = {
  delivery: "dim-delivery",
  quality: "dim-quality",
  consistency: "dim-consistency",
  breadth: "dim-breadth",
  craft: "dim-craft",
};


// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DimensionCardProps {
  dimension: keyof DimensionScores;
  score: number;
  stats: StatsData;
  trend?: DimensionTrend | null;
  delta?: number | null;
  animationDelay?: number;
  className?: string;
  profileType?: ProfileType;
  craftResult?: CraftResult | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DimensionCard({
  dimension,
  score,
  stats,
  trend,
  delta,
  animationDelay = 0,
  className = "",
  profileType = "collaborative",
  craftResult = null,
}: DimensionCardProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelId = `dim-panel-${dimension}`;

  // Animated counter
  const inView = useInView(containerRef);
  const { value: displayScore, animate } = useAnimatedCounter(
    score,
    1500,
    "easeOut",
  );

  useEffect(() => {
    if (inView) animate();
  }, [inView, animate]);

  // Toggle expand/collapse
  const toggle = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    },
    [toggle],
  );

  const label = t(`dimensions.${dimension}.label`) as string;
  const isSoloQuality = dimension === "quality" && profileType === "solo";
  const subtitle = isSoloQuality
    ? t('dimensions.quality.soloSubtitle') as string
    : t(`dimensions.${dimension}.subtitle`) as string;
  const colors = DIMENSION_COLORS[dimension];
  const tooltipId = DIMENSION_TOOLTIP_IDS[dimension];
  const tooltipTip = isSoloQuality
    ? t('dimensions.quality.soloTip') as string
    : t(`dimensions.${dimension}.tip`) as string;

  const hasTrendRow =
    (trend != null && trend.values.length > 0) || delta != null;

  return (
    <div
      ref={containerRef}
      role="article"
      aria-label={interpolate(t('aria.dimensionScore') as string, { label, score: String(score) })}
      className={`rounded-xl bg-card shadow-card transition-shadow duration-200 hover:shadow-card-hover animate-fade-in-up ${className}`}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {/* Header */}
      <div className="p-4 pb-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wider text-text-secondary font-body">
            {label}
          </span>
          <InfoTooltip id={tooltipId} content={tooltipTip} />
        </div>
        <span className="font-heading text-3xl font-extrabold text-text-primary tabular-nums">
          {displayScore}
        </span>
      </div>

      {/* Progress bar */}
      <div className="px-4 pt-2">
        <div
          role="progressbar"
          aria-valuenow={score}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={interpolate(t('aria.dimensionLabel') as string, { label })}
          className="h-1.5 overflow-hidden rounded-full bg-stroke/30"
        >
          <div
            className="h-full rounded-full animate-bar-fill"
            style={{
              background: `linear-gradient(to right, ${colors.from}, ${colors.to})`,
              width: `${score}%`,
            }}
          />
        </div>
      </div>

      {/* Trend row — only if trend or delta data exists */}
      {hasTrendRow && (
        <div className="flex items-center justify-between px-4 pt-3">
          <div>
            {trend != null && trend.values.length > 0 && (
              <Sparkline values={trend.values} color={colors.from} />
            )}
          </div>
          <div>
            {delta != null && (
              <DeltaIndicator delta={delta} label={t('dashboard.vsLastWeek') as string} />
            )}
          </div>
        </div>
      )}

      {/* Footer row — expand/collapse toggle */}
      <button
        type="button"
        aria-expanded={isExpanded}
        aria-controls={panelId}
        aria-label={interpolate(t('aria.toggleBreakdown') as string, { label })}
        onClick={toggle}
        onKeyDown={handleKeyDown}
        className="flex w-full cursor-pointer items-center justify-between p-4 pt-3 text-left"
      >
        <span className="text-xs text-text-secondary">{subtitle}</span>
        <svg
          data-testid="chevron-icon"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
          className={`text-text-secondary transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
        >
          <path
            d="M4 6l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Expanded panel */}
      <div id={panelId} className={isExpanded ? "border-t border-stroke" : ""}>
        <SubMetricPanel
          dimension={dimension}
          stats={stats}
          isOpen={isExpanded}
          onClose={toggle}
          profileType={profileType}
          craftResult={craftResult}
        />
      </div>
    </div>
  );
}
