"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { CraftResult, DimensionScores, StatsData, ProfileType } from "@chapa/shared";
import { useAnimatedCounter } from "@/lib/effects/counters/use-animated-counter";
import { useInView } from "@/lib/effects/counters/use-in-view";
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
  animationDelay?: number;
  className?: string;
  profileType?: ProfileType;
  craftResult?: CraftResult | null;
  receiptPresentation?: { display: string | null; subtitle: string; detail: React.ReactNode };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DimensionCard({
  dimension,
  score,
  stats,
  animationDelay = 0,
  className = "",
  profileType = "collaborative",
  craftResult = null,
  receiptPresentation,
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
    if (inView && !receiptPresentation) animate();
  }, [inView, animate, receiptPresentation]);

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
  const subtitle = receiptPresentation?.subtitle ?? (isSoloQuality
    ? t('dimensions.quality.soloSubtitle') as string
    : t(`dimensions.${dimension}.subtitle`) as string);
  const colors = DIMENSION_COLORS[dimension];
  const tooltipId = DIMENSION_TOOLTIP_IDS[dimension];
  const tooltipTip = receiptPresentation ? t("observedScoring.intro") as string : isSoloQuality
    ? t('dimensions.quality.soloTip') as string
    : t(`dimensions.${dimension}.tip`) as string;

  return (
    <div
      ref={containerRef}
      role="article"
      aria-label={interpolate(t('aria.dimensionScore') as string, { label, score: receiptPresentation ? receiptPresentation.display ?? (t("observedScoring.unavailable") as string) : String(score) })}
      className={`rounded-[3px] border border-stroke bg-card transition-colors duration-200 animate-fade-in-up ${className}`}
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
        <span className={`font-heading ${receiptPresentation?.display === null ? "text-sm" : "text-3xl"} font-extrabold text-text-primary tabular-nums break-words`}>
          {receiptPresentation ? receiptPresentation.display ?? (t("observedScoring.unavailable") as string) : displayScore}
        </span>
      </div>

      {/* Progress bar */}
      {(!receiptPresentation || receiptPresentation.display !== null) && <div className="px-4 pt-2">
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

      }

      {/* Footer row — expand/collapse toggle */}
      <button
        type="button"
        aria-expanded={isExpanded}
        aria-controls={panelId}
        // WCAG 2.5.3: the visible subtitle must be part of the accessible
        // name, so a voice-control user can say what they see (LE-8-3).
        aria-label={`${interpolate(t('aria.toggleBreakdown') as string, { label })}: ${subtitle}`}
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
        {receiptPresentation ? (isExpanded ? <div className="p-4">{receiptPresentation.detail}</div> : null) : <SubMetricPanel
          dimension={dimension}
          stats={stats}
          isOpen={isExpanded}
          onClose={toggle}
          profileType={profileType}
          craftResult={craftResult}
        />}
      </div>
    </div>
  );
}
