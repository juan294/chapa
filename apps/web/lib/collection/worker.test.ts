import { describe, expect, it, vi } from "vitest";
import { createScoringWindow, engineeringEventKey, type NormalizedEngineeringEvent, type SourceCoverage } from "@chapa/shared";
import type { CollectionJob } from "@/lib/db/collection-queue";
import type { StoredSourceObservation } from "@/lib/db/source-context";
import { EMPTY_CHECKPOINT, type CollectorCheckpoint, type SliceResult } from "./plan";
import { runCollectionSlice, runCollectionTick, type CollectionWorkerDeps, type CredentialResolution } from "./worker";

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
  return { events: [], checkpoint: EMPTY_CHECKPOINT, done: false, coverage: null, stop: null, requests: 1, ...overrides };
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
        discovered: { repositoryIds: ["R1"], itemIds: { seededWorkItemIds: ["github:PR1"] } },
        state: { seededDataThrough: "2026-09-04T12:00:00.000Z" },
      };
      expect(deps.checkpoint).toHaveBeenNthCalledWith(1, { id: "job-1", leaseToken: "lease-1" }, seededCheckpoint, [merged], expect.any(Object), false);
      expect(deps.collect).toHaveBeenCalledWith(expect.anything(), expect.anything(), seededCheckpoint, expect.anything(), new Set([engineeringEventKey(merged)]));
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
});
