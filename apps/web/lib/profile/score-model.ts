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
export function scoreModelFrom(handle: string, impact: ClientImpactV6Result, receipt: RenderableReceipt, selection?: ScoringRenderSelection): ScoreViewModel {
  if (receipt && "unavailable" in receipt) return { ...legacyViewModel(impact), freshness: "unavailable" };
  return receipt ? observedReceiptViewModel(handle, receipt, selection?.capturedAt) : legacyViewModel(impact);
}
