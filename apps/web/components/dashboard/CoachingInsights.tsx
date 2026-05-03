"use client";

import { useMemo } from "react";
import type { ImpactV6Result } from "@chapa/shared";
import type { TrendSummary } from "@/lib/history/trend";
import type { SnapshotDiff } from "@/lib/history/diff";
import { generateInsights } from "@/lib/dashboard/generate-insights";
import { InsightCard } from "./InsightCard";
import { useTranslation } from "@/lib/i18n";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CoachingInsightsProps {
  impact: ImpactV6Result;
  trend: TrendSummary | null;
  diff: SnapshotDiff | null;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CoachingInsights({
  impact,
  trend,
  diff,
  className,
}: CoachingInsightsProps) {
  const { t } = useTranslation();
  const insights = useMemo(
    () => generateInsights(impact, trend, diff, t),
    [impact, trend, diff, t],
  );

  if (insights.length === 0) {
    return null;
  }

  // Group insights by type for distinct visual layout
  const achievements = insights.filter((i) => i.type === "achievement");
  const trends = insights.filter((i) => i.type === "trend");
  const nextTier = insights.filter((i) => i.type === "next-tier");
  const coaching = insights.filter((i) => i.type === "tip");

  let delayCounter = 0;
  const nextDelay = () => 1600 + delayCounter++ * 150;

  return (
    <div className={className}>
      <h3 className="font-heading text-xs uppercase tracking-wider text-text-secondary mb-5 flex items-center gap-2">
        <span
          className="inline-block w-1.5 h-1.5 rounded-sm bg-amber"
          aria-hidden="true"
        />
        {t('dashboard.insightsCoaching') as string}
      </h3>

      <div className="space-y-3">
        {/* Achievements — full-width, prominent */}
        {achievements.map((insight) => (
          <InsightCard
            key={insight.id}
            insight={insight}
            animationDelay={nextDelay()}
          />
        ))}

        {/* Trends — 2-column grid for compact metrics */}
        {trends.length > 0 && (
          <div
            className={`grid gap-3 ${
              trends.length >= 2
                ? "grid-cols-1 sm:grid-cols-2"
                : "grid-cols-1"
            }`}
          >
            {trends.map((insight) => (
              <InsightCard
                key={insight.id}
                insight={insight}
                animationDelay={nextDelay()}
              />
            ))}
          </div>
        )}

        {/* Next-tier — full-width with progress bar */}
        {nextTier.map((insight) => (
          <InsightCard
            key={insight.id}
            insight={insight}
            animationDelay={nextDelay()}
          />
        ))}

        {/* Coaching tips — compact treatment */}
        {coaching.length > 0 && (
          <div className="space-y-2">
            {coaching.map((insight) => (
              <InsightCard
                key={insight.id}
                insight={insight}
                animationDelay={nextDelay()}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
