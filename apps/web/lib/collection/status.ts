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

function clampPercent(done: number, known: number, complete: boolean): number {
  if (complete) return 100;
  if (known <= 0) return 0;
  return Math.min(99, Math.floor((done / known) * 100));
}

function reasonForFailedJob(job: CollectionJob): ProviderStatusReason {
  return job.lastStop?.stopKind === "not_accessible" ? "reconnect" : "failed";
}

function toProviderStatus(job: CollectionJob): ProviderStatus {
  const percent = clampPercent(job.progress.operationsDone, job.progress.operationsKnown, job.state === "complete");
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
 */
function overallPercent(jobs: readonly CollectionJob[]): number {
  if (jobs.length === 0) return 0;
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

  if (receipt?.current) {
    const updating = jobs.some((job) => IN_PROGRESS_STATES.has(job.state));
    return { kind: "ready", receiptDate: receipt.date, updating };
  }

  const sources = jobs.map(toProviderStatus);

  if (jobs.some((job) => job.state === "failed")) {
    return { kind: "action_needed", sources, hasPriorReceipt };
  }

  return { kind: "collecting", percent: overallPercent(jobs), sources, hasPriorReceipt };
}
