/**
 * The only scoring policy Chapa renders (#1335). Replaces the retired
 * DB-backed render-selector flag; image and cache key segments keep this
 * literal so their key format is unchanged.
 *
 * Deliberately NOT in constants.ts: that file is one of the byte-digested
 * v7.2 algorithm artifacts (score-receipt-observed-artifacts.ts), so editing
 * it would change the algorithm digest of every issued receipt.
 */
export const SCORING_POLICY = "v7.2" as const;
export type ScoringPolicy = typeof SCORING_POLICY;
