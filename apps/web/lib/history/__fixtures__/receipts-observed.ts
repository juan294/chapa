import { randomUUID } from "node:crypto";
import { createScoringWindow, SCORING_OBSERVED_POLICY, RECEIPT_ALGORITHM_OBSERVED, sealObservedScoreReceipt, type CoreCountInputs, type PublicObservedCraft, type PublicObservedScoringReceipt } from "@chapa/shared";
import { calculateObservedCoreV7 } from "../../impact/observed-v7";

/** Synthetic/public aggregate fixture; production scorer output is checked by independent replay tests. */
export async function observedReceiptFixture(options: {
  referenceTime?: string; delivery?: number; counts?: CoreCountInputs; receiptId?: string; revisionId?: string;
  prior?: PublicObservedScoringReceipt; craft?: PublicObservedCraft;
} = {}) {
  const window = createScoringWindow(options.referenceTime ?? options.prior?.window.referenceTime ?? "2026-09-07T17:20:02.164Z");
  const counts: CoreCountInputs = options.counts ?? {
    deliveryUnits: { lower: options.delivery ?? 65, upper: Math.max(options.delivery ?? 65, 120) },
    quality: { rationale: { lower: 0, upper: 12 }, verification: { lower: 0, upper: 12 }, review_or_correction: { lower: 0, upper: 12 }, outcome_followup: { lower: 0, upper: 12 } },
    activeIsoWeeks: { lower: 5, upper: 40 }, eligibleProjects: { lower: 4, upper: 4 }, eligibleCategories: { lower: 0, upper: 4 },
  };
  const calculated = calculateObservedCoreV7({ policyVersion: "v7.2", window, counts });
  return sealObservedScoreReceipt({ schemaVersion: "v7", policyVersion: "v7.2", subjectRef: "subject-1", receiptId: options.receiptId ?? options.prior?.receiptId ?? randomUUID(), revisionId: options.revisionId ?? randomUUID(), revision: options.prior ? options.prior.revision + 1 : 1, recordedAt: window.referenceTime, supersedesRevisionId: options.prior?.revisionId ?? null, action: options.prior ? "correct" : "create", window, inputs: calculated.inputs, core: calculated.core, craft: options.craft ?? { status: "no_report", unlocked: false, report: null }, criteria: [], coverage: [], exclusions: [], limitations: ["not_assessed"], serializationVersion: "canonical-json-v1", algorithm: RECEIPT_ALGORITHM_OBSERVED, calculation: { rules: SCORING_OBSERVED_POLICY, core: calculated.trace } });
}
