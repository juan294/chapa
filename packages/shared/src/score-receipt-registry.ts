import { parsePublicScoreReceipt, sealScoreReceipt, verifyScoreReceipt, type HashedScoreReceipt } from "./score-receipt";
import type { PublicScoringReceipt } from "./scoring-evidence";
import { parseObservedScoreReceipt, sealObservedScoreReceipt, verifyObservedScoreReceipt, type PublicObservedScoringReceipt, type HashedObservedScoreReceipt } from "./score-receipt-observed";
import { canonicalJson } from "./canonical-json";

export type RegisteredScoringReceipt = PublicScoringReceipt | PublicObservedScoringReceipt;
export type RegisteredScoreEnvelope = HashedScoreReceipt | HashedObservedScoreReceipt;
/** Narrow historical APIs remain unchanged; only explicitly registered boundaries broaden. */
function policy(value: unknown): "v7" | "v7.2" {
  canonicalJson(value);
  if (!value || typeof value !== "object" || !("policyVersion" in value) || !("algorithm" in value)) throw new TypeError("Unregistered receipt policy");
  const algorithm = value.algorithm;
  if (!algorithm || typeof algorithm !== "object" || !("revision" in algorithm)) throw new TypeError("Unregistered receipt algorithm");
  if (value.policyVersion === "v7" && algorithm.revision === "v7.1") return "v7";
  if (value.policyVersion === "v7.2" && algorithm.revision === "v7.2") return "v7.2";
  throw new TypeError("Unregistered receipt policy/algorithm pair");
}
export function parseRegisteredScoreReceipt(value: unknown): RegisteredScoringReceipt {
  return policy(value) === "v7" ? parsePublicScoreReceipt(value) : parseObservedScoreReceipt(value);
}
export async function sealRegisteredScoreReceipt(value: unknown): Promise<RegisteredScoreEnvelope> {
  return policy(value) === "v7" ? sealScoreReceipt(value) : sealObservedScoreReceipt(value);
}
export async function verifyRegisteredScoreReceipt(value: unknown): Promise<RegisteredScoringReceipt> {
  canonicalJson(value);
  if (!value || typeof value !== "object" || !("receipt" in value)) throw new TypeError("Invalid receipt envelope");
  return policy(value.receipt) === "v7" ? verifyScoreReceipt(value) : verifyObservedScoreReceipt(value);
}
