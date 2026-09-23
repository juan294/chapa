import "server-only";
import { isWithinScoringWindow, scoringInstant, type NormalizedEngineeringEvent, type ScoringWindow } from "@chapa/shared";
import type { CollectorCheckpoint, CollectorOperation } from "./plan";

/**
 * The prior day's completed observation for one source, as read from storage.
 * `dataThrough` is the prior collection's own window end -- never a caller-
 * supplied date -- and seeds the "only fetch since" optimization below.
 */
export interface PriorObservation {
  readonly dataThrough: string | null;
  readonly events: readonly NormalizedEngineeringEvent[];
}

export interface SeedResult {
  readonly checkpoint: CollectorCheckpoint;
  /** In-window prior events to stage immediately, before any new request. */
  readonly seededEvents: readonly NormalizedEngineeringEvent[];
}

const THIRTY_DAYS_MS = 30 * 86_400_000;

/**
 * Seeds a fresh checkpoint from yesterday's complete observation of the same
 * source (#1335 phase 3, "Incremental daily reuse"). Pure: no I/O, no clock
 * reads beyond the supplied window.
 *
 * - Prior events outside the new window are dropped; in-window ones are
 *   staged immediately, before the first request of the new job.
 * - An operation whose output is immutable once seen is pre-marked `done`:
 *   `files:<workItemId>` for an already-merged accepted_change, and
 *   `reviews:<workItemId>` for one merged more than 30 days before the new
 *   window's reference time (no further review can attach to it).
 * - `discovered.repositoryIds` seeds from the retained events' repositories,
 *   so a slice engine does not need to re-discover them from scratch.
 * - The prior `dataThrough` is carried in `state.seededDataThrough` so a
 *   time-filterable operation (one with a native `since`/`updated_after`
 *   parameter) can narrow its first request to only what changed since then,
 *   instead of the whole window.
 */
export function seedFromPrior(prior: PriorObservation, window: ScoringWindow): SeedResult {
  const seededEvents = prior.events.filter((event) => isWithinScoringWindow(event.occurredAt, window));
  const repositoryIds = [...new Set(seededEvents.map((event) => event.repositoryId))].sort();
  const acceptedChanges = seededEvents.filter((event) => event.kind === "accepted_change");
  const referenceMs = scoringInstant(window.referenceTime).getTime();

  const immutableFiles = new Set(acceptedChanges.map((event) => event.workItemId));
  const staleReviews = new Set(
    acceptedChanges
      .filter((event) => referenceMs - scoringInstant(event.occurredAt).getTime() > THIRTY_DAYS_MS)
      .map((event) => event.workItemId),
  );

  const operations: CollectorOperation[] = [
    ...[...immutableFiles].map((workItemId): CollectorOperation => ({ key: `files:${workItemId}`, cursor: null, done: true })),
    ...[...staleReviews].map((workItemId): CollectorOperation => ({ key: `reviews:${workItemId}`, cursor: null, done: true })),
  ];

  return {
    checkpoint: {
      version: 1,
      operations,
      discovered: { repositoryIds, itemIds: { seededWorkItemIds: [...immutableFiles].sort() } },
      state: { seededDataThrough: prior.dataThrough },
    },
    seededEvents,
  };
}
