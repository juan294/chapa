"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { DimensionScores, StatsData, ProfileType } from "@chapa/shared";
import type { DimensionTrend } from "@/lib/history/trend";
import { useAnimatedCounter } from "@/lib/effects/counters/use-animated-counter";
import { useInView } from "@/lib/effects/counters/use-in-view";
import { Sparkline } from "./Sparkline";
import { DeltaIndicator } from "./DeltaIndicator";
import { SubMetricPanel } from "./SubMetricPanel";
import { InfoTooltip } from "@/components/InfoTooltip";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DIMENSION_LABELS: Record<keyof DimensionScores, string> = {
  delivery: "Delivery",
  quality: "Quality",
  consistency: "Consistency",
  breadth: "Breadth",
  craft: "Craft",
};

const DIMENSION_SUBTITLES: Record<keyof DimensionScores, string> = {
  delivery: "PRs merged \u00B7 issues closed \u00B7 commits",
  quality: "Code reviews \u00B7 quality gatekeeping",
  consistency: "Active days \u00B7 sustained contributions",
  breadth: "Repos contributed \u00B7 community reach",
  craft: "AI tool proficiency \u00B7 effectiveness \u00B7 sophistication",
};

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

const DIMENSION_TOOLTIPS: Record<
  keyof DimensionScores,
  { id: string; tip: string }
> = {
  delivery: {
    id: "dim-delivery",
    tip: "Measures shipping output: PRs merged, issues closed, and commits. High score = consistently turning ideas into merged code.",
  },
  quality: {
    id: "dim-quality",
    tip: "Measures code stewardship: reviews submitted, review-to-PR ratio, and commit cleanliness. High score = strong gatekeeper and quality advocate.",
  },
  consistency: {
    id: "dim-consistency",
    tip: "Measures sustained engagement: active days, even weekly distribution, and low burst patterns. High score = reliable daily contributor.",
  },
  breadth: {
    id: "dim-breadth",
    tip: "Measures breadth of impact: repos contributed to, contribution spread, stars, forks, and docs PRs. High score = wide cross-project influence.",
  },
  craft: {
    id: "dim-craft",
    tip: "Measures AI tool mastery: proficiency with coding assistants, effectiveness of tool-assisted workflows, and sophistication of usage patterns.",
  },
};

// Solo quality overrides — shared with ImpactBreakdown.tsx (keep in sync)
const SOLO_QUALITY_SUBTITLE = "PR descriptions \u00B7 branch discipline \u00B7 issue linkage";
const SOLO_QUALITY_TOOLTIP = {
  id: "dim-quality",
  tip: "Measures engineering discipline: PR descriptions, feature branch usage, issue linkage, and commit cleanliness.",
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
}: DimensionCardProps) {
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

  const label = DIMENSION_LABELS[dimension];
  const isSoloQuality = dimension === "quality" && profileType === "solo";
  const subtitle = isSoloQuality
    ? SOLO_QUALITY_SUBTITLE
    : DIMENSION_SUBTITLES[dimension];
  const colors = DIMENSION_COLORS[dimension];
  const tooltip = isSoloQuality
    ? SOLO_QUALITY_TOOLTIP
    : DIMENSION_TOOLTIPS[dimension];

  const hasTrendRow =
    (trend != null && trend.values.length > 0) || delta != null;

  return (
    <div
      ref={containerRef}
      role="article"
      aria-label={`${label} dimension score: ${score}`}
      className={`rounded-xl border border-stroke bg-card transition-colors duration-200 hover:border-amber/20 animate-fade-in-up ${className}`}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between p-4 pb-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wider text-text-secondary font-body">
            {label}
          </span>
          <InfoTooltip id={tooltip.id} content={tooltip.tip} />
        </div>
        <span className="font-heading text-3xl font-extrabold text-text-primary">
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
              <DeltaIndicator delta={delta} label="vs last week" />
            )}
          </div>
        </div>
      )}

      {/* Footer row — expand/collapse toggle */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-controls={panelId}
        onClick={toggle}
        onKeyDown={handleKeyDown}
        className="flex cursor-pointer items-center justify-between p-4 pt-3"
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
      </div>

      {/* Expanded panel */}
      <div id={panelId} className={isExpanded ? "border-t border-stroke" : ""}>
        <SubMetricPanel
          dimension={dimension}
          stats={stats}
          isOpen={isExpanded}
          onClose={toggle}
          profileType={profileType}
        />
      </div>
    </div>
  );
}
