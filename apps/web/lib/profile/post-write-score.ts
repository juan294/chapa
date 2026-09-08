import { dbReadObservedReceipt } from "@/lib/db/score-receipts-observed";
import type { ScoringRenderSelection } from "@/lib/scoring-render-selection";
import { observedReceiptViewModel } from "./score-view-model";
import { publicScoreProjection } from "./public-score-projection";

/** Read the committed current receipt; private publication metadata never leaves this seam. */
export async function readPublicObservedScore(handle: string, selection: ScoringRenderSelection) {
  if (!selection.cacheable) return { status: "unavailable" } as const;
  if (!selection.enabled) return { status: "missing" } as const;
  const stored = await dbReadObservedReceipt(handle);
  if (stored.status !== "found") return { status: stored.status };
  if (!stored.isCurrent || stored.envelope.receipt.action === "retract") return { status: "missing" } as const;
  const model = observedReceiptViewModel(handle, { receipt: stored.envelope, trend: stored.trend }, selection.capturedAt);
  const projection = publicScoreProjection(model);
  return { status: "current", projection: { ...projection, compositeScore: projection.displayScore, adjustedComposite: projection.displayScore, displayAdjustedComposite: projection.displayScore, displayTier: projection.tier } } as const;
}

/** Publication can fail after a legacy snapshot write. Return the last committed
 * current score as stale, never the newly computed legacy value as current. */
export async function postWriteScore(handle: string, selection: ScoringRenderSelection, issuance: "issued" | "skipped" | "failed") {
  if (!selection.cacheable) return { status: "unavailable", publication: "pending" } as const;
  if (!selection.enabled) return { status: "legacy" } as const;
  const published = await readPublicObservedScore(handle, selection);
  if (published.status === "current") {
    const projection = issuance === "failed" ? { ...published.projection, freshness: "stale" as const, scoring: { ...published.projection.scoring, freshness: "stale" as const } } : published.projection;
    return { status: "current", publication: issuance === "failed" ? "pending" : issuance === "issued" ? "published" : "unchanged", projection } as const;
  }
  if (published.status === "missing" && issuance === "skipped") return { status: "legacy" } as const;
  return { status: "unavailable", publication: "pending" } as const;
}
