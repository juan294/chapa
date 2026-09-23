import { expect, it } from "vitest";
import { simulateObservedScore } from "./simulate";
import { scoringConsistencyFixture } from "@/lib/profile/__fixtures__/scoring-consistency";
it("keeps a current dimension scenario hypothetical with four weights and separate Craft", async () => {
  const f = await scoringConsistencyFixture({ craft: 57 });
  const baseline = simulateObservedScore(f.model, { dimensions: {} });
  const craft = simulateObservedScore(f.model, { dimensions: { craft: 0 } });
  expect(baseline).toMatchObject({ hypothetical: true, policyVersion: "v7.2", scope: "dimension_scenario", baselineRevision: f.model.identity!.revisionId, displayScore: 46, deltaVsCurrent: 0 });
  expect(craft.exactScore).toBe(baseline.exactScore);
  expect(craft.dimensions.craft).toBe(0);
  expect(simulateObservedScore(f.model, { dimensions: { delivery: 100, quality: 0, consistency: 0, breadth: 0 } })).toMatchObject({ exactScore: 25, displayScore: 25 });
});
it("replays real current count inputs and rejects missing or mismatched baselines", async () => {
  const f = await scoringConsistencyFixture({ craft: 0 });
  const model = { ...f.model, observedInputs: f.envelope.receipt.inputs };
  expect(simulateObservedScore(model, { counts: {} })).toMatchObject({ scope: "evidence_counts", displayScore: 46, deltaVsCurrent: 0, inputs: f.envelope.receipt.inputs });
  expect(simulateObservedScore(model, { counts: { deliveryUnits: { lower: 0, upper: 0 } } }).exactScore).toBeLessThan(f.envelope.receipt.core.composite.exact);
  expect(() => simulateObservedScore({ ...model, observedInputs: undefined }, { counts: {} })).toThrow(/baseline/i);
  expect(() => simulateObservedScore({ ...model, window: { ...model.window!, referenceDate: "2026-09-09" } }, { counts: {} })).toThrow(/context/i);
  expect(() => simulateObservedScore(model, { dimensions: { craft: Number.NaN } })).toThrow();
});
