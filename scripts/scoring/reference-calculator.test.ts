import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createScoringWindow, SCORING_V7_RECEIPT_RULES, RECEIPT_ALGORITHM_V7, sealScoreReceipt, verifyScoreReceipt, parsePublicScoreReceipt, canonicalSha256, projectReceiptEvidence, type CoreScoringInputs, type CraftScoringInputs, type PublicScoringReceipt, type PublicCriterionResult, type PublicCoverageSummary, type PrivateCriterionAssessment } from "@chapa/shared";
import { calculateCoreV7 } from "../../apps/web/lib/impact/v7";
import { calculateCraftV7 } from "../../apps/web/lib/insights/craft-v7";
import { referenceCalculate, replayReceipt, assertReferenceParity } from "./reference-calculator";
const window = createScoringWindow("2026-09-05T12:00:00Z");
const bound = (lower: number, upper = lower) => ({ lower, upper });
function inputs(n = 0): CoreScoringInputs {
  return { policyVersion: "v7", window, counts: { deliveryUnits: bound(n), quality: { rationale: bound(n), verification: bound(n), review_or_correction: bound(n), outcome_followup: bound(n) }, activeIsoWeeks: bound(Math.min(n, 40)), eligibleProjects: bound(n), eligibleCategories: bound(Math.min(n, 4)) } };
}
function craft(n: number, eligible = n): CraftScoringInputs {
  return { policyVersion: "v7", window, eligibleEpisodes: eligible, counts: { framing: bound(n), verification_debugging: bound(n), tool_judgment: bound(n), accepted_outcome: bound(n) }, independentlyCorroboratedCompleteEpisodes: n ? 1 : 0 };
}
function receipt(coreInput = inputs(), craftInput: CraftScoringInputs | null = null): PublicScoringReceipt {
  const core = calculateCoreV7(coreInput), c = craftInput ? calculateCraftV7(craftInput) : null;
  return { schemaVersion: "v7", policyVersion: "v7", receiptId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", subjectRef: "subject-1", revisionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", revision: 1, recordedAt: window.referenceTime, supersedesRevisionId: null, action: "create", window, inputs: core.inputs, core: core.core, craft: craftInput && c ? { inputs: craftInput, result: c.result } : null, criteria: [], coverage: [], exclusions: [], limitations: [], serializationVersion: "canonical-json-v1", algorithm: RECEIPT_ALGORITHM_V7, calculation: { rules: SCORING_V7_RECEIPT_RULES, core: core.calculation, craft: c?.trace ?? null } };
}
const acceptedCriterion: PublicCriterionResult = { workItemRef: "work-1", criterion: "rationale", status: "accepted", rubricVersion: "v7", reasonCode: "criterion_demonstrated", qualifyingCount: 1, provenance: "human_assessed" };
const completeCoverage: PublicCoverageSummary = { sourceRef: "source-1", provider: "github", status: "complete", dataThrough: window.referenceTime, discovery: "explicit_repositories", accessibleRepositoryCount: 1, repositoryDiscoveryComplete: true, reasonCodes: [], unknownPeriods: [] };
async function rejectEveryBoundary(value: PublicScoringReceipt): Promise<void> {
  expect(() => parsePublicScoreReceipt(value)).toThrow();
  await expect(sealScoreReceipt(value)).rejects.toThrow();
  await expect(verifyScoreReceipt({ receipt: value, contentHash: { algorithm: "SHA-256", value: await canonicalSha256(value) } })).rejects.toThrow();
}
describe("independent v7 replay", () => {
  it("enforces resolved rubric invariants at parse, seal and recomputed-hash verification", async () => {
    for (const criteria of [
      [acceptedCriterion, acceptedCriterion],
      [{ ...acceptedCriterion, provenance: "self_reported" as const }],
      [{ ...acceptedCriterion, reasonCode: "not_assessed" as const }],
      [{ ...acceptedCriterion, reasonCode: "criterion_not_demonstrated" as const }],
      [{ ...acceptedCriterion, status: "retracted" as const, qualifyingCount: 0 as const }],
    ]) await rejectEveryBoundary({ ...receipt(), criteria });
    await expect(sealScoreReceipt({ ...receipt(), criteria: [acceptedCriterion, { ...acceptedCriterion, workItemRef: "work-2", status: "unassessed", reasonCode: "not_assessed", qualifyingCount: 0 }] })).resolves.toBeDefined();
    const assessment: PrivateCriterionAssessment = { assessmentId: "private", claimRevisionId: "private", workItemId: "private", criterion: "rationale", status: "accepted", rubricVersion: "v7", reasonCode: "criterion_demonstrated", evaluator: { id: "private", kind: "human", version: "v7", independent: false }, rationale: "private", assessedAt: window.referenceTime, evidenceReferenceIds: ["private"], provenance: "human_assessed", revisionId: "private", revision: 1, recordedAt: window.referenceTime, supersedesRevisionId: null, action: "create" };
    const scope = { sources: [], excludedSources: [], ledgerRevisionIds: [] };
    expect(() => projectReceiptEvidence(scope, [assessment, assessment])).toThrow();
    expect(() => projectReceiptEvidence(scope, [{ ...assessment, provenance: "self_reported" }])).toThrow();
    expect(() => projectReceiptEvidence(scope, [{ ...assessment, reasonCode: "not_assessed" }])).toThrow();
  });
  it("rejects future coverage and complete coverage contradicted inside the window", async () => {
    const recordedAt = "2026-09-06T12:00:00.000Z";
    for (const row of [
      { ...completeCoverage, dataThrough: recordedAt },
      { ...completeCoverage, dataThrough: "2026-09-05T12:00:00.001Z" },
      { ...completeCoverage, repositoryDiscoveryComplete: false },
      { ...completeCoverage, unknownPeriods: [{ startInclusive: window.startInclusive, endExclusive: window.endExclusive }] },
    ]) await rejectEveryBoundary({ ...receipt(), recordedAt, coverage: [row] });
    const outside = [{ startInclusive: "2024-01-01T00:00:00.000Z", endExclusive: window.startInclusive }, { startInclusive: window.endExclusive, endExclusive: "2027-01-01T00:00:00.000Z" }];
    await expect(sealScoreReceipt({ ...receipt(), coverage: [{ ...completeCoverage, unknownPeriods: outside }] })).resolves.toBeDefined();
    await expect(sealScoreReceipt({ ...receipt(), coverage: [{ ...completeCoverage, status: "partial", repositoryDiscoveryComplete: false, unknownPeriods: [{ startInclusive: window.startInclusive, endExclusive: window.endExclusive }] }] })).resolves.toBeDefined();
  });
  it("allows only internal math drift within 1e-10 without changing canonical bytes", async () => {
    const baseline = receipt(inputs(8), craft(8));
    const shifted = structuredClone(baseline);
    for (const bounds of new Set([shifted.calculation.core.delivery.normalized, shifted.calculation.core.delivery.weighted, shifted.calculation.core.dimensions.delivery, shifted.calculation.core.weightedDimensions.delivery, shifted.calculation.core.composite, shifted.calculation.craft!.criteria.framing.normalized, shifted.calculation.craft!.criteria.framing.weighted, shifted.calculation.craft!.composite])) Object.assign(bounds, { lower: bounds.lower + 5e-11, upper: bounds.upper + 5e-11 });
    const original = await sealScoreReceipt(baseline), changed = await sealScoreReceipt(shifted);
    expect(changed.contentHash).not.toEqual(original.contentHash);
    await expect(replayReceipt(changed)).resolves.toHaveProperty("replayStatus", "arithmetic_reproduced");
    await expect(verifyScoreReceipt({ ...changed, contentHash: original.contentHash })).rejects.toThrow();
    const tooFar = structuredClone(baseline);
    Object.assign(tooFar.calculation.core.delivery.normalized, { lower: tooFar.calculation.core.delivery.normalized.lower + 2e-10, upper: tooFar.calculation.core.delivery.normalized.upper + 2e-10 });
    await rejectEveryBoundary(tooFar);
    const wrongCount = structuredClone(baseline);
    Object.assign(wrongCount.calculation.core.delivery.input, { lower: 8 + 5e-11, upper: 8 + 5e-11 });
    await rejectEveryBoundary(wrongCount);
    const wrongDisplay = structuredClone(baseline);
    Object.assign(wrongDisplay.core.composite, { displayValue: 99 });
    await rejectEveryBoundary(wrongDisplay);
    const hiddenRange = structuredClone(baseline);
    Object.assign(hiddenRange.calculation.core.composite, { upper: hiddenRange.calculation.core.composite.upper + 5e-11 });
    await rejectEveryBoundary(hiddenRange);
    const wrongKind = structuredClone(baseline);
    const value = wrongKind.core.composite.kind === "point" ? wrongKind.core.composite.value : 0;
    Object.assign(wrongKind.core, { composite: { kind: "range", lower: value, upper: value + 5e-11, displayLower: Math.floor(value), displayUpper: Math.ceil(value) } });
    await rejectEveryBoundary(wrongKind);
    expect(() => assertReferenceParity({ weighted: { lower: 25 + 5e-11, upper: 25 + 5e-11 } }, { weighted: { lower: 25, upper: 25 } })).not.toThrow();
    expect(() => assertReferenceParity({ input: { lower: 8 + 5e-11, upper: 8 } }, { input: { lower: 8, upper: 8 } })).toThrow();
    expect(() => assertReferenceParity({ displayValue: 25 + 5e-11 }, { displayValue: 25 })).toThrow();
  });
  it("pins exact policy and engine artifact bytes", () => {
    expect(createHash("sha256").update(readFileSync("docs/plans/2026-09-05-scoring-relaunch-phases/policy.md")).digest("hex")).toBe(RECEIPT_ALGORITHM_V7.policyDigest.value);
    expect(createHash("sha256").update(readFileSync("apps/web/lib/impact/v7.ts")).update(readFileSync("apps/web/lib/insights/craft-v7.ts")).digest("hex")).toBe(RECEIPT_ALGORITHM_V7.algorithmDigest.value);
  });
  it("runs the actual offline CLI identically in distant timezones", async () => {
    const directory = mkdtempSync(join(tmpdir(), "chapa-replay-"));
    const file = join(directory, "receipt.json"), guard = join(directory, "offline.cjs");
    try {
      writeFileSync(file, JSON.stringify(await sealScoreReceipt(receipt(inputs(8), craft(8)))));
      writeFileSync(guard, 'global.fetch = () => { throw Error("offline"); }; require("node:net").Socket.prototype.connect = () => { throw Error("offline"); };');
      const run = (zone: string) => execFileSync(process.execPath, ["--require", guard, "--import", "tsx", "scripts/scoring/reference-calculator.ts", file], { encoding: "utf8", env: { ...process.env, TZ: zone } });
      const first = run("Pacific/Honolulu");
      expect(first).toBe(run("Asia/Tokyo"));
      expect(JSON.parse(first).replayStatus).toBe("arithmetic_reproduced");
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });

  it("matches frozen zero and saturated fixtures, including full traces", () => {
    for (const n of [0, 1, 4, 8, 12, 40, 120]) {
      const expected = receipt(inputs(n), craft(Math.min(n, 8)));
      const result = referenceCalculate(expected.inputs, expected.craft!.inputs);
      expect(result.core).toEqual(expected.core);
      expect(result.coreTrace).toEqual(expected.calculation.core);
      expect(result.craft).toEqual(expected.craft!.result);
      expect(result.craftTrace).toEqual(expected.calculation.craft);
    }
    expect(referenceCalculate(inputs()).core.composite).toEqual({ kind: "point", value: 0, displayValue: 0 });
    expect(referenceCalculate(inputs(120)).core.composite).toEqual({ kind: "point", value: 100, displayValue: 100 });
  });
  it("matches 250 deterministic randomized point/range inputs", async () => {
    let seed = 1701;
    const next = (max: number) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % max; };
    for (let i = 0; i < 250; i++) {
      const random = (max: number) => { const lower = next(max); return bound(lower, lower + next(max - lower)); };
      const source = inputs();
      const input: CoreScoringInputs = { ...source, counts: { deliveryUnits: random(200), activeIsoWeeks: random(53), eligibleProjects: random(10), eligibleCategories: random(5), quality: { rationale: random(20), verification: random(20), review_or_correction: random(20), outcome_followup: random(20) } } };
      await expect(replayReceipt(await sealScoreReceipt(receipt(input, craft(next(9), 9))))).resolves.toHaveProperty("replayStatus", "arithmetic_reproduced");
    }
  });
  it("preserves absent, no eligible portfolio, and measured zero", async () => {
    const absent = await sealScoreReceipt(receipt());
    const unseen = await sealScoreReceipt(receipt(inputs(), craft(0)));
    const zero = await sealScoreReceipt(receipt(inputs(), craft(0, 1)));
    expect((await replayReceipt(absent)).craft).toBeNull();
    expect((await replayReceipt(unseen)).craft).toEqual({ status: "not_observed" });
    expect((await replayReceipt(zero)).craft).toMatchObject({ status: "observed", composite: { kind: "point", value: 0 } });
    expect(absent.receipt.core).toEqual(zero.receipt.core);
    expect(absent.contentHash).not.toEqual(zero.contentHash);
  });
  it("replays with an unrelated clock and network disabled and freezes detached inputs", async () => {
    const input = receipt(inputs(8), craft(8));
    const envelope = await sealScoreReceipt(input);
    const before = await replayReceipt(envelope);
    vi.useFakeTimers(); vi.setSystemTime(new Date("2027-09-05T22:00:00-11:00"));
    vi.stubGlobal("fetch", () => { throw new Error("network forbidden"); });
    try { expect(await replayReceipt(envelope)).toEqual(before); } finally { vi.useRealTimers(); vi.unstubAllGlobals(); }
    expect(Object.isFrozen(envelope.receipt.calculation.core.quality.rationale)).toBe(true);
    expect(envelope.receipt).not.toBe(input);
  });
  it("rejects unknown fields, private strings, wrong windows and altered hashes/traces", async () => {
    const baseline = receipt(inputs(8));
    for (const mutate of [
      (r: PublicScoringReceipt) => { Object.assign(r, { token: "private" }); },
      (r: PublicScoringReceipt) => { Object.assign(r.inputs.counts.quality.rationale, { repository: "private" }); },
      (r: PublicScoringReceipt) => { Object.assign(r, { subjectRef: "private-owner" }); },
      (r: PublicScoringReceipt) => { Object.assign(r.algorithm.policyDigest, { value: "0".repeat(64) }); },
      (r: PublicScoringReceipt) => { Object.assign(r.inputs.window, { referenceDate: "2026-09-04" }); },
    ]) {
      const copy = structuredClone(baseline); mutate(copy); await expect(sealScoreReceipt(copy)).rejects.toThrow();
    }
    const envelope = await sealScoreReceipt(baseline);
    const altered = structuredClone(envelope); (altered.receipt.core.composite as { value: number }).value += 1;
    await expect(replayReceipt(altered)).rejects.toThrow();
    const forged = { ...altered, contentHash: { algorithm: "SHA-256", value: await canonicalSha256(altered.receipt) } };
    await expect(replayReceipt(forged)).rejects.toThrow();
    await expect(replayReceipt({ version: "v6", result: {} })).rejects.toThrow();
  });
  it("projects identities without private repository/host/account fields", () => {
    const result = projectReceiptEvidence({ sources: [{ source: { provider: "github", host: "private.host", subjectId: "private-person" }, window, dataThrough: window.referenceTime, status: "partial", discovery: "explicit_repositories", repositoryIds: ["private/repo"], repositoryDiscoveryComplete: false, eventKinds: {}, reasonCodes: ["not_accessible"], unknownPeriods: [] }], excludedSources: [], ledgerRevisionIds: ["private-revision"] }, []);
    expect(JSON.stringify(result)).not.toContain("private");
    expect(result.coverage[0]).toMatchObject({ sourceRef: "source-1", accessibleRepositoryCount: 1 });
  });
});
