"use client";

import type { StatsData } from "@chapa/shared";
import { DimensionCard } from "./DimensionCard";
import { CORE_DIMENSION_KEYS, type ScoreViewModel } from "@/lib/profile/score-view-model";
import type { ReceiptExplanation } from "@/lib/dashboard/receipt-explanation";
import { ObservedStepDetails } from "./ObservedStepDetails";
import { ReportCraftDetails } from "./ReportCraftDetails";
import { useTranslation } from "@/lib/i18n";

export interface DimensionCardsRowProps {
  /** #1335 — v7.2 is the one scoring policy every dashboard consumer renders. */
  scoring: ScoreViewModel;
  stats: StatsData;
  className?: string;
  receiptExplanation?: ReceiptExplanation | null;
}

export function DimensionCardsRow({
  scoring,
  stats,
  className,
  receiptExplanation,
}: DimensionCardsRowProps) {
  const { t } = useTranslation();
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
