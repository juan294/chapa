import "server-only";
import { deriveReceiptVerificationTokenV7 } from "@/lib/verification/receipt-token";
import { readRenderableReceipt } from "./score-model";
import { getPublicProfileVerification, type PublicVerificationCode } from "./public-profile";
import type { MaterializedProfile } from "./materialize-profile";

type VerifiableProfile = Pick<MaterializedProfile, "stats" | "displayImpact" | "statsComplete"> & {
  scoring?: MaterializedProfile["scoring"];
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
  if (materialized.scoring?.policyVersion !== "v7") {
    return getPublicProfileVerification(materialized);
  }
  const snapshot = await readRenderableReceipt(materialized.stats.handle);
  if (!snapshot) return null;
  const hash = await deriveReceiptVerificationTokenV7(snapshot);
  return hash ? { hash, date: snapshot.receipt.receipt.window.referenceDate } : null;
}
