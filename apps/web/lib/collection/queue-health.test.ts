import { describe, expect, it } from "vitest";
import {
  QUEUE_STUCK_EXPIRED_LEASE_MS,
  QUEUE_STUCK_OLDEST_QUEUED_MS,
  isCollectionQueueStuck,
  isQueueLeaseStuck,
  isQueueOldestQueuedStuck,
} from "./queue-health";
import type { CollectionQueueHealth } from "@/lib/db/collection-queue";

const healthy: CollectionQueueHealth = {
  queued: 1,
  running: 0,
  retrying: 0,
  waitingRateLimit: 0,
  failedToday: 0,
  oldestQueuedAgeMs: 1000,
  expiredLeases: 0,
  oldestExpiredLeaseAgeMs: 0,
};

/**
 * #1335 phase 4 — this is the single source of truth for the thresholds
 * `lib/collection/worker.ts`'s `scoring_queue_stuck` alert and `/api/health`'s
 * `scoringQueue.degraded` field both consume; each of their own test suites
 * covers the integration, so this file only needs to pin the boundary math.
 */
describe("isQueueOldestQueuedStuck", () => {
  it("is false at exactly the threshold", () => {
    expect(isQueueOldestQueuedStuck({ ...healthy, oldestQueuedAgeMs: QUEUE_STUCK_OLDEST_QUEUED_MS })).toBe(false);
  });

  it("is true just past the threshold", () => {
    expect(isQueueOldestQueuedStuck({ ...healthy, oldestQueuedAgeMs: QUEUE_STUCK_OLDEST_QUEUED_MS + 1 })).toBe(true);
  });
});

describe("isQueueLeaseStuck", () => {
  it("is false with no expired leases even past the age threshold", () => {
    expect(isQueueLeaseStuck({ expiredLeases: 0, oldestExpiredLeaseAgeMs: QUEUE_STUCK_EXPIRED_LEASE_MS + 1 })).toBe(false);
  });

  it("is false at exactly the threshold", () => {
    expect(isQueueLeaseStuck({ expiredLeases: 1, oldestExpiredLeaseAgeMs: QUEUE_STUCK_EXPIRED_LEASE_MS })).toBe(false);
  });

  it("is true just past the threshold with at least one expired lease", () => {
    expect(isQueueLeaseStuck({ expiredLeases: 1, oldestExpiredLeaseAgeMs: QUEUE_STUCK_EXPIRED_LEASE_MS + 1 })).toBe(true);
  });
});

describe("isCollectionQueueStuck", () => {
  it("is false for an entirely healthy queue", () => {
    expect(isCollectionQueueStuck(healthy)).toBe(false);
  });

  it("is true when only the queued-age check trips", () => {
    expect(isCollectionQueueStuck({ ...healthy, oldestQueuedAgeMs: QUEUE_STUCK_OLDEST_QUEUED_MS + 1 })).toBe(true);
  });

  it("is true when only the lease check trips", () => {
    expect(isCollectionQueueStuck({ ...healthy, expiredLeases: 1, oldestExpiredLeaseAgeMs: QUEUE_STUCK_EXPIRED_LEASE_MS + 1 })).toBe(true);
  });
});
