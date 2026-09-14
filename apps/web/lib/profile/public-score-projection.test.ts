import { expect, it } from "vitest";
import { scoringConsistencyFixture } from "./__fixtures__/scoring-consistency";
import { legacyViewModel } from "./score-view-model";
import { publicScoreProjection, comparePublicScores } from "./public-score-projection";
it.each([57, 0] as const)("projects canonical current values and Craft%s without legacy traps", async craft => {
  const f = await scoringConsistencyFixture({ craft });
  const result = publicScoreProjection(f.model, 83);
  expect(result).toMatchObject({ policyVersion: "v7.2", displayScore: 46, archetype: null, dimensions: { craft }, identity: f.model.identity });
  expect(result.exactScore).toBe(f.envelope.receipt.core.composite.exact);
  expect(result.dimensions.delivery).toBe(f.model.dimensions.delivery.kind === "point" ? f.model.dimensions.delivery.display : null);
  expect(result.exactDimensions.delivery).toBe(f.envelope.receipt.core.dimensions.delivery.exact);
  expect(JSON.stringify(result)).not.toContain('"Builder"');
});
it("keeps absent and expired Craft nonnumeric and uses canonical boundary display", async () => {
  for (const craft of ["none", "expired"] as const) {
    const f = await scoringConsistencyFixture({ craft, boundary: true });
    const result = publicScoreProjection(f.model, 83);
    expect(result.dimensions.craft).toBeUndefined();
    expect(result.displayScore).toBe(f.envelope.receipt.core.composite.displayValue);
    expect(result.displayScore).toBe(69.99);
    expect(result.exactScore).toBeGreaterThan(69.9);
  }
});
it("compares only compatible policies and observation periods, preserving both contexts", async () => {
  const f = await scoringConsistencyFixture({ craft: 57 });
  const a = publicScoreProjection(f.model);
  expect(comparePublicScores(a, a)).toMatchObject({ status: "comparable", differences: { score: 0, dimensions: { craft: 0 } } });
  const legacy = publicScoreProjection(legacyViewModel(f.impact), 83);
  expect(legacy.dimensions.craft).toBe(83);
  expect(comparePublicScores(a, legacy)).toMatchObject({ status: "not_comparable", reason: "policy_mismatch", differences: null });
  const next = publicScoreProjection({ ...f.model, window: { ...f.model.window!, referenceDate: "2026-09-09" } });
  expect(comparePublicScores(a, next)).toMatchObject({ status: "not_comparable", reason: "period_mismatch", differences: null });
});
it("keeps core comparable while refusing Craft deltas across report periods", async () => {
  const f = await scoringConsistencyFixture({ craft: 57 });
  const a = publicScoreProjection(f.model);
  if (f.model.reportCraft?.status !== "scored") throw new Error("Expected scored report");
  const craft = f.model.reportCraft;
  const b = publicScoreProjection({ ...f.model, reportCraft: { ...craft, report: { ...craft.report,
    inputs: { ...craft.report.inputs, reportPeriod: { ...craft.report.inputs.reportPeriod, startInclusive: "2026-09-02T00:00:00.000Z" } } } } });
  const comparison = comparePublicScores(a, b);
  expect(comparison).toMatchObject({ status: "comparable", craftComparison: { status: "not_comparable", reason: "period_mismatch" }, differences: { score: 0 } });
  expect(comparison.differences?.dimensions.craft).toBeUndefined();
});
