import "server-only";
import { toDateString } from "@/lib/utils/date";
import { listCollectionJobsForDate } from "@/lib/db/collection-queue";
import { dbIsScoringSubject } from "@/lib/db/scoring-subjects";
import { dbReadObservedReceipt } from "@/lib/db/score-receipts-observed";
import { captureServerError } from "@/lib/analytics/server-errors";
import { readRenderableReceipt } from "@/lib/profile/score-model";
import type { ScoringRenderSelection } from "@/lib/scoring-render-selection";
import { deriveScoringStatus, type ReceiptSummary } from "./status";
import type { ScoringStatus } from "./scoring-status";

/**
 * True when the existing current-receipt authority (`readRenderableReceipt`
 * — the same single read `materializeProfile` itself already relies on)
 * finds a drawable, non-retracted v7.2 receipt for `handle`. Callers use
 * this to decide whether `readScoringStatus` below is even necessary: a
 * drawable receipt already proves the render is "ready", so paying for
 * `readScoringStatus`'s extra subject + jobs reads (3 DB reads total) would
 * be redundant — and a warm cache hit for a ready receipt must never pay
 * for them at all (#1335 phase 4 perf fix, `lib/monitoring/latency-slo.ts`'s
 * 800ms cache-hit budget). `false` — no receipt, a retracted one, or the
 * read itself failing — is the only case that should still call
 * `readScoringStatus`. See badge.svg/og-image/the share page's status-
 * gating blocks for the call site.
 */
export async function hasDrawableCurrentReceipt(handle: string, scoringSelection: ScoringRenderSelection): Promise<boolean> {
  const receipt = await readRenderableReceipt(handle, scoringSelection);
  return !!(receipt && "receipt" in receipt);
}

/**
 * Reads the owner-visible `ScoringStatus` for a handle (#1335 phase 4):
 * `null` means the authority read itself failed (a genuine DB error), which
 * every caller (badge, OG, share, `/api/scoring/status`) must render as
 * unavailable/no-store -- never silently folded into "unregistered" or any
 * other real state.
 *
 * Part B's badge/OG/share routes import this exact name and path.
 */
export async function readScoringStatus(handle: string): Promise<ScoringStatus | null> {
  const owner = handle.toLowerCase();
  try {
    const registration = await dbIsScoringSubject(owner);
    if (registration === "unavailable") return null;
    if (registration === "unregistered") return { kind: "unregistered" };

    const today = toDateString(new Date());
    const [jobs, receiptRead] = await Promise.all([
      listCollectionJobsForDate(owner, today),
      dbReadObservedReceipt(owner),
    ]);
    if (receiptRead.status === "unavailable") return null;

    // "found" covers both a live current receipt and a receipt that was
    // later retracted or superseded -- either way the owner has a scoring
    // history, so `hasPriorReceipt` (derived from a non-null receipt below)
    // is true. Only the true absence of any row (dbReadObservedReceipt's
    // "missing" status) means this owner has never been scored.
    const receipt: ReceiptSummary | null = receiptRead.status === "found"
      ? { date: receiptRead.envelope.receipt.window.referenceDate, current: receiptRead.isCurrent && receiptRead.envelope.receipt.action !== "retract" }
      : null;

    return deriveScoringStatus(jobs, receipt, true);
  } catch (error) {
    // An authority-read failure must stay observable, not silently become
    // `null` with no trace -- the same "durable write/read failure must be
    // observable" rule as everywhere else in this codebase. Only the handle
    // and route are attached; captureServerError's own sanitize() still
    // redacts anything token-shaped inside the wrapped message.
    await captureServerError({
      route: "lib/collection/read-scoring-status",
      statusCode: 500,
      error: new Error(`readScoringStatus failed for ${owner}: ${error instanceof Error ? error.message : String(error)}`),
    });
    return null;
  }
}
