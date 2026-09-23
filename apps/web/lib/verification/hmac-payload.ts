import { createHmac } from "node:crypto";
import type { StatsData, ImpactV6Result } from "@chapa/shared";
import { CURRENT_VERIFICATION_HASH_HEX_LENGTH } from "./constants";

/**
 * Pure companions to `lib/verification/hmac.ts`, split out deliberately
 * without an `import "server-only"` guard.
 *
 * `hmac.ts` begins with `import "server-only"`, so importing any of its
 * exports — even the pure payload/hash functions — throws immediately
 * outside a Server Component (confirmed the same way as
 * `lib/cache/stats-cache-envelope.ts`, which documents the identical
 * problem for the stats cache). A disposable e2e/qualification fixture that
 * needs to pre-seed a `verification_records` row matching exactly what a
 * live render will independently derive — so a cold, read-only smoke probe
 * doesn't depend on some other spec having already performed a
 * non-read-only render first — must build the identical payload string and
 * hash `hmac.ts` would produce, not a hand-duplicated approximation of it.
 */

export const VERIFICATION_PAYLOAD_VERSION = "v2";

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
    VERIFICATION_PAYLOAD_VERSION,
    stats.handle.toLowerCase(),
    impact.adjustedComposite,
    impact.confidence,
    impact.tier,
    impact.archetype,
    Math.round(impact.dimensions.delivery),
    Math.round(impact.dimensions.quality),
    Math.round(impact.dimensions.consistency),
    Math.round(impact.dimensions.breadth),
    Math.round(impact.dimensions.craft ?? 0),
    stats.commitsTotal,
    stats.prsMergedCount,
    stats.reviewsSubmittedCount,
    stats.activeDays,
    stats.reposContributed,
    date,
  ].join("|");
}

/**
 * Compute a truncated HMAC-SHA256 hash (32 hex chars / 128 bits by default)
 * from a payload string.
 */
export function computeHash(
  payload: string,
  secret: string,
  hexLength: number = CURRENT_VERIFICATION_HASH_HEX_LENGTH,
): string {
  return createHmac("sha256", secret).update(payload).digest("hex").slice(0, hexLength);
}
