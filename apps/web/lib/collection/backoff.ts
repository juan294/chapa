/**
 * Exponential backoff schedule for a durable collection job's `retrying` /
 * `waiting_rate_limit` states (#1335 phase 3). Pure duration function -- the
 * caller (worker.ts) decides when `job.attempt` has exhausted the retry
 * budget and passes `retry_at = null` instead of calling this.
 */

/** 1m,2m,4m,8m,16m,32m,64m,64m -- doubling, then held at the 64m ceiling.
 * Matches docs/plans/2026-09-23-universal-v72-reliable-collection-phases/phase-3.md's
 * worker pseudocode comment.
 */
const CEILING_SECONDS = 64 * 60;

/** Total attempts a transient (5xx/network) failure gets, since the job's
 * last progress, before it becomes terminally `failed`. Migration 058
 * (#1351 phase 3) redefines `job.attempt` as "failures since the last
 * progress": a `rate_limited` stop never counts against this budget, and a
 * checkpoint that advances `operationsDone` resets it to 0, so this budget
 * is spent only by repeated failures with no progress between them. A
 * protocol/parse failure uses a stricter budget of its own (3), enforced by
 * the worker, not here.
 */
export const MAX_COLLECTION_ATTEMPTS = 8;

/**
 * @param attempt Zero-indexed count of prior attempts (the job's current
 *   `attempt` column value before this failure increments it). Negative
 *   values are treated as 0.
 * @returns Seconds to wait before the next retry.
 */
export function nextBackoff(attempt: number): number {
  const clamped = Math.max(0, attempt);
  const seconds = 60 * Math.pow(2, clamped);
  return Math.min(seconds, CEILING_SECONDS);
}
