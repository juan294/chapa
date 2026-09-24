import { dbReadObservedReceipt } from "@/lib/db/score-receipts-observed";
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
export async function readPublicObservedScore(handle: string) {
  const stored = await dbReadObservedReceipt(handle);
  if (stored.status !== "found") return { status: stored.status };
  if (!stored.isCurrent || stored.envelope.receipt.action === "retract") return { status: "missing" } as const;
  const model = observedReceiptViewModel(handle, { receipt: stored.envelope, trend: stored.trend });
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
 * `null` means the status authority read itself failed -- already
 * `readScoringStatus`'s own captured/observable failure mode.
 */
export async function postWriteScore(handle: string): Promise<ScoringStatus | null> {
  return readScoringStatus(handle);
}

/**
 * The enqueue-then-report shape shared by refresh, recalculate and generate
 * (#1335 phase 4): (re-)enqueue collection for `reason`, run a bounded
 * background slice (`scheduleCollectionAdvance`) so the caller doesn't wait a
 * full 5-minute cron tick for first progress, then report back the same
 * `ScoringStatus` every other surface renders. v7.2 is the one rendered
 * policy (#1335 phase 5 — the retired DB-backed render-selector flag this
 * used to gate enqueueing on), so every call now always enqueues.
 *
 * `/api/admin/bulk-recalculate` and `/api/scoring/status`'s retry action stay
 * on their own path rather than this helper: bulk-recalculate chooses per
 * handle between a direct `maybeIssue` (when today's jobs are already
 * complete) and an `admin`-reason enqueue, and paces `scheduleCollectionAdvance`
 * once per batch rather than once per handle; a status retry has no gate to
 * apply, since retrying only makes sense for an already-registered subject.
 */
export async function enqueueAndReportScoringStatus(
  handle: string,
  reason: EnqueueReason,
): Promise<ScoringStatus | null> {
  await enqueueCollection(handle, reason);
  scheduleCollectionAdvance();
  return postWriteScore(handle);
}
