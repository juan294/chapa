import {
  createScoringWindow,
  type CoreScoringInputs,
  type ScoreBounds,
  type ScoringWindow,
} from "@chapa/shared";
import { calculateCoreV7 } from "./v7";

/**
 * The worked examples published on the methodology page, in both languages.
 *
 * Every figure here is produced by `calculateCoreV7` — the same function that
 * scores a real profile — rather than transcribed into prose. A published
 * example that is merely written down goes stale the first time a cap or a
 * weight moves, and a methodology page that disagrees with the scorer is worse
 * than no methodology page.
 */
export interface WorkedExample {
  readonly id: "complete" | "partial" | "zero";
  readonly window: ScoringWindow;
  readonly inputs: CoreScoringInputs;
  readonly dimensions: Readonly<Record<"delivery" | "quality" | "consistency" | "breadth", ScoreBounds>>;
  readonly composite: ScoreBounds;
  readonly tier: string | null;
  readonly archetype: string | null;
}

/** A fixed reference instant, so a published example never changes under the
 * reader. The window arithmetic is the real one. */
export const WORKED_EXAMPLE_REFERENCE = "2026-09-01T12:00:00.000Z";

const bounds = (lower: number, upper = lower): ScoreBounds & { lower: number; upper: number } =>
  ({ lower, upper }) as never;

function build(id: WorkedExample["id"], counts: CoreScoringInputs["counts"]): WorkedExample {
  const window = createScoringWindow(WORKED_EXAMPLE_REFERENCE);
  const calculated = calculateCoreV7({ policyVersion: "v7", window, counts });
  return {
    id,
    window,
    inputs: calculated.inputs,
    dimensions: calculated.core.dimensions,
    composite: calculated.core.composite,
    tier: calculated.core.tier,
    archetype: calculated.core.archetype,
  };
}

/**
 * Three examples, chosen to show the three things a reader most often gets
 * wrong: what complete evidence looks like, that incomplete evidence produces a
 * range rather than a lower score, and that a truthful zero is a real result
 * rather than a failure.
 */
export function workedExamples(): WorkedExample[] {
  const quality = (n: number) => ({
    rationale: bounds(n), verification: bounds(n),
    review_or_correction: bounds(n), outcome_followup: bounds(n),
  });
  return [
    // A mid-range profile on purpose: the log curve saturates quickly, and an
    // example built from a strong profile would leave a reader thinking the
    // scale runs from "Elite" to "Elite".
    build("complete", {
      deliveryUnits: bounds(18), quality: quality(3),
      activeIsoWeeks: bounds(14), eligibleProjects: bounds(2), eligibleCategories: bounds(2),
    }),
    // The same observed evidence, plus one source whose repository discovery
    // did not complete: the lower bound is unchanged and the upper bound rises.
    build("partial", {
      deliveryUnits: { lower: 18, upper: 44 } as never, quality: quality(3),
      activeIsoWeeks: { lower: 14, upper: 19 } as never,
      eligibleProjects: { lower: 2, upper: 3 } as never, eligibleCategories: bounds(2),
    }),
    build("zero", {
      deliveryUnits: bounds(0), quality: quality(0),
      activeIsoWeeks: bounds(0), eligibleProjects: bounds(0), eligibleCategories: bounds(0),
    }),
  ];
}

/** The displayed integers a reader compares against their own badge. */
export function workedExampleDisplay(example: WorkedExample) {
  const shown = (score: ScoreBounds) =>
    score.kind === "point" ? `${score.displayValue}` : `${score.displayLower}–${score.displayUpper}`;
  return {
    id: example.id,
    delivery: shown(example.dimensions.delivery),
    quality: shown(example.dimensions.quality),
    consistency: shown(example.dimensions.consistency),
    breadth: shown(example.dimensions.breadth),
    composite: shown(example.composite),
    tier: example.tier,
    archetype: example.archetype,
  };
}
