import { createHmac } from "node:crypto";
import type { StatsData, ImpactV4Result } from "@chapa/shared";

/**
 * Build a deterministic pipe-delimited payload string from badge data.
 * Same inputs on the same date always produce the same string.
 */
export function buildPayload(
  stats: StatsData,
  impact: ImpactV4Result,
  date: string,
): string {
  return [
    stats.handle.toLowerCase(),
    impact.adjustedComposite,
    impact.confidence,
    impact.tier,
    impact.archetype,
    Math.round(impact.dimensions.building),
    Math.round(impact.dimensions.guarding),
    Math.round(impact.dimensions.consistency),
    Math.round(impact.dimensions.breadth),
    stats.commitsTotal,
    stats.prsMergedCount,
    stats.reviewsSubmittedCount,
    date,
  ].join("|");
}

/**
 * Compute a truncated HMAC-SHA256 hash (8 hex chars) from a payload string.
 */
export function computeHash(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex").slice(0, 8);
}

/**
 * Generate a verification code for the given stats and impact.
 * Returns null if the CHAPA_VERIFICATION_SECRET env var is unset.
 */
export function generateVerificationCode(
  stats: StatsData,
  impact: ImpactV4Result,
): { hash: string; date: string } | null {
  const secret = process.env.CHAPA_VERIFICATION_SECRET?.trim();
  if (!secret) return null;

  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const payload = buildPayload(stats, impact, date);
  const hash = computeHash(payload, secret);

  return { hash, date };
}
