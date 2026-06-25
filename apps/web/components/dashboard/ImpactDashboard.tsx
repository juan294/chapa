"use client";

import type { CraftResult, ImpactV6Result, StatsData } from "@chapa/shared";
import { useTrendData } from "@/hooks/useTrendData";
import { getArchetypeProfile } from "@/components/ImpactBreakdown";
import { DimensionCardsRow } from "./DimensionCardsRow";
import { CoachingInsights } from "./CoachingInsights";
import { ActivityHeatmap } from "./ActivityHeatmap";
import { StatsGrid } from "./StatsGrid";
import { useTranslation } from "@/lib/i18n";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ImpactDashboardProps {
  impact: ImpactV6Result;
  stats: StatsData;
  handle: string;
  craftResult?: CraftResult | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImpactDashboard({
  impact,
  stats,
  handle,
  craftResult = null,
}: ImpactDashboardProps) {
  const { trend, diff } = useTrendData(handle);
  const { t } = useTranslation();

  const profileText = getArchetypeProfile(impact, t);

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
        craftResult={craftResult}
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
