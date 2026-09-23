import type { NormalizedEngineeringEvent, SourceCoverage } from "@chapa/shared";
import type { SourceDiagnostic } from "@/lib/platform/evidence-diagnostics";
import type { SourceContextInput } from "@/lib/platform/source-context";

/**
 * Collector slice contract (#1335 phase 3). One slice advances a durable
 * checkpoint by at most `maxRequests` provider requests or until `deadlineAt`,
 * whichever comes first. A queue job runs as many slices as it needs, so a
 * budget or deadline stop is progress, never an incomplete observation.
 *
 * The checkpoint is pure data persisted in `scoring_collection_jobs.checkpoint`:
 * no URLs with hosts or tokens, no response bodies.
 */
export interface CollectorOperation {
  /** Stable, deterministic key, e.g. `repositories`, `merged:2026-01-01..2026-01-31`, `files:<prNodeId>`. */
  readonly key: string;
  /** Provider cursor value (GraphQL cursor, page number, or host-less `next` path). */
  readonly cursor: string | null;
  readonly done: boolean;
}

export interface CollectorCheckpoint {
  readonly version: 1;
  readonly operations: readonly CollectorOperation[];
  readonly discovered: {
    readonly repositoryIds: readonly string[];
    readonly itemIds?: Readonly<Record<string, readonly string[]>>;
  };
  /**
   * Provider-specific JSON accumulators that must survive between slices
   * (e.g. reason codes and unknown periods found so far). JSON-safe values
   * only; never credentials, URLs with hosts, or response bodies.
   */
  readonly state?: Readonly<Record<string, unknown>>;
}

export interface SliceBudget {
  readonly maxRequests: number;
  /** Epoch milliseconds. */
  readonly deadlineAt: number;
}

export interface SliceResult {
  /** Only the events first discovered by this slice. */
  readonly events: readonly NormalizedEngineeringEvent[];
  readonly checkpoint: CollectorCheckpoint;
  /** Every operation in the checkpoint is complete. */
  readonly done: boolean;
  /** Present only when `done`; computed from the full staged event set. */
  readonly coverage: SourceCoverage | null;
  /** Why this slice ended before `done`; null when it finished or had nothing to do. */
  readonly stop: SourceDiagnostic | null;
  /** Provider requests issued by this slice. */
  readonly requests: number;
}

/**
 * One provider's slice collector. `staged` is every event already staged for
 * this job by earlier slices, so the final slice can compute coverage over the
 * complete set and skip events it has already emitted.
 */
export type CollectSlice = (
  input: SourceContextInput,
  credential: { readonly token: string | null },
  checkpoint: CollectorCheckpoint,
  budget: SliceBudget,
  staged: readonly NormalizedEngineeringEvent[],
) => Promise<SliceResult>;

export const EMPTY_CHECKPOINT: CollectorCheckpoint = { version: 1, operations: [], discovered: { repositoryIds: [] } };
