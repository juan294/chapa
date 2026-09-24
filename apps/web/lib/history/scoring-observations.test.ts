import { describe, expect, it } from "vitest";
import { scoringConsistencyFixture } from "@/lib/profile/__fixtures__/scoring-consistency";
import { scoringObservation, compareScoringObservations, buildScoringHistory } from "./scoring-observations";

describe("policy-segmented scoring observations", () => {
  it("preserves canonical decimal, exact identity and measured Craft zero", async () => {
    const { model } = await scoringConsistencyFixture({ craft: 0, boundary: true });
    const observation = scoringObservation(model)!;
    expect(observation.composite).toEqual({ exact: model.composite.kind === "point" ? model.composite.value : 0, display: 69.99 });
    expect(observation.craft?.display).toBe(0);
    expect(observation.identity).toEqual(model.identity);
    expect(JSON.stringify(observation)).not.toContain("confidence");
  });
  it("never calls a policy transition or changed annual window an improvement", async () => {
    const fixture = await scoringConsistencyFixture();
    const current = scoringObservation(fixture.model)!;
    const otherPolicy = scoringObservation({ ...fixture.model, policyVersion: "v7" })!;
    expect(compareScoringObservations(otherPolicy, current)).toMatchObject({ status: "not_comparable", reason: "policy_mismatch" });
    expect(compareScoringObservations(current, { ...current, window: { ...current.window!, referenceDate: "2026-09-09" } })).toMatchObject({ status: "not_comparable", reason: "window_mismatch" });
    expect(compareScoringObservations(current, { ...current, window: { ...current.window!, referenceTime: "2026-09-08T15:00:00.000Z" } })).toMatchObject({ status: "comparable", composite: { exact: 0, display: 0 } });
  });
  it("preserves stored policy EMA instead of reseeding a filtered slice", async () => {
    const { model } = await scoringConsistencyFixture();
    const trend = { policyVersion: "v7.2" as const, referenceDate: model.window!.referenceDate, receiptRevisionId: model.identity!.revisionId, rawPoint: 46, unroundedValue: 61.25, previousAnchorRevisionId: "previous" };
    expect(buildScoringHistory([{ model, trend }]).trend).toEqual([trend]);
    expect(scoringObservation({ ...model, freshness: "unavailable" })).toBeNull();
    expect(scoringObservation({ ...model, illustrative: true })).toBeNull();
  });
});

it("allows a significant same-window current revision and suppresses changed-window claims", async () => {
  const { isSignificantScoringChange } = await import("./significant-change");
  const { model } = await scoringConsistencyFixture();
  const previous = scoringObservation(model)!;
  const current = { ...previous, composite: { exact: 60, display: 60 } };
  expect(isSignificantScoringChange(compareScoringObservations(previous, current))).toMatchObject({ significant: true, reason: "score_bump" });
  expect(isSignificantScoringChange(compareScoringObservations(previous, { ...current, policyVersion: "v7" }))).toEqual({ significant: false });
});
