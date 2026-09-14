import { randomUUID } from "node:crypto";
import { createScoringWindow, sealScoreReceipt, RECEIPT_ALGORITHM_V7, SCORING_V7_RECEIPT_RULES, type PublicScoringReceipt } from "@chapa/shared";
import { calculateCoreV7 } from "@/lib/impact/v7";
export async function receiptFixtureV7(date = "2026-09-01", n = 4, previous?: PublicScoringReceipt, range = false) {
  const window = createScoringWindow(`${date}T12:00:00.000Z`);
  const bounds = { lower: n, upper: n };
  const core = calculateCoreV7({ policyVersion: "v7", window, counts: { deliveryUnits: { lower: n, upper: range ? n + 1 : n }, quality: { rationale: bounds, verification: bounds, review_or_correction: bounds, outcome_followup: bounds }, activeIsoWeeks: bounds, eligibleProjects: bounds, eligibleCategories: { lower: Math.min(n, 4), upper: Math.min(n, 4) } } });
  return sealScoreReceipt({ schemaVersion: "v7", policyVersion: "v7", receiptId: previous?.receiptId ?? randomUUID(), revisionId: randomUUID(), subjectRef: "subject-1", revision: (previous?.revision ?? 0) + 1, supersedesRevisionId: previous?.revisionId ?? null, action: previous ? "correct" : "create", recordedAt: window.referenceTime, window,
    inputs: core.inputs, core: core.core, craft: null, criteria: [], coverage: [], exclusions: [], limitations: [], serializationVersion: "canonical-json-v1", algorithm: RECEIPT_ALGORITHM_V7, calculation: { rules: SCORING_V7_RECEIPT_RULES, core: core.calculation, craft: null } });
}
