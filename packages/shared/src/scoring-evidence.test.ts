import { describe, expect, it, expectTypeOf } from "vitest";
import { SCORING_V7_RECEIPT_RULES, type SourceIdentity, type PublicCoverageSummary, type EvidenceProvider, type PublicScoringReceipt, type ReceiptAlgorithmIdentity, type ReceiptCalculationTrace, type ContentDigest, type NormalizationTrace, countBounds, observed, unknown, publicCriterionResult, scoreBounds, SCORING_V7_POLICY, type CoreScoringInputs, type PrivateCriterionAssessment } from "./scoring-evidence";

describe("v7 evidence boundaries", () => {
  it("distinguishes measured zero from unknown, partial, stale and provenance", () => {
    expect(observed(0, "complete", "source_observed")).toEqual({ status: "observed", value: 0, coverage: "complete", provenance: "source_observed" });
    expect(unknown("unavailable", "not_accessible").status).toBe("unknown");
    expect(observed(0, "partial", "self_reported").coverage).toBe("partial");
    expect(observed(0, "stale", "independently_corroborated").provenance).toBe("independently_corroborated");
  });
  it.each([[NaN, 1], [0, Infinity], [-1, 1], [2, 1], [0.5, 1], [0, Number.MAX_SAFE_INTEGER + 1]])("rejects invalid count bounds %s..%s", (lower, upper) => {
    expect(() => countBounds(lower, upper)).toThrow();
  });
  it("preserves exact ranges even if normal integer rounding coincides", () => {
    expect(scoreBounds(69.91, 69.99)).toEqual({ kind: "range", lower: 69.91, upper: 69.99, displayLower: 69, displayUpper: 70 });
    expect(scoreBounds(0, 0)).toEqual({ kind: "point", value: 0, displayValue: 0 });
    expect(() => scoreBounds(0, 101)).toThrow();
  });
  it("keeps Craft and AI diagnostics outside the fixed core input schema", () => {
    expect(Object.values(SCORING_V7_POLICY.coreWeights)).toEqual([0.25, 0.25, 0.25, 0.25]);
    expectTypeOf<Extract<keyof CoreScoringInputs, "craft" | "tool" | "aiProvenance" | "accessToken" | "accountCreatedAt">>().toEqualTypeOf<never>();
  });
  it("projects structured rubric results without private rationale, identity or artifact paths", () => {
    const assessment: PrivateCriterionAssessment = {
      revisionId: "assessment-revision", revision: 1, recordedAt: "2026-09-05T00:00:00.000Z", supersedesRevisionId: null, action: "create",
      assessmentId: "private-assessment", claimRevisionId: "private-revision", workItemId: "private-repo/item",
      criterion: "rationale", status: "accepted", rubricVersion: "v7.1", reasonCode: "criterion_demonstrated",
      evaluator: { id: "person@example.com", kind: "human", version: "1", independent: true },
      rationale: "Private contents https://private/repo", assessedAt: "2026-09-05T00:00:00.000Z", evidenceReferenceIds: ["secret/path"],
      provenance: "independently_corroborated",
    };
    const result = publicCriterionResult(assessment, "item-1");
    expect(result).toEqual({ workItemRef: "item-1", criterion: "rationale", status: "accepted", rubricVersion: "v7.1", reasonCode: "criterion_demonstrated", qualifyingCount: 1, provenance: "independently_corroborated" });
    expect(JSON.stringify(result)).not.toMatch(/private|secret|example.com/);
    expect(publicCriterionResult({ ...assessment, status: "unassessed" }, "item-1").qualifyingCount).toBe(0);
  });
});

describe("v7 durable replay contract", () => {
  it("supports manual portfolios and supplemental evidence without inventing a forge provider", () => {
    expectTypeOf<SourceIdentity["provider"]>().toEqualTypeOf<EvidenceProvider>();
    expectTypeOf<PublicCoverageSummary["provider"]>().toEqualTypeOf<EvidenceProvider>();
    const manual: SourceIdentity = { provider: "portfolio", host: "chapa-ledger", subjectId: "owner-1" };
    const supplemental: SourceIdentity = { ...manual, provider: "supplemental" };
    expect([manual.provider, supplemental.provider]).toEqual(["portfolio", "supplemental"]);
  });
  it("pins typed normalization, weight and rounding rules for offline replay", () => {
    expect(SCORING_V7_RECEIPT_RULES.normalization).toBe("ln(1+min(count,cap))/ln(1+cap)");
    expect(SCORING_V7_RECEIPT_RULES.coreWeights).toEqual(SCORING_V7_POLICY.coreWeights);
    expect(SCORING_V7_RECEIPT_RULES.qualityCriterionWeight).toBe(25);
    expect(SCORING_V7_RECEIPT_RULES.breadthComponentWeight).toBe(50);
    expect(SCORING_V7_RECEIPT_RULES.craftCriterionWeight).toBe(25);
    expect(SCORING_V7_RECEIPT_RULES.rounding).toEqual({ intermediate: "none", point: "nearest_integer_half_up", rangeLower: "floor", rangeUpper: "ceil", pointEquality: "exact", tierBasis: "unrounded", tierBoundaryDisplay: "distinguishing_decimal_or_less_than" });
    expect(Object.isFrozen(SCORING_V7_RECEIPT_RULES)).toBe(true);
    expect(Object.isFrozen(SCORING_V7_RECEIPT_RULES.rounding)).toBe(true);
    expectTypeOf<PublicScoringReceipt["algorithm"]>().toEqualTypeOf<ReceiptAlgorithmIdentity>();
    expectTypeOf<PublicScoringReceipt["calculation"]>().toEqualTypeOf<ReceiptCalculationTrace>();
  });
  it("records saturation and full-precision range endpoints without hiding rounding", () => {
    const delivery: NormalizationTrace<120, 100> = {
      input: { lower: 119, upper: 121 }, cap: 120,
      clamped: { lower: 119, upper: 120 },
      normalized: { lower: Math.log1p(119) / Math.log1p(120), upper: 1 },
      multiplier: 100,
      weighted: { lower: 100 * Math.log1p(119) / Math.log1p(120), upper: 100 },
    };
    const serialized = JSON.parse(JSON.stringify(delivery)) as NormalizationTrace<120, 100>;
    expect(serialized).toEqual(delivery);
    expect(serialized.weighted.lower).not.toBe(Math.round(serialized.weighted.lower));
    expect(scoreBounds(serialized.weighted.lower, serialized.weighted.upper).kind).toBe("range");
    expectTypeOf<{} extends Pick<PublicScoringReceipt, "algorithm" | "calculation"> ? true : false>().toEqualTypeOf<false>();
  });
  it("requires both policy and algorithm SHA-256 identities instead of relying on a mutable version label", () => {
    const identity: ReceiptAlgorithmIdentity = {
      algorithmId: "chapa-impact-v7", revision: "source-revision-1",
      algorithmDigest: { algorithm: "SHA-256", value: "a".repeat(64) },
      policyDigest: { algorithm: "SHA-256", value: "b".repeat(64) },
    };
    expect(identity.algorithmDigest).not.toEqual(identity.policyDigest);
    expectTypeOf<Pick<ReceiptAlgorithmIdentity, "algorithmDigest" | "policyDigest">>().toEqualTypeOf<{ readonly algorithmDigest: ContentDigest; readonly policyDigest: ContentDigest }>();
  });
});
