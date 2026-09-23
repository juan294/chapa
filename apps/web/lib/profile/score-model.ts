import "server-only";
import { readObservedScoreReceipt, type ObservedReceiptSnapshot } from "./score-receipt-observed";
import { observedReceiptViewModel, type ScoreViewModel } from "./score-view-model";

/**
 * The sole v7.2 receipt authority every scored surface shares (#1335 phase
 * 5 — "delete v6"). `null` covers a genuine "no receipt yet", a retracted
 * receipt, and a failed authority read alike: by the time any of badge.svg,
 * og-image or the share page reaches this, it has already resolved its own
 * `ScoringStatus` placeholder (collecting/action_needed/unregistered/
 * unavailable) for exactly those cases — this is the second, narrower read
 * those surfaces themselves already perform to decide whether there is a
 * drawable receipt at all.
 */
export type RenderableReceipt = ObservedReceiptSnapshot | null;

export async function readRenderableReceipt(handle: string): Promise<RenderableReceipt> {
  const result = await readObservedScoreReceipt(handle).catch(() => ({ status: "unavailable" as const }));
  if (result.status !== "found" || result.envelope.receipt.action === "retract") return null;
  return { receipt: result.envelope, trend: result.trend };
}

/** Capture the receipt once, then project it. `undefined` means there is
 * nothing to draw — the caller's own `ScoringStatus` placeholder governs
 * what renders instead. */
export async function resolveScoreModel(handle: string): Promise<ScoreViewModel | undefined> {
  return scoreModelFrom(handle, await readRenderableReceipt(handle));
}

export function scoreModelFrom(handle: string, receipt: RenderableReceipt): ScoreViewModel | undefined {
  return receipt ? observedReceiptViewModel(handle, receipt) : undefined;
}
