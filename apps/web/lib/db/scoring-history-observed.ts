import { canonicalJson, sealObservedScoreReceipt, SCORING_OBSERVED_POLICY, type HashedObservedScoreReceipt } from "@chapa/shared";
import { getSupabase } from "./supabase";
import type { ObservedTrendAnchor } from "./score-receipts-observed";

type History = { status: "found"; entries: { envelope: HashedObservedScoreReceipt; trend: ObservedTrendAnchor }[] } | { status: "missing" | "unavailable" };
/** Daily publication winners only; EMA anchors are durable values, never re-seeded from a filtered list. */
export async function dbListObservedReceiptHistory(owner: string, dates: { from?: string; to?: string } = {}): Promise<History> {
  try {
    const db = getSupabase();
    if (!db) return { status: "unavailable" };
    const { data, error } = await db.rpc("scoring_observed_history", { p_owner: owner.toLowerCase(), p_from: dates.from ?? null, p_to: dates.to ?? null });
    if (error) throw error;
    if (data === null) return { status: "missing" };
    if (!Array.isArray(data)) throw new Error("Invalid history response");
    const entries = await Promise.all(data.map(async row => {
      if (typeof row?.canonicalReceipt !== "string") throw new Error("Missing canonical receipt");
      const envelope = await sealObservedScoreReceipt(JSON.parse(row.canonicalReceipt));
      const r = envelope.receipt; const t = row.trend;
      if (canonicalJson(r) !== row.canonicalReceipt || r.action === "retract" || t?.policy_version !== "v7.2" || t.receipt_id !== r.revisionId || t.date !== r.window.referenceDate || !Number.isFinite(t.raw_value) || Math.abs(t.raw_value - r.core.composite.exact) > SCORING_OBSERVED_POLICY.numericTolerance || !Number.isFinite(t.value) || t.value < 0 || t.value > 100 || !(t.previous_receipt_id === null || typeof t.previous_receipt_id === "string")) throw new Error("Invalid history anchor");
      const trend: ObservedTrendAnchor = { policyVersion: "v7.2", referenceDate: t.date, receiptRevisionId: t.receipt_id, rawPoint: t.raw_value, unroundedValue: t.value, previousAnchorRevisionId: t.previous_receipt_id };
      return { envelope, trend };
    }));
    return { status: "found", entries };
  } catch {
    console.error("[TABLE_FALLBACK] observed history read failed");
    return { status: "unavailable" };
  }
}
