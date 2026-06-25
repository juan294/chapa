"use client";

import { useEffect, useMemo } from "react";
import type { DimensionScores, StatsData, ProfileType } from "@chapa/shared";
import { useTranslation } from "@/lib/i18n";
import { interpolate } from "@/lib/i18n/interpolate";
import { getDimensionSubMetrics } from "@/lib/dashboard/dimension-sub-metrics";

export interface SubMetricPanelProps {
  dimension: keyof DimensionScores;
  stats: StatsData;
  isOpen: boolean;
  onClose: () => void;
  profileType?: ProfileType;
}

const DIMENSION_COLORS: Record<keyof DimensionScores, string> = {
  delivery: "var(--color-dimension-delivery)",
  quality: "var(--color-dimension-quality)",
  consistency: "var(--color-dimension-consistency)",
  breadth: "var(--color-dimension-breadth)",
  craft: "var(--color-dimension-craft)",
};

export function SubMetricPanel({
  dimension,
  stats,
  isOpen,
  onClose,
  profileType = "collaborative",
}: SubMetricPanelProps) {
  const { t } = useTranslation();
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const subMetrics = useMemo(
    () => getDimensionSubMetrics(dimension, stats, profileType),
    [dimension, stats, profileType],
  );

  if (!isOpen) return null;

  const color = DIMENSION_COLORS[dimension];
  const label = t(`dimensions.${dimension}.label`) as string;

  return (
    <div
      role="region"
      aria-label={`${label} dimension breakdown`}
      className="animate-scale-in relative rounded-xl border border-stroke bg-card p-5"
    >
      <div className="mb-4 flex items-center justify-between">
        <h3
          className="font-heading text-sm uppercase tracking-wider text-text-secondary"
          style={{ color }}
        >
          {label} {t('dashboard.breakdown') as string}
        </h3>
        <button
          type="button"
          aria-label={t('aria.closeBreakdown') as string}
          onClick={onClose}
          className="rounded-full p-1 text-text-secondary transition-colors hover:text-text-primary"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M4 4l8 8M12 4l-8 8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <div className="space-y-4">
        {subMetrics.map((metric) => {
          const percent = Math.round(metric.normalizedValue * 100);
          const metricLabel = t(`scoreExplanation.subMetrics.${metric.key}`) as string;
          return (
            <div key={metric.key}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-medium text-text-primary">
                  {metricLabel}
                </span>
                <span className="text-xs font-medium text-text-secondary">
                  {metric.weight}
                </span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={metricLabel}
                className="h-2 w-full rounded-full bg-stroke"
              >
                <div
                  className="h-2 rounded-full transition-all duration-500"
                  style={{
                    width: `${percent}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
              <p className="mt-1 text-xs text-text-secondary">
                {interpolate(
                  t(`scoreExplanation.rawLabels.${metric.rawLabelKey}`) as string,
                  metric.rawLabelParams,
                )}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
