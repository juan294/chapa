import { canonicalJson, sealObservedScoreReceipt, verifyObservedScoreReceipt, SCORING_OBSERVED_POLICY, type HashedObservedScoreReceipt } from "@chapa/shared";
import { getSupabase } from "./supabase";

export interface ObservedTrendAnchor {
  readonly policyVersion: "v7.2";
  readonly referenceDate: string;
  readonly receiptRevisionId: string;
  readonly rawPoint: number;
  readonly unroundedValue: number;
  readonly previousAnchorRevisionId: string | null;
}
export interface ObservedReceiptManifest {
  readonly revisionId: string;
  readonly policyVersion: "v7.2";
  /** SHA-256 of the exact durable canonical bytes, not a cache-supplied digest. */
  readonly contentHash: string;
  /** Private service metadata; never put this digest in public API/cache identities. */
  readonly semanticDigest: string;
  readonly coreSemanticDigest: string | null;
  readonly trend: ObservedTrendAnchor | null;
  readonly isCurrent: boolean;
}
export interface StoredObservedReceipt {
  readonly envelope: HashedObservedScoreReceipt;
  readonly semanticDigest: string;
  readonly coreSemanticDigest: string | null;
  readonly trend: ObservedTrendAnchor | null;
  readonly isCurrent: boolean;
}
export type ObservedReceiptRead = ({ readonly status: "found" } & StoredObservedReceipt) | { readonly status: "missing" | "unavailable" };
export type ObservedReceiptPublication = ({ readonly status: "inserted" | "duplicate" } & StoredObservedReceipt) | { readonly status: "failed" };
const digest = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
const score = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid observed storage response");
  return value as Record<string, unknown>;
}
function manifest(value: unknown): ObservedReceiptManifest {
  const row = record(value);
  if (typeof row.revisionId !== "string" || row.policyVersion !== "v7.2" || !digest(row.semanticDigest) || !digest(row.contentHash) || typeof row.isCurrent !== "boolean") throw new Error("Invalid observed manifest");
  if (row.coreSemanticDigest !== undefined && row.coreSemanticDigest !== null && !digest(row.coreSemanticDigest)) throw new Error("Invalid core semantic digest");
  let trend: ObservedTrendAnchor | null = null;
  if (row.trend !== null) {
    const t = record(row.trend);
    if (t.policy_version !== "v7.2" || t.receipt_id !== row.revisionId || typeof t.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(t.date)
      || !score(t.raw_value) || !score(t.value) || !(t.previous_receipt_id === null || typeof t.previous_receipt_id === "string")) throw new Error("Invalid observed trend");
    trend = { policyVersion: "v7.2", referenceDate: t.date, receiptRevisionId: row.revisionId, rawPoint: t.raw_value, unroundedValue: t.value, previousAnchorRevisionId: t.previous_receipt_id };
  }
  return { revisionId: row.revisionId, policyVersion: "v7.2", contentHash: row.contentHash, semanticDigest: row.semanticDigest, coreSemanticDigest: typeof row.coreSemanticDigest === "string" ? row.coreSemanticDigest : null, trend, isCurrent: row.isCurrent };
}
async function stored(value: unknown): Promise<StoredObservedReceipt> {
  const row = record(value); const identity = manifest(row);
  if (typeof row.canonicalReceipt !== "string") throw new Error("Missing observed canonical receipt");
  const envelope = await sealObservedScoreReceipt(JSON.parse(row.canonicalReceipt));
  const receipt = envelope.receipt;
  if (canonicalJson(receipt) !== row.canonicalReceipt || receipt.revisionId !== identity.revisionId || envelope.contentHash.value !== identity.contentHash) throw new Error("Observed receipt identity mismatch");
  const trend = identity.trend;
  if (trend && (receipt.action === "retract" || trend.referenceDate !== receipt.window.referenceDate || Math.abs(trend.rawPoint - receipt.core.composite.exact) > SCORING_OBSERVED_POLICY.numericTolerance)) throw new Error("Observed receipt trend mismatch");
  return { envelope, semanticDigest: identity.semanticDigest, coreSemanticDigest: identity.coreSemanticDigest, trend, isCurrent: identity.isCurrent };
}
async function rpc(name: string, args: Record<string, unknown>): Promise<unknown> {
  const db = getSupabase();
  if (!db) throw new Error("Observed storage unavailable");
  const result = await db.rpc(name, args);
  if (result.error) throw new Error("Observed storage RPC failed");
  return result.data;
}
function unavailable(operation: string): void {
  console.error(`[TABLE_FALLBACK] observed receipt ${operation} failed`);
}
export async function dbObservedReceiptManifest(owner: string, revisionId?: string): Promise<{ status: "found"; manifest: ObservedReceiptManifest } | { status: "missing" | "unavailable" }> {
  try {
    const value = await rpc("scoring_observed_receipt_manifest", { p_owner: owner.toLowerCase(), p_revision: revisionId ?? null });
    if (value === null) return { status: "missing" };
    const result = manifest(value);
    if (revisionId && result.revisionId !== revisionId) throw new Error("Observed revision mismatch");
    return { status: "found", manifest: result };
  } catch { unavailable("manifest read"); return { status: "unavailable" }; }
}
/** Service-only, policy-qualified read; missing consent and transport failure remain distinct. */
export async function dbReadObservedReceipt(owner: string, revisionId?: string): Promise<ObservedReceiptRead> {
  try {
    const value = await rpc("scoring_observed_read_receipt", { p_owner: owner.toLowerCase(), p_revision: revisionId ?? null });
    if (value === null) return { status: "missing" };
    const result = await stored(value);
    if (revisionId && result.envelope.receipt.revisionId !== revisionId) throw new Error("Observed revision mismatch");
    return { status: "found", ...result };
  } catch { unavailable("read"); return { status: "unavailable" }; }
}
/** Returns the database's authoritative winner, which may differ from the prepared
 * envelope after a concurrent semantic no-op. Success always follows durable commit.
 */
export async function dbPublishObservedReceipt(owner: string, actor: string, envelope: HashedObservedScoreReceipt, semanticDigest: string, coreSemanticDigest?: string): Promise<ObservedReceiptPublication> {
  try {
    if (!digest(semanticDigest) || (coreSemanticDigest !== undefined && !digest(coreSemanticDigest))) throw new Error("Invalid observed semantic digest");
    const receipt = await verifyObservedScoreReceipt(envelope);
    const value = record(await rpc("scoring_observed_publish_receipt", { p_owner: owner.toLowerCase(), p_actor: actor.toLowerCase(), p_receipt: receipt, p_canonical: canonicalJson(receipt), p_semantic_digest: semanticDigest, p_core_semantic_digest: coreSemanticDigest ?? null }));
    if (value.status !== "inserted" && value.status !== "duplicate") throw new Error("Invalid observed publication result");
    const result = await stored(value);
    if (result.semanticDigest !== semanticDigest || (coreSemanticDigest !== undefined && result.coreSemanticDigest !== coreSemanticDigest) || (value.status === "inserted" && canonicalJson(result.envelope) !== canonicalJson(envelope))) throw new Error("Observed publication identity mismatch");
    return { status: value.status, ...result };
  } catch { unavailable("publication"); return { status: "failed" }; }
}
