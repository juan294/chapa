import { interpolate } from "@/lib/i18n/interpolate";
import type { ScoreViewModel } from "@/lib/profile/score-view-model";

export interface ScoringEvidenceLabels {
  illustrativeExample: string;
  observedScoreDescription: string;
  reportCraftDescription: string;
  reportCraftAbsent: string;
  reportCraftUnavailable: string;
  incompleteSources: string;
  excludedSources: string;
}
const DEFAULT_OBSERVED_LABELS: ScoringEvidenceLabels = {
  illustrativeExample: "Illustrative scoring example.",
  observedScoreDescription: "Observed core score from credited evidence; Craft does not enter the core average.",
  reportCraftDescription: "Craft: {score}/100 from {credited} credited outcome sessions out of {total}. Classified outcomes: {recognized}/{total}. Report period: {start} to {end} (end exclusive).",
  reportCraftAbsent: "No current report-derived Craft score.",
  reportCraftUnavailable: "Craft is unlocked; update insights for a current score.",
  incompleteSources: "{incomplete} of {total} sources incomplete.",
  excludedSources: "{count} sources excluded and disclosed.",
};

function describeObserved(model: ScoreViewModel, labels: ScoringEvidenceLabels): string {
  const parts = [...(model.illustrative ? [labels.illustrativeExample] : []), labels.observedScoreDescription];
  const craft = model.reportCraft;
  if (craft?.status === "scored") {
    const { inputs, result } = craft.report;
    parts.push(interpolate(labels.reportCraftDescription, {
      score: result.point.displayLabel, credited: String(result.trace.creditedSessions),
      total: String(inputs.totalSessions), recognized: String(result.trace.recognizedSessions),
      start: inputs.reportPeriod.startInclusive, end: inputs.reportPeriod.endExclusive,
    }));
  } else parts.push(craft?.unlocked ? labels.reportCraftUnavailable : labels.reportCraftAbsent);
  const incomplete = model.coverage.filter(row => row.status !== "complete").length;
  if (incomplete) parts.push(interpolate(labels.incompleteSources, { incomplete: String(incomplete), total: String(model.coverage.length) }));
  if (model.exclusions.length) parts.push(interpolate(labels.excludedSources, { count: String(model.exclusions.length) }));
  return ` ${parts.join(" ")}`;
}

/**
 * The sentence a screen reader hears after the badge's headline.
 *
 * The badge is embedded as an `<img>`, so this description is the only text a
 * reader gets. It must therefore distinguish the three things the artwork
 * distinguishes and the headline number cannot: a point from an
 * evidence-completion range, an absent Craft portfolio from a zero one, and
 * complete coverage from partial. Silence on any of them reads as a claim.
 */
export function describeScoringEvidence(model: ScoreViewModel | undefined, labels: ScoringEvidenceLabels = DEFAULT_OBSERVED_LABELS): string {
  if (!model) return "";
  if (model.policyVersion === "v6") return " Legacy v6 aggregate score.";
  if (model.policyVersion === "v7.2") return describeObserved(model, labels);

  const parts: string[] = [];
  const ranged = [
    ...Object.entries(model.dimensions).filter(([, score]) => score.kind === "range").map(([key]) => key),
    ...(model.composite.kind === "range" ? ["composite"] : []),
  ];
  parts.push(
    ranged.length === 0
      ? "Complete evidence: every value is an exact point."
      : `Evidence-completion range shown for ${ranged.join(", ")}; the true value lies within the observed bounds.`,
  );

  parts.push(
    model.craft === null || model.craft.status === "not_observed"
      ? "No Craft practice portfolio observed; Craft is separate from the core and does not lower it."
      : `Craft practice portfolio observed${model.craft.descriptor ? ` with the ${model.craft.descriptor} descriptor` : ""}, reported separately from the core.`,
  );

  const incomplete = model.coverage.filter(row => row.status !== "complete");
  if (incomplete.length > 0) {
    parts.push(`${incomplete.length} of ${model.coverage.length} sources incomplete.`);
  }
  if (model.exclusions.length > 0) {
    parts.push(`${model.exclusions.length} sources excluded and disclosed.`);
  }
  return ` ${parts.join(" ")}`;
}
