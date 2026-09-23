import "server-only";
import { listCollectionJobsForDate, listPendingFanIns, type CollectionJob } from "@/lib/db/collection-queue";
import { issueScoreReceipt, type ReceiptIssuanceOutcome } from "@/lib/profile/issue-receipt";
import { dbRecordScoringIssuanceAttempt } from "@/lib/db/scoring-issuance";
import { captureServerError, captureOperationalAlert } from "@/lib/analytics/server-errors";
import { scheduleServerEvent } from "@/lib/analytics/schedule-server-event";
import { cacheSetNxStatus } from "@/lib/cache/redis";
import { readRenderableReceipt, type RenderableReceipt } from "@/lib/profile/score-model";
import { observedReceiptViewModel } from "@/lib/profile/score-view-model";
import { scoringObservation, compareScoringObservations, type ScoringObservation } from "@/lib/history/scoring-observations";
import { notifyObservedScoreChange } from "@/lib/email/score-bump";

/**
 * Issuance fan-in (#1335 phase 4). A receipt is issued exactly when every
 * one of an owner's connected sources for the day is complete. Every outcome
 * -- issued, unchanged, or a specific failure reason -- is recorded in
 * `scoring_issuance_attempts` and emitted as `scoring_issuance_outcome`; a
 * `failed` outcome is captured and paged, and leaves no issued/unchanged row
 * behind, so `runCollectionTick`'s retry sweep (`retryPendingFanIns` below)
 * picks the day back up on the next tick rather than losing it silently.
 */
export interface FanInDeps {
  readonly listJobsForDate: (owner: string, referenceDate: string) => Promise<readonly CollectionJob[]>;
  readonly issue: (owner: string, options: { referenceTime: string }) => Promise<ReceiptIssuanceOutcome>;
  readonly recordAttempt: (owner: string, referenceDate: string, outcome: ReceiptIssuanceOutcome) => Promise<boolean>;
  readonly scheduleEvent: typeof scheduleServerEvent;
  readonly captureError: typeof captureServerError;
  readonly alertFailure: (owner: string, referenceDate: string, reason: string) => Promise<void>;
  /** Reads the owner's current receipt, read once before issuing (the
   * pre-issuance baseline) and once after a fresh `issued` outcome (#1335
   * phase 5.7: `notifyObservedScoreChange` is kept, re-homed here from the
   * old synchronous warm-cache issuance it used to sit beside). */
  readonly readReceipt: (owner: string) => Promise<RenderableReceipt>;
  readonly notifyScoreChange: typeof notifyObservedScoreChange;
}

/** Dedupe key mirrors the warm-cache ceiling alert's pattern (#1162 / BE-L5):
 * one page per owner per day, not one per failed fan-in attempt. */
async function alertScoringCollectionFailed(owner: string, referenceDate: string, reason: string): Promise<void> {
  const guardStatus = await cacheSetNxStatus(`scoring:issuance-failed-alerted:${owner}:${referenceDate}`, 86400);
  if (guardStatus === "exists") return;
  await captureOperationalAlert({
    signal: "scoring_collection_failed",
    severity: "P2",
    summary: `Score issuance failed for ${owner} (${referenceDate}): ${reason}`,
    route: "lib/collection/fan-in",
    properties: { owner, referenceDate, reason },
  });
}

export const productionFanInDeps: FanInDeps = {
  listJobsForDate: listCollectionJobsForDate,
  issue: issueScoreReceipt,
  recordAttempt: dbRecordScoringIssuanceAttempt,
  scheduleEvent: scheduleServerEvent,
  captureError: captureServerError,
  alertFailure: alertScoringCollectionFailed,
  readReceipt: readRenderableReceipt,
  notifyScoreChange: notifyObservedScoreChange,
};

/** `scoringObservation` needs a `ScoreViewModel`; a receipt read that came
 * back null or unavailable has nothing to observe. */
function observationFrom(owner: string, receipt: RenderableReceipt): ScoringObservation | null {
  if (!receipt || "unavailable" in receipt) return null;
  return scoringObservation(observedReceiptViewModel(owner, receipt));
}

/**
 * Issues a receipt for `owner`/`referenceDate` if, and only if, every job
 * enqueued for that owner and day has reached `complete`. A day with no jobs
 * at all never issues (there is nothing to fan in from yet).
 */
export async function maybeIssue(
  owner: string,
  referenceDate: string,
  referenceTime: string,
  deps: FanInDeps = productionFanInDeps,
): Promise<void> {
  const jobs = await deps.listJobsForDate(owner, referenceDate);
  if (jobs.length === 0 || jobs.some((job) => job.state !== "complete")) return;

  // The pre-issuance baseline: read before, not after, calling deps.issue --
  // issuance is what's about to change this, so the "previous" side of the
  // comparison has to be captured first. A read failure here (thrown or a
  // reported `unavailable`) just means no notification is possible; it must
  // never block or fail issuance itself.
  const before = await deps.readReceipt(owner).catch((): RenderableReceipt => null);
  const previousObserved = observationFrom(owner, before);

  const outcome = await deps.issue(owner, { referenceTime });
  await deps.recordAttempt(owner, referenceDate, outcome);
  deps.scheduleEvent("scoring_issuance_outcome", {
    handle: owner,
    referenceDate,
    outcome: outcome.status,
    ...(outcome.status === "failed" ? { reason: outcome.reason } : {}),
  });

  if (outcome.status === "failed") {
    await deps.captureError({
      route: "lib/collection/fan-in",
      statusCode: 500,
      error: new Error(`Issuance failed for ${owner} (${referenceDate}): ${outcome.reason}`),
    });
    await deps.alertFailure(owner, referenceDate, outcome.reason);
    return;
  }

  // Only a genuine new revision is worth comparing and notifying about --
  // "unchanged" means nothing moved, and there is no earlier state to
  // compare against on a subject's first-ever issuance.
  if (outcome.status !== "issued" || !previousObserved) return;

  try {
    const after = await deps.readReceipt(owner);
    const currentObserved = observationFrom(owner, after);
    if (!currentObserved) return;
    await deps.notifyScoreChange(owner, compareScoringObservations(previousObserved, currentObserved));
  } catch {
    // Never let the notification side-channel fail fan-in itself -- the
    // receipt is already durably issued at this point.
  }
}

/** The worker's `onJobComplete` hook (`lib/collection/worker.ts`): called
 * once per job that reaches `complete`, so `maybeIssue` can check whether
 * that job's owner/day is now fully done.
 */
export async function onJobComplete(
  job: Pick<CollectionJob, "ownerHandle" | "referenceDate" | "referenceTime">,
  deps: FanInDeps = productionFanInDeps,
): Promise<void> {
  await maybeIssue(job.ownerHandle, job.referenceDate, job.referenceTime, deps);
}

/**
 * Re-runs fan-in for every (owner, day) whose jobs are all complete but has
 * no recorded issued/unchanged attempt yet — a worker crash between the last
 * job completing and `onJobComplete`, or a day whose every issuance attempt
 * so far has failed. `runCollectionTick` calls this once at the start of
 * every tick, before claiming new work.
 */
export async function retryPendingFanIns(limit = 50, deps: FanInDeps = productionFanInDeps): Promise<void> {
  const pending = await listPendingFanIns(limit);
  for (const { ownerHandle, referenceDate, referenceTime } of pending) {
    await maybeIssue(ownerHandle, referenceDate, referenceTime, deps);
  }
}
