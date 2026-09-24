import { describe, expect, it } from "vitest";
import { OBSERVED_ALGORITHM_ARTIFACTS } from "./score-receipt-observed-artifacts";
import { SCORING_POLICY } from "./scoring-policy";

describe("SCORING_POLICY", () => {
  it("is the single rendered policy, v7.2", () => {
    expect(SCORING_POLICY).toBe("v7.2");
  });
  it("lives outside the digested v7.2 algorithm artifacts", () => {
    expect(OBSERVED_ALGORITHM_ARTIFACTS).not.toContain("packages/shared/src/scoring-policy.ts");
  });
});
