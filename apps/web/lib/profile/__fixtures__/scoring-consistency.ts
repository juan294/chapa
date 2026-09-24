import { createScoringWindow, sealObservedScoreReceipt, type CoreCountInputs, type PublicObservedCraft } from "@chapa/shared";
import { observedReceiptFixture } from "@/lib/history/__fixtures__/receipts-observed";
import { calculateReportCraftInputs } from "@/lib/insights/report-craft";
import { DEMO_STATS } from "@/lib/render/demoData";
import { observedReceiptViewModel } from "../score-view-model";

/** Synthetic, replayable current receipt (#1335 phase 5 — no more legacy v6
 * fields alongside it; every consumer now reads the v7.2 receipt view model
 * or raw `StatsData`). */
export async function scoringConsistencyFixture(options: { craft?: "none" | 57 | 0 | "expired"; boundary?: boolean } = {}) {
  const referenceTime = "2026-09-08T10:00:00.000Z";
  const window = createScoringWindow(referenceTime);
  const state = options.craft ?? "none";
  let craft: PublicObservedCraft = { status: "no_report", unlocked: false, report: null };
  if (state !== "none") {
    const expired = state === "expired";
    const calculation = calculateReportCraftInputs({ policyVersion: "v7.2", classifierRevision: "cc-outcomes-v7.2",
      window: expired ? createScoringWindow("2025-08-01T10:00:00.000Z") : window,
      reportPeriod: { startInclusive: expired ? "2025-07-01T00:00:00.000Z" : "2026-09-01T00:00:00.000Z", endExclusive: expired ? "2025-08-01T00:00:00.000Z" : "2026-09-08T00:00:00.000Z" },
      totalSessions: 10, outcomes: state === 0
        ? { fully_achieved: 0, mostly_achieved: 0, partially_achieved: 0, not_achieved: 10 }
        : { fully_achieved: 4, mostly_achieved: 2, partially_achieved: 1, not_achieved: 1 },
      unknownSessions: state === 0 ? 0 : 1, unclassifiedSessions: state === 0 ? 0 : 1 });
    if (calculation.status !== "valid" || calculation.result.status !== "scored") throw new Error("Invalid consistency report fixture");
    const report = { reportRef: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", supersedesReportRef: null, inputs: calculation.inputs, result: calculation.result };
    craft = expired ? { status: "expired", unlocked: true, report: null, lastReport: report } : { status: "scored", unlocked: true, report };
  }
  const fixed = (count: number) => ({ lower: count, upper: count });
  const boundaryCounts: CoreCountInputs = { deliveryUnits: fixed(14), quality: { rationale: fixed(1), verification: fixed(1), review_or_correction: fixed(1), outcome_followup: fixed(1) }, activeIsoWeeks: fixed(35), eligibleProjects: fixed(4), eligibleCategories: fixed(4) };
  const base = await observedReceiptFixture({ referenceTime, craft, ...(options.boundary ? { counts: boundaryCounts } : {}),
    receiptId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", revisionId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" });
  const envelope = await sealObservedScoreReceipt({ ...base.receipt, coverage: [{ sourceRef: "source-1", provider: "github", status: "partial", dataThrough: referenceTime, discovery: "owned_and_contributed", accessibleRepositoryCount: 4, repositoryDiscoveryComplete: false, reasonCodes: ["discovery_incomplete"], unknownPeriods: [] }] });
  const model = observedReceiptViewModel("alice", { receipt: envelope, trend: null }, Date.parse(referenceTime));
  const stats = { ...DEMO_STATS, handle: "alice", displayName: "Alice Example", fetchedAt: referenceTime };
  return { stats, model, envelope };
}
