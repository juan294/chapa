"use client";

import { useMemo } from "react";
import type { ImpactV4Result } from "@chapa/shared";
import type { TrendSummary } from "@/lib/history/trend";
import type { SnapshotDiff } from "@/lib/history/diff";
import { generateInsights } from "@/lib/dashboard/generate-insights";
import { InsightCard } from "./InsightCard";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CoachingInsightsProps {
  impact: ImpactV4Result;
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
  const insights = useMemo(
    () => generateInsights(impact, trend, diff),
    [impact, trend, diff],
  );

  if (insights.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <h3 className="font-heading text-xs uppercase tracking-wider text-text-secondary mb-4">
        Insights &amp; Coaching
      </h3>
      <div className="space-y-3">
        {insights.map((insight, i) => (
          <InsightCard
            key={insight.id}
            insight={insight}
            animationDelay={1600 + i * 150}
          />
        ))}
      </div>
    </div>
  );
}
