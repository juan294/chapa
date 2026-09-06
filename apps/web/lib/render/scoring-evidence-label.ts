import type { ScoreViewModel } from "@/lib/profile/score-view-model";

/**
 * The sentence a screen reader hears after the badge's headline.
 *
 * The badge is embedded as an `<img>`, so this description is the only text a
 * reader gets. It must therefore distinguish the three things the artwork
 * distinguishes and the headline number cannot: a point from an
 * evidence-completion range, an absent Craft portfolio from a zero one, and
 * complete coverage from partial. Silence on any of them reads as a claim.
 */
export function describeScoringEvidence(model: ScoreViewModel | undefined): string {
  if (!model) return "";
  if (model.policyVersion === "v6") return " Legacy v6 aggregate score.";

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
