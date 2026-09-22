import { canonicalJson, createScoringWindow, sealObservedScoreReceipt, verifyObservedScoreReceipt, type HashedObservedScoreReceipt, type PublicObservedCraft, type ReportCraftInputs, type ScoringWindow } from "@chapa/shared";
import { calculateReportCraftInputs, reportCraftPeriodStatus } from "@/lib/insights/report-craft";
import { prepareReportCraftImport, type PreparedReportCraftImport } from "@/lib/insights/report-craft-import";
import { dbReadObservedReceipt, type ObservedReceiptPublication } from "./score-receipts-observed";
import { getSupabase } from "./supabase";

export type ReportCraftStorage = {
  status: "stored"; persisted: true; reportId: string; selectedReportId: string | null; generation: number; consented: boolean;
  selection: "selected" | "unchanged" | "insufficient" | "outside_window" | "older";
} | { status: "consent_required" | "correction_required" | "failed"; persisted: false; supersedesReportId?: string };
export type ReportCraftRead = { status: "found"; craft: PublicObservedCraft; selectedReportId: string | null; generation: number }
  | { status: "not_consented" | "unavailable" };
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const generation = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
function record(value: unknown): Record<string, unknown> { if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid report storage response"); return value as Record<string, unknown>; }
async function rpc(name: string, args: Record<string, unknown>): Promise<unknown> {
  const db = getSupabase(); if (!db) throw new Error("Report storage unavailable");
  const result = await db.rpc(name, args); if (result.error) throw new Error("Report storage RPC failed"); return result.data;
}
function failure(operation: string) { console.error(`[TABLE_FALLBACK] report Craft ${operation} failed`); }

/** Revalidates the private DTO before entering one consent/selection transaction. */
export async function dbStoreReportCraft(owner: string, actor: string, prepared: PreparedReportCraftImport, options: { publicationAcknowledged: boolean; supersedesReportId?: string }): Promise<ReportCraftStorage> {
  try {
    const verified = await prepareReportCraftImport(JSON.parse(prepared.canonicalBody), prepared.capturedAt);
    if (canonicalJson(verified) !== canonicalJson(prepared)) throw new Error("Report preparation mismatch");
    if (options.supersedesReportId !== undefined && !uuid(options.supersedesReportId)) throw new Error("Invalid report correction");
    const result = record(await rpc("scoring_report_craft_store", { p_owner: owner.toLowerCase(), p_actor: actor.toLowerCase(), p_prepared: verified,
      p_acknowledged: options.publicationAcknowledged, p_supersedes: options.supersedesReportId ?? null }));
    if (result.status === "consent_required") return { status: "consent_required", persisted: false };
    if (result.status === "correction_required") return { status: "correction_required", persisted: false, ...(uuid(result.supersedesReportId) ? { supersedesReportId: result.supersedesReportId } : {}) };
    if (result.status !== "stored" || result.persisted !== true || !uuid(result.reportId) || !(result.selectedReportId === null || uuid(result.selectedReportId))
      || !generation(result.generation) || result.consented !== true || !["selected", "unchanged", "insufficient", "outside_window", "older"].includes(String(result.selection))) throw new Error("Invalid report admission");
    return { status: "stored", persisted: true, reportId: result.reportId, selectedReportId: result.selectedReportId, generation: result.generation,
      consented: true, selection: result.selection as Extract<ReportCraftStorage, { status: "stored" }>["selection"] };
  } catch { failure("admission"); return { status: "failed", persisted: false }; }
}
function replayRow(value: unknown) {
  const row = record(value);
  if (!uuid(row.id) || !(row.supersedes_id === null || uuid(row.supersedes_id))) throw new Error("Invalid report identity");
  const original = calculateReportCraftInputs(row.canonical_inputs);
  if (original.status !== "valid" || canonicalJson(original.result) !== canonicalJson(row.result)) throw new Error("Invalid durable report arithmetic");
  return { reportRef: row.id, supersedesReportRef: row.supersedes_id, inputs: original.inputs, result: original.result };
}
/** Selected identity is durable; current eligibility is evaluated against the caller's exact window. */
export async function dbReadReportCraft(owner: string, window: ScoringWindow): Promise<ReportCraftRead> {
  try {
    if (canonicalJson(createScoringWindow(window.referenceTime)) !== canonicalJson(window)) throw new Error("Invalid report window");
    const value = await rpc("scoring_report_craft_read", { p_owner: owner.toLowerCase(), p_reference: window.referenceTime });
    if (value === null) return { status: "not_consented" };
    const row = record(value);
    if (!(row.selectedReportId === null || uuid(row.selectedReportId)) || !generation(row.generation)) throw new Error("Invalid report selection");
    let craft: PublicObservedCraft = { status: "no_report", unlocked: false, report: null };
    if (row.selectedReportId !== null) {
      const selected = replayRow(row.selected);
      if (selected.reportRef !== row.selectedReportId || selected.result.status !== "scored") throw new Error("Invalid selected report");
      const lastReport = { ...selected, result: selected.result };
      if (selected.inputs.reportPeriod.endExclusive > window.referenceTime) {
        // A newer selected report cannot be projected into an older core context.
        return { status: "unavailable" };
      }
      const eligibility = reportCraftPeriodStatus(window, selected.inputs.reportPeriod);
      if (eligibility === "historical") craft = { status: "expired", unlocked: true, report: null, lastReport };
      else if (eligibility === "straddling") craft = { status: "unavailable", unlocked: true, report: null, lastReport, reason: "outside_window" };
      else {
        const current = calculateReportCraftInputs({ ...selected.inputs, window });
        if (current.status !== "valid" || current.result.status !== "scored") throw new Error("Invalid current report");
        craft = { status: "scored", unlocked: true, report: { reportRef: selected.reportRef, supersedesReportRef: selected.supersedesReportRef, inputs: current.inputs, result: current.result } };
      }
    } else if (row.insufficient !== null) {
      const insufficient = replayRow(row.insufficient);
      if (insufficient.result.status !== "insufficient_report_data") throw new Error("Invalid insufficient report");
      if (insufficient.inputs.reportPeriod.endExclusive <= window.referenceTime && reportCraftPeriodStatus(window, insufficient.inputs.reportPeriod) === "current") {
        const current = calculateReportCraftInputs({ ...insufficient.inputs, window } as ReportCraftInputs);
        if (current.status !== "valid" || current.result.status !== "insufficient_report_data") throw new Error("Invalid insufficient replay");
        craft = { status: "insufficient_report_data", unlocked: false, report: { inputs: current.inputs, result: current.result } };
      }
    }
    return { status: "found", craft, selectedReportId: row.selectedReportId, generation: row.generation };
  } catch { failure("read"); return { status: "unavailable" }; }
}

/** Selection fence and consent are checked under the same lock as durable receipt publication. */
export async function dbPublishObservedReceiptWithReport(owner: string, actor: string, envelope: HashedObservedScoreReceipt, semanticDigest: string, selectedReportId: string | null, selectedGeneration: number, expectedBaselineRevisionId?: string, coreSemanticDigest?: string): Promise<ObservedReceiptPublication> {
  try {
    if (!/^[0-9a-f]{64}$/.test(semanticDigest) || !(selectedReportId === null || uuid(selectedReportId)) || !generation(selectedGeneration) || (expectedBaselineRevisionId !== undefined && !uuid(expectedBaselineRevisionId)) || (coreSemanticDigest !== undefined && !/^[0-9a-f]{64}$/.test(coreSemanticDigest))) throw new Error("Invalid publication fence");
    const receipt = await verifyObservedScoreReceipt(envelope);
    const result = record(await rpc("scoring_observed_publish_with_report", { p_owner: owner.toLowerCase(), p_actor: actor.toLowerCase(), p_receipt: receipt,
      p_canonical: canonicalJson(receipt), p_semantic_digest: semanticDigest, p_selected_report: selectedReportId, p_generation: selectedGeneration, p_expected_receipt: expectedBaselineRevisionId ?? null, p_core_semantic_digest: coreSemanticDigest ?? null }));
    if ((result.status !== "inserted" && result.status !== "duplicate") || typeof result.canonicalReceipt !== "string" || !uuid(result.revisionId)) throw new Error("Invalid report publication");
    const winner = await sealObservedScoreReceipt(JSON.parse(result.canonicalReceipt));
    const stored = await dbReadObservedReceipt(owner, result.revisionId);
    if (stored.status !== "found" || canonicalJson(stored.envelope) !== canonicalJson(winner) || stored.semanticDigest !== semanticDigest || (coreSemanticDigest !== undefined && stored.coreSemanticDigest !== coreSemanticDigest)
      || (result.status === "inserted" && canonicalJson(winner) !== canonicalJson(envelope))) throw new Error("Report publication unavailable");
    return { ...stored, status: result.status };
  } catch { failure("publication"); return { status: "failed" }; }
}
