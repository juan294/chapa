import { verifyObservedScoreReceipt, SCORING_OBSERVED_POLICY, type HashedObservedScoreReceipt } from "@chapa/shared";
import { dbObservedReceiptManifest, dbReadObservedReceipt, type ObservedReceiptRead } from "@/lib/db/score-receipts-observed";
import { cacheGet, cacheSet, cacheDel } from "./redis";

/** Immutable public bytes only; private semantic digests never enter Redis. */
export function buildObservedReceiptKey(revisionId: string): string {
  return `snapshot:v7.2:receipt:${revisionId}`;
}
async function remove(key: string): Promise<void> {
  try {
    if (await cacheDel(key)) return;
  } catch { /* Authorization still fails closed; cleanup must remain observable. */ }
  console.error("[TABLE_FALLBACK] observed receipt cache cleanup failed");
}
/** Durable policy-qualified authorization precedes and follows any asynchronous
 * cache access. A late renderer cannot publish a revoked or superseded selection.
 */
export async function getCachedObservedReceipt(owner: string, revisionId?: string): Promise<ObservedReceiptRead> {
  const initial = await dbObservedReceiptManifest(owner, revisionId);
  if (initial.status !== "found") return { status: initial.status };
  const key = buildObservedReceiptKey(initial.manifest.revisionId);
  let envelope: HashedObservedScoreReceipt | null = null;
  try {
    const cached = await cacheGet<HashedObservedScoreReceipt>(key);
    if (cached) {
      const receipt = await verifyObservedScoreReceipt(cached);
      if (receipt.revisionId === initial.manifest.revisionId && cached.contentHash.value === initial.manifest.contentHash) envelope = cached;
    }
  } catch { /* Corrupt or unavailable cache is replaced from authorized storage. */ }
  if (!envelope) {
    const durable = await dbReadObservedReceipt(owner, initial.manifest.revisionId);
    if (durable.status !== "found") { await remove(key); return durable; }
    envelope = durable.envelope;
    try { await cacheSet(key, envelope, 86400); } catch { /* Durable receipt remains available. */ }
  }
  const current = await dbObservedReceiptManifest(owner, revisionId);
  if (current.status !== "found") { await remove(key); return { status: current.status }; }
  const receipt = envelope.receipt;
  if (current.manifest.revisionId !== receipt.revisionId || current.manifest.contentHash !== envelope.contentHash.value) {
    await remove(key);
    return { status: "unavailable" };
  }
  const trend = current.manifest.trend;
  if (trend && (receipt.action === "retract" || trend.referenceDate !== receipt.window.referenceDate || Math.abs(trend.rawPoint - receipt.core.composite.exact) > SCORING_OBSERVED_POLICY.numericTolerance)) {
    await remove(key);
    return { status: "unavailable" };
  }
  return { status: "found", envelope, semanticDigest: current.manifest.semanticDigest, trend, isCurrent: current.manifest.isCurrent };
}
