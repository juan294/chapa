import {
  dbGetVerification,
  dbStoreVerification,
} from "@/lib/db/verification";
import type { VerificationRecord } from "./types";

/**
 * Store a verification record in Supabase.
 * Fail-open: silently no-ops if the store is unavailable.
 */
export async function storeVerificationRecord(
  hash: string,
  record: VerificationRecord,
): Promise<void> {
  try {
    await dbStoreVerification(hash, record);
  } catch {
    // Fail open — verification storage is non-critical
  }
}

/**
 * Retrieve a verification record by hash.
 * Returns null on miss or if DB is unavailable.
 */
export async function getVerificationRecord(
  hash: string,
): Promise<VerificationRecord | null> {
  try {
    return await dbGetVerification(hash);
  } catch {
    return null;
  }
}

// V7 receipts have durable immutable issuance; legacy fail-open semantics above do not apply.
import { canonicalJson, sealScoreReceipt, verifyScoreReceipt } from "@chapa/shared";
import { dbVerificationRpcV7 } from "@/lib/db/verification";
import { getChapaVerificationSecret } from "@/lib/env";
import { authenticateReceiptV7, signReceiptV7 } from "./hmac";
import { parseVerificationTokenV7, VERIFICATION_V7_KEY_VERSION } from "./constants";
import type { ReceiptVerificationV7 } from "./types";

export async function issueReceiptVerificationV7(owner: string, actor: string, envelope: unknown): Promise<string> {
  const receipt = await verifyScoreReceipt(envelope);
  const detached = await sealScoreReceipt(receipt);
  const secret = getChapaVerificationSecret();
  if (!secret) throw new Error("Receipt signing key unavailable");
  const token = await signReceiptV7(detached, secret);
  const parsed = parseVerificationTokenV7(token)!;
  await dbVerificationRpcV7("scoring_v7_issue_verification", {
    p_owner: owner, p_actor: actor, p_revision: receipt.revisionId,
    p_key_version: VERIFICATION_V7_KEY_VERSION, p_signature: parsed.signature,
    p_canonical: canonicalJson(receipt),
  });
  // Publication may have been withdrawn while the issuance request was in flight.
  const current = await getReceiptVerificationV7(token);
  if (!current || current.status === "revoked") throw new Error("Receipt issuance unavailable");
  return token;
}

export async function getReceiptVerificationV7(token: string): Promise<ReceiptVerificationV7 | null> {
  const parsed = parseVerificationTokenV7(token);
  if (!parsed) return null;
  const args = { p_revision: parsed.revisionId, p_signature: parsed.signature };
  const read = () => dbVerificationRpcV7("scoring_v7_read_verification", args);
  const raw = await read();
  if (raw === null) return null;
  const revoked = (): ReceiptVerificationV7 => ({ version: "v7", status: "revoked", revisionId: parsed.revisionId, signatureAuthenticated: false });
  if (typeof raw !== "object" || !raw || !("status" in raw)) throw new Error("Invalid receipt verification record");
  if (raw.status === "revoked") return revoked();
  if (!("canonical" in raw) || typeof raw.canonical !== "string" || !("keyVersion" in raw) || typeof raw.keyVersion !== "string" || !["current", "superseded", "retracted"].includes(String(raw.status))) throw new Error("Invalid receipt verification record");
  const envelope = await sealScoreReceipt(JSON.parse(raw.canonical));
  if (canonicalJson(envelope.receipt) !== raw.canonical || envelope.receipt.revisionId !== parsed.revisionId) throw new Error("Invalid receipt verification record");
  const secret = raw.keyVersion === VERIFICATION_V7_KEY_VERSION ? getChapaVerificationSecret() : null;
  const signatureAuthenticated = await authenticateReceiptV7(token, envelope, secret ?? null);
  const final = await read();
  if (final === null) return null;
  if (typeof final === "object" && final && "status" in final && final.status === "revoked") return revoked();
  // Fail closed on changed authority or inconsistent storage; do not return the first read.
  if (canonicalJson(final) !== canonicalJson(raw)) throw new Error("Receipt verification changed during read");
  return Object.freeze({ version: "v7", status: raw.status as "current" | "superseded" | "retracted", revisionId: parsed.revisionId, issuanceRecorded: true, signatureAuthenticated, keyVersion: raw.keyVersion, arithmetic: "offline_replay_available", sourceEvidence: "not_verified", envelope });
}
