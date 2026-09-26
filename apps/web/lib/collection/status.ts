import type { CollectionJob, CollectionJobState } from "@/lib/db/collection-queue";
import type { ProviderStatus, ProviderStatusReason, ScoringStatus } from "./scoring-status";

/**
 * The current receipt as it matters to `deriveScoringStatus`: just enough to
 * tell "ready" from "still collecting" and to know whether an owner ever had
 * a receipt at all (#1335 phase 4). `current: true` is the drawable receipt a
 * surface renders; `current: false` means a receipt exists in history (e.g.
 * superseded or withdrawn) but nothing is currently published -- that still
 * sets `hasPriorReceipt`, distinguishing "this owner has been scored before"
 * from "this is a brand-new subject's first collection".
 */
export interface ReceiptSummary {
  readonly date: string;
  readonly current: boolean;
}

const IN_PROGRESS_STATES: ReadonlySet<CollectionJobState> = new Set([
  "queued",
  "running",
  "waiting_rate_limit",
  "retrying",
]);

/** True while `job` can still add operations (#1342): a complete job has
 * finished discovery by definition, regardless of what its progress row
 * says; any other job is still discovering unless its progress explicitly
 * says otherwise. A legacy row written before this field existed (no
 * `discovering` key at all) reads as `undefined`, which is not `=== false`,
 * so it is treated as still discovering -- the safe default, since a legacy
 * in-flight checkpoint may still be mid-scaffold. */
function discovering(job: CollectionJob): boolean {
  return job.state !== "complete" && job.progress.discovering !== false;
}

function clampPercent(job: CollectionJob): number | null {
  if (job.state === "complete") return 100;
  if (discovering(job)) return null;
  const { operationsDone, operationsKnown } = job.progress;
  if (operationsKnown <= 0) return 0;
  return Math.min(99, Math.floor((operationsDone / operationsKnown) * 100));
}

function reasonForFailedJob(job: CollectionJob): ProviderStatusReason {
  const stop = job.lastStop;
  if (stop?.operation === "event_limit") return "capacity";
  if (stop?.stopKind === "storage" || stop?.operation === "finish" || stop?.operation === "checkpoint" || stop?.operation === "prior_source_storage") return "storage";
  return stop?.stopKind === "not_accessible" ? "reconnect" : "failed";
}

function toProviderStatus(job: CollectionJob): ProviderStatus {
  const percent = clampPercent(job);
  const base = { provider: job.provider, state: job.state, percent };

  if (job.state === "waiting_rate_limit") {
    return { ...base, resumesAt: job.nextRunAt, reason: "rate_limited" };
  }
  if (job.state === "retrying") {
    return { ...base, resumesAt: job.nextRunAt, attempt: job.attempt, reason: "temporary" };
  }
  if (job.state === "failed") {
    return { ...base, reason: reasonForFailedJob(job), ...(job.lastStop ? { stop: job.lastStop } : {}) };
  }
  return base;
}

/** Aggregate percent across every job for the day: total operations done
 * over total operations known, capped at 99 -- this is only ever shown while
 * `kind` is `collecting`, never `ready`, so the cap always applies (phase-4.md:
 * "percent = operationsDone / max(operationsKnown, 1), capped at 99 until done").
 * Null while any job is still discovering (#1342): while true, the sum of
 * `operationsKnown` is not yet final, so the fraction it would produce could
 * only move backwards as discovery finds more work. A complete job always
 * counts as discovered, regardless of its stored progress.
 */
function overallPercent(jobs: readonly CollectionJob[]): number | null {
  if (jobs.length === 0) return 0;
  if (jobs.some((job) => discovering(job))) return null;
  const done = jobs.reduce((sum, j) => sum + j.progress.operationsDone, 0);
  const known = jobs.reduce((sum, j) => sum + j.progress.operationsKnown, 0);
  if (known <= 0) return 0;
  return Math.min(99, Math.floor((done / known) * 100));
}

/**
 * Pure derivation of the owner-visible `ScoringStatus` from today's
 * collection jobs, the current receipt (if any), and whether the handle is a
 * registered scoring subject at all. No I/O -- `lib/collection/read-scoring-status.ts`
 * does the reads and calls this.
 */
export function deriveScoringStatus(
  jobs: readonly CollectionJob[],
  receipt: ReceiptSummary | null,
  registered: boolean,
): ScoringStatus {
  if (!registered) return { kind: "unregistered" };

  const hasPriorReceipt = receipt !== null;

  const sources = jobs.map(toProviderStatus);
  if (jobs.some((job) => job.state === "failed")) {
    return { kind: "action_needed", sources, hasPriorReceipt, ...(receipt?.current ? { priorReceiptDate: receipt.date } : {}) };
  }

  if (receipt?.current) {
    const newerJobs = jobs.filter((job) => job.referenceDate > receipt.date);
    const finalizing = newerJobs.length > 0 && newerJobs.every((job) => job.state === "complete");
    const updating = finalizing || jobs.some((job) => IN_PROGRESS_STATES.has(job.state));
    return { kind: "ready", receiptDate: receipt.date, updating, ...(finalizing ? { finalizing: true } : {}) };
  }

  const finalizing = jobs.length > 0 && jobs.every((job) => job.state === "complete");
  return { kind: "collecting", percent: finalizing ? null : overallPercent(jobs), ...(finalizing ? { finalizing: true } : {}), sources, hasPriorReceipt };
}
