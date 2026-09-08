import "server-only";
import { deriveReceiptVerificationTokenV7 } from "@/lib/verification/receipt-token";
import { readScoreReceiptV7 } from "./score-receipt-v7";
import { readObservedScoreReceipt } from "./score-receipt-observed";
import { getReceiptVerificationV7 } from "@/lib/verification/store";
import { getPublicProfileVerification, type PublicVerificationCode } from "./public-profile";
import type { MaterializedProfile } from "./materialize-profile";

type VerifiableProfile = Pick<MaterializedProfile, "stats" | "displayImpact" | "statsComplete"> & {
  scoring?: Omit<NonNullable<MaterializedProfile["scoring"]>, "policyVersion"> & { policyVersion: "v6" | "v7" | "v7.2" };
};

/**
 * The attestation that belongs on the badge being rendered.
 *
 * One accessor rather than a policy check at each render site: the badge, the
 * OG image, the share page and the warm-cache pre-render must agree about
 * which artifact the verification link resolves to, for the same reason they
 * agree about the number above it.
 */
export async function resolveBadgeVerification(
  materialized: VerifiableProfile,
): Promise<PublicVerificationCode | null> {
  if (!materialized.scoring || materialized.scoring.policyVersion === "v6") {
    return getPublicProfileVerification({
      ...materialized,
      scoring: materialized.scoring ? { ...materialized.scoring, policyVersion: "v6" } : undefined,
    });
  }
  const identity = materialized.scoring.identity;
  if (!identity) return null;
  try {
    // A later refresh may already have published B. This badge still displays
    // A, so only A's immutable recorded issuance can attest it.
    const current = materialized.scoring.policyVersion === "v7.2"
      ? await readObservedScoreReceipt(materialized.stats.handle, identity.revisionId) : null;
    const snapshot = current
      ? current.status === "found" ? { receipt: current.envelope } : null
      : await readScoreReceiptV7(materialized.stats.handle, identity.revisionId);
    if (!snapshot) return null;
    const receipt = snapshot.receipt.receipt;
    if (receipt.policyVersion !== materialized.scoring.policyVersion
      || receipt.receiptId !== identity.receiptId
      || receipt.revisionId !== identity.revisionId
      || receipt.revision !== identity.revision
      || snapshot.receipt.contentHash.value !== identity.contentHash) return null;
    const hash = await deriveReceiptVerificationTokenV7(snapshot);
    if (!hash) return null;
    const verification = await getReceiptVerificationV7(hash);
    if (!verification || verification.status === "revoked" || verification.status === "retracted"
      || !verification.issuanceRecorded || !verification.signatureAuthenticated
      || verification.revisionId !== identity.revisionId
      || verification.envelope.contentHash.value !== identity.contentHash) return null;
    return { hash, date: receipt.window.referenceDate };
  } catch {
    return null;
  }
}
