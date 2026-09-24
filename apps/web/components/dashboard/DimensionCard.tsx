"use client";

import { useState, useCallback } from "react";
import type { DimensionScores } from "@chapa/shared";
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

/**
 * #1335 phase 5 step 5.10 — the legacy branch (craftResult/profileType/stats/
 * score props, and the SubMetricPanel it rendered instead of a receipt
 * detail) is deleted. `receiptPresentation` is the only presentation this
 * component ever draws now, so it is required rather than optional.
 */
export interface DimensionCardProps {
  dimension: keyof DimensionScores;
  animationDelay?: number;
  className?: string;
  receiptPresentation: { display: string | null; subtitle: string; detail: React.ReactNode };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DimensionCard({
  dimension,
  animationDelay = 0,
  className = "",
  receiptPresentation,
}: DimensionCardProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const panelId = `dim-panel-${dimension}`;

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
  const { display, subtitle, detail } = receiptPresentation;
  const colors = DIMENSION_COLORS[dimension];
  const tooltipId = DIMENSION_TOOLTIP_IDS[dimension];
  const tooltipTip = t("observedScoring.intro") as string;
  const unavailableText = t("observedScoring.unavailable") as string;
  const numericScore = display === null ? null : Number(display);

  return (
    <div
      role="article"
      aria-label={interpolate(t('aria.dimensionScore') as string, { label, score: display ?? unavailableText })}
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
        <span className={`font-heading ${display === null ? "text-sm" : "text-3xl"} font-extrabold text-text-primary tabular-nums break-words`}>
          {display ?? unavailableText}
        </span>
      </div>

      {/* Progress bar */}
      {numericScore !== null && <div className="px-4 pt-2">
        <div
          role="progressbar"
          aria-valuenow={numericScore}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={interpolate(t('aria.dimensionLabel') as string, { label })}
          className="h-1.5 overflow-hidden rounded-full bg-stroke/30"
        >
          <div
            className="h-full rounded-full animate-bar-fill"
            style={{
              background: `linear-gradient(to right, ${colors.from}, ${colors.to})`,
              width: `${numericScore}%`,
            }}
          />
        </div>
      </div>}

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
        {isExpanded ? <div className="p-4">{detail}</div> : null}
      </div>
    </div>
  );
}
