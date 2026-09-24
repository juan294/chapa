import "server-only";
import { getSupabase } from "./supabase";
import type { ReceiptIssuanceOutcome } from "@/lib/profile/issue-receipt";

/**
 * Records every fan-in issuance outcome (#1335 phase 4) -- `issued`,
 * `unchanged`, or a specific `failed{reason}`. Never a silent skip: this is
 * the durable "fan-in marker" `runCollectionTick`'s retry sweep reads
 * (`scoring_collection_pending_fan_in`, migration 056) to decide whether a
 * complete day's receipt still needs issuing.
 *
 * A write failure here is itself captured by the caller (`lib/collection/fan-in.ts`)
 * rather than here, since the caller already knows the issuance outcome being
 * recorded and can fold both into one alert.
 */
export async function dbRecordScoringIssuanceAttempt(
  owner: string,
  referenceDate: string,
  outcome: ReceiptIssuanceOutcome,
): Promise<boolean> {
  const db = getSupabase();
  if (!db) return false;
  try {
    const { error } = await db.from("scoring_issuance_attempts").insert({
      owner_handle: owner.toLowerCase(),
      reference_date: referenceDate,
      outcome: outcome.status,
      reason: outcome.status === "failed" ? outcome.reason : null,
    });
    if (error) throw error;
    return true;
  } catch (error) {
    console.error("[db] dbRecordScoringIssuanceAttempt failed:", (error as Error).message);
    return false;
  }
}
