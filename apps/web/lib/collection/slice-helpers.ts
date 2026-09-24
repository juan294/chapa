import "server-only";
import {
  createScoringWindow, engineeringEventKey, unknown,
  type EventMeasurements, type EvidenceReasonCode, type NormalizedEngineeringEvent, type ScoringWindow, type SourceCoverage,
} from "@chapa/shared";
import {
  createDiagnosticRecorder, type SourceDiagnostic, type SourceProvider, type StopKind,
} from "@/lib/platform/evidence-diagnostics";
import type { SourceContextInput } from "@/lib/platform/source-context";
import type { CollectorCheckpoint, CollectorOperation } from "./plan";

/**
 * Small pure/near-pure pieces genuinely identical across all four provider
 * slice engines (`lib/{github,bitbucket,gitlab,codeberg}/evidence.ts`,
 * #1335 phase 3). Extracted here rather than left duplicated four times so a
 * future change to one of these shapes -- e.g. a new `EventMeasurements`
 * field, or the checkpoint envelope -- happens once. Anything with real
 * per-provider pagination/protocol nuance (the REST vs GraphQL `runPagedList`
 * loops) stays in each engine: unifying those would risk exactly the kind of
 * subtle collection-correctness regression this codebase has been burned by
 * before (see CLAUDE.md "Scoring rigor is non-negotiable").
 */

/** Mutable per-slice operation bookkeeping shape every provider's local
 * `MutableXOperation` interface repeats verbatim. */
export interface MutableSliceOperation {
  key: string;
  cursor: string | null;
  done: boolean;
}

/**
 * Every provider slice engine re-derives the scoring window from the
 * caller-supplied reference time and rejects a mismatch against what the
 * caller actually passed in -- the caller and the engine must agree on the
 * exact 365-day window, never silently substitute the engine's own.
 */
export function validateSliceWindow(input: SourceContextInput): ScoringWindow {
  const window = createScoringWindow(input.window.referenceTime);
  if (
    window.startInclusive !== input.window.startInclusive ||
    window.endExclusive !== input.window.endExclusive ||
    window.referenceDate !== input.window.referenceDate ||
    input.window.calendarDays !== 365
  ) {
    throw new RangeError("Inconsistent scoring window");
  }
  return window;
}

/** The shared default for an event kind that carries no file/line/description
 * signal (e.g. `review`, `issue_work`) -- every provider's local
 * `emptyMeasurements()` returns exactly this. */
export function emptySliceMeasurements(): EventMeasurements {
  return {
    changedFiles: unknown("unavailable", "not_supported"),
    additions: unknown("unavailable", "not_supported"),
    deletions: unknown("unavailable", "not_supported"),
    leadTimeHours: unknown("unavailable", "not_supported"),
    hasDescription: unknown("unavailable", "not_supported"),
    hasIssueLink: unknown("unavailable", "not_supported"),
    usesFeatureBranch: unknown("unavailable", "not_supported"),
  };
}

/** Appends a fresh, not-yet-started operation for `key` unless one already
 * exists. Every provider's per-item fan-out (files:, reviews:, activity:,
 * commits:, etc.) discovers new operation keys this exact way. */
export function ensureSliceOperation(operations: MutableSliceOperation[], key: string): void {
  if (!operations.some((op) => op.key === key)) operations.push({ key, cursor: null, done: false });
}

/** This slice's newly discovered events, minus any the caller already staged
 * in an earlier slice (identity is `engineeringEventKey`). */
export function newSliceEvents(
  newEvents: ReadonlyMap<string, NormalizedEngineeringEvent>,
  stagedKeys: ReadonlySet<string>,
): NormalizedEngineeringEvent[] {
  return [...newEvents.values()].filter((event) => !stagedKeys.has(engineeringEventKey(event)));
}

/** Builds a `makeStop(operation, stopKind, httpStatus?, retryAfter?)` closure
 * bound to one provider and one run's diagnostic recorder -- every engine's
 * local `makeStop` records the diagnostic and returns the identical
 * `SourceDiagnostic` shape, differing only in the literal `provider`. */
export function makeSliceStopFactory(
  diag: ReturnType<typeof createDiagnosticRecorder>,
  provider: SourceProvider,
): (operation: string, stopKind: StopKind, httpStatus?: number | null, retryAfter?: number | null) => SourceDiagnostic {
  return (operation, stopKind, httpStatus = null, retryAfter = null) => {
    diag.record(operation, stopKind, httpStatus, retryAfter);
    return { provider, operation, stopKind, httpStatus, retryAfterSeconds: retryAfter };
  };
}

/** Assembles the final `CollectorCheckpoint` a `done` or `stop` slice result
 * returns. `extraState` carries a provider's own accumulators on top of the
 * common `{ ...state, reasons }` envelope (GitLab's `verifiedEmails`, e.g.). */
export function buildSliceCheckpoint(
  operations: readonly MutableSliceOperation[],
  repositoryIds: ReadonlySet<string>,
  state: Readonly<Record<string, unknown>>,
  reasons: ReadonlySet<EvidenceReasonCode>,
  extraState: Readonly<Record<string, unknown>> = {},
): CollectorCheckpoint {
  return {
    version: 1,
    operations: operations.map((op): CollectorOperation => ({ key: op.key, cursor: op.cursor, done: op.done })),
    discovered: { repositoryIds: [...repositoryIds].sort() },
    state: { ...state, reasons: [...reasons], ...extraState },
  };
}

/**
 * Assembles the final `SourceCoverage` every provider engine reports once
 * every operation is done -- the envelope shape is identical; only the
 * source identity and the per-provider `eventKinds` completeness differ.
 */
export function assembleSliceCoverage(params: {
  readonly provider: SourceProvider;
  readonly host: string;
  readonly subjectId: string;
  readonly window: ScoringWindow;
  readonly explicit: boolean;
  readonly repositoryIds: ReadonlySet<string>;
  readonly eventKinds: SourceCoverage["eventKinds"];
  readonly reasons: ReadonlySet<EvidenceReasonCode>;
}): SourceCoverage {
  const complete = Object.values(params.eventKinds).every((status) => status === "complete") && params.reasons.size === 0;
  return {
    source: { provider: params.provider, host: params.host, subjectId: params.subjectId },
    window: params.window,
    dataThrough: params.window.referenceTime,
    status: complete ? "complete" : "partial",
    discovery: params.explicit ? "explicit_repositories" : "owned_and_contributed",
    repositoryIds: [...params.repositoryIds].sort(),
    repositoryDiscoveryComplete: params.explicit,
    eventKinds: params.eventKinds,
    reasonCodes: [...params.reasons].sort(),
    unknownPeriods: complete ? [] : [{ startInclusive: params.window.startInclusive, endExclusive: params.window.endExclusive }],
  };
}
