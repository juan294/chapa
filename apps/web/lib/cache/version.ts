// Bump when scoring, cached payload shape, or rendered badge output changes.
export const CACHE_VERSION = "v2";

/**
 * The v7 cache namespace, kept separate from `CACHE_VERSION` on purpose.
 *
 * v6 and v7 entries must never share a key. During the transition both are
 * live: a request that reads a v6 entry gets v6 math and a v6 label, and a
 * request that reads a v7 entry gets v7 math and a v7 label. One shared
 * namespace would let a mixed deployment serve a v7 label over a v6 payload,
 * which is the single failure this split exists to make impossible.
 *
 * Rollback is therefore additive and non-destructive: reverting the read
 * selection leaves every v7 entry in place, and no v7 receipt is deleted.
 */
export const SCORING_V7_CACHE_VERSION = "v7";

/** `true` when this key belongs to the v7 namespace. Used by the transition
 * tooling to count and clear v7 entries without touching v6 ones. */
export function isScoringV7CacheKey(key: string): boolean {
  return /^[a-z-]+:v7:/.test(key);
}
