import type { ScoreViewModel } from "./score-view-model";

/**
 * The one-sentence description of a score for metadata — JSON-LD today, and
 * anything else that hands a number to a machine rather than a reader.
 *
 * This is the highest-leverage place to get a v7 range right. A search result,
 * a social card and an LLM answer all quote this sentence back, and unlike the
 * badge it has no artwork to qualify it: publishing "Impact Score of 67" while
 * the badge draws "64–73" would put a point claim Chapa does not make into
 * someone else's index, where a later correction cannot reach it.
 *
 * So a range is described as a range, and a range that earned no tier claims
 * no tier. A v6 aggregate keeps its existing sentence, because that is what it
 * has always meant.
 */
export function describeScoreForMetadata(model: ScoreViewModel | null): string | null {
  if (!model) return null;

  const tierSuffix = model.tier ? ` (${model.tier} tier)` : "";

  if (model.composite.kind === "point") {
    return `Developer with a Chapa Impact Score of ${model.composite.display}${tierSuffix}.`;
  }

  // An evidence-completion range. Named as one, so the interval is not mistaken
  // for a precision claim about the developer.
  const { displayLower, displayUpper } = model.composite;
  return `Developer with a Chapa Impact evidence range of ${displayLower}–${displayUpper}${tierSuffix}, reflecting incomplete source coverage.`;
}
