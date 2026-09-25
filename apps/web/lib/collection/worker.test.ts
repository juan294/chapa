import { describe, expect, it, vi, beforeEach } from "vitest";
import { createScoringWindow, engineeringEventKey, type NormalizedEngineeringEvent, type SourceCoverage } from "@chapa/shared";
import type { CollectionJob, CollectionQueueHealth } from "@/lib/db/collection-queue";
import type { StoredSourceObservation } from "@/lib/db/source-context";
import { EMPTY_CHECKPOINT, type CollectorCheckpoint, type SliceResult } from "./plan";

// #1335 phase 4.7 — mocked, not injected: these three modules are the only
// hardwired (non-deps-injected) I/O `runCollectionSlice`/`runCollectionTick`
// touch, since the alert helpers (`alertScoringCollectionFailed`,
// `alertIfQueueStuck`) and the inline `scheduleServerEvent` calls import them
// directly rather than going through `CollectionWorkerDeps`. `importOriginal`
// keeps every other export (e.g. `captureServerError`, used by the `captureError`
// dep in every existing test in this file) real.
const mockCacheSetNxStatus = vi.hoisted(() => vi.fn());
vi.mock("@/lib/cache/redis", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/cache/redis")>()),
  cacheSetNxStatus: (...args: unknown[]) => mockCacheSetNxStatus(...args),
}));
const mockCaptureOperationalAlert = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics/server-errors", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics/server-errors")>()),
  captureOperationalAlert: (...args: unknown[]) => mockCaptureOperationalAlert(...args),
}));
const mockScheduleServerEvent = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics/schedule-server-event", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics/schedule-server-event")>()),
  scheduleServerEvent: (...args: unknown[]) => mockScheduleServerEvent(...args),
}));

import { runCollectionSlice, runCollectionTick, productionCollectionWorkerDeps, type CollectionWorkerDeps, type CredentialResolution } from "./worker";

const window = createScoringWindow("2026-09-05T12:00:00Z");
const source = { provider: "github" as const, host: "github.com", subjectId: "canonical" };
const sampleCoverage: SourceCoverage = {
  source, window, dataThrough: window.referenceTime, status: "complete", discovery: "owned_and_contributed",
  repositoryIds: [], repositoryDiscoveryComplete: true, eventKinds: {}, reasonCodes: [], unknownPeriods: [],
};

function makeJob(overrides: Partial<CollectionJob> = {}): CollectionJob {
  return {
    id: "job-1",
    ownerHandle: "alice",
    provider: "github",
    referenceDate: "2026-09-05",
    referenceTime: window.referenceTime,
    state: "running",
    checkpoint: EMPTY_CHECKPOINT,
    progress: { operationsDone: 0, operationsKnown: 0, events: 0, requests: 0 },
    attempt: 0,
    nextRunAt: window.referenceTime,
    leaseToken: "lease-1",
    leaseExpiresAt: window.referenceTime,
    lastStop: null,
    enqueueReason: "signup",
    observationId: null,
    ...overrides,
  };
}

function sliceResult(overrides: Partial<SliceResult> = {}): SliceResult {
  return { events: [], checkpoint: EMPTY_CHECKPOINT, done: false, coverage: null, stop: null, requests: 1, discoveryComplete: false, ...overrides };
}

/** Mirrors `seed.test.ts`'s helper -- a minimal but schema-shaped
 * `NormalizedEngineeringEvent` for building prior-observation fixtures.
 */
function event(overrides: Partial<NormalizedEngineeringEvent> & { readonly eventId: string; readonly occurredAt: string }): NormalizedEngineeringEvent {
  return {
    schemaVersion: "v7", provider: "github", host: "github.com", subjectId: "canonical", actorId: "canonical",
    repositoryId: "R1", kind: "accepted_change", dataThrough: window.referenceTime,
    canonicalProjectId: "github:R1", workItemId: `github:${overrides.eventId}`, artifactRevision: "rev",
    artifactReferenceIds: [`github:${overrides.eventId}`], attribution: "individual", provenance: "source_observed",
    coverage: "complete", categories: [],
    measurements: {
      changedFiles: { status: "unknown", coverage: "unavailable", reasonCode: "not_supported" },
      additions: { status: "unknown", coverage: "unavailable", reasonCode: "not_supported" },
      deletions: { status: "unknown", coverage: "unavailable", reasonCode: "not_supported" },
      leadTimeHours: { status: "unknown", coverage: "unavailable", reasonCode: "not_supported" },
      hasDescription: { status: "unknown", coverage: "unavailable", reasonCode: "not_supported" },
      hasIssueLink: { status: "unknown", coverage: "unavailable", reasonCode: "not_supported" },
      usesFeatureBranch: { status: "unknown", coverage: "unavailable", reasonCode: "not_supported" },
    },
    acceptance: { status: "unknown", coverage: "unavailable", reasonCode: "not_assessed" },
    ...overrides,
  };
}

/** A `StoredSourceObservation`-shaped fixture for a prior day's complete
 * observation. Only `coverage.status`/`dataThrough` and `events` are read by
 * the worker's seeding path; the rest exists to satisfy the storage type.
 */
function priorObservation(overrides: { readonly dataThrough: string | null; readonly events: readonly NormalizedEngineeringEvent[] }): StoredSourceObservation {
  const priorWindow = createScoringWindow("2026-09-04T12:00:00Z");
  return {
    id: "11111111-1111-1111-1111-111111111111",
    window: priorWindow,
    coverage: {
      source, window: priorWindow, dataThrough: overrides.dataThrough, status: "complete", discovery: "owned_and_contributed",
      repositoryIds: [], repositoryDiscoveryComplete: true, eventKinds: {}, reasonCodes: [], unknownPeriods: [],
    },
    events: [...overrides.events],
    // `provider` here is always one of the four forge providers this test
    // constructs (`event()` defaults to "github"); the shared
    // `NormalizedEngineeringEvent` type widens it to `EvidenceProvider`
    // (which also allows "supplemental"/"portfolio") for non-forge evidence,
    // so a cast is needed to satisfy the storage schema's narrower type.
  } as unknown as StoredSourceObservation;
}

/** A mutable version of the deps bag, so a test can reassign one field
 * (e.g. `deps.collect = ...`) without fighting `CollectionWorkerDeps`'s
 * `readonly` modifiers -- those exist to keep production callers from
 * mutating a shared deps object, not to block test harnesses.
 */
type MutableCollectionWorkerDeps = { -readonly [K in keyof CollectionWorkerDeps]: CollectionWorkerDeps[K] };

function harness(): MutableCollectionWorkerDeps {
  const resolveCredential = vi.fn<CollectionWorkerDeps["resolveCredential"]>().mockResolvedValue({
    status: "ok",
    resolved: {
      context: { owner: "alice", requestedSource: { provider: "github", host: "github.com", login: "alice" }, window, scope: { discovery: "owned_and_contributed", repositoryIds: [], eventKinds: [] } },
      token: "fake-token",
      accessContextId: "a".repeat(64),
      requested: { provider: "github", host: "github.com", login: "alice" },
      link: null,
    },
  } satisfies CredentialResolution);
  const deps: MutableCollectionWorkerDeps = {
    claim: vi.fn().mockResolvedValue([]),
    checkpoint: vi.fn().mockResolvedValue({ status: "ok", stagedCount: 0 }),
    finish: vi.fn().mockResolvedValue({ status: "ok", observationId: "obs-1" }),
    fail: vi.fn().mockResolvedValue({ status: "failed" }),
    listStagedKeys: vi.fn().mockResolvedValue(new Set()),
    resolveCredential,
    collect: vi.fn().mockResolvedValue(sliceResult()),
    discoverSource: vi.fn().mockResolvedValue({ status: "missing" }),
    readPriorObservation: vi.fn().mockResolvedValue(null),
    emitDiagnostics: vi.fn(),
    captureError: vi.fn().mockResolvedValue(undefined),
    onJobComplete: vi.fn().mockResolvedValue(undefined),
    now: vi.fn(() => Date.parse("2026-09-05T12:00:00.000Z")),
  };
  return deps;
}

describe("runCollectionSlice", () => {
  it("fails immediately with not_accessible, retryAt null, when credentials cannot be resolved -- the 401/reconnect case", async () => {
    const deps = harness();
    deps.resolveCredential = vi.fn().mockResolvedValue({ status: "not_accessible" });
    await runCollectionSlice(makeJob(), Date.now() + 60_000, deps);
    expect(deps.collect).not.toHaveBeenCalled();
    expect(deps.fail).toHaveBeenCalledWith(
      { id: "job-1", leaseToken: "lease-1" },
      expect.objectContaining({ stopKind: "not_accessible" }),
      null,
    );
  });

  it("fails immediately with retryAt null for a MID-SLICE not_accessible stop too, not just the credential-resolution stage", async () => {
    const deps = harness();
    const stop = { provider: "github" as const, operation: "profile", stopKind: "not_accessible" as const, httpStatus: 401, retryAfterSeconds: null };
    deps.collect = vi.fn().mockResolvedValue(sliceResult({ stop }));
    await runCollectionSlice(makeJob({ attempt: 0 }), Date.now() + 60_000, deps);
    // Must not fall into the protocol/parse 3-try retry bucket, which would
    // compute a non-null backoff retryAt for attempt 0.
    expect(deps.fail).toHaveBeenCalledWith(
      { id: "job-1", leaseToken: "lease-1" },
      expect.objectContaining({ stopKind: "not_accessible" }),
      null,
    );
  });

  it("finishes and calls onJobComplete when the slice reports done", async () => {
    const deps = harness();
    deps.collect = vi.fn().mockResolvedValue(sliceResult({ done: true, coverage: sampleCoverage }));
    await runCollectionSlice(makeJob(), Date.now() + 60_000, deps);
    expect(deps.checkpoint).toHaveBeenCalledWith({ id: "job-1", leaseToken: "lease-1" }, EMPTY_CHECKPOINT, [], expect.any(Object), false);
    expect(deps.finish).toHaveBeenCalledWith(
      { id: "job-1", leaseToken: "lease-1" },
      expect.objectContaining({ coverage: sampleCoverage, requested: { provider: "github", host: "github.com", login: "alice" } }),
    );
    expect(deps.onJobComplete).toHaveBeenCalledWith(expect.objectContaining({ state: "complete", observationId: "obs-1" }));
    expect(deps.fail).not.toHaveBeenCalled();
  });

  // #1342 -- the worker never recomputes discovery on its own; it only
  // carries whatever the collector reported for this checkpoint.
  it("slice progress carries the collector's discoveryComplete", async () => {
    const deps = harness();
    deps.collect = vi.fn().mockResolvedValue(sliceResult({ discoveryComplete: true }));
    await runCollectionSlice(makeJob(), Date.now() + 60_000, deps);
    expect(deps.checkpoint).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), expect.anything(),
      expect.objectContaining({ discovering: false }),
      expect.anything(),
    );
  });

  it("slice progress reports discovering true when the collector's discoveryComplete is false", async () => {
    const deps = harness();
    deps.collect = vi.fn().mockResolvedValue(sliceResult({ discoveryComplete: false, stop: { provider: "github", operation: "repositories", stopKind: "budget", httpStatus: null, retryAfterSeconds: null } }));
    await runCollectionSlice(makeJob(), Date.now() + 60_000, deps);
    expect(deps.checkpoint).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), expect.anything(),
      expect.objectContaining({ discovering: true }),
      expect.anything(),
    );
  });

  it("still reaches complete when an absorbed not_accessible fan-out item left coverage partial, not just on full complete coverage", async () => {
    const deps = harness();
    const partialCoverage: SourceCoverage = { ...sampleCoverage, status: "partial", reasonCodes: ["not_accessible"] };
    deps.collect = vi.fn().mockResolvedValue(sliceResult({ done: true, coverage: partialCoverage }));
    await runCollectionSlice(makeJob(), Date.now() + 60_000, deps);
    expect(deps.finish).toHaveBeenCalledWith(
      { id: "job-1", leaseToken: "lease-1" },
      expect.objectContaining({ coverage: partialCoverage }),
    );
    expect(deps.onJobComplete).toHaveBeenCalledWith(expect.objectContaining({ state: "complete", observationId: "obs-1" }));
    expect(deps.fail).not.toHaveBeenCalled();
  });

  it("releases a budget stop to queued for immediate reclaim, without calling fail", async () => {
    const deps = harness();
    const checkpoint: CollectorCheckpoint = { version: 1, operations: [{ key: "repositories", cursor: "p2", done: false }], discovered: { repositoryIds: [] } };
    deps.collect = vi.fn().mockResolvedValue(sliceResult({ checkpoint, stop: { provider: "github", operation: "repositories", stopKind: "budget", httpStatus: null, retryAfterSeconds: null } }));
    await runCollectionSlice(makeJob(), Date.now() + 60_000, deps);
    expect(deps.checkpoint).toHaveBeenCalledWith({ id: "job-1", leaseToken: "lease-1" }, checkpoint, [], expect.any(Object), true);
    expect(deps.fail).not.toHaveBeenCalled();
  });

  it("releases a deadline stop the same way a budget stop is released", async () => {
    const deps = harness();
    deps.collect = vi.fn().mockResolvedValue(sliceResult({ stop: { provider: "github", operation: "repositories", stopKind: "deadline", httpStatus: null, retryAfterSeconds: null } }));
    await runCollectionSlice(makeJob(), Date.now() + 60_000, deps);
    expect(deps.checkpoint).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), expect.anything(), true);
    expect(deps.fail).not.toHaveBeenCalled();
  });

  it("emits the phase-1 evidence_source_stop diagnostic at its new call site", async () => {
    const deps = harness();
    const stop = { provider: "github" as const, operation: "merged", stopKind: "rate_limited" as const, httpStatus: 403, retryAfterSeconds: 120 };
    deps.collect = vi.fn().mockResolvedValue(sliceResult({ stop }));
    await runCollectionSlice(makeJob(), Date.now() + 60_000, deps);
    expect(deps.emitDiagnostics).toHaveBeenCalledWith("alice", [stop]);
  });

  it("emits no diagnostic when the slice reports done with no stop", async () => {
    const deps = harness();
    deps.collect = vi.fn().mockResolvedValue(sliceResult({ done: true, coverage: sampleCoverage }));
    await runCollectionSlice(makeJob(), Date.now() + 60_000, deps);
    expect(deps.emitDiagnostics).not.toHaveBeenCalled();
  });

  it("fails a rate_limited stop with retryAt computed from retryAfterSeconds", async () => {
    const deps = harness();
    deps.collect = vi.fn().mockResolvedValue(sliceResult({ stop: { provider: "github", operation: "merged", stopKind: "rate_limited", httpStatus: 403, retryAfterSeconds: 120 } }));
    await runCollectionSlice(makeJob(), Date.now() + 60_000, deps);
    expect(deps.checkpoint).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), expect.anything(), false);
    expect(deps.fail).toHaveBeenCalledWith(
      { id: "job-1", leaseToken: "lease-1" },
      expect.objectContaining({ stopKind: "rate_limited" }),
      new Date(Date.parse("2026-09-05T12:00:00.000Z") + 120_000).toISOString(),
    );
  });

  // #1351 (phase 3): migration 058 redefines `attempt` as "failures since
  // the last progress" -- a `rate_limited` stop never increments it. This
  // fake `fail()` applies that rule (the real rule lives in SQL, proven by
  // collection-queue.contract.test.ts); what this test proves is that
  // runCollectionSlice's own rate_limited branch never computes a null
  // retryAt on its own, no matter how high `attempt` climbs, so a job that
  // only ever sees rate limiting can never become terminal.
  it("rate-limited stops never make a job terminal, however many slices see one", async () => {
    const deps = harness();
    let attempt = 0;
    let state: "running" | "retrying" | "waiting_rate_limit" | "failed" = "running";
    deps.collect = vi.fn().mockResolvedValue(sliceResult({
      stop: { provider: "github", operation: "merged", stopKind: "rate_limited", httpStatus: 403, retryAfterSeconds: 60 },
    }));
    deps.fail = vi.fn().mockImplementation(async (_lease, stop: { stopKind: string }, retryAt: string | null) => {
      if (retryAt === null) {
        state = "failed";
        return { status: "failed" };
      }
      attempt = stop.stopKind === "rate_limited" ? attempt : attempt + 1;
      state = stop.stopKind === "rate_limited" ? "waiting_rate_limit" : "retrying";
      return { status: state };
    });

    for (let i = 0; i < 20; i++) {
      await runCollectionSlice(makeJob({ attempt, leaseToken: "lease-1" }), Date.now() + 60_000, deps);
      expect(state).not.toBe("failed");
    }
    expect(attempt).toBe(0);
  });

  it("fails a 5xx (http) stop with exponential backoff while attempts remain", async () => {
    const deps = harness();
    deps.collect = vi.fn().mockResolvedValue(sliceResult({ stop: { provider: "github", operation: "merged", stopKind: "http", httpStatus: 503, retryAfterSeconds: null } }));
    await runCollectionSlice(makeJob({ attempt: 0 }), Date.now() + 60_000, deps);
    expect(deps.fail).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ stopKind: "http" }),
      new Date(Date.parse("2026-09-05T12:00:00.000Z") + 60_000).toISOString(), // nextBackoff(0) = 60s
    );
  });

  it("gives up an http stop with retryAt null once the 8-attempt budget is exhausted", async () => {
    const deps = harness();
    deps.collect = vi.fn().mockResolvedValue(sliceResult({ stop: { provider: "github", operation: "merged", stopKind: "network", httpStatus: null, retryAfterSeconds: null } }));
    await runCollectionSlice(makeJob({ attempt: 7 }), Date.now() + 60_000, deps);
    expect(deps.fail).toHaveBeenCalledWith(expect.anything(), expect.anything(), null);
  });

  // The slice's own checkpoint resets `attempt` in the database when it
  // advances operationsDone (migration 058), so the in-memory claim-time
  // attempt must not end a job that made progress before this stop.
  describe("a stop after progress in the same slice", () => {
    const advanced: CollectorCheckpoint = {
      version: 1,
      operations: [{ key: "profile", cursor: null, done: true }, { key: "merged:a", cursor: null, done: true }, { key: "merged:b", cursor: null, done: false }],
      discovered: { repositoryIds: [] },
    };
    const priorProgress = { operationsDone: 1, operationsKnown: 3, events: 0, requests: 0 };

    it("still retries an http stop at the claim-time budget edge", async () => {
      const deps = harness();
      deps.collect = vi.fn().mockResolvedValue(sliceResult({ checkpoint: advanced, stop: { provider: "github", operation: "merged", stopKind: "http", httpStatus: 502, retryAfterSeconds: null } }));
      await runCollectionSlice(makeJob({ attempt: 7, progress: priorProgress }), Date.now() + 60_000, deps);
      expect(deps.fail).toHaveBeenCalledWith(expect.anything(), expect.anything(), new Date(Date.parse("2026-09-05T12:00:00.000Z") + 60_000).toISOString());
    });

    it("still retries a structural stop at the claim-time budget edge", async () => {
      const deps = harness();
      deps.collect = vi.fn().mockResolvedValue(sliceResult({ checkpoint: advanced, stop: { provider: "github", operation: "merged", stopKind: "protocol", httpStatus: null, retryAfterSeconds: null } }));
      await runCollectionSlice(makeJob({ attempt: 2, progress: priorProgress }), Date.now() + 60_000, deps);
      expect(deps.fail).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.any(String));
    });

    it("ends the job when the slice made no progress", async () => {
      const deps = harness();
      deps.collect = vi.fn().mockResolvedValue(sliceResult({ checkpoint: advanced, stop: { provider: "github", operation: "merged", stopKind: "http", httpStatus: 502, retryAfterSeconds: null } }));
      await runCollectionSlice(makeJob({ attempt: 7, progress: { ...priorProgress, operationsDone: 2 } }), Date.now() + 60_000, deps);
      expect(deps.fail).toHaveBeenCalledWith(expect.anything(), expect.anything(), null);
    });
  });

  it("gives a protocol/parse stop only a 3-try budget, stricter than http/network", async () => {
    const deps = harness();
    deps.collect = vi.fn().mockResolvedValue(sliceResult({ stop: { provider: "github", operation: "merged", stopKind: "protocol", httpStatus: null, retryAfterSeconds: null } }));
    await runCollectionSlice(makeJob({ attempt: 2 }), Date.now() + 60_000, deps);
    expect(deps.fail).toHaveBeenCalledWith(expect.anything(), expect.anything(), null);
  });

  it("still retries a protocol stop below its 3-try budget", async () => {
    const deps = harness();
    deps.collect = vi.fn().mockResolvedValue(sliceResult({ stop: { provider: "github", operation: "merged", stopKind: "parse", httpStatus: null, retryAfterSeconds: null } }));
    await runCollectionSlice(makeJob({ attempt: 1 }), Date.now() + 60_000, deps);
    expect(deps.fail).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.any(String));
  });

  // 2026-09-24: an EMU login made the GitHub collector throw on every slice.
  // The job was never failed, so its lease expired and it was re-claimed
  // every tick, forever.
  it("fails a job whose collector throws, with the structural 3-try budget, and still rethrows", async () => {
    const deps = harness();
    deps.collect = vi.fn().mockRejectedValue(new RangeError("Invalid GitHub handle"));
    await expect(runCollectionSlice(makeJob({ attempt: 0 }), Date.now() + 60_000, deps)).rejects.toThrow("Invalid GitHub handle");
    expect(deps.fail).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ operation: "collect", stopKind: "protocol" }), expect.any(String));
  });

  it("fails a throwing collector terminally once the 3-try budget is spent", async () => {
    const deps = harness();
    deps.collect = vi.fn().mockRejectedValue(new RangeError("Invalid GitHub handle"));
    await expect(runCollectionSlice(makeJob({ attempt: 2 }), Date.now() + 60_000, deps)).rejects.toThrow();
    expect(deps.fail).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ operation: "collect" }), null);
  });

  it("resumes from exactly the checkpoint persisted before an outcome-processing crash", async () => {
    const deps = harness();
    const midCheckpoint: CollectorCheckpoint = { version: 1, operations: [{ key: "repositories", cursor: "page2", done: false }], discovered: { repositoryIds: ["r1"] } };
    deps.collect = vi.fn().mockResolvedValue(sliceResult({ checkpoint: midCheckpoint, done: true, coverage: sampleCoverage }));
    deps.finish = vi.fn().mockRejectedValue(new Error("process killed mid-flight"));
    await expect(runCollectionSlice(makeJob(), Date.now() + 60_000, deps)).rejects.toThrow("process killed mid-flight");
    // The checkpoint call (which the DB commits independently of what happens
    // next in this process) already carried the advanced checkpoint.
    expect(deps.checkpoint).toHaveBeenCalledWith(expect.anything(), midCheckpoint, [], expect.anything(), false);

    // A later tick claims the job fresh, with that persisted checkpoint as
    // job.checkpoint, and the collector picks up from exactly that state.
    const resumedJob = makeJob({ checkpoint: midCheckpoint, leaseToken: "lease-2" });
    deps.finish = vi.fn().mockResolvedValue({ status: "ok", observationId: "obs-2" });
    await runCollectionSlice(resumedJob, Date.now() + 60_000, deps);
    expect(deps.collect).toHaveBeenLastCalledWith(expect.anything(), expect.anything(), midCheckpoint, expect.anything(), expect.anything());
  });

  describe("incremental daily reuse (seedFromPrior wiring)", () => {
    it("seeds the checkpoint from a prior complete observation and skips its immutable ops before the first collect call", async () => {
      const deps = harness();
      const merged = event({ eventId: "PR1", occurredAt: "2026-09-01T00:00:00.000Z" });
      deps.discoverSource = vi.fn().mockResolvedValue({ status: "found", source });
      deps.readPriorObservation = vi.fn().mockResolvedValue(priorObservation({ dataThrough: "2026-09-04T12:00:00.000Z", events: [merged] }));
      deps.collect = vi.fn().mockResolvedValue(sliceResult({ done: true, coverage: sampleCoverage }));

      await runCollectionSlice(makeJob(), Date.now() + 60_000, deps);

      // The seed goes through the same checkpoint RPC as any other slice's
      // events, before collect() is ever called with the seeded state.
      const seededCheckpoint: CollectorCheckpoint = {
        version: 1,
        operations: [{ key: "files:github:PR1", cursor: null, done: true }],
        discovered: { repositoryIds: [], itemIds: { seededWorkItemIds: ["github:PR1"] } },
      };
      expect(deps.checkpoint).toHaveBeenNthCalledWith(1, { id: "job-1", leaseToken: "lease-1" }, seededCheckpoint, [merged], expect.any(Object), false);
      expect(deps.collect).toHaveBeenCalledWith(expect.anything(), expect.anything(), seededCheckpoint, expect.anything(), new Set([engineeringEventKey(merged)]));
    });

    // #1342 -- a seed pre-write never runs the collector, so its progress
    // must read as still discovering, not a false N/N=99%.
    it("seed writes discovering true", async () => {
      const deps = harness();
      const merged = event({ eventId: "PR1", occurredAt: "2026-09-01T00:00:00.000Z" });
      deps.discoverSource = vi.fn().mockResolvedValue({ status: "found", source });
      deps.readPriorObservation = vi.fn().mockResolvedValue(priorObservation({ dataThrough: "2026-09-04T12:00:00.000Z", events: [merged] }));
      deps.collect = vi.fn().mockResolvedValue(sliceResult({ done: true, coverage: sampleCoverage }));

      await runCollectionSlice(makeJob(), Date.now() + 60_000, deps);

      expect(deps.checkpoint).toHaveBeenNthCalledWith(
        1,
        expect.anything(),
        expect.anything(),
        [merged],
        expect.objectContaining({ discovering: true }),
        false,
      );
    });

    it("does not seed when the checkpoint already has progress or events are already staged (not the job's first slice)", async () => {
      const deps = harness();
      deps.discoverSource = vi.fn().mockResolvedValue({ status: "found", source });
      deps.readPriorObservation = vi.fn().mockResolvedValue(priorObservation({ dataThrough: "2026-09-04T12:00:00.000Z", events: [event({ eventId: "PR1", occurredAt: "2026-09-01T00:00:00.000Z" })] }));
      deps.listStagedKeys = vi.fn().mockResolvedValue(new Set([engineeringEventKey(event({ eventId: "already-staged", occurredAt: "2026-09-01T00:00:00.000Z" }))]));

      await runCollectionSlice(makeJob(), Date.now() + 60_000, deps);

      expect(deps.discoverSource).not.toHaveBeenCalled();
      expect(deps.readPriorObservation).not.toHaveBeenCalled();
    });

    it("drops out-of-window prior events instead of staging them, and never seeds a checkpoint operation for them", async () => {
      const deps = harness();
      const outOfWindow = event({ eventId: "stale", occurredAt: "2020-01-01T00:00:00.000Z" });
      deps.discoverSource = vi.fn().mockResolvedValue({ status: "found", source });
      deps.readPriorObservation = vi.fn().mockResolvedValue(priorObservation({ dataThrough: "2026-09-04T12:00:00.000Z", events: [outOfWindow] }));
      deps.collect = vi.fn().mockResolvedValue(sliceResult({ done: true, coverage: sampleCoverage }));

      await runCollectionSlice(makeJob(), Date.now() + 60_000, deps);

      // Nothing to seed -- the empty checkpoint is untouched by a seed
      // pre-write, and collect() runs with the job's original empty state.
      expect(deps.checkpoint).toHaveBeenCalledTimes(1);
      expect(deps.checkpoint).toHaveBeenCalledWith({ id: "job-1", leaseToken: "lease-1" }, EMPTY_CHECKPOINT, [], expect.any(Object), false);
      expect(deps.collect).toHaveBeenCalledWith(expect.anything(), expect.anything(), EMPTY_CHECKPOINT, expect.anything(), new Set());
    });

    it("never lets a seeding failure (discovery/storage error) block the slice -- collection still proceeds from scratch, but the failure is captured, not silent", async () => {
      const deps = harness();
      deps.discoverSource = vi.fn().mockRejectedValue(new Error("storage unavailable"));
      deps.collect = vi.fn().mockResolvedValue(sliceResult({ done: true, coverage: sampleCoverage }));

      await runCollectionSlice(makeJob(), Date.now() + 60_000, deps);

      expect(deps.collect).toHaveBeenCalledWith(expect.anything(), expect.anything(), EMPTY_CHECKPOINT, expect.anything(), new Set());
      expect(deps.fail).not.toHaveBeenCalled();

      // The no-silent-failure rule: seeding is an optimization whose failure
      // must never block the job, but it must still be observable.
      expect(deps.captureError).toHaveBeenCalledTimes(1);
      const [captured] = vi.mocked(deps.captureError).mock.calls[0]!;
      expect(captured.route).toContain("trySeedFromPrior");
      expect(captured.statusCode).toBe(500);
      const message = (captured.error as Error).message;
      expect(message).toContain("job-1");
      expect(message).toContain("github");
      expect(message).toContain("storage unavailable");
      // No secrets: never the owner handle, a token, or an access-context HMAC.
      expect(message).not.toContain("alice");
      expect(message).not.toContain("fake-token");
    });
  });
});

describe("runCollectionTick", () => {
  it("stops claiming once no jobs are returned", async () => {
    const deps = harness();
    deps.claim = vi.fn().mockResolvedValueOnce([]);
    const result = await runCollectionTick(240_000, deps);
    expect(result.slicesRun).toBe(0);
    expect(deps.claim).toHaveBeenCalledTimes(1);
  });

  it("re-claims a job released mid-tick so one tick can carry it through multiple slices", async () => {
    const deps = harness();
    const now = 0;
    deps.now = () => now;
    const job = makeJob();
    deps.claim = vi.fn()
      .mockResolvedValueOnce([job])
      .mockResolvedValueOnce([job])
      .mockResolvedValueOnce([]);
    deps.collect = vi.fn()
      .mockResolvedValueOnce(sliceResult({ stop: { provider: "github", operation: "repositories", stopKind: "budget", httpStatus: null, retryAfterSeconds: null } }))
      .mockResolvedValueOnce(sliceResult({ done: true, coverage: sampleCoverage }));
    const result = await runCollectionTick(240_000, deps);
    expect(deps.claim).toHaveBeenCalledTimes(3);
    expect(result.slicesRun).toBe(2);
    expect(deps.finish).toHaveBeenCalledTimes(1);
  });

  it("captures a rejected slice via captureError and still runs the other jobs in the same batch", async () => {
    const deps = harness();
    const failingJob = makeJob({ id: "job-fail", leaseToken: "lease-fail", provider: "gitlab",
      lastStop: { provider: "gitlab", operation: "merged", stopKind: "http", httpStatus: 500, retryAfterSeconds: null } });
    const okJob = makeJob({ id: "job-ok", leaseToken: "lease-ok", provider: "github" });
    deps.claim = vi.fn().mockResolvedValueOnce([failingJob, okJob]).mockResolvedValueOnce([]);
    deps.resolveCredential = vi.fn().mockImplementation(async (_owner: string, provider: string) => {
      if (provider === "gitlab") throw new Error("unexpected credential blowup");
      return {
        status: "ok",
        resolved: {
          context: { owner: "alice", requestedSource: { provider: "github", host: "github.com", login: "alice" }, window, scope: { discovery: "owned_and_contributed", repositoryIds: [], eventKinds: [] } },
          token: "fake-token", accessContextId: "a".repeat(64),
          requested: { provider: "github", host: "github.com", login: "alice" }, link: null,
        },
      };
    });

    const result = await runCollectionTick(240_000, deps);

    // Both jobs in the batch were attempted -- the failing one didn't abort the other.
    expect(result.slicesRun).toBe(2);
    expect(deps.checkpoint).toHaveBeenCalledTimes(1); // only okJob reached a checkpoint call
    expect(deps.captureError).toHaveBeenCalledTimes(1);
    const [captured] = vi.mocked(deps.captureError).mock.calls[0]!;
    expect(captured.route).toContain("collection");
    expect(captured.statusCode).toBe(500);
    const message = (captured.error as Error).message;
    expect(message).toContain("job-fail");
    expect(message).toContain("gitlab");
    expect(message).toContain("previousStopKind=http");
    expect(message).toContain("unexpected credential blowup");
    // No secrets: never the token or access-context HMAC.
    expect(message).not.toContain("fake-token");
    expect(message).not.toContain("a".repeat(64));
  });

  it("stops claiming inside the tick's safety margin, even if jobs remain", async () => {
    const deps = harness();
    let now = 0;
    deps.now = () => now;
    deps.claim = vi.fn().mockImplementation(async () => {
      now += 10_000;
      return [];
    });
    await runCollectionTick(15_000, deps); // margin (20s) exceeds the whole budget
    expect(deps.claim).not.toHaveBeenCalled();
  });

  it("re-runs fan-in for complete-but-unissued days at the start of the tick, before claiming new work", async () => {
    const deps = harness();
    const calls: string[] = [];
    deps.retryPendingFanIns = vi.fn().mockImplementation(async () => { calls.push("retry"); });
    deps.claim = vi.fn().mockImplementation(async () => { calls.push("claim"); return []; });
    await runCollectionTick(240_000, deps);
    expect(deps.retryPendingFanIns).toHaveBeenCalledWith(50);
    expect(calls).toEqual(["retry", "claim"]);
  });

  it("captures, rather than throws, when the fan-in retry sweep itself fails", async () => {
    const deps = harness();
    deps.retryPendingFanIns = vi.fn().mockRejectedValue(new Error("db unavailable"));
    await expect(runCollectionTick(240_000, deps)).resolves.toEqual({ slicesRun: 0 });
    expect(deps.captureError).toHaveBeenCalledOnce();
  });

  it("never touches fan-in retry when the dep is omitted (existing test doubles)", async () => {
    const deps = harness();
    expect(deps.retryPendingFanIns).toBeUndefined();
    await expect(runCollectionTick(240_000, deps)).resolves.toEqual({ slicesRun: 0 });
  });

  it("alerts scoring_queue_stuck when the oldest queued job exceeds the 2h threshold", async () => {
    const deps = harness();
    deps.checkQueueHealth = vi.fn().mockResolvedValue({
      queued: 3, running: 0, retrying: 0, waitingRateLimit: 0, failedToday: 0,
      oldestQueuedAgeMs: 3 * 60 * 60 * 1000, expiredLeases: 0, oldestExpiredLeaseAgeMs: 0,
    });
    await runCollectionTick(240_000, deps);
    expect(deps.checkQueueHealth).toHaveBeenCalledOnce();
  });

  it("does not alert when queue health is within budget", async () => {
    const deps = harness();
    deps.checkQueueHealth = vi.fn().mockResolvedValue({
      queued: 1, running: 0, retrying: 0, waitingRateLimit: 0, failedToday: 0,
      oldestQueuedAgeMs: 1000, expiredLeases: 0, oldestExpiredLeaseAgeMs: 0,
    });
    await expect(runCollectionTick(240_000, deps)).resolves.toEqual({ slicesRun: 0 });
  });

  it("captures, rather than throws, when the queue health check itself fails", async () => {
    const deps = harness();
    deps.checkQueueHealth = vi.fn().mockRejectedValue(new Error("db unavailable"));
    await expect(runCollectionTick(240_000, deps)).resolves.toEqual({ slicesRun: 0 });
    expect(deps.captureError).toHaveBeenCalledOnce();
  });
});

describe("fan-in and terminal-failure hooks", () => {
  it("calls onJobComplete with the finished job when a slice reports done", async () => {
    const deps = harness();
    const onJobComplete = vi.fn().mockResolvedValue(undefined);
    deps.onJobComplete = onJobComplete;
    deps.collect = vi.fn().mockResolvedValue(sliceResult({ done: true, coverage: sampleCoverage }));
    await runCollectionSlice(makeJob(), Date.now() + 60_000, deps);
    expect(onJobComplete).toHaveBeenCalledWith(expect.objectContaining({ state: "complete", ownerHandle: "alice" }));
  });

  it("calls onJobFailed exactly once when a fail() call lands on the terminal failed state", async () => {
    const deps = harness();
    const onJobFailed = vi.fn().mockResolvedValue(undefined);
    deps.onJobFailed = onJobFailed;
    deps.fail = vi.fn().mockResolvedValue({ status: "failed" });
    const job = makeJob({ provider: "bitbucket" });
    deps.collect = vi.fn().mockResolvedValue(sliceResult({
      stop: { provider: "bitbucket", operation: "profile", stopKind: "not_accessible", httpStatus: 403, retryAfterSeconds: null },
    }));
    await runCollectionSlice(job, Date.now() + 60_000, deps);
    expect(onJobFailed).toHaveBeenCalledOnce();
    const [failedJob, stop] = vi.mocked(onJobFailed).mock.calls[0]!;
    expect(failedJob.id).toBe(job.id);
    expect(stop.stopKind).toBe("not_accessible");
  });

  it("never calls onJobFailed when fail() lands on a retry state, not the terminal failed state", async () => {
    const deps = harness();
    const onJobFailed = vi.fn().mockResolvedValue(undefined);
    deps.onJobFailed = onJobFailed;
    deps.fail = vi.fn().mockResolvedValue({ status: "retrying" });
    deps.collect = vi.fn().mockResolvedValue(sliceResult({
      stop: { provider: "github", operation: "merged", stopKind: "http", httpStatus: 500, retryAfterSeconds: null },
    }));
    await runCollectionSlice(makeJob(), Date.now() + 60_000, deps);
    expect(onJobFailed).not.toHaveBeenCalled();
  });

  it("tolerates the absence of onJobFailed (existing test doubles that omit it)", async () => {
    const deps = harness();
    expect(deps.onJobFailed).toBeUndefined();
    deps.fail = vi.fn().mockResolvedValue({ status: "failed" });
    deps.collect = vi.fn().mockResolvedValue(sliceResult({
      stop: { provider: "github", operation: "profile", stopKind: "not_accessible", httpStatus: 401, retryAfterSeconds: null },
    }));
    await expect(runCollectionSlice(makeJob(), Date.now() + 60_000, deps)).resolves.toBeUndefined();
  });
});

describe("observability (#1335 phase 4.7)", () => {
  beforeEach(() => {
    mockCacheSetNxStatus.mockReset().mockResolvedValue("acquired");
    mockCaptureOperationalAlert.mockReset().mockResolvedValue(undefined);
    mockScheduleServerEvent.mockReset();
  });

  describe("scoring_collection_failed alert (worker's own, job-level)", () => {
    function terminalFailureDeps(job: CollectionJob) {
      const deps = harness();
      deps.onJobFailed = productionCollectionWorkerDeps.onJobFailed;
      deps.fail = vi.fn().mockResolvedValue({ status: "failed" });
      deps.collect = vi.fn().mockResolvedValue(sliceResult({
        stop: { provider: job.provider, operation: "profile", stopKind: "not_accessible", httpStatus: 403, retryAfterSeconds: null },
      }));
      return deps;
    }

    it("raises scoring_collection_failed exactly once on a terminal job failure", async () => {
      const job = makeJob({ provider: "bitbucket" });
      const deps = terminalFailureDeps(job);

      await runCollectionSlice(job, Date.now() + 60_000, deps);

      expect(mockCaptureOperationalAlert).toHaveBeenCalledOnce();
      expect(mockCaptureOperationalAlert).toHaveBeenCalledWith(
        expect.objectContaining({ signal: "scoring_collection_failed", severity: "P2" }),
      );
    });

    it("dedupes a second terminal failure for the same owner/provider/day", async () => {
      const job = makeJob({ provider: "bitbucket" });
      mockCacheSetNxStatus.mockResolvedValueOnce("acquired").mockResolvedValueOnce("exists");

      await runCollectionSlice(job, Date.now() + 60_000, terminalFailureDeps(job));
      await runCollectionSlice(job, Date.now() + 60_000, terminalFailureDeps(job));

      expect(mockCaptureOperationalAlert).toHaveBeenCalledOnce();
    });

    it("does not dedupe across different owners, providers, or days (independent keys)", async () => {
      const jobA = makeJob({ provider: "bitbucket", ownerHandle: "alice" });
      const jobB = makeJob({ provider: "gitlab", ownerHandle: "alice" });
      // Every call in this test acquires -- distinct dedupe keys, never "exists".
      mockCacheSetNxStatus.mockResolvedValue("acquired");

      await runCollectionSlice(jobA, Date.now() + 60_000, terminalFailureDeps(jobA));
      await runCollectionSlice(jobB, Date.now() + 60_000, terminalFailureDeps(jobB));

      expect(mockCaptureOperationalAlert).toHaveBeenCalledTimes(2);
      const keys = mockCacheSetNxStatus.mock.calls.map((call) => call[0]);
      expect(new Set(keys).size).toBe(2);
    });
  });

  describe("scoring_queue_stuck alert", () => {
    function tickDeps(health: CollectionQueueHealth) {
      const deps = harness();
      deps.claim = vi.fn().mockResolvedValue([]);
      deps.checkQueueHealth = vi.fn().mockResolvedValue(health);
      return deps;
    }
    const healthy: CollectionQueueHealth = {
      queued: 1, running: 0, retrying: 0, waitingRateLimit: 0, failedToday: 0,
      oldestQueuedAgeMs: 1000, expiredLeases: 0, oldestExpiredLeaseAgeMs: 0,
    };

    it("fires when the oldest queued job exceeds the 2h threshold", async () => {
      await runCollectionTick(240_000, tickDeps({ ...healthy, oldestQueuedAgeMs: 2 * 60 * 60 * 1000 + 1 }));
      expect(mockCaptureOperationalAlert).toHaveBeenCalledWith(
        expect.objectContaining({ signal: "scoring_queue_stuck", severity: "P2" }),
      );
    });

    it("does not fire at exactly the 2h threshold", async () => {
      await runCollectionTick(240_000, tickDeps({ ...healthy, oldestQueuedAgeMs: 2 * 60 * 60 * 1000 }));
      expect(mockCaptureOperationalAlert).not.toHaveBeenCalled();
    });

    it("fires when a lease has been expired for more than 30 minutes", async () => {
      await runCollectionTick(240_000, tickDeps({ ...healthy, expiredLeases: 1, oldestExpiredLeaseAgeMs: 30 * 60 * 1000 + 1 }));
      expect(mockCaptureOperationalAlert).toHaveBeenCalledWith(
        expect.objectContaining({ signal: "scoring_queue_stuck" }),
      );
    });

    it("does not fire for an expired-lease age at or under the 30-minute threshold", async () => {
      await runCollectionTick(240_000, tickDeps({ ...healthy, expiredLeases: 1, oldestExpiredLeaseAgeMs: 30 * 60 * 1000 }));
      expect(mockCaptureOperationalAlert).not.toHaveBeenCalled();
    });

    it("does not fire when healthy", async () => {
      await runCollectionTick(240_000, tickDeps(healthy));
      expect(mockCaptureOperationalAlert).not.toHaveBeenCalled();
    });

    it("dedupes a second stuck tick", async () => {
      mockCacheSetNxStatus.mockResolvedValueOnce("acquired").mockResolvedValueOnce("exists");
      const stuck = { ...healthy, oldestQueuedAgeMs: 3 * 60 * 60 * 1000 };

      await runCollectionTick(240_000, tickDeps(stuck));
      await runCollectionTick(240_000, tickDeps(stuck));

      expect(mockCaptureOperationalAlert).toHaveBeenCalledOnce();
    });
  });

  describe("scoring_collection_slice and scoring_collection_failed event payload shapes", () => {
    /** No URL, request/response body, or token/credential-shaped field in any
     * event payload -- these events are provider/operation/stop-kind
     * telemetry only (mirrors evidence-diagnostics.ts's SourceDiagnostic
     * contract). Matches key names, not values, since a legitimate field
     * name like `stopKind` must not itself trip a substring match on "kind". */
    const FORBIDDEN_KEY_PATTERN = /url|token|credential|authorization|secret|body|cookie/i;
    function assertNoSensitiveFields(payload: Record<string, unknown>): void {
      for (const key of Object.keys(payload)) {
        expect(key).not.toMatch(FORBIDDEN_KEY_PATTERN);
      }
    }

    it("emits scoring_collection_slice with the documented shape on every slice, done or not", async () => {
      const deps = harness();
      deps.collect = vi.fn().mockResolvedValue(sliceResult({ done: true, coverage: sampleCoverage, requests: 12, events: [] }));
      await runCollectionSlice(makeJob(), Date.now() + 60_000, deps);

      expect(mockScheduleServerEvent).toHaveBeenCalledWith("scoring_collection_slice", {
        handle: "alice",
        provider: "github",
        stopKind: null,
        requests: 12,
        events: 0,
        done: true,
      });
      assertNoSensitiveFields(vi.mocked(mockScheduleServerEvent).mock.calls[0]![1] as Record<string, unknown>);
    });

    it("emits scoring_collection_slice reporting the stop kind on an incomplete slice", async () => {
      const deps = harness();
      deps.collect = vi.fn().mockResolvedValue(sliceResult({
        stop: { provider: "github", operation: "merged", stopKind: "budget", httpStatus: null, retryAfterSeconds: null },
      }));
      await runCollectionSlice(makeJob(), Date.now() + 60_000, deps);

      expect(mockScheduleServerEvent).toHaveBeenCalledWith("scoring_collection_slice", expect.objectContaining({
        stopKind: "budget",
        done: false,
      }));
    });

    it("emits scoring_collection_failed with the documented shape on a terminal job failure", async () => {
      const deps = harness();
      deps.fail = vi.fn().mockResolvedValue({ status: "failed" });
      deps.collect = vi.fn().mockResolvedValue(sliceResult({
        stop: { provider: "bitbucket", operation: "profile", stopKind: "not_accessible", httpStatus: 403, retryAfterSeconds: null },
      }));
      const job = makeJob({ provider: "bitbucket", attempt: 2 });

      await runCollectionSlice(job, Date.now() + 60_000, deps);

      const failedCall = vi.mocked(mockScheduleServerEvent).mock.calls.find((call) => call[0] === "scoring_collection_failed");
      expect(failedCall).toBeDefined();
      expect(failedCall![1]).toEqual({
        handle: "alice",
        provider: "bitbucket",
        stopKind: "not_accessible",
        httpStatus: 403,
        operation: "profile",
        attempt: 2,
      });
      assertNoSensitiveFields(failedCall![1] as Record<string, unknown>);
    });

    it("never leaks the resolved token or access-context id into either event", async () => {
      const deps = harness();
      deps.resolveCredential = vi.fn().mockResolvedValue({
        status: "ok",
        resolved: {
          context: { owner: "alice", requestedSource: { provider: "github", host: "github.com", login: "alice" }, window, scope: { discovery: "owned_and_contributed", repositoryIds: [], eventKinds: [] } },
          token: "super-secret-token-value",
          accessContextId: "a".repeat(64),
          requested: { provider: "github", host: "github.com", login: "alice" },
          link: null,
        },
      } satisfies CredentialResolution);
      deps.fail = vi.fn().mockResolvedValue({ status: "failed" });
      deps.collect = vi.fn().mockResolvedValue(sliceResult({
        stop: { provider: "github", operation: "profile", stopKind: "not_accessible", httpStatus: 401, retryAfterSeconds: null },
      }));

      await runCollectionSlice(makeJob(), Date.now() + 60_000, deps);

      for (const call of mockScheduleServerEvent.mock.calls) {
        const serialized = JSON.stringify(call[1]);
        expect(serialized).not.toContain("super-secret-token-value");
        expect(serialized).not.toContain("a".repeat(64));
      }
    });
  });
});
