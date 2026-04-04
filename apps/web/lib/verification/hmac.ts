import { createHmac } from "node:crypto";
import type { StatsData, ImpactV6Result } from "@chapa/shared";
import { toDateString } from "@/lib/utils/date";

/**
 * Build a deterministic pipe-delimited payload string from badge data.
 * Same inputs on the same date always produce the same string.
 */
export function buildPayload(
  stats: StatsData,
  impact: ImpactV6Result,
  date: string,
): string {
  return [
    stats.handle.toLowerCase(),
    impact.adjustedComposite,
    impact.confidence,
    impact.tier,
    impact.archetype,
    Math.round(impact.dimensions.delivery),
    Math.round(impact.dimensions.quality),
    Math.round(impact.dimensions.consistency),
    Math.round(impact.dimensions.breadth),
    stats.commitsTotal,
    stats.prsMergedCount,
    stats.reviewsSubmittedCount,
    date,
  ].join("|");
}

/**
 * Compute a truncated HMAC-SHA256 hash (32 hex chars / 128 bits) from a payload string.
 */
export function computeHash(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex").slice(0, 32);
}

/**
 * Generate a verification code for the given stats and impact.
 * Returns null if the CHAPA_VERIFICATION_SECRET env var is unset.
 */
export function generateVerificationCode(
  stats: StatsData,
  impact: ImpactV6Result,
): { hash: string; date: string } | null {
  const secret = process.env.CHAPA_VERIFICATION_SECRET?.trim();
  if (!secret) return null;

  const date = toDateString(new Date());
  const payload = buildPayload(stats, impact, date);
  const hash = computeHash(payload, secret);

  return { hash, date };
}
