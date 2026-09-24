import type { CollectionQueueHealth } from "@/lib/db/collection-queue";

/**
 * Shared "collection queue looks stuck" thresholds (#1335 phase 4): the
 * oldest queued job has waited more than 2h, or a lease has been expired for
 * more than 30 min. One definition for `lib/collection/worker.ts`'s own
 * `scoring_queue_stuck` P2 alert and `/api/health`'s `scoringQueue.degraded`
 * field — these previously drifted into two independent copies of the same
 * two numbers and the same boolean logic.
 */
export const QUEUE_STUCK_OLDEST_QUEUED_MS = 2 * 60 * 60 * 1000;
export const QUEUE_STUCK_EXPIRED_LEASE_MS = 30 * 60 * 1000;

export function isQueueOldestQueuedStuck(health: Pick<CollectionQueueHealth, "oldestQueuedAgeMs">): boolean {
  return health.oldestQueuedAgeMs > QUEUE_STUCK_OLDEST_QUEUED_MS;
}

export function isQueueLeaseStuck(health: Pick<CollectionQueueHealth, "expiredLeases" | "oldestExpiredLeaseAgeMs">): boolean {
  return health.expiredLeases > 0 && health.oldestExpiredLeaseAgeMs > QUEUE_STUCK_EXPIRED_LEASE_MS;
}

/** True when either sub-check trips — what `/api/health`'s `scoringQueue.degraded` reports. */
export function isCollectionQueueStuck(health: CollectionQueueHealth): boolean {
  return isQueueOldestQueuedStuck(health) || isQueueLeaseStuck(health);
}
