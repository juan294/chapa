import "server-only";
import type { ClientImpactV6Result } from "@chapa/shared";
import { readObservedScoreReceipt, type ObservedReceiptSnapshot } from "./score-receipt-observed";
import { readScoringRenderSelection, type ScoringRenderSelection } from "@/lib/scoring-render-selection";
import { legacyViewModel, observedReceiptViewModel, type ScoreViewModel } from "./score-view-model";

/** Capture policy once, then use only that policy's durable receipt authority. */
export async function resolveScoreModel(handle: string, impact: ClientImpactV6Result, selection?: ScoringRenderSelection): Promise<ScoreViewModel> {
  const captured = selection ?? await readScoringRenderSelection();
  return scoreModelFrom(handle, impact, await readRenderableReceipt(handle, captured), captured);
}
export type RenderableReceipt = ObservedReceiptSnapshot | { readonly unavailable: true } | null;
export async function readRenderableReceipt(handle: string, selection?: ScoringRenderSelection): Promise<RenderableReceipt> {
  const captured = selection ?? await readScoringRenderSelection();
  if (!captured.enabled) return null;
  const result = await readObservedScoreReceipt(handle).catch(() => ({ status: "unavailable" as const }));
  if (result.status === "unavailable") return { unavailable: true };
  return result.status === "found" && result.envelope.receipt.action !== "retract"
    ? { receipt: result.envelope, trend: result.trend } : null;
}
/**
 * `statsFreshness` — from `readStats`/`materializeProfile`'s
 * `current`/`stale` distinction (badge-source-outage-resilience, 2026-09-22)
 * — only ever reaches the labelled v6 aggregate: a committed v7/v7.2 receipt
 * carries its own freshness authority (`observedReceiptViewModel` derives it
 * from the receipt's own window), and a receipt-read failure keeps the
 * existing `"unavailable"` signal regardless of the stats underneath it.
 */
export function scoreModelFrom(handle: string, impact: ClientImpactV6Result, receipt: RenderableReceipt, selection?: ScoringRenderSelection, statsFreshness?: "current" | "stale"): ScoreViewModel {
  if (receipt && "unavailable" in receipt) return { ...legacyViewModel(impact), freshness: "unavailable" };
  return receipt ? observedReceiptViewModel(handle, receipt, selection?.capturedAt) : legacyViewModel(impact, { freshness: statsFreshness });
}
