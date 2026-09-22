import { describe, expect, it } from "vitest";
import { createScoringWindow, type EngineeringEvidenceInput, type PublicObservedCraft, type PublicObservedScoringReceipt } from "@chapa/shared";
import { canonicalizeReceiptEvidence, observedSemanticIdentity, receiptSemanticIdentity } from "./receipt-semantic-identity";

const time = "2026-09-08T10:00:00.000Z";
function payload(referenceTime = time) {
  const window = createScoringWindow(referenceTime);
  return { schemaVersion: "v7", policyVersion: "v7.2", receiptId: "family", revisionId: "revision", revision: 1, supersedesRevisionId: null, action: "create", recordedAt: referenceTime,
    window, inputs: { window, counts: { delivery: 3 } }, core: { exact: 30 }, craft: { status: "no_report" },
    algorithm: { revision: "v7.2", digest: "pinned" }, calculation: { rules: { tieOrder: ["a", "b"] }, core: { scalar: 0.3 } },
    coverage: [{ sourceRef: "source-1", provider: "portfolio", discovery: "registered_ledger", dataThrough: referenceTime }], criteria: [], exclusions: [], limitations: [],
  } as unknown as PublicObservedScoringReceipt;
}
function evidence(referenceTime = time): EngineeringEvidenceInput {
  const window = createScoringWindow(referenceTime);
  return { schemaVersion: "v7", window, scope: { sources: [], excludedSources: [], ledgerRevisionIds: ["b", "a"] }, events: [], assessments: [], repositoryAliases: [], equivalentWorkItems: [] };
}
describe("observed receipt semantic identity", () => {
  it("reuses same-day evidence across allocated IDs and incidental caller clocks", async () => {
    const later = { ...payload("2026-09-08T11:00:00.000Z"), receiptId: "another", revisionId: "new", revision: 8, supersedesRevisionId: "old", action: "correct" as const };
    expect(await receiptSemanticIdentity(later, evidence("2026-09-08T11:00:00.000Z"))).toBe(await receiptSemanticIdentity(payload(), evidence()));
  });
  it("retains genuine provider freshness, coverage, provenance, exclusions, policy and trace changes", async () => {
    const original = payload();
    const digest = await receiptSemanticIdentity(original, evidence());
    for (const update of [
      { coverage: [{ provider: "github", dataThrough: time }] },
      { criteria: [{ provenance: "human_assessed" }] }, { exclusions: [{ provider: "github", reason: "not_connected" }] },
      { limitations: ["not_assessed"] }, { algorithm: { revision: "changed" } }, { calculation: { scalar: 0.4 } }, { craft: { status: "scored", reportRef: "opaque" } },
    ]) expect(await receiptSemanticIdentity({ ...original, ...update } as unknown as PublicObservedScoringReceipt, evidence())).not.toBe(digest);
    const github = { ...original, coverage: [{ provider: "github", discovery: "owned_and_contributed", dataThrough: time }] } as unknown as PublicObservedScoringReceipt;
    const fresher = { ...github, coverage: [{ provider: "github", discovery: "owned_and_contributed", dataThrough: "2026-09-08T11:00:00.000Z" }] } as unknown as PublicObservedScoringReceipt;
    expect(await receiptSemanticIdentity(github, evidence())).not.toBe(await receiptSemanticIdentity(fresher, evidence()));
  });
  it("retains actual private ledger revision/recording identity even when counts agree", async () => {
    expect(await receiptSemanticIdentity(payload(), evidence(), { revisionId: "a", recordedAt: time })).not.toBe(await receiptSemanticIdentity(payload(), evidence(), { revisionId: "b", recordedAt: time }));
    expect(await receiptSemanticIdentity(payload(), evidence(), { recordedAt: time })).not.toBe(await receiptSemanticIdentity(payload(), evidence(), { recordedAt: "2026-09-08T11:00:00.000Z" }));
  });
  it("never treats retraction as an ordinary create/correct semantic no-op", async () => {
    expect(await receiptSemanticIdentity({ ...payload(), action: "retract" }, evidence())).not.toBe(await receiptSemanticIdentity(payload(), evidence()));
  });
  it("canonicalizes set-like evidence before allocating any public ordinal", async () => {
    const original = evidence();
    const shuffled = { ...original, scope: { ...original.scope, ledgerRevisionIds: ["a", "b"] } };
    expect(canonicalizeReceiptEvidence(shuffled)).toEqual(canonicalizeReceiptEvidence(original));
    expect(original.scope.ledgerRevisionIds).toEqual(["b", "a"]);
    expect(await receiptSemanticIdentity(payload(), shuffled)).toBe(await receiptSemanticIdentity(payload(), original));
    expect(await receiptSemanticIdentity(payload("2026-09-09T10:00:00.000Z"), evidence())).not.toBe(await receiptSemanticIdentity(payload(), evidence()));
  });
});

it("normalizes only the current Craft evaluation clock, retaining real period and historical context", async () => {
  const current = (clock: string, end = time) => ({ status: "scored", unlocked: true, report: { inputs: { window: createScoringWindow(clock), reportPeriod: { startInclusive: "2026-09-01T00:00:00.000Z", endExclusive: end } } } }) as unknown as PublicObservedCraft;
  const first = current(time), later = current("2026-09-08T11:00:00.000Z");
  const digest = await observedSemanticIdentity("core-a", first);
  expect(await observedSemanticIdentity("core-a", later)).toBe(digest);
  expect(await observedSemanticIdentity("core-b", first)).not.toBe(digest);
  expect(await observedSemanticIdentity("core-a", current(time, "2026-09-08T09:00:00.000Z"))).not.toBe(digest);
  expect(await observedSemanticIdentity("core-a", current("2026-09-09T10:00:00.000Z"))).not.toBe(digest);
  const expired = (craft: PublicObservedCraft) => ({ status: "expired", unlocked: true, report: null, lastReport: craft.report }) as PublicObservedCraft;
  expect(await observedSemanticIdentity("core-a", expired(first))).not.toBe(await observedSemanticIdentity("core-a", expired(later)));
});
