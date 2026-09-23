import "server-only";
import { listCollectionJobsForDate, listPendingFanIns, type CollectionJob } from "@/lib/db/collection-queue";
import { issueScoreReceipt, type ReceiptIssuanceOutcome } from "@/lib/profile/issue-receipt";
import { dbRecordScoringIssuanceAttempt } from "@/lib/db/scoring-issuance";
import { captureServerError, captureOperationalAlert } from "@/lib/analytics/server-errors";
import { scheduleServerEvent } from "@/lib/analytics/schedule-server-event";
import { cacheSetNxStatus } from "@/lib/cache/redis";

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
};

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
