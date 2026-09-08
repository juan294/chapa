import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HashedObservedScoreReceipt, PublicObservedCraft } from "@chapa/shared";

vi.mock("@/lib/platform/source-collectors", () => ({ selectSourceEvidence: vi.fn() }));
vi.mock("@/lib/db/engineering-evidence", () => ({ dbReadEngineeringEvidence: vi.fn() }));
vi.mock("@/lib/db/score-receipts-observed", () => ({ dbReadObservedReceipt: vi.fn(), dbPublishObservedReceipt: vi.fn() }));
vi.mock("@/lib/analytics/server-errors", () => ({ captureServerError: vi.fn() }));
import { selectSourceEvidence } from "@/lib/platform/source-collectors";
import { dbReadEngineeringEvidence } from "@/lib/db/engineering-evidence";
import { dbReadObservedReceipt, dbPublishObservedReceipt } from "@/lib/db/score-receipts-observed";
import { materializeObservedScoreReceipt } from "./score-receipt-observed";
import { ledgerFixture } from "@/lib/evidence/test-fixtures";

const referenceTime = "2026-09-08T10:00:00.000Z";
const ledger = { ownerId: "alice", publicConsent: true, claims: [], assessments: [], references: [] };
const readCraft = vi.fn(async (): Promise<PublicObservedCraft> => ({ status: "no_report", unlocked: false, report: null }));
let saved: { envelope: HashedObservedScoreReceipt; semanticDigest: string } | null;
beforeEach(() => {
  vi.clearAllMocks(); saved = null;
  readCraft.mockResolvedValue({ status: "no_report", unlocked: false, report: null });
  vi.mocked(dbReadEngineeringEvidence).mockResolvedValue(ledger);
  vi.mocked(selectSourceEvidence).mockResolvedValue({ status: "unlinked" });
  vi.mocked(dbReadObservedReceipt).mockImplementation(async () => saved ? { status: "found", ...saved, trend: null, isCurrent: true } : { status: "missing" });
  vi.mocked(dbPublishObservedReceipt).mockImplementation(async (_owner, _actor, envelope, semanticDigest) => {
    if (saved?.envelope.receipt.revisionId === envelope.receipt.revisionId) return { status: "duplicate", ...saved, trend: null, isCurrent: true };
    saved = { envelope, semanticDigest };
    return { status: "inserted", ...saved, trend: null, isCurrent: true };
  });
});
describe("observed receipt materialization", () => {
  it("publishes a consented truthful zero only with authoritative no_report and one fixed context", async () => {
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
  it("never guesses missing Craft authority or ignores explicit consent withdrawal", async () => {
    expect(await materializeObservedScoreReceipt("alice", { referenceTime })).toMatchObject({ status: "unavailable", reason: "craft_error" });
    vi.mocked(dbReadEngineeringEvidence).mockResolvedValue({ ...ledger, publicConsent: false });
    expect(await materializeObservedScoreReceipt("alice", { referenceTime, readCraft })).toEqual({ status: "unavailable", reason: "not_consented" });
    expect(dbPublishObservedReceipt).not.toHaveBeenCalled();
  });
  it("read-only resolves durable state without consent writes, collection or Craft reads", async () => {
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
      vi.mocked(dbReadEngineeringEvidence).mockResolvedValue({ ...base, publicConsent: true, assessments });
      expect((await materializeObservedScoreReceipt("owner", { referenceTime, readCraft })).status).toBe("issued");
      expect(saved!.envelope.receipt.criteria).toHaveLength(1);
      expect(saved!.envelope.receipt.criteria[0]).toMatchObject({ criterion: "verification", status: "accepted", qualifyingCount: 1 });
      expect(saved!.envelope.receipt.inputs.counts.quality.verification.lower).toBe(1);
    }
  });
  it("latest retraction never revives an earlier accepted public criterion", async () => {
    const base = ledgerFixture(), original = base.assessments[0]!;
    const retraction = { ...original, assessment: { ...original.assessment, revisionId: "assessment-rev:2", supersedesRevisionId: original.assessment.revisionId, revision: 2, action: "retract" as const, status: "retracted" as const } };
    vi.mocked(dbReadEngineeringEvidence).mockResolvedValue({ ...base, publicConsent: true, assessments: [original, retraction] });
    expect((await materializeObservedScoreReceipt("owner", { referenceTime, readCraft })).status).toBe("issued");
    expect(saved!.envelope.receipt.criteria).toEqual([]);
    expect(saved!.envelope.receipt.inputs.counts.quality.verification.lower).toBe(0);
  });
});
