/** Exact ordered UTF-8 source concatenation, without separators. Identity module excluded to avoid self-reference. */
export const OBSERVED_ALGORITHM_ARTIFACTS = [
  "apps/web/lib/impact/observed-v7.ts",
  "apps/web/lib/impact/v7.ts",
  "apps/web/lib/impact/v7-evidence.ts",
  "apps/web/lib/insights/report-craft.ts",
  "apps/web/lib/insights/report-craft-selection.ts",
  "packages/shared/src/scoring-observed.ts",
  "packages/shared/src/scoring-evidence.ts",
  "packages/shared/src/scoring-aggregation-v7.ts",
  "packages/shared/src/scoring-window.ts",
  "packages/shared/src/stats-schema.ts",
  "packages/shared/src/stats-aggregation.ts",
  "packages/shared/src/constants.ts",
  "packages/shared/src/canonical-json.ts",
  "packages/shared/src/score-receipt-observed.ts"
] as const;
export const OBSERVED_POLICY_ARTIFACT = "docs/plans/2026-09-08-v7-single-score-consistency-phases/policy.md";
export const RECEIPT_ALGORITHM_OBSERVED = Object.freeze({ algorithmId: "chapa-impact-v7" as const, revision: "v7.2" as const, algorithmDigest: Object.freeze({ algorithm: "SHA-256" as const, value: "03a29d65a690676b9a6b25993a07869c96b37d67cd7a759b0359f364b20d2b0d" }), policyDigest: Object.freeze({ algorithm: "SHA-256" as const, value: "e17a55d83c99256b4e490edef995c1f117d771380ee79159a469a2b16579fd50" }) });
