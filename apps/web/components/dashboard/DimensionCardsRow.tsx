"use client";

import type {
  ClientImpactV6Result,
  CraftResult,
  StatsData,
  DimensionScores,
} from "@chapa/shared";
import type { TrendSummary } from "@/lib/history/trend";
import type { ClientSnapshotDiff } from "@/lib/history/diff";
import { DimensionCard } from "./DimensionCard";
import { CORE_DIMENSION_KEYS, type ScoreViewModel } from "@/lib/profile/score-view-model";
import type { ReceiptExplanation } from "@/lib/dashboard/receipt-explanation";
import { ObservedStepDetails } from "./ObservedStepDetails";
import { ReportCraftDetails } from "./ReportCraftDetails";
import { useTranslation } from "@/lib/i18n";

/** Core dimensions — always shown. */
const CORE_DIMENSIONS = ["delivery", "quality", "consistency", "breadth"] as const;

export interface DimensionCardsRowProps {
  // #1067 — redacted PublicImpactV6Result for a non-owner visitor, full
  // ImpactV6Result for the owner. This component never reads confidence.
  impact: ClientImpactV6Result;
  stats: StatsData;
  trend?: TrendSummary | null;
  diff?: ClientSnapshotDiff | null;
  activeDimension?: keyof DimensionScores | null;
  className?: string;
  craftResult?: CraftResult | null;
  scoring?: ScoreViewModel | null;
  receiptExplanation?: ReceiptExplanation | null;
}

export function DimensionCardsRow({
  impact,
  stats,
  trend,
  diff,
  activeDimension,
  className,
  craftResult = null,
  scoring, receiptExplanation,
}: DimensionCardsRowProps) {
  const { t } = useTranslation();
  if (scoring?.policyVersion === "v7.2") {
    const craft = scoring.reportCraft;
    const hasCraft = craft?.unlocked === true;
    return <section className={className}>
      <h3 className="font-heading text-xs uppercase tracking-wider text-text-secondary mb-3">{t("dashboard.performanceDimensions") as string}</h3>
      <div className={`grid ${hasCraft ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"} gap-3`}>
        {CORE_DIMENSION_KEYS.map((dimension, index) => {
          const point = scoring.dimensions[dimension];
          const detail = receiptExplanation?.policyVersion === "v7.2" ? receiptExplanation.dimensions.find(row => row.key === dimension) : null;
          return <DimensionCard key={dimension} dimension={dimension} score={point.kind === "point" ? point.display : 0} stats={stats} animationDelay={400 + index * 100}
            receiptPresentation={{ display: point.kind === "point" ? String(point.display) : null, subtitle: t("observedScoring.evidenceDetails") as string,
              detail: detail ? <dl className="space-y-2 text-sm">{detail.steps.map(row => <div key={row.label}>
                <dt className="text-text-secondary">{t(`observedScoring.steps.${row.label}`) as string}</dt>
                <dd><ObservedStepDetails step={row.step} /></dd>
                {row.step.observed.lower === 0 && <p className="mt-1 text-text-secondary">{t("observedScoring.missingEvidence") as string}</p>}
              </div>)}</dl> : <p className="text-sm text-text-secondary">{t("observedScoring.explanationUnavailable") as string}</p> }} />;
        })}
        {hasCraft && craft && <DimensionCard dimension="craft" score={craft.status === "scored" ? craft.report.result.point.displayValue : 0} stats={stats} animationDelay={800}
          receiptPresentation={{ display: craft.status === "scored" ? craft.report.result.point.displayLabel : null,
            subtitle: t(craft.status === "scored" ? "observedScoring.craftReport" : "observedScoring.updateInsights") as string, detail: <ReportCraftDetails craft={craft} /> }} />}
      </div>
    </section>;
  }
  const hasCraft = impact.dimensions.craft != null;
  const dimensions: (keyof DimensionScores)[] = hasCraft
    ? [...CORE_DIMENSIONS, "craft"]
    : [...CORE_DIMENSIONS];

  const gridCols = hasCraft
    ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
    : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";

  return (
    <section className={className}>
      <h3 className="font-heading text-xs uppercase tracking-wider text-text-secondary mb-3">
        {t('dashboard.performanceDimensions') as string}
      </h3>
      <div className={`grid ${gridCols} gap-3`}>
        {dimensions.map((dim, i) => {
          const isInactive =
            activeDimension != null && activeDimension !== dim;

          return (
            <DimensionCard
              key={dim}
              dimension={dim}
              score={impact.dimensions[dim] ?? 0}
              stats={stats}
              trend={trend?.dimensions[dim] ?? null}
              delta={diff?.dimensions[dim] ?? null}
              animationDelay={400 + i * 100}
              className={
                isInactive
                  ? "opacity-70 transition-opacity duration-200"
                  : ""
              }
              profileType={impact.profileType}
              craftResult={craftResult}
            />
          );
        })}
      </div>
    </section>
  );
}
