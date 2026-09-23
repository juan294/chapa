/**
 * Supabase data access — v7.2 receipt history RPC bridge.
 *
 * The v6 `metrics_snapshots` table and its CRUD (dbInsertSnapshot,
 * dbReplaceSnapshot, dbGetSnapshots, dbGetLatestSnapshot,
 * dbGetLatestSnapshotBatch, dbGetScoredCandidates, dbGetTopScoredProfiles,
 * dbCleanOldSnapshots) were retired in #1335 phase 5. Lifetime history is
 * now read from the durable `scoring_v7_receipts` / `scoring_v7_trend_anchors`
 * store via `scoring_observed_history`/`scoring_v7_read_receipt` below.
 */

import { canonicalJson, sealScoreReceipt, verifyScoreReceipt } from "@chapa/shared";
import { buildReceiptSnapshotV7 } from "@/lib/history/snapshot";
import { getSupabase } from "./supabase";

export class ReceiptHistoryError extends Error {
  constructor(readonly code: string) { super("Receipt history operation failed"); }
}
async function receiptRpc(name: string, args: Record<string, unknown>): Promise<unknown> {
  const db = getSupabase();
  if (!db) throw new ReceiptHistoryError("unavailable");
  const { data, error } = await db.rpc(name, args);
  if (error) throw new ReceiptHistoryError(error.code);
  return data;
}
interface StoredTrendRow {
  policy_version: "v7";
  date: string;
  receipt_id: string;
  raw_value: number;
  value: number;
  previous_receipt_id: string | null;
}
export interface ReceiptManifestV7 {
  readonly revisionId: string;
  readonly policyVersion: "v7";
  readonly trend: import("@chapa/shared").TrendAnchor | null;
}
function receiptManifest(value: unknown): ReceiptManifestV7 {
  if (!value || typeof value !== "object") throw new ReceiptHistoryError("contract");
  const row = value as Record<string, unknown>;
  if (typeof row.revisionId !== "string" || row.policyVersion !== "v7") throw new ReceiptHistoryError("contract");
  let trend: import("@chapa/shared").TrendAnchor | null = null;
  if (row.trend !== null) {
    const t = row.trend as StoredTrendRow;
    if (!t || t.policy_version !== "v7" || t.receipt_id !== row.revisionId || typeof t.date !== "string" || !Number.isFinite(t.value) || t.value < 0 || t.value > 100 || !Number.isFinite(t.raw_value) || t.raw_value < 0 || t.raw_value > 100 || (t.previous_receipt_id !== null && typeof t.previous_receipt_id !== "string")) throw new ReceiptHistoryError("contract");
    trend = { policyVersion: t.policy_version, referenceDate: t.date, receiptRevisionId: t.receipt_id, rawPoint: t.raw_value, unroundedValue: t.value, previousAnchorRevisionId: t.previous_receipt_id };
  }
  return { revisionId: row.revisionId, policyVersion: row.policyVersion, trend };
}
/** Every public read checks present consent through the service-only manifest RPC. */
export async function dbReceiptManifestV7(owner: string, revisionId?: string): Promise<ReceiptManifestV7 | null> {
  const value = await receiptRpc("scoring_v7_receipt_manifest", { p_owner: owner.toLowerCase(), p_revision: revisionId ?? null });
  return value === null ? null : receiptManifest(value);
}
export async function dbReadReceiptV7(owner: string, revisionId?: string): Promise<import("@/lib/history/snapshot").ReceiptSnapshotV7 | null> {
  const value = await receiptRpc("scoring_v7_read_receipt", { p_owner: owner.toLowerCase(), p_revision: revisionId ?? null });
  if (value === null) return null;
  const manifest = receiptManifest(value);
  const canonical = (value as Record<string, unknown>).canonicalReceipt;
  if (typeof canonical !== "string") throw new ReceiptHistoryError("contract");
  const envelope = await sealScoreReceipt(JSON.parse(canonical));
  if (canonicalJson(envelope.receipt) !== canonical || envelope.receipt.revisionId !== manifest.revisionId) throw new ReceiptHistoryError("contract");
  return buildReceiptSnapshotV7(envelope, manifest.trend);
}
/** Reuse the exact prepared envelope on retries. Conflicting payloads never overwrite history.
 * Durable receipt + optional trend commit in one database transaction before success. */
export async function dbPublishReceiptV7(owner: string, actor: string, envelope: import("@chapa/shared").HashedScoreReceipt): Promise<{ status: "inserted" | "duplicate"; snapshot: import("@/lib/history/snapshot").ReceiptSnapshotV7 }> {
  const receipt = await verifyScoreReceipt(envelope);
  const value = await receiptRpc("scoring_v7_publish_receipt", { p_owner: owner.toLowerCase(), p_actor: actor.toLowerCase(), p_receipt: receipt, p_canonical: canonicalJson(receipt) });
  if (!value || typeof value !== "object") throw new ReceiptHistoryError("contract");
  const row = value as Record<string, unknown>;
  if ((row.status !== "inserted" && row.status !== "duplicate") || row.canonicalReceipt !== canonicalJson(receipt)) throw new ReceiptHistoryError("contract");
  const manifest = receiptManifest({ revisionId: receipt.revisionId, policyVersion: receipt.policyVersion, trend: row.trend });
  return { status: row.status, snapshot: buildReceiptSnapshotV7(await sealScoreReceipt(receipt), manifest.trend) };
}
