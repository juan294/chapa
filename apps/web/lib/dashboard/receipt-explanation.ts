import {
  SCORING_V7_RECEIPT_RULES,
  type EvidenceReasonCode,
  type ExactNumericBounds,
  type NormalizationTrace,
  type PublicCoverageSummary,
  type PublicScoringReceipt,
} from "@chapa/shared";
import {
  CORE_DIMENSION_KEYS,
  CRAFT_CRITERION_KEYS,
  type CoreDimensionKey,
  type CraftCriterionKey,
  type ScoreValue,
} from "@/lib/profile/score-view-model";
import type { ReceiptSnapshotV7 } from "@/lib/history/snapshot";

/** One step of the published arithmetic, in the receipt's own numbers. */
export interface ExplainedStep {
  /** The counted evidence, before the cap. */
  readonly observed: ExactNumericBounds;
  readonly cap: number;
  readonly normalized: ExactNumericBounds;
  /** This step's points inside its dimension. */
  readonly weighted: ExactNumericBounds;
}

export interface ExplainedDimension {
  readonly key: CoreDimensionKey;
  /** The steps that add up to this dimension. Quality has four criteria and
   * Breadth has two terms; Delivery and Consistency have one each. */
  readonly steps: readonly { readonly label: string; readonly step: ExplainedStep }[];
  readonly dimension: ExactNumericBounds;
  /** The dimension's quarter share of the composite. */
  readonly contribution: ExactNumericBounds;
  readonly displayed: ScoreValue;
}

export interface ExplainedCraft {
  readonly status: "not_observed" | "observed";
  readonly criteria: readonly { readonly key: CraftCriterionKey; readonly step: ExplainedStep }[];
  readonly composite: ExactNumericBounds | null;
  readonly descriptor: "Artificer" | null;
  readonly eligibleEpisodes: number;
}

export interface ReceiptExplanation {
  readonly policyVersion: "v7";
  readonly window: PublicScoringReceipt["window"];
  readonly dimensions: readonly ExplainedDimension[];
  /** The sum of the four contributions. Equal to the receipt's composite. */
  readonly composite: ExactNumericBounds;
  readonly displayedComposite: ScoreValue;
  readonly tier: PublicScoringReceipt["core"]["tier"];
  readonly archetype: PublicScoringReceipt["core"]["archetype"];
  /** Null when this subject has no Craft channel at all. Craft never enters
   * the composite above; it is reported beside it. */
  readonly craft: ExplainedCraft | null;
  readonly coverage: readonly PublicCoverageSummary[];
  readonly limitations: readonly EvidenceReasonCode[];
}

function fromScore(score: PublicScoringReceipt["core"]["composite"]): ScoreValue {
  return score.kind === "point"
    ? { kind: "point", value: score.value, display: score.displayValue }
    : { kind: "range", lower: score.lower, upper: score.upper, displayLower: score.displayLower, displayUpper: score.displayUpper };
}

function step(trace: NormalizationTrace<number, number>): ExplainedStep {
  return { observed: trace.input, cap: trace.cap, normalized: trace.normalized, weighted: trace.weighted };
}

const add = (a: ExactNumericBounds, b: ExactNumericBounds): ExactNumericBounds => ({ lower: a.lower + b.lower, upper: a.upper + b.upper });
const quarter = (value: ExactNumericBounds): ExactNumericBounds => ({ lower: value.lower / 4, upper: value.upper / 4 });

/**
 * Explain an issued receipt using the arithmetic it was sealed with.
 *
 * Nothing here re-derives a formula: every bound is read out of the receipt's
 * own `calculation` trace, which is why the four contributions sum to the
 * published composite exactly rather than approximately. An explanation that
 * rebuilt the formulas would be a second implementation, and the first time the
 * two disagreed the explanation would be the one people believed.
 */
export function explainReceipt(snapshot: ReceiptSnapshotV7): ReceiptExplanation {
  const receipt = snapshot.receipt.receipt;
  const trace = receipt.calculation.core;

  const dimensions: ExplainedDimension[] = CORE_DIMENSION_KEYS.map(key => {
    const steps =
      key === "delivery" ? [{ label: "delivery_units", step: step(trace.delivery) }]
      : key === "consistency" ? [{ label: "active_iso_weeks", step: step(trace.consistency) }]
      : key === "breadth" ? [
          { label: "eligible_projects", step: step(trace.breadth.projects) },
          { label: "eligible_categories", step: step(trace.breadth.categories) },
        ]
      : (["rationale", "verification", "review_or_correction", "outcome_followup"] as const)
          .map(criterion => ({ label: criterion, step: step(trace.quality[criterion]) }));
    return {
      key,
      steps,
      dimension: trace.dimensions[key],
      contribution: trace.weightedDimensions[key],
      displayed: fromScore(receipt.core.dimensions[key]),
    };
  });

  const craft: ExplainedCraft | null = receipt.craft && receipt.calculation.craft
    ? {
        status: receipt.craft.result.status,
        criteria: CRAFT_CRITERION_KEYS.map(key => ({ key, step: step(receipt.calculation.craft!.criteria[key]) })),
        composite: receipt.calculation.craft.composite,
        descriptor: receipt.craft.result.status === "observed" ? receipt.craft.result.descriptor : null,
        eligibleEpisodes: receipt.craft.inputs.eligibleEpisodes,
      }
    : null;

  return {
    policyVersion: "v7",
    window: receipt.window,
    dimensions,
    composite: dimensions.map(row => row.contribution).reduce(add, { lower: 0, upper: 0 }),
    displayedComposite: fromScore(receipt.core.composite),
    tier: receipt.core.tier,
    archetype: receipt.core.archetype,
    craft,
    coverage: receipt.coverage,
    limitations: receipt.limitations,
  };
}

/** True when the explanation reconciles with the receipt it explains, within
 * the receipt policy's own cross-runtime tolerance. Callers use this in tests
 * and diagnostics; a false result means the explanation and the artifact
 * disagree, which must never reach a reader. */
export function explanationReconciles(explanation: ReceiptExplanation, snapshot: ReceiptSnapshotV7): boolean {
  const receipt = snapshot.receipt.receipt;
  const tolerance = SCORING_V7_RECEIPT_RULES.numericTolerance;
  const close = (a: ExactNumericBounds, b: ExactNumericBounds) =>
    Math.abs(a.lower - b.lower) <= tolerance && Math.abs(a.upper - b.upper) <= tolerance;

  if (!close(explanation.composite, receipt.calculation.core.composite)) return false;
  return explanation.dimensions.every(row => {
    const summed = row.steps.map(entry => entry.step.weighted).reduce(add, { lower: 0, upper: 0 });
    return close(summed, row.dimension) && close(quarter(row.dimension), row.contribution);
  });
}
