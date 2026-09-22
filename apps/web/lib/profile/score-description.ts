import type { ScoreViewModel } from "./score-view-model";

/** One metadata sentence from the same canonical model as the visible badge.
 * Current points describe recorded evidence; archived ranges retain their
 * historical meaning and legacy v6 keeps its existing wording. */
export function describeScoreForMetadata(model: ScoreViewModel | null): string | null {
  if (!model) return null;

  const tierSuffix = model.tier ? ` (${model.tier} tier)` : "";

  if (model.policyVersion === "v7.2" && model.composite.kind === "point") {
    return `Chapa Impact Score of ${model.composite.display}${tierSuffix}, using v7.2 recorded evidence within the declared source scope and window. Coverage limitations are available in the receipt.`;
  }

  if (model.composite.kind === "point") {
    return `Developer with a Chapa Impact Score of ${model.composite.display}${tierSuffix}.`;
  }

  // An evidence-completion range. Named as one, so the interval is not mistaken
  // for a precision claim about the developer.
  const { displayLower, displayUpper } = model.composite;
  return `Developer with a Chapa Impact evidence range of ${displayLower}–${displayUpper}${tierSuffix}, reflecting incomplete source coverage.`;
}
