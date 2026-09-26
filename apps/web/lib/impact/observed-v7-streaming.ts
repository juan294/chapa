import type { ObservedCoreInputs } from "@chapa/shared";
import { calculateObservedCoreV7, type CalculatedObservedCoreV7 } from "./observed-v7";
import type { StreamingObservedEvidence } from "./v7-evidence-streaming";

/** Applies the unchanged v7.2 point policy to a paged evidence reduction. */
export function computeObservedImpactV7FromReduction(evidence: StreamingObservedEvidence): Omit<StreamingObservedEvidence, "inputs"> & CalculatedObservedCoreV7 {
  const inputs: ObservedCoreInputs = { policyVersion: "v7.2", window: evidence.inputs.window, counts: evidence.inputs.counts };
  return { ...evidence, ...calculateObservedCoreV7(inputs) };
}
