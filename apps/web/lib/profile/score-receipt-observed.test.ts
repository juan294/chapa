import { beforeEach, describe, expect, it, vi } from "vitest";
import { createScoringWindow, type HashedObservedScoreReceipt, type PublicObservedCraft, type ScoringWindow } from "@chapa/shared";
import type { SourceObservationManifest } from "@/lib/db/source-context";
import { sourceEventFixture } from "@/lib/db/source-context-fixture";

vi.mock("@/lib/platform/source-collectors", () => ({ selectSourceEvidence: vi.fn(), selectSourceManifest: vi.fn() }));
vi.mock("@/lib/db/engineering-evidence", () => ({ dbReadEngineeringEvidence: vi.fn() }));
vi.mock("@/lib/db/score-receipts-observed", () => ({ dbReadObservedReceipt: vi.fn(), dbPublishObservedReceipt: vi.fn() }));
vi.mock("@/lib/analytics/server-errors", () => ({ captureServerError: vi.fn() }));
import { selectSourceManifest } from "@/lib/platform/source-collectors";
import { dbReadEngineeringEvidence } from "@/lib/db/engineering-evidence";
import { dbReadObservedReceipt, dbPublishObservedReceipt } from "@/lib/db/score-receipts-observed";
import { materializeObservedScoreReceipt, type ObservedReceiptMaterializationOptions } from "./score-receipt-observed";
import { RECEIPT_SOURCE_PROVIDERS } from "./score-receipt-v7";
import type { SourceProvider } from "@/lib/platform/source-authorization";
import { ledgerFixture } from "@/lib/evidence/test-fixtures";
import * as evidenceReducer from "@/lib/impact/v7-evidence-streaming";

const referenceTime = "2026-09-08T10:00:00.000Z";
const ledger = { ownerId: "alice", claims: [], assessments: [], references: [] };
const readCraft = vi.fn<(owner: string, window: ScoringWindow) => Promise<PublicObservedCraft>>(async () => ({ status: "no_report", unlocked: false, report: null }));
function sourceManifest(window: ScoringWindow, eventCount = 0): SourceObservationManifest {
  return { id: "11111111-1111-4111-8111-111111111111", window,
    coverage: { source: { provider: "github", host: "github.com", subjectId: "alice" }, window,
      dataThrough: window.referenceTime, status: "complete", discovery: "owned_and_contributed",
      repositoryIds: eventCount ? ["known"] : [], repositoryDiscoveryComplete: true, eventKinds: {}, reasonCodes: [], unknownPeriods: [] },
    storageMode: "rows", eventCount, eventGenerationId: "22222222-2222-4222-8222-222222222222", eventKeysSha256: "0".repeat(64) };
}
let saved: { envelope: HashedObservedScoreReceipt; semanticDigest: string; coreSemanticDigest: string | null } | null;
beforeEach(() => {
  vi.clearAllMocks(); saved = null;
  readCraft.mockResolvedValue({ status: "no_report", unlocked: false, report: null });
  vi.mocked(dbReadEngineeringEvidence).mockResolvedValue(ledger);
  vi.mocked(selectSourceManifest).mockResolvedValue({ status: "unlinked" });
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
    vi.mocked(selectSourceManifest).mockImplementation(async input => ({ status: input.provider === "github" ? "disabled" : "unlinked" }));
    await materializeObservedScoreReceipt("alice", { referenceTime: "2026-09-08T11:00:00.000Z", readCraft });
    expect(saved!.envelope.receipt).toMatchObject({ revision: 1, supersedesRevisionId: null, action: "create" });
    expect(saved!.envelope.receipt.receiptId).not.toBe(previous.receipt.receiptId);
    const target = saved!;
    vi.mocked(selectSourceManifest).mockResolvedValue({ status: "unlinked" });
    await materializeObservedScoreReceipt("alice", { referenceTime: "2026-09-08T12:00:00.000Z", correctionRevisionId: target.envelope.receipt.revisionId, readCraft });
    expect(saved!.envelope.receipt).toMatchObject({ receiptId: target.envelope.receipt.receiptId, revision: 2, supersedesRevisionId: target.envelope.receipt.revisionId, window: target.envelope.receipt.window });
    await materializeObservedScoreReceipt("alice", { referenceTime: "2026-09-09T10:00:00.000Z", readCraft });
    expect(saved!.envelope.receipt.revision).toBe(1);
  });
  it("preserves a known-good envelope on connected source failure and never publishes empty fallback", async () => {
    await materializeObservedScoreReceipt("alice", { referenceTime, readCraft });
    const previous = saved!.envelope;
    vi.mocked(selectSourceManifest).mockResolvedValue({ status: "unavailable" });
    expect(await materializeObservedScoreReceipt("alice", { referenceTime, readCraft })).toMatchObject({ status: "stored", snapshot: { receipt: previous }, freshness: "stale", reason: "source_error" });
    expect(dbPublishObservedReceipt).toHaveBeenCalledTimes(1);
  });
  it("preserves the prior receipt when a reducer invariant fails before digest and publish", async () => {
    await materializeObservedScoreReceipt("alice", { referenceTime, readCraft });
    const previous = saved!.envelope;
    const reducer = vi.spyOn(evidenceReducer, "beginObservedEvidence").mockImplementationOnce(() => { throw new RangeError("Reducer invariant"); });
    try {
      expect(await materializeObservedScoreReceipt("alice", { referenceTime, readCraft })).toMatchObject({
        status: "stored", snapshot: { receipt: previous }, freshness: "stale", reason: "storage_error",
      });
      expect(dbPublishObservedReceipt).toHaveBeenCalledTimes(1);
    } finally { reducer.mockRestore(); }
  });
  it("preserves the prior receipt when a later source page fails after an earlier page", async () => {
    await materializeObservedScoreReceipt("alice", { referenceTime, readCraft });
    const previous = saved!.envelope;
    const window = createScoringWindow(referenceTime);
    const manifest = sourceManifest(window, 1);
    vi.mocked(selectSourceManifest).mockImplementation(async input => input.provider === "github"
      ? { status: "observed", manifest, inProgress: false, assertCurrent: async () => {}, pages: async function* () {
          yield [sourceEventFixture(manifest.coverage.source, window)];
          throw new Error("Page integrity failed");
        } }
      : { status: "unlinked" });
    expect(await materializeObservedScoreReceipt("alice", { referenceTime, readCraft })).toMatchObject({
      status: "stored", snapshot: { receipt: previous }, freshness: "stale", reason: "source_error",
    });
    expect(dbPublishObservedReceipt).toHaveBeenCalledTimes(1);
  });
  it("drains and verifies every selected page before publishing", async () => {
    const window = createScoringWindow(referenceTime);
    const manifest = sourceManifest(window, 1);
    let drained = false;
    vi.mocked(selectSourceManifest).mockImplementation(async input => input.provider === "github"
      ? { status: "observed", manifest, inProgress: false, assertCurrent: async () => {}, pages: async function* () {
          yield [sourceEventFixture(manifest.coverage.source, window)];
          drained = true;
        } }
      : { status: "unlinked" });
    vi.mocked(dbPublishObservedReceipt).mockImplementationOnce(async (_owner, _actor, envelope, semanticDigest, coreSemanticDigest) => {
      expect(drained).toBe(true);
      saved = { envelope, semanticDigest, coreSemanticDigest: coreSemanticDigest ?? null };
      return { status: "inserted", ...saved, trend: null, isCurrent: true };
    });
    expect((await materializeObservedScoreReceipt("alice", { referenceTime, readCraft })).status).toBe("issued");
    expect(drained).toBe(true);
  });
  it.each([0, 1])("preserves the prior receipt if a %i-event source loses authorization after page drain", async eventCount => {
    await materializeObservedScoreReceipt("alice", { referenceTime, readCraft });
    const previous = saved!.envelope;
    const window = createScoringWindow(referenceTime);
    const manifest = sourceManifest(window, eventCount);
    let drained = false;
    const assertCurrent = vi.fn(async () => { if (drained) throw new Error("Source authorization changed"); });
    vi.mocked(selectSourceManifest).mockImplementation(async input => input.provider === "github"
      ? { status: "observed", manifest, inProgress: false, assertCurrent, pages: async function* () {
          if (eventCount) yield [sourceEventFixture(manifest.coverage.source, window)];
          drained = true;
        } }
      : { status: "unlinked" });
    expect(await materializeObservedScoreReceipt("alice", { referenceTime, readCraft })).toMatchObject({
      status: "stored", snapshot: { receipt: previous }, freshness: "stale", reason: "source_error",
    });
    expect(assertCurrent).toHaveBeenCalledTimes(1);
    expect(dbPublishObservedReceipt).toHaveBeenCalledTimes(1);
  });
  it("never regresses an established non-trivial core to empty evidence -- refuses instead of silently publishing zero", async () => {
    vi.mocked(dbReadEngineeringEvidence).mockResolvedValueOnce(ledgerFixture());
    await materializeObservedScoreReceipt("alice", { referenceTime, readCraft });
    const established = saved!.envelope;
    expect(established.receipt.core.composite.exact).toBeGreaterThan(0);
    // A later report whose period extends past the established window (so the
    // Craft-only short-circuit's exact-window match fails) falls through to a
    // full recompute. The read-only source coordinator (#1335 phase 3) and an
    // empty ledger both report cleanly -- no source is "unavailable" -- but
    // nothing was actually collected. That must never overwrite an established,
    // non-trivial receipt with a zero built from missing evidence.
    const result = await materializeObservedScoreReceipt("alice", {
      referenceTime: "2026-09-09T10:00:00.000Z",
      reportUpdate: { endExclusive: "2026-09-09T09:00:00.000Z" },
      readCraft,
    });
    expect(result).toMatchObject({ status: "stored", snapshot: { receipt: established }, freshness: "stale", reason: "empty_evidence" });
    expect(saved!.envelope).toEqual(established);
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
    expect(selectSourceManifest).not.toHaveBeenCalled();
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
    vi.mocked(selectSourceManifest).mockImplementation(async () => { saved = null; return { status: "unavailable" }; });
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
  expect(selectSourceManifest).not.toHaveBeenCalled();
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
  expect(selectSourceManifest).toHaveBeenCalledWith(expect.objectContaining({ readOnly: true }));
});

it("reprojects retained normalized evidence with honest old dataThrough on UTC rollover", async () => {
  const oldWindow = createScoringWindow(referenceTime);
  const manifest = sourceManifest(oldWindow);
  const pages = async function* () { /* complete empty generation */ };
  vi.mocked(selectSourceManifest).mockImplementation(async input => input.provider === "github" ? { status: "observed", manifest, pages, assertCurrent: async () => {}, inProgress: false } : { status: "unlinked" });
  await materializeObservedScoreReceipt("alice", { referenceTime, readCraft });
  const original = saved!.envelope;
  vi.mocked(selectSourceManifest).mockImplementation(async input => input.provider === "github" ? { status: "stale", manifest, pages, assertCurrent: async () => {}, inProgress: false } : { status: "unlinked" });
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
  vi.mocked(selectSourceManifest).mockImplementation(async input => ({ status: input.provider === "github" ? "disabled" : "unlinked" }));
  expect((await materializeObservedScoreReceipt("alice", { referenceTime, readCraft })).status).toBe("issued");
  expect(saved!.envelope.receipt.receiptId).not.toBe(reportEnvelope.receipt.receiptId);
});

it("keeps public source ordinals and private identity stable when provider selection order reverses", async () => {
  const window = createScoringWindow(referenceTime);
  const github = sourceManifest(window);
  const gitlab: SourceObservationManifest = { ...github, id: "33333333-3333-4333-8333-333333333333",
    coverage: { ...github.coverage, source: { provider: "gitlab", host: "gitlab.com", subjectId: "alice" } } };
  vi.mocked(selectSourceManifest).mockImplementation(async input => input.provider === "github" || input.provider === "gitlab"
    ? { status: "observed", manifest: input.provider === "github" ? github : gitlab,
        pages: async function* () {}, assertCurrent: async () => {}, inProgress: false }
    : { status: "unlinked" });
  expect((await materializeObservedScoreReceipt("alice", { referenceTime, readCraft })).status).toBe("issued");
  const first = saved!;
  saved = null;
  const mutableProviders = RECEIPT_SOURCE_PROVIDERS as SourceProvider[];
  mutableProviders.reverse();
  try {
    expect((await materializeObservedScoreReceipt("alice", { referenceTime, readCraft })).status).toBe("issued");
    expect(saved!.envelope.receipt.coverage).toEqual(first.envelope.receipt.coverage);
    expect(saved!.envelope.receipt.exclusions).toEqual(first.envelope.receipt.exclusions);
    expect(saved!.coreSemanticDigest).toBe(first.coreSemanticDigest);
  } finally { mutableProviders.reverse(); }
});

it("deduplicates repeated source coverage before assigning public ordinals", async () => {
  const window = createScoringWindow(referenceTime);
  const manifest = sourceManifest(window);
  vi.mocked(selectSourceManifest).mockImplementation(async input => input.provider === "github" || input.provider === "gitlab"
    ? { status: "observed", manifest, pages: async function* () {}, assertCurrent: async () => {}, inProgress: false }
    : { status: "unlinked" });
  expect((await materializeObservedScoreReceipt("alice", { referenceTime, readCraft })).status).toBe("issued");
  const coverage = saved!.envelope.receipt.coverage;
  expect(coverage.filter(row => row.provider === "github")).toHaveLength(1);
  expect(coverage.map(row => row.sourceRef)).toEqual(coverage.map((_row, index) => `source-${index + 1}`));
});
