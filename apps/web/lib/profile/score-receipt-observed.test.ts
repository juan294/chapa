import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HashedObservedScoreReceipt, PublicObservedCraft, ScoringWindow } from "@chapa/shared";

vi.mock("@/lib/platform/source-collectors", () => ({ selectSourceEvidence: vi.fn() }));
vi.mock("@/lib/db/engineering-evidence", () => ({ dbReadEngineeringEvidence: vi.fn() }));
vi.mock("@/lib/db/score-receipts-observed", () => ({ dbReadObservedReceipt: vi.fn(), dbPublishObservedReceipt: vi.fn() }));
vi.mock("@/lib/analytics/server-errors", () => ({ captureServerError: vi.fn() }));
import { selectSourceEvidence } from "@/lib/platform/source-collectors";
import { dbReadEngineeringEvidence } from "@/lib/db/engineering-evidence";
import { dbReadObservedReceipt, dbPublishObservedReceipt } from "@/lib/db/score-receipts-observed";
import { materializeObservedScoreReceipt, type ObservedReceiptMaterializationOptions } from "./score-receipt-observed";
import { ledgerFixture } from "@/lib/evidence/test-fixtures";

const referenceTime = "2026-09-08T10:00:00.000Z";
const ledger = { ownerId: "alice", claims: [], assessments: [], references: [] };
const readCraft = vi.fn<(owner: string, window: ScoringWindow) => Promise<PublicObservedCraft>>(async () => ({ status: "no_report", unlocked: false, report: null }));
let saved: { envelope: HashedObservedScoreReceipt; semanticDigest: string; coreSemanticDigest: string | null } | null;
beforeEach(() => {
  vi.clearAllMocks(); saved = null;
  readCraft.mockResolvedValue({ status: "no_report", unlocked: false, report: null });
  vi.mocked(dbReadEngineeringEvidence).mockResolvedValue(ledger);
  vi.mocked(selectSourceEvidence).mockResolvedValue({ status: "unlinked" });
  vi.mocked(dbReadObservedReceipt).mockImplementation(async () => saved ? { status: "found", ...saved, trend: null, isCurrent: true } : { status: "missing" });
  vi.mocked(dbPublishObservedReceipt).mockImplementation(async (_owner, _actor, envelope, semanticDigest, coreSemanticDigest) => {
    if (saved?.envelope.receipt.revisionId === envelope.receipt.revisionId) return { status: "duplicate", ...saved, trend: null, isCurrent: true };
    saved = { envelope, semanticDigest, coreSemanticDigest: coreSemanticDigest ?? null };
    return { status: "inserted", ...saved, trend: null, isCurrent: true };
  });
});
describe("observed receipt materialization", () => {
  it("publishes a truthful zero only with authoritative no_report and one fixed context", async () => {
    expect((await materializeObservedScoreReceipt("Alice", { referenceTime, readCraft })).status).toBe("issued");
    expect(saved!.envelope.receipt.core.composite.displayValue).toBe(0);
    expect(saved!.envelope.receipt.window.referenceTime).toBe(referenceTime);
    expect(saved!.envelope.receipt.craft).toEqual({ status: "no_report", unlocked: false, report: null });
    expect(saved!.semanticDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(readCraft).toHaveBeenCalledWith("alice", expect.objectContaining({ referenceTime }));
  });
  it("same-day clock-only no-op returns the exact stored envelope without new publication", async () => {
    await materializeObservedScoreReceipt("alice", { referenceTime, readCraft });
    const previous = saved!.envelope;
    const later = await materializeObservedScoreReceipt("alice", { referenceTime: "2026-09-08T11:00:00.000Z", readCraft });
    expect(later).toMatchObject({ status: "stored", snapshot: { receipt: previous }, freshness: "current" });
    expect(dbPublishObservedReceipt).toHaveBeenCalledTimes(2);
  });
  it("new observation/date starts a family; explicit correction freezes the target context", async () => {
    await materializeObservedScoreReceipt("alice", { referenceTime, readCraft });
    const previous = saved!.envelope;
    vi.mocked(selectSourceEvidence).mockImplementation(async input => ({ status: input.provider === "github" ? "disabled" : "unlinked" }));
    await materializeObservedScoreReceipt("alice", { referenceTime: "2026-09-08T11:00:00.000Z", readCraft });
    expect(saved!.envelope.receipt).toMatchObject({ revision: 1, supersedesRevisionId: null, action: "create" });
    expect(saved!.envelope.receipt.receiptId).not.toBe(previous.receipt.receiptId);
    const target = saved!;
    vi.mocked(selectSourceEvidence).mockResolvedValue({ status: "unlinked" });
    await materializeObservedScoreReceipt("alice", { referenceTime: "2026-09-08T12:00:00.000Z", correctionRevisionId: target.envelope.receipt.revisionId, readCraft });
    expect(saved!.envelope.receipt).toMatchObject({ receiptId: target.envelope.receipt.receiptId, revision: 2, supersedesRevisionId: target.envelope.receipt.revisionId, window: target.envelope.receipt.window });
    await materializeObservedScoreReceipt("alice", { referenceTime: "2026-09-09T10:00:00.000Z", readCraft });
    expect(saved!.envelope.receipt.revision).toBe(1);
  });
  it("preserves a known-good envelope on connected source failure and never publishes empty fallback", async () => {
    await materializeObservedScoreReceipt("alice", { referenceTime, readCraft });
    const previous = saved!.envelope;
    vi.mocked(selectSourceEvidence).mockResolvedValue({ status: "unavailable" });
    expect(await materializeObservedScoreReceipt("alice", { referenceTime, readCraft })).toMatchObject({ status: "stored", snapshot: { receipt: previous }, freshness: "stale", reason: "source_error" });
    expect(dbPublishObservedReceipt).toHaveBeenCalledTimes(1);
  });
  it("never guesses missing Craft authority", async () => {
    expect(await materializeObservedScoreReceipt("alice", { referenceTime })).toMatchObject({ status: "unavailable", reason: "craft_error" });
    expect(dbPublishObservedReceipt).not.toHaveBeenCalled();
  });
  it("read-only resolves durable state without new writes, collection or Craft reads", async () => {
    await materializeObservedScoreReceipt("alice", { referenceTime, readCraft });
    vi.clearAllMocks();
    expect((await materializeObservedScoreReceipt("alice", { readOnly: true })).status).toBe("stored");
    expect(dbReadEngineeringEvidence).not.toHaveBeenCalled();
    expect(selectSourceEvidence).not.toHaveBeenCalled();
    expect(readCraft).not.toHaveBeenCalled();
    expect(dbPublishObservedReceipt).not.toHaveBeenCalled();
  });
  it("checks a no-op against the locked publisher and marks superseded returned identity stale", async () => {
    await materializeObservedScoreReceipt("alice", { referenceTime, readCraft });
    const initial = saved!;
    vi.mocked(dbPublishObservedReceipt).mockResolvedValue({ status: "duplicate", ...initial, trend: null, isCurrent: false });
    expect(await materializeObservedScoreReceipt("alice", { referenceTime, readCraft })).toMatchObject({ status: "stored", snapshot: { receipt: initial.envelope }, freshness: "stale" });
    expect(vi.mocked(dbPublishObservedReceipt).mock.calls.at(-1)![2]).toBe(initial.envelope);
  });
  it("revalidates authority instead of serving an initial receipt after withdrawal during collection", async () => {
    await materializeObservedScoreReceipt("alice", { referenceTime, readCraft });
    vi.mocked(selectSourceEvidence).mockImplementation(async () => { saved = null; return { status: "unavailable" }; });
    expect(await materializeObservedScoreReceipt("alice", { referenceTime, readCraft })).toEqual({ status: "unavailable", reason: "source_error" });
  });
  it("projects one final public criterion for corrected chains or agreeing assessors", async () => {
    const base = ledgerFixture();
    const original = base.assessments[0]!;
    const correction = { ...original, assessment: { ...original.assessment, revisionId: "assessment-rev:2", supersedesRevisionId: original.assessment.revisionId, revision: 2, action: "correct" as const } };
    const second = { ...original, assessment: { ...original.assessment, assessmentId: "second", revisionId: "second:1", evaluator: { ...original.assessment.evaluator, id: "second-reviewer" } } };
    for (const assessments of [[original, correction], [original, second]]) {
      saved = null;
      vi.mocked(dbReadEngineeringEvidence).mockResolvedValue({ ...base, assessments });
      expect((await materializeObservedScoreReceipt("owner", { referenceTime, readCraft })).status).toBe("issued");
      expect(saved!.envelope.receipt.criteria).toHaveLength(1);
      expect(saved!.envelope.receipt.criteria[0]).toMatchObject({ criterion: "verification", status: "accepted", qualifyingCount: 1 });
      expect(saved!.envelope.receipt.inputs.counts.quality.verification.lower).toBe(1);
    }
  });
  it("latest retraction never revives an earlier accepted public criterion", async () => {
    const base = ledgerFixture(), original = base.assessments[0]!;
    const retraction = { ...original, assessment: { ...original.assessment, revisionId: "assessment-rev:2", supersedesRevisionId: original.assessment.revisionId, revision: 2, action: "retract" as const, status: "retracted" as const } };
    vi.mocked(dbReadEngineeringEvidence).mockResolvedValue({ ...base, assessments: [original, retraction] });
    expect((await materializeObservedScoreReceipt("owner", { referenceTime, readCraft })).status).toBe("issued");
    expect(saved!.envelope.receipt.criteria).toEqual([]);
    expect(saved!.envelope.receipt.inputs.counts.quality.verification.lower).toBe(0);
  });
});

it("report-only publication reuses the baseline context without provider refresh", async () => {
  await materializeObservedScoreReceipt("alice", { referenceTime, readCraft });
  const baseline = saved!.envelope;
  vi.clearAllMocks();
  vi.mocked(dbReadEngineeringEvidence).mockRejectedValue(new Error("unrelated ledger cache unavailable"));
  const publish = vi.fn<NonNullable<ObservedReceiptMaterializationOptions["publish"]>>((owner, actor, envelope, semanticDigest, baseline, coreSemanticDigest) => {
    void baseline; return dbPublishObservedReceipt(owner, actor, envelope, semanticDigest, coreSemanticDigest);
  });
  await materializeObservedScoreReceipt("alice", { referenceTime: "2026-09-09T12:00:00.000Z", reportUpdate: { endExclusive: "2026-09-08T09:00:00.000Z" }, readCraft, publish });
  expect(readCraft).toHaveBeenCalledWith("alice", expect.objectContaining({ referenceTime }));
  expect(selectSourceEvidence).not.toHaveBeenCalled();
  expect(dbReadEngineeringEvidence).not.toHaveBeenCalled();
  expect(publish).toHaveBeenCalled();
  expect(saved!.envelope.receipt.window.referenceTime).toBe(referenceTime);
  expect(saved!.envelope.receipt.core).toEqual(baseline.receipt.core);
});
it("a report beyond the frozen baseline reprojects retained dated evidence at the captured context", async () => {
  await materializeObservedScoreReceipt("alice", { referenceTime, readCraft });
  vi.clearAllMocks();
  await materializeObservedScoreReceipt("alice", { referenceTime: "2026-09-08T12:00:00.000Z", reportUpdate: { endExclusive: "2026-09-08T11:00:00.000Z" }, readCraft });
  expect(readCraft).toHaveBeenCalledWith("alice", expect.objectContaining({ referenceTime: "2026-09-08T12:00:00.000Z" }));
  expect(selectSourceEvidence).toHaveBeenCalledWith(expect.objectContaining({ readOnly: true }));
});

it("reprojects retained normalized evidence with honest old dataThrough on UTC rollover", async () => {
  const { createScoringWindow } = await import("@chapa/shared");
  const oldWindow = createScoringWindow(referenceTime);
  const observation = { id: "11111111-1111-4111-8111-111111111111", window: oldWindow,
    coverage: { source: { provider: "github" as const, host: "github.com", subjectId: "alice" }, window: oldWindow,
      dataThrough: referenceTime, status: "complete" as const, discovery: "owned_and_contributed" as const,
      repositoryIds: [], repositoryDiscoveryComplete: true, eventKinds: {}, reasonCodes: [], unknownPeriods: [] }, events: [] };
  vi.mocked(selectSourceEvidence).mockImplementation(async input => input.provider === "github" ? { status: "observed", observation } : { status: "unlinked" });
  await materializeObservedScoreReceipt("alice", { referenceTime, readCraft });
  const original = saved!.envelope;
  vi.mocked(selectSourceEvidence).mockImplementation(async input => input.provider === "github" ? { status: "stale", observation } : { status: "unlinked" });
  const result = await materializeObservedScoreReceipt("alice", { referenceTime: "2026-09-09T12:00:00.000Z", reportUpdate: { endExclusive: "2026-09-09T11:00:00.000Z" }, readCraft });
  expect(result.status).toBe("issued");
  expect(saved!.envelope.receipt.receiptId).not.toBe(original.receipt.receiptId);
  expect(saved!.envelope.receipt.window.referenceDate).toBe("2026-09-09");
  expect(saved!.envelope.receipt.coverage).toContainEqual(expect.objectContaining({ dataThrough: referenceTime, status: "partial" }));
  expect(saved!.envelope.receipt.core.composite.displayValue).toBe(0);
});

it("normal refresh after a frozen Craft publication reuses the exact envelope and still detects private evidence changes", async () => {
  const { createScoringWindow } = await import("@chapa/shared");
  const { calculateReportCraftInputs } = await import("@/lib/insights/report-craft");
  await materializeObservedScoreReceipt("alice", { referenceTime, readCraft });
  const calculation = calculateReportCraftInputs({ policyVersion: "v7.2", classifierRevision: "cc-outcomes-v7.2", window: createScoringWindow(referenceTime),
    reportPeriod: { startInclusive: "2026-09-01T00:00:00.000Z", endExclusive: "2026-09-08T09:00:00.000Z" }, totalSessions: 1,
    outcomes: { fully_achieved: 1, mostly_achieved: 0, partially_achieved: 0, not_achieved: 0 }, unknownSessions: 0, unclassifiedSessions: 0 });
  if (calculation.status !== "valid" || calculation.result.status !== "scored") throw new Error("fixture invalid");
  const report = { reportRef: "11111111-1111-4111-8111-111111111111", supersedesReportRef: null, inputs: calculation.inputs, result: calculation.result };
  readCraft.mockImplementation(async (owner, window) => { void owner; return { status: "scored", unlocked: true, report: { ...report, inputs: { ...report.inputs, window } } }; });
  await materializeObservedScoreReceipt("alice", { referenceTime, reportUpdate: { endExclusive: "2026-09-08T09:00:00.000Z" }, readCraft });
  const reportEnvelope = saved!.envelope;
  expect(await materializeObservedScoreReceipt("alice", { referenceTime: "2026-09-08T11:00:00.000Z", readCraft })).toMatchObject({ status: "stored", snapshot: { receipt: reportEnvelope } });
  vi.mocked(selectSourceEvidence).mockImplementation(async input => ({ status: input.provider === "github" ? "disabled" : "unlinked" }));
  expect((await materializeObservedScoreReceipt("alice", { referenceTime, readCraft })).status).toBe("issued");
  expect(saved!.envelope.receipt.receiptId).not.toBe(reportEnvelope.receipt.receiptId);
});
