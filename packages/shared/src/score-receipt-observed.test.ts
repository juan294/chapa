/// <reference types="node" />
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { canonicalSha256 } from "./canonical-json";
import { parsePublicScoreReceipt } from "./score-receipt";
import { parseObservedScoreReceipt, sealObservedScoreReceipt, verifyObservedScoreReceipt, type PublicObservedCraft, type PublicObservedScoringReceipt, type PublicScoredReportCalculation } from "./score-receipt-observed";
import { verifyRegisteredScoreReceipt, parseRegisteredScoreReceipt } from "./score-receipt-registry";
import { OBSERVED_ALGORITHM_ARTIFACTS, OBSERVED_POLICY_ARTIFACT, RECEIPT_ALGORITHM_OBSERVED } from "./score-receipt-observed-artifacts";
import { observedReceiptFixture } from "../../../apps/web/lib/history/__fixtures__/receipts-observed";
import { calculateReportCraftInputs } from "../../../apps/web/lib/insights/report-craft";
import { createScoringWindow } from "./scoring-window";

async function report(failed = false): Promise<PublicScoredReportCalculation> {
  const window = createScoringWindow("2026-09-07T17:20:02.164Z");
  const inputs = { policyVersion: "v7.2", classifierRevision: "cc-outcomes-v7.2", window, reportPeriod: { startInclusive: "2026-08-01T00:00:00.000Z", endExclusive: "2026-09-01T00:00:00.000Z" }, totalSessions: 10, outcomes: failed ? { fully_achieved: 0, mostly_achieved: 0, partially_achieved: 0, not_achieved: 10 } : { fully_achieved: 4, mostly_achieved: 2, partially_achieved: 1, not_achieved: 1 }, unknownSessions: failed ? 0 : 1, unclassifiedSessions: failed ? 0 : 1 };
  const result = calculateReportCraftInputs(inputs);
  if (result.status !== "valid" || result.result.status !== "scored") throw new Error("Fixture report failed");
  return { reportRef: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", supersedesReportRef: null, inputs: result.inputs, result: result.result };
}
async function reject(value: unknown) {
  expect(() => parseObservedScoreReceipt(value)).toThrow();
  await expect(sealObservedScoreReceipt(value)).rejects.toThrow();
  await expect(verifyObservedScoreReceipt({ receipt: value, contentHash: { algorithm: "SHA-256", value: await canonicalSha256(value) } })).rejects.toThrow();
}
describe("strict registered v7.2 receipt", () => {
  it("retains historical envelope identity and historical narrow APIs", async () => {
    const archived = JSON.parse(readFileSync("docs/plans/2026-09-07-local-e2e-verification-phases/evidence/phase6/receipt-envelope.json", "utf8"));
    const old = await verifyRegisteredScoreReceipt(archived);
    expect(old.policyVersion).toBe("v7");
    expect(old.core.composite).toMatchObject({ kind: "range", displayLower: 46, displayUpper: 100 });
    const current = await observedReceiptFixture();
    expect(() => parsePublicScoreReceipt(current.receipt)).toThrow();
    expect(parseRegisteredScoreReceipt(current.receipt).policyVersion).toBe("v7.2");
    expect(current.receipt.core.composite).toEqual({ kind: "point", exact: 46.40250879691149, displayValue: 46, displayLabel: "46" });
  });
  it("binds actual ordered dependency bytes and policy bytes", () => {
    const hash = createHash("sha256");
    OBSERVED_ALGORITHM_ARTIFACTS.forEach(path => hash.update(readFileSync(path)));
    expect(hash.digest("hex")).toBe(RECEIPT_ALGORITHM_OBSERVED.algorithmDigest.value);
    expect(createHash("sha256").update(readFileSync(OBSERVED_POLICY_ARTIFACT)).digest("hex")).toBe(RECEIPT_ALGORITHM_OBSERVED.policyDigest.value);
  });
  it("rejects unknown pair, digests, current ranges and private/extra fields at each boundary", async () => {
    const original = (await observedReceiptFixture({ craft: { status: "scored", unlocked: true, report: await report() } })).receipt;
    const selected = (value: PublicObservedScoringReceipt) => (value.craft as Extract<PublicObservedCraft, { status: "scored" }>).report;
    const changes: ((value: PublicObservedScoringReceipt) => void)[] = [
      value => { Object.assign(value, { policyVersion: "v8" }); }, value => { Object.assign(value.algorithm, { revision: "v7.1" }); }, value => { Object.assign(value.algorithm.algorithmDigest, { value: "0".repeat(64) }); },
      value => { Object.assign(value, { privateUrl: "https://private.invalid" }); }, value => { Object.assign(value.inputs, { rawReport: "private" }); }, value => { Object.assign(selected(value).inputs.outcomes, { secret: 1 }); },
      value => { Object.assign(selected(value), { rawDigest: "a".repeat(64) }); }, value => { Object.assign(value.core, { composite: { kind: "range", lower: 46, upper: 100, displayLower: 46, displayUpper: 100 } }); },
      value => { Object.assign(value.core.composite, { displayLabel: "46–100" }); }, value => { Object.assign(value.core.composite, { displayValue: 47 }); }, value => { Object.assign(value.calculation.core.delivery, { observedCount: 64 }); },
      value => { Object.assign(value.calculation.core.delivery, { normalized: value.calculation.core.delivery.normalized + 1e-5 }); }, value => { Object.assign(selected(value).result.trace, { creditedSessions: 9 }); }, value => { Object.assign(selected(value).inputs, { unclassifiedSessions: 2 }); },
      value => { Object.assign(selected(value).inputs, { unknownSessions: Number.MAX_SAFE_INTEGER }); }, value => { Object.assign(selected(value).result, { provenance: "human_assessed" }); },
    ];
    for (const change of changes) { const copy = structuredClone(original); change(copy); await reject(copy); }
  });
  it("detaches and recursively freezes without tolerating changed presentation", async () => {
    const original = (await observedReceiptFixture()).receipt;
    const candidate = structuredClone(original);
    const sealed = await sealObservedScoreReceipt(candidate);
    expect(Object.isFrozen(sealed.receipt.calculation.core.delivery.originalBounds)).toBe(true);
    Object.assign(candidate.core.composite, { exact: 1 });
    expect(sealed.receipt.core.composite.exact).toBe(46.40250879691149);
    const changed = structuredClone(original);
    Object.assign(changed.core.composite, { displayValue: 46 + 5e-11 });
    await reject(changed);
  });
  it("replays scored57/scored0 and expired Craft from retained original canonical inputs", async () => {
    for (const failed of [false, true]) {
      const selected = await report(failed);
      const craft: PublicObservedCraft = { status: "scored", unlocked: true, report: selected };
      const current = await observedReceiptFixture({ craft });
      expect(current.receipt.craft).toEqual(craft);
      expect(selected.result.point.exact).toBe(failed ? 0 : 57);
      const expired = await observedReceiptFixture({ referenceTime: "2027-09-07T17:20:02.164Z", craft: { status: "expired", unlocked: true, report: null, lastReport: selected } });
      await expect(verifyObservedScoreReceipt(expired)).resolves.toEqual(expired.receipt);
      const invalid = structuredClone(expired.receipt);
      Object.assign(invalid, { window: current.receipt.window, inputs: current.receipt.inputs, recordedAt: current.receipt.recordedAt });
      await reject(invalid);
    }
  });
  it("retains insufficient outcomes without inventing numeric Craft", async () => {
    const selected = await report();
    const calculation = calculateReportCraftInputs({ ...selected.inputs, outcomes: { fully_achieved: 0, mostly_achieved: 0, partially_achieved: 0, not_achieved: 0 }, unknownSessions: 0, unclassifiedSessions: 10 });
    if (calculation.status !== "valid" || calculation.result.status !== "insufficient_report_data") throw new Error("Fixture failed");
    const sealed = await observedReceiptFixture({ craft: { status: "insufficient_report_data", unlocked: false, report: { inputs: calculation.inputs, result: calculation.result } } });
    expect(sealed.receipt.craft.status).toBe("insufficient_report_data");
  });
  it("keeps unavailable publication state distinct from invented points and lost unlock", async () => {
    const lastReport = await report();
    for (const craft of [
      { status: "unavailable", unlocked: false, report: null, lastReport: null, reason: "publication_pending" },
      { status: "unavailable", unlocked: true, report: null, lastReport, reason: "source_error" },
      { status: "unavailable", unlocked: true, report: null, lastReport, reason: "outside_window" },
    ] as const) {
      const envelope = await observedReceiptFixture({ craft });
      expect(envelope.receipt.craft).toEqual(craft);
    }
    const envelope = await observedReceiptFixture();
    await reject({ ...envelope.receipt, craft: { status: "unavailable", unlocked: false, report: null, lastReport, reason: "source_error" } });
  });
  it("validates context, coverage and criterion privacy invariants", async () => {
    const original = (await observedReceiptFixture()).receipt;
    const baseCriterion = { workItemRef: "work-1", criterion: "rationale", status: "accepted", rubricVersion: "v7", reasonCode: "criterion_demonstrated", qualifyingCount: 1, provenance: "human_assessed" };
    for (const criteria of [[baseCriterion, baseCriterion], [{ ...baseCriterion, provenance: "self_reported" }], [{ ...baseCriterion, criterion: "framing" }]]) await reject({ ...original, criteria });
    await reject({ ...original, inputs: { ...original.inputs, window: createScoringWindow("2026-09-08T12:00:00Z") } });
    await reject({ ...original, coverage: [{ sourceRef: "source-1", provider: "github", status: "complete", dataThrough: "2026-09-08T00:00:00.000Z", discovery: "explicit_repositories", accessibleRepositoryCount: 0, repositoryDiscoveryComplete: true, reasonCodes: [], unknownPeriods: [] }] });
  });
});
