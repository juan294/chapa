import "server-only";
import { createHmac } from "node:crypto";
import { canonicalJson, verifyRegisteredScoreReceipt, type StatsData, type ImpactV6Result } from "@chapa/shared";
import { safeEqual } from "@/lib/crypto/safe-equal";
import { parseVerificationTokenV7 } from "./constants";
import { toDateString } from "@/lib/utils/date";
import { getChapaVerificationSecret, getVercelEnv } from "@/lib/env";
import { buildPayload, computeHash } from "./hmac-payload";

// `buildPayload`/`computeHash` are pure and live in `./hmac-payload` (no
// `import "server-only"`) so a disposable fixture can import them directly;
// re-exported here unchanged so every existing caller of this module keeps
// working.
export { buildPayload, computeHash } from "./hmac-payload";

/**
 * Generate a verification code for the given stats and impact.
 * Returns null if the CHAPA_VERIFICATION_SECRET env var is unset.
 */
export function generateVerificationCode(
  stats: StatsData,
  impact: ImpactV6Result,
): { hash: string; date: string } | null {
  const secret = getChapaVerificationSecret();
  if (!secret) {
    if (getVercelEnv() === "production") {
      throw new Error("CHAPA_VERIFICATION_SECRET is required in production");
    }
    console.warn(
      "[verify] CHAPA_VERIFICATION_SECRET unset - verification disabled (non-production)",
    );
    return null;
  }

  const date = toDateString(new Date());
  const payload = buildPayload(stats, impact, date);
  const hash = computeHash(payload, secret);

  return { hash, date };
}

/** No clock or selected-field projection: authenticate the complete immutable receipt. */
export async function signReceiptV7(envelope: unknown, secret: string): Promise<string> {
  if (!secret) throw new Error("Receipt signing key unavailable");
  const receipt = await verifyRegisteredScoreReceipt(envelope);
  const signature = createHmac("sha256", secret).update(canonicalJson(receipt), "utf8").digest("hex");
  return `v7.${receipt.revisionId}.${signature}`;
}

export async function authenticateReceiptV7(token: string, envelope: unknown, secret: string | null): Promise<boolean> {
  if (!secret || !parseVerificationTokenV7(token)) return false;
  try { return safeEqual(token, await signReceiptV7(envelope, secret)); } catch { return false; }
}
