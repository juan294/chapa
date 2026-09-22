"use client";
import type { PublicObservedCraft } from "@chapa/shared";
import { useTranslation } from "@/lib/i18n";
import { interpolate } from "@/lib/i18n/interpolate";

/** Public aggregate report arithmetic; no legacy proficiency or private labels. */
export function ReportCraftDetails({ craft }: { craft: PublicObservedCraft }) {
  const { t } = useTranslation();
  const report = craft.status === "scored" ? craft.report : craft.status === "expired" || craft.status === "unavailable" ? craft.lastReport : null;
  const period = report?.inputs.reportPeriod ?? (craft.status === "insufficient_report_data" ? craft.report.inputs.reportPeriod : null);
  return <div className="space-y-3 text-sm text-text-secondary">
    <p>{t("observedScoring.craftReport") as string}</p>
    {period && <p className="break-words tabular-nums">{interpolate(t("observedScoring.reportPeriod") as string, { start: period.startInclusive, end: period.endExclusive })}</p>}
    {craft.status === "scored" ? <>
      <p>{interpolate(t("observedScoring.reportCoverage") as string, { recognized: String(craft.report.result.trace.recognizedSessions), total: String(craft.report.inputs.totalSessions) })}</p>
      <dl className="space-y-1">
        {(Object.keys(craft.report.inputs.outcomes) as (keyof typeof craft.report.inputs.outcomes)[]).map(key => <div key={key} className="flex flex-wrap justify-between gap-2">
          <dt>{t(`observedScoring.outcomes.${key}`) as string}</dt>
          <dd className="font-heading tabular-nums">{craft.report.inputs.outcomes[key]} × {craft.report.result.trace.outcomeCredits[key]}</dd>
        </div>)}
        <div className="flex justify-between gap-2"><dt>{t("observedScoring.unknownSessions") as string}</dt><dd>{craft.report.inputs.unknownSessions}</dd></div>
        <div className="flex justify-between gap-2"><dt>{t("observedScoring.unclassifiedSessions") as string}</dt><dd>{craft.report.inputs.unclassifiedSessions}</dd></div>
      </dl>
      <p className="font-heading break-words tabular-nums">{craft.report.result.trace.creditedSessions} / {craft.report.inputs.totalSessions} × 100 = {craft.report.result.point.exact}</p>
    </> : <p>{t(craft.status === "no_report" ? "observedScoring.craftNone" : craft.status === "insufficient_report_data" ? "observedScoring.craftInsufficient" : "observedScoring.craftUnavailable") as string}</p>}
    <p>{t("observedScoring.coreSeparate") as string}</p>
  </div>;
}
