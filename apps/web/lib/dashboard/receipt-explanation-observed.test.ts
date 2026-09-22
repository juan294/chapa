import { expect, it } from "vitest";
import { scoringConsistencyFixture } from "@/lib/profile/__fixtures__/scoring-consistency";
import { explainObservedReceipt } from "./receipt-explanation";
it("copies exact observed trace and canonical core46 while report57 contributes nothing to the four core weights", async () => {
  const f = await scoringConsistencyFixture({ craft: 57 });
  const explanation = explainObservedReceipt({ receipt: f.envelope, trend: null }, Date.parse(f.envelope.receipt.window.referenceTime));
  expect(explanation.policyVersion).toBe("v7.2");
  expect(explanation.displayedComposite).toMatchObject({ kind: "point", display: 46 });
  expect(explanation.composite).toEqual({ lower: f.envelope.receipt.calculation.core.composite, upper: f.envelope.receipt.calculation.core.composite });
  expect(explanation.dimensions).toHaveLength(4);
  expect(explanation.dimensions.reduce((sum, row) => sum + row.contribution.lower, 0)).toBe(f.envelope.receipt.calculation.core.composite);
  expect(explanation.dimensions.find(row => row.key === "quality")!.steps.every(row => row.step.observed.lower === 0)).toBe(true);
  expect(explanation.archetype).toBeNull();
  expect(explanation.reportCraft).toMatchObject({ status: "scored", report: { result: { point: { exact: 57 } } } });
});
