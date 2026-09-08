import "server-only";
import { sealRegisteredScoreReceipt } from "@chapa/shared";
import { getChapaVerificationSecret } from "@/lib/env";
import type { RegisteredScoreEnvelope } from "@chapa/shared";
import { signReceiptV7 } from "./hmac";

/**
 * The verification token for an issued receipt, derived rather than stored.
 *
 * `signReceiptV7` is an HMAC over the receipt's canonical JSON, so the token is
 * a deterministic function of the revision and the signing key: recomputing it
 * at render costs one hash and no I/O, and it cannot drift from the artifact
 * the way a separately persisted copy could.
 *
 * Returns `null` when no signing key is configured, which is the same answer
 * the v6 path gives — a badge without an attestation, rather than an
 * attestation nobody can check.
 */
export async function deriveReceiptVerificationTokenV7(
  snapshot: { readonly receipt: RegisteredScoreEnvelope },
): Promise<string | null> {
  const secret = getChapaVerificationSecret();
  if (!secret) return null;
  try {
    return await signReceiptV7(await sealRegisteredScoreReceipt(snapshot.receipt.receipt), secret);
  } catch {
    // A receipt that will not re-seal cannot be attested. The badge renders
    // without a strip rather than carrying a token that resolves to nothing.
    return null;
  }
}
