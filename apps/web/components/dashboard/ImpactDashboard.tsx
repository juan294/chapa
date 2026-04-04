"use client";

import type { ImpactV6Result, StatsData } from "@chapa/shared";
import { useTrendData } from "@/lib/hooks/use-trend-data";
import { getArchetypeProfile } from "@/components/ImpactBreakdown";
import { DimensionCardsRow } from "./DimensionCardsRow";
import { CoachingInsights } from "./CoachingInsights";
import { ActivityHeatmap } from "./ActivityHeatmap";
import { StatsGrid } from "./StatsGrid";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ImpactDashboardProps {
  impact: ImpactV6Result;
  stats: StatsData;
  handle: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImpactDashboard({
  impact,
  stats,
  handle,
}: ImpactDashboardProps) {
  const { trend, diff } = useTrendData(handle);

  const profileText = getArchetypeProfile(impact);

  return (
    <div className="space-y-12">
      <div className="animate-fade-in-up">
        <p className="font-heading text-xl text-amber tracking-tight">
          {impact.archetype}
        </p>
        <div className="border-t border-stroke my-4" />
        <p className="text-sm text-text-secondary leading-relaxed">
          {profileText}
        </p>
      </div>

      <DimensionCardsRow
        impact={impact}
        stats={stats}
        trend={trend}
        diff={diff}
      />

      <CoachingInsights impact={impact} trend={trend} diff={diff} />

      <ActivityHeatmap
        heatmapData={stats.heatmapData}
        activeDays={stats.activeDays}
        dimensions={impact.dimensions}
      />

      <StatsGrid stats={stats} diff={diff} />
    </div>
  );
}
