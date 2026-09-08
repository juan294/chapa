"use client";

import Link from "next/link";
import type { ClientImpactV6Result, CraftResult, StatsData } from "@chapa/shared";
import type { TrendSummary } from "@/lib/history/trend";
import type { ClientSnapshotDiff } from "@/lib/history/diff";
import { getArchetypeProfile } from "@/components/ImpactBreakdown";
import { DimensionCardsRow } from "./DimensionCardsRow";
import { CoachingInsights } from "./CoachingInsights";
import { ActivityHeatmap } from "./ActivityHeatmap";
import { StatsGrid } from "./StatsGrid";
import type { ScoreViewModel } from "@/lib/profile/score-view-model";
import type { ReceiptExplanation } from "@/lib/dashboard/receipt-explanation";
import { interpolate } from "@/lib/i18n/interpolate";
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
  scoring?: ScoreViewModel | null;
  isOwner?: boolean;
  receiptExplanation?: ReceiptExplanation | null;
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
  scoring, receiptExplanation, isOwner = false,
  trend = null,
  diff = null,
}: ImpactDashboardProps) {
  const { t } = useTranslation();

  if (scoring?.policyVersion === "v7.2") {
    const missing = receiptExplanation?.policyVersion === "v7.2" ? receiptExplanation.dimensions.find(row => row.key === "quality")?.steps.filter(row => row.step.observed.lower === 0) ?? [] : [];
    const report = scoring.reportCraft;
    return <div className="space-y-12">
      <div className="animate-fade-in-up">
        <p className="font-heading text-xl text-amber-text tracking-tight">{t("receiptExplanation.core") as string} <output>{scoring.composite.kind === "point" ? scoring.composite.display : t("observedScoring.unavailable") as string}</output></p>
        <p className="mt-2 text-sm text-text-secondary">{scoring.archetype ?? (t("observedScoring.noArchetype") as string)}</p>
        <div className="border-t border-stroke my-4" />
        <p className="text-sm text-text-secondary leading-relaxed">{t("observedScoring.intro") as string}</p>
        <p className="mt-2 text-sm text-text-secondary leading-relaxed">{t("observedScoring.coreSeparate") as string}</p>
        {scoring.freshness === "stale" && scoring.window && <p className="mt-2 text-sm text-text-secondary">{interpolate(t("observedScoring.stale") as string, { date: scoring.window.referenceDate })}</p>}
      </div>
      <DimensionCardsRow impact={impact} stats={stats} scoring={scoring} receiptExplanation={receiptExplanation} />
      {report && report.status !== "scored" && (!report.unlocked || isOwner) && <section className="text-sm text-text-secondary">
        {!report.unlocked && <p>{t(report.status === "no_report" ? "observedScoring.craftNone" : report.status === "insufficient_report_data" ? "observedScoring.craftInsufficient" : "observedScoring.craftUnavailable") as string}</p>}
        {isOwner && <Link href="/settings" className="mt-2 inline-flex min-h-11 items-center underline underline-offset-4 hover:text-text-primary">{t(report.status === "no_report" ? "observedScoring.uploadInsights" : "observedScoring.updateInsights") as string}</Link>}
      </section>}
      {missing.length > 0 && <section>
        <h3 className="font-heading text-xs uppercase tracking-wider text-text-secondary mb-3">{t("observedScoring.coaching") as string}</h3>
        <p className="text-sm text-text-secondary leading-relaxed">{missing.map(row => t(`observedScoring.steps.${row.label}`) as string).join(", ")}. {t("observedScoring.missingEvidence") as string}</p>
      </section>}
      <ActivityHeatmap heatmapData={stats.heatmapData} activeDays={stats.activeDays} descriptiveOnly />
      <StatsGrid stats={stats} diff={null} />
    </div>;
  }
  const profileText = getArchetypeProfile(impact, t);

  return (
    <div className="space-y-12">
      <div className="animate-fade-in-up">
        <p className="font-heading text-xl text-amber-text tracking-tight">
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
