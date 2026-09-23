import "server-only";
import { createHmac } from "node:crypto";
import { canonicalJson, verifyRegisteredScoreReceipt } from "@chapa/shared";
import { safeEqual } from "@/lib/crypto/safe-equal";
import { parseVerificationTokenV7 } from "./constants";

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
