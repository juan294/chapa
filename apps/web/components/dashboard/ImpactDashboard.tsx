"use client";

import Link from "next/link";
import type { StatsData } from "@chapa/shared";
import { DimensionCardsRow } from "./DimensionCardsRow";
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
  /** #1335 — v7.2 is the one scoring policy every dashboard consumer renders. */
  scoring: ScoreViewModel;
  stats: StatsData;
  isOwner?: boolean;
  receiptExplanation?: ReceiptExplanation | null;
  /** #1331 — set for a durable stored-badge fallback. The heatmap is never
   *  drawn in this state: `stats.heatmapData` is `[]` for a stored
   *  projection (never persisted per-day), and an empty grid would read as
   *  "no activity" rather than "unknown" — the stale notice above this
   *  component already discloses the outage and the stored date. */
  activityUnavailable?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImpactDashboard({
  scoring, receiptExplanation, isOwner = false,
  stats,
  activityUnavailable = false,
}: ImpactDashboardProps) {
  const { t } = useTranslation();

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
    <DimensionCardsRow scoring={scoring} receiptExplanation={receiptExplanation} />
    {report && report.status !== "scored" && (!report.unlocked || isOwner) && <section className="text-sm text-text-secondary">
      {!report.unlocked && <p>{t(report.status === "no_report" ? "observedScoring.craftNone" : report.status === "insufficient_report_data" ? "observedScoring.craftInsufficient" : "observedScoring.craftUnavailable") as string}</p>}
      {isOwner && <Link href="/settings" className="mt-2 inline-flex min-h-11 items-center underline underline-offset-4 hover:text-text-primary">{t(report.status === "no_report" ? "observedScoring.uploadInsights" : "observedScoring.updateInsights") as string}</Link>}
    </section>}
    {missing.length > 0 && <section>
      <h3 className="font-heading text-xs uppercase tracking-wider text-text-secondary mb-3">{t("observedScoring.coaching") as string}</h3>
      <p className="text-sm text-text-secondary leading-relaxed">{missing.map(row => t(`observedScoring.steps.${row.label}`) as string).join(", ")}. {t("observedScoring.missingEvidence") as string}</p>
    </section>}
    {!activityUnavailable && (
      <ActivityHeatmap heatmapData={stats.heatmapData} activeDays={stats.activeDays} descriptiveOnly />
    )}
    <StatsGrid stats={stats} />
  </div>;
}
