"use client";

import { useState } from "react";
import type { ImpactV4Result, StatsData, DimensionScores } from "@chapa/shared";
import { useTrendData } from "@/lib/hooks/use-trend-data";
import { HeroScoreZone } from "./HeroScoreZone";
import { DimensionCardsRow } from "./DimensionCardsRow";
import { RadarChartInteractive } from "./RadarChartInteractive";
import { CoachingInsights } from "./CoachingInsights";
import { ActivityHeatmap } from "./ActivityHeatmap";
import { StatsGrid } from "./StatsGrid";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ImpactDashboardProps {
  impact: ImpactV4Result;
  stats: StatsData;
  handle: string;
  heroVariant?: "ring" | "bold" | "rings";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImpactDashboard({
  impact,
  stats,
  handle,
  heroVariant = "ring",
}: ImpactDashboardProps) {
  const { trend, diff } = useTrendData(handle);

  const [activeDimension, setActiveDimension] = useState<
    keyof DimensionScores | null
  >(null);

  return (
    <div className="space-y-12">
      <HeroScoreZone variant={heroVariant} impact={impact} />

      <DimensionCardsRow
        impact={impact}
        stats={stats}
        trend={trend}
        diff={diff}
        activeDimension={activeDimension}
      />

      <RadarChartInteractive
        dimensions={impact.dimensions}
        activeDimension={activeDimension}
        onDimensionHover={setActiveDimension}
      />

      <CoachingInsights impact={impact} trend={trend} diff={diff} />

      <ActivityHeatmap
        heatmapData={stats.heatmapData}
        activeDays={stats.activeDays}
      />

      <StatsGrid stats={stats} diff={diff} />
    </div>
  );
}
