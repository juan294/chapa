import "server-only";
import { toDateString } from "@/lib/utils/date";
import { listCollectionJobsForDate } from "@/lib/db/collection-queue";
import { dbIsScoringSubject } from "@/lib/db/scoring-subjects";
import { dbReadObservedReceipt } from "@/lib/db/score-receipts-observed";
import { deriveScoringStatus, type ReceiptSummary } from "./status";
import type { ScoringStatus } from "./scoring-status";

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
  try {
    const owner = handle.toLowerCase();

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
  } catch {
    return null;
  }
}
