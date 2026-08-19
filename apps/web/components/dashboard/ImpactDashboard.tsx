"use client";

import type { ClientImpactV6Result, CraftResult, StatsData } from "@chapa/shared";
import type { TrendSummary } from "@/lib/history/trend";
import type { ClientSnapshotDiff } from "@/lib/history/diff";
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
  // #1067 — redacted PublicImpactV6Result for a non-owner visitor, full
  // ImpactV6Result for the owner. Nothing in this component or its children
  // reads confidence/confidencePenalties.
  impact: ClientImpactV6Result;
  stats: StatsData;
  craftResult?: CraftResult | null;
  /**
   * Trend/diff history data, fetched server-side (#1034) by the share page
   * and threaded down as props. Previously this component fetched its own
   * trend data client-side via `useTrendData`, creating a post-hydration
   * waterfall (static shell -> hydrate -> lazy chunk -> client fetch).
   * Both default to `null` — the same "no history yet" state the old client
   * fetch showed while loading or on a fetch error.
   */
  trend?: TrendSummary | null;
  diff?: ClientSnapshotDiff | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImpactDashboard({
  impact,
  stats,
  craftResult = null,
  trend = null,
  diff = null,
}: ImpactDashboardProps) {
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
