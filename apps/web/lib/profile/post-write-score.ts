import { dbReadObservedReceipt } from "@/lib/db/score-receipts-observed";
import type { ScoringRenderSelection } from "@/lib/scoring-render-selection";
import { observedReceiptViewModel } from "./score-view-model";
import { publicScoreProjection } from "./public-score-projection";
import { readScoringStatus } from "@/lib/collection/read-scoring-status";
import { enqueueCollection, scheduleCollectionAdvance } from "@/lib/collection/enqueue";
import type { EnqueueReason } from "@/lib/db/collection-queue";
import type { ScoringStatus } from "@/lib/collection/scoring-status";

/** Read the committed current receipt; private publication metadata never
 * leaves this seam. Unchanged by #1335 phase 4 -- this backs public reads
 * (`/api/profile/:handle`, `/api/insights/:handle`, the share page's stored
 * profile), a different concern from `postWriteScore` below (a write route's
 * own scoring status after enqueueing collection). */
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

/**
 * The owner-visible scoring status a write route (refresh, recalculate,
 * generate, admin bulk-recalculate) reports after enqueueing collection
 * (#1335 phase 4). Replaces the old `{status:"legacy"|"current"|"unavailable"}`
 * shape: issuance is no longer synchronous with the write (it happens only
 * from fan-in, once collection completes), so there is nothing left for a
 * write route to read back except the same `ScoringStatus` every other
 * surface renders.
 *
 * `null` means either the render flag is off (legacy v6 still governs this
 * handle, so the route's caller falls back to its plain v6 response) or the
 * status authority read itself failed -- the caller cannot tell those apart
 * from this return value alone, which is fine: both cases mean "nothing new
 * to report from the v7.2 side", and a failed authority read is already
 * `readScoringStatus`'s own captured/observable failure mode.
 */
export async function postWriteScore(handle: string, selection: ScoringRenderSelection): Promise<ScoringStatus | null> {
  if (!selection.enabled) return null;
  return readScoringStatus(handle);
}

/**
 * The enqueue-then-report shape shared by refresh, recalculate and generate
 * (#1335 phase 4): (re-)enqueue collection for `reason` when v7.2 rendering
 * is on, run a bounded background slice (`scheduleCollectionAdvance`) so the
 * caller doesn't wait a full 5-minute cron tick for first progress, then
 * report back the same `ScoringStatus` every other surface renders.
 *
 * `/api/admin/bulk-recalculate` and `/api/scoring/status`'s retry action stay
 * on their own path rather than this helper: bulk-recalculate chooses per
 * handle between a direct `maybeIssue` (when today's jobs are already
 * complete) and an `admin`-reason enqueue, and paces `scheduleCollectionAdvance`
 * once per batch rather than once per handle; a status retry has no
 * `selection.enabled` gate to apply, since retrying only makes sense for an
 * already-registered subject.
 */
export async function enqueueAndReportScoringStatus(
  handle: string,
  reason: EnqueueReason,
  selection: ScoringRenderSelection,
): Promise<ScoringStatus | null> {
  if (selection.enabled) {
    await enqueueCollection(handle, reason);
    scheduleCollectionAdvance();
  }
  return postWriteScore(handle, selection);
}
