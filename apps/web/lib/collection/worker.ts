import "server-only";
import { randomUUID } from "node:crypto";
import { createScoringWindow, type NormalizedEngineeringEvent } from "@chapa/shared";
import {
  checkpointCollectionJob, claimCollectionJobs, failCollectionJob, finishCollectionJob,
  dbReadCollectionQueueHealth, type CollectionJob, type CollectionProgress, type CollectionQueueHealth,
} from "@/lib/db/collection-queue";
import { discoverStoredSource, readSourceManifest, readSourcePages, type SourceStorageContext } from "@/lib/db/source-context";
import { readSourceAuthorization, type SourceAuthorization, type SourceProvider } from "@/lib/platform/source-authorization";
import { refreshSourceLink } from "@/lib/platform/source-refresh";
import { createSourceContext, type SourceContextInput } from "@/lib/platform/source-context";
import { emitSourceDiagnostics, type SourceDiagnostic } from "@/lib/platform/evidence-diagnostics";
import { captureServerError, captureOperationalAlert } from "@/lib/analytics/server-errors";
import { scheduleServerEvent } from "@/lib/analytics/schedule-server-event";
import { cacheSetNxStatus } from "@/lib/cache/redis";
import { MAX_COLLECTION_ATTEMPTS, nextBackoff } from "./backoff";
import { isQueueOldestQueuedStuck, isQueueLeaseStuck } from "./queue-health";
import { collectSourceSlice } from "./collect-source-slice";
import { createPriorSeedAccumulator } from "./seed";
import { onJobComplete as fanInOnJobComplete, retryPendingFanIns } from "./fan-in";
import type { CollectorCheckpoint, CollectSlice } from "./plan";

/**
 * Durable resumable collection worker (#1335 phase 3). `runCollectionTick`
 * drives a cron invocation: it repeatedly claims runnable jobs and runs one
 * slice each, until the tick's own time budget is nearly spent.
 * `runCollectionSlice` is exported separately for the crash/deadline/retry
 * unit tests, which construct a `CollectionJob` directly rather than going
 * through the real queue.
 */

const HOSTS: Record<SourceProvider, string> = { github: "github.com", gitlab: "gitlab.com", bitbucket: "bitbucket.org", codeberg: "codeberg.org" };

/** The single scope every signed-up owner's full collection uses --
 * mirrors `collectSources` in `lib/profile/score-receipt-v7.ts:67`.
 */
export const FULL_COLLECTION_SCOPE = { discovery: "owned_and_contributed" as const, repositoryIds: [] as readonly string[], eventKinds: [] as readonly string[] };

export interface ResolvedCredential {
  readonly context: SourceContextInput;
  readonly token: string | null;
  readonly accessContextId: string;
  readonly requested: { readonly provider: SourceProvider; readonly host: string; readonly login: string };
  readonly link: { readonly id: string; readonly updatedAt: string } | null;
}
export type CredentialResolution =
  | { readonly status: "ok"; readonly resolved: ResolvedCredential }
  | { readonly status: "not_accessible" };
export type ResolveCredential = (owner: string, provider: SourceProvider, referenceTime: string) => Promise<CredentialResolution>;

/**
 * Production credential resolution: the existing source-context and refresh
 * path (`readSourceAuthorization` + `refreshSourceLink` + `createSourceContext`)
 * -- the same building blocks `source-coordinator.ts` used before this phase
 * made it read-only. Never discovers, reads or appends a source observation;
 * only resolves the token binding a `CollectSlice` call needs.
 */
export const resolveCredential: ResolveCredential = async (owner, provider, referenceTime) => {
  try {
    let authorization: SourceAuthorization = await readSourceAuthorization(owner, provider);
    if (authorization.status !== "authorized") return { status: "not_accessible" };
    if (authorization.link) {
      authorization = await refreshSourceLink(authorization, { owner, provider });
      if (authorization.status !== "authorized") return { status: "not_accessible" };
    }
    const login = provider === "github" ? owner : authorization.link?.remoteLogin;
    if (!login) return { status: "not_accessible" };
    const requested = { provider, host: HOSTS[provider], login };
    const context: SourceContextInput = { owner, requestedSource: requested, window: createScoringWindow(referenceTime), scope: FULL_COLLECTION_SCOPE };
    const binding = authorization.link
      ? createSourceContext(context, { kind: "linked", link: authorization.link, accessToken: authorization.link.tokens.accessToken.trim() })
      : createSourceContext(context, { kind: "github" });
    const token = await binding.collect(async (effectiveToken) => effectiveToken ?? null);
    return {
      status: "ok",
      resolved: {
        context, token, accessContextId: binding.accessContextId, requested,
        link: authorization.link ? { id: authorization.link.id, updatedAt: authorization.link.updatedAt } : null,
      },
    };
  } catch (error) {
    // Still terminal for this job, but never silent: the real cause (a bad
    // stored reference time, an unreadable link row, a refresh failure) is
    // what an operator needs, not a blanket not_accessible.
    void captureServerError({
      route: "lib/collection/worker:resolveCredential",
      statusCode: 500,
      error: new Error(`resolveCredential failed for ${owner}/${provider}: ${(error as Error)?.message ?? String(error)}`),
    });
    return { status: "not_accessible" };
  }
};

export interface CollectionWorkerDeps {
  readonly claim: (limit: number, leaseSeconds: number) => Promise<readonly CollectionJob[]>;
  readonly checkpoint: typeof checkpointCollectionJob;
  readonly finish: typeof finishCollectionJob;
  readonly fail: typeof failCollectionJob;
  readonly resolveCredential: ResolveCredential;
  readonly collect: CollectSlice;
  /** Incremental daily reuse (phase-3.md "Incremental daily reuse"): reads
   * yesterday's complete observation for the same source, if any, so the
   * first slice of a fresh job can seed its checkpoint instead of starting
   * from scratch. Both are read-only -- this worker remains the only writer.
   */
  readonly discoverSource: typeof discoverStoredSource;
  readonly readSourceManifest: typeof readSourceManifest;
  readonly readSourcePages: typeof readSourcePages;
  readonly emitDiagnostics: typeof emitSourceDiagnostics;
  /** Reports a slice that rejected unexpectedly (a bug, or a genuine
   * infrastructure failure below the collector's own stop classification --
   * `runCollectionSlice` otherwise never throws for an ordinary collection
   * outcome). Never blocks other jobs in the same tick's batch on this.
   */
  readonly captureError: typeof captureServerError;
  /** Fires fan-in issuance once this job reaches `complete` (#1335 phase 4). */
  readonly onJobComplete: (job: CollectionJob) => Promise<void> | void;
  /** Fires the `scoring_collection_failed` P2 alert when this job reaches
   * its terminal `failed` state (#1335 phase 4). Optional so existing test
   * doubles that build a `CollectionWorkerDeps` literal without it keep
   * compiling; the production default always alerts.
   */
  readonly onJobFailed?: (job: CollectionJob, stop: SourceDiagnostic) => Promise<void> | void;
  /** Re-runs fan-in for every complete-but-unissued day at the start of each
   * tick (#1335 phase 4: "the job stays complete; the fan-in marker is not
   * set until publication succeeds"). Optional for the same reason as
   * `onJobFailed` above -- existing test doubles omit it and get a no-op.
   */
  readonly retryPendingFanIns?: (limit: number) => Promise<void>;
  /** Backs the `scoring_queue_stuck` P2 alert, checked once per tick
   * (#1335 phase 4). Optional for the same reason as the two deps above.
   */
  readonly checkQueueHealth?: () => Promise<CollectionQueueHealth>;
  readonly now: () => number;
}

/** Dedupes the alert to once per hour rather than once per 5-minute tick. */
const QUEUE_STUCK_ALERT_DEDUPE_SECONDS = 3600;

async function alertIfQueueStuck(health: CollectionQueueHealth): Promise<void> {
  const stuckQueued = isQueueOldestQueuedStuck(health);
  const stuckLease = isQueueLeaseStuck(health);
  if (!stuckQueued && !stuckLease) return;
  const guardStatus = await cacheSetNxStatus("scoring:queue-stuck-alerted", QUEUE_STUCK_ALERT_DEDUPE_SECONDS);
  if (guardStatus === "exists") return;
  await captureOperationalAlert({
    signal: "scoring_queue_stuck",
    severity: "P2",
    summary: stuckQueued
      ? `Collection queue stuck: oldest queued job is ${Math.round(health.oldestQueuedAgeMs / 60000)}min old`
      : `Collection queue stuck: a lease has been expired for ${Math.round(health.oldestExpiredLeaseAgeMs / 60000)}min`,
    route: "lib/collection/worker",
    properties: { ...health },
  });
}

/** Dedupe key mirrors the warm-cache ceiling alert's pattern (#1162 / BE-L5):
 * one page per owner/provider/day, not one per retry that lands on `failed`. */
async function alertScoringCollectionFailed(job: CollectionJob, stop: SourceDiagnostic): Promise<void> {
  const guardStatus = await cacheSetNxStatus(
    `scoring:collection-failed-alerted:${job.ownerHandle}:${job.provider}:${job.referenceDate}`,
    86400,
  );
  if (guardStatus === "exists") return;
  await captureOperationalAlert({
    signal: "scoring_collection_failed",
    severity: "P2",
    summary: `Collection failed terminally for ${job.ownerHandle}/${job.provider} (${job.referenceDate}): ${stop.operation} (${stop.stopKind})`,
    route: "lib/collection/worker",
    properties: { owner: job.ownerHandle, provider: job.provider, referenceDate: job.referenceDate, operation: stop.operation, stopKind: stop.stopKind, httpStatus: stop.httpStatus },
  });
}

export const productionCollectionWorkerDeps: CollectionWorkerDeps = {
  claim: claimCollectionJobs,
  checkpoint: checkpointCollectionJob,
  finish: finishCollectionJob,
  fail: failCollectionJob,
  resolveCredential,
  collect: collectSourceSlice,
  discoverSource: discoverStoredSource,
  readSourceManifest,
  readSourcePages,
  emitDiagnostics: emitSourceDiagnostics,
  captureError: captureServerError,
  onJobComplete: (job) => fanInOnJobComplete(job),
  onJobFailed: (job, stop) => alertScoringCollectionFailed(job, stop),
  retryPendingFanIns: (limit) => retryPendingFanIns(limit),
  checkQueueHealth: () => dbReadCollectionQueueHealth(),
  now: () => Date.now(),
};

/** Per-tick claim batch size and lease length. */
const CLAIM_LIMIT = 4;
const LEASE_SECONDS = 120;
/** Per-slice request budget and wall-clock share of the tick's deadline. */
const MAX_REQUESTS_PER_SLICE = 150;
const SLICE_TIME_BUDGET_MS = 60_000;
const MAX_EVENTS_PER_CHECKPOINT = 1_000;
/** Leaves time for a lease-fenced fail RPC after an in-flight page or stage. */
const SEED_TRANSITION_MARGIN_MS = 20_000;
class PriorSeedDeadline extends Error {}
/** Stop claiming new work this long before the tick's own deadline, so the
 * last claimed batch has time to finish and the response can still return.
 */
const TICK_SAFETY_MARGIN_MS = 20_000;

/** Writes bodies without advancing the durable collector state. */
async function stageEventBatches(
  deps: CollectionWorkerDeps,
  lease: { readonly id: string; readonly leaseToken: string },
  previousCheckpoint: CollectorCheckpoint,
  previousProgress: CollectionProgress,
  events: readonly NormalizedEngineeringEvent[],
  beforeBatch: () => void = () => {},
): ReturnType<typeof checkpointCollectionJob> {
  if (events.length === 0) {
    beforeBatch();
    return deps.checkpoint(lease, previousCheckpoint, [], previousProgress, false);
  }
  let outcome: Awaited<ReturnType<typeof checkpointCollectionJob>>;
  for (let start = 0; start < events.length; start += MAX_EVENTS_PER_CHECKPOINT) {
    beforeBatch();
    outcome = await deps.checkpoint(lease, previousCheckpoint, events.slice(start, start + MAX_EVENTS_PER_CHECKPOINT), previousProgress, false);
    if (outcome.status !== "ok") return outcome;
  }
  return outcome!;
}

/** Advance the cursor only after all bodies are staged. The final empty
 * checkpoint uses the database's distinct staged count, including replays. */
async function checkpointInBatches(
  deps: CollectionWorkerDeps,
  lease: { readonly id: string; readonly leaseToken: string },
  previousCheckpoint: CollectorCheckpoint,
  previousProgress: CollectionProgress,
  nextCheckpoint: CollectorCheckpoint,
  events: readonly NormalizedEngineeringEvent[],
  nextProgress: CollectionProgress,
  release: boolean,
): ReturnType<typeof checkpointCollectionJob> {
  const staged = await stageEventBatches(deps, lease, previousCheckpoint, previousProgress, events);
  if (staged.status !== "ok") return staged;
  return deps.checkpoint(lease, nextCheckpoint, [], { ...nextProgress, events: staged.stagedCount }, release);
}

/**
 * Reads yesterday's complete observation a page at a time. Body writes keep
 * the old cursor/progress until the iterator has verified the final page;
 * a failed page therefore leaves a replayable, incomplete seed. Ordinary
 * absence/ambiguity falls back to collection, but a storage fault is reported
 * and retried after lease reclaim, without publishing partial evidence.
 */
async function trySeedFromPrior(
  deps: CollectionWorkerDeps,
  resolved: ResolvedCredential,
  job: Pick<CollectionJob, "id" | "provider" | "checkpoint" | "progress">,
  lease: { readonly id: string; readonly leaseToken: string },
  ensureBudget: () => void,
): Promise<{ readonly checkpoint: CollectorCheckpoint; readonly progress: CollectionProgress } | null> {
  try {
    ensureBudget();
    const discovery = await deps.discoverSource({
      owner: resolved.context.owner,
      requestedSource: resolved.requested,
      accessContextId: resolved.accessContextId,
      scope: resolved.context.scope,
      window: resolved.context.window,
      link: resolved.link,
    });
    if (discovery.status !== "found") return null;
    const storageContext: SourceStorageContext = {
      owner: resolved.context.owner,
      requestedSource: resolved.requested,
      source: discovery.source,
      accessContextId: resolved.accessContextId,
      scope: resolved.context.scope,
      window: resolved.context.window,
      link: resolved.link,
    };
    // `prior: true` -- the latest observation strictly earlier than today's
    // window, never today's own (there isn't one yet on a job's first slice).
    ensureBudget();
    const prior = await deps.readSourceManifest(storageContext, true);
    if (!prior || prior.coverage.status !== "complete") return null;
    const seed = createPriorSeedAccumulator(resolved.context.window);
    let stagedCount = job.progress.events;
    let wroteBodies = false;
    const pages = deps.readSourcePages(storageContext, prior)[Symbol.asyncIterator]();
    try {
      while (true) {
        ensureBudget();
        const next = await pages.next();
        ensureBudget();
        if (next.done) break; // final count/digest has been validated
        const retained = seed.acceptPage(next.value);
        if (retained.length === 0) continue;
        const staged = await stageEventBatches(deps, lease, job.checkpoint, job.progress, retained, ensureBudget);
        if (staged.status !== "ok") throw new Error(`Prior seed checkpoint returned ${staged.status}`);
        stagedCount = staged.stagedCount;
        wroteBodies = true;
      }
    } finally {
      await pages.return?.();
    }
    if (!wroteBodies) {
      const staged = await stageEventBatches(deps, lease, job.checkpoint, job.progress, [], ensureBudget);
      if (staged.status !== "ok") throw new Error(`Prior seed checkpoint returned ${staged.status}`);
      stagedCount = staged.stagedCount;
    }
    const checkpoint = seed.finish();
    const progress: CollectionProgress = {
      operationsDone: checkpoint.operations.filter((op) => op.done).length,
      operationsKnown: checkpoint.operations.length,
      events: stagedCount,
      requests: 0,
      discovering: true,
    };
    ensureBudget();
    const completed = await deps.checkpoint(lease, checkpoint, [], progress, false);
    if (completed.status !== "ok") throw new Error(`Prior seed completion returned ${completed.status}`);
    return { checkpoint, progress: { ...progress, events: completed.stagedCount } };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await deps.captureError({
      route: "lib/collection/worker:trySeedFromPrior",
      statusCode: 500,
      error: new Error(`Seed-from-prior failed for job ${job.id} (provider=${job.provider}): ${message}`),
    });
    throw error;
  }
}

/**
 * Advances one durable job by exactly one collector slice: resolve
 * credentials, run the collector bounded by `deadlineAt`, persist whatever it
 * produced, and transition state per the outcome. Never throws for an
 * ordinary collection failure -- every stop kind maps to a queue transition.
 */
export async function runCollectionSlice(
  job: CollectionJob,
  deadlineAt: number,
  deps: CollectionWorkerDeps = productionCollectionWorkerDeps,
): Promise<void> {
  if (!job.leaseToken) throw new Error(`runCollectionSlice: job ${job.id} has no lease token`);
  const lease = { id: job.id, leaseToken: job.leaseToken };

  // Wraps deps.fail: a terminal outcome (retryAt === null landing on
  // "failed") fires the scoring_collection_failed event and P2 alert exactly
  // once, from the one place every fail() call in this function funnels
  // through (#1335 phase 4, observability step 4.7).
  const failJob: typeof deps.fail = async (leaseArg, stop, retryAt) => {
    const outcome = await deps.fail(leaseArg, stop, retryAt);
    if (outcome.status === "failed") {
      scheduleServerEvent("scoring_collection_failed", {
        handle: job.ownerHandle,
        provider: stop.provider,
        stopKind: stop.stopKind,
        httpStatus: stop.httpStatus,
        operation: stop.operation,
        attempt: job.attempt,
      });
      void deps.onJobFailed?.(job, stop);
    }
    return outcome;
  };

  const credentialResult = await deps.resolveCredential(job.ownerHandle, job.provider, job.referenceTime);
  if (credentialResult.status !== "ok") {
    await failJob(lease, { provider: job.provider, operation: "resolve_credential", stopKind: "not_accessible", httpStatus: null, retryAfterSeconds: null }, null);
    return;
  }
  const { resolved } = credentialResult;

  let checkpoint = job.checkpoint;
  let persistedProgress = job.progress;

  // An incomplete seed leaves this cursor unchanged and is safely replayed
  // under a new lease; the database deduplicates its already-staged keys.
  if (checkpoint.operations.length === 0 && persistedProgress.requests === 0
      && checkpoint.discovered.itemIds?.seededWorkItemIds === undefined) {
    let seed: Awaited<ReturnType<typeof trySeedFromPrior>>;
    const leaseExpiry = job.leaseExpiresAt ? Date.parse(job.leaseExpiresAt) : Number.NEGATIVE_INFINITY;
    const ensureSeedBudget = () => {
      if (deps.now() + SEED_TRANSITION_MARGIN_MS >= Math.min(deadlineAt, leaseExpiry)) {
        throw new PriorSeedDeadline("Prior seed reached its slice or lease safety margin");
      }
    };
    try {
      seed = await trySeedFromPrior(deps, resolved, job, lease, ensureSeedBudget);
    } catch (error) {
      // The current diagnostic schema has no storage stop kind. The stable
      // operation identifies this as prior-source storage, not a provider
      // request; `protocol` gives it the bounded structural retry budget.
      await failJob(lease, {
        provider: job.provider,
        operation: error instanceof PriorSeedDeadline ? "prior_source_seed" : "prior_source_storage",
        stopKind: error instanceof PriorSeedDeadline ? "deadline" : "protocol",
        httpStatus: null, retryAfterSeconds: null,
      }, structuralRetryAt(job.attempt, deps));
      return;
    }
    if (seed) {
      checkpoint = seed.checkpoint;
      persistedProgress = seed.progress;
    }
  }

  let result: Awaited<ReturnType<typeof deps.collect>>;
  try {
    result = await deps.collect(
      resolved.context,
      { token: resolved.token },
      checkpoint,
      { maxRequests: MAX_REQUESTS_PER_SLICE, deadlineAt },
      new Set(),
    );
  } catch (error) {
    // A collector that throws instead of returning a stop must still move
    // the job: left running, its lease expires and every tick re-claims it
    // (2026-09-24, an EMU login the GitHub collector rejected). Treat it as a
    // structural failure, then rethrow so the tick still captures the cause.
    await failJob(lease, { provider: job.provider, operation: "collect", stopKind: "protocol", httpStatus: null, retryAfterSeconds: null }, structuralRetryAt(job.attempt, deps));
    throw error;
  }

  const progress: CollectionProgress = {
    operationsDone: result.checkpoint.operations.filter((op) => op.done).length,
    operationsKnown: result.checkpoint.operations.length,
    events: persistedProgress.events,
    requests: result.requests,
    // Carries the collector's own discoveryComplete for this checkpoint
    // (#1342): while false, a not-done operation could still add more
    // operations, so operationsKnown is not yet final.
    discovering: !result.discoveryComplete,
  };

  scheduleServerEvent("scoring_collection_slice", {
    handle: job.ownerHandle,
    provider: job.provider,
    stopKind: result.stop?.stopKind ?? null,
    requests: result.requests,
    events: result.events.length,
    done: result.done,
  });

  if (result.done) {
    const outcome = await checkpointInBatches(deps, lease, checkpoint, persistedProgress, result.checkpoint, result.events, progress, false);
    if (outcome.status !== "ok") return;
    if (!result.coverage) throw new Error(`runCollectionSlice: job ${job.id} reported done with no coverage`);
    const observationId = randomUUID();
    const finished = await deps.finish(lease, {
      coverage: result.coverage,
      observationId,
      requested: resolved.requested,
      access: resolved.accessContextId,
      scope: FULL_COLLECTION_SCOPE,
      linkId: resolved.link?.id ?? null,
      linkVersion: resolved.link?.updatedAt ?? null,
    });
    if (finished.status === "ok") {
      await deps.onJobComplete({ ...job, state: "complete", observationId: finished.observationId });
    }
    return;
  }

  const stop = result.stop;
  if (!stop) {
    // Nothing left to do this slice (e.g. a checkpoint-only pass with no
    // stop reported) but not done either -- release for another slice.
    await checkpointInBatches(deps, lease, checkpoint, persistedProgress, result.checkpoint, result.events, progress, true);
    return;
  }

  // Preserves the phase-1 evidence_source_stop telemetry at its new call
  // site -- collection moved from source-coordinator.ts (which emitted one
  // event per collect() attempt) into this worker.
  deps.emitDiagnostics(job.ownerHandle, [stop]);

  if (stop.stopKind === "budget" || stop.stopKind === "deadline") {
    await checkpointInBatches(deps, lease, checkpoint, persistedProgress, result.checkpoint, result.events, progress, true);
    return;
  }

  // Every other stop kind persists this slice's progress (release=false --
  // fail() owns the next state transition) before deciding retry policy.
  const outcome = await checkpointInBatches(deps, lease, checkpoint, persistedProgress, result.checkpoint, result.events, progress, false);
  if (outcome.status !== "ok") return;

  if (stop.stopKind === "rate_limited") {
    const retryAt = new Date(deps.now() + (stop.retryAfterSeconds ?? 60) * 1000).toISOString();
    await failJob(lease, stop, retryAt);
    return;
  }

  // Access was lost mid-slice (e.g. a linked platform's token was revoked
  // between requests) -- terminal immediately, exactly like the credential-
  // resolution stage above. Retrying on a schedule can never fix a
  // reconnect-required failure, so this must never fall into the
  // structural-retry bucket below.
  if (stop.stopKind === "not_accessible") {
    await failJob(lease, stop, null);
    return;
  }

  // `attempt` is "failures since last progress" (migration 058, #1351): a
  // rate_limited stop never bumps it, and a checkpoint that advances
  // operationsDone resets it. This slice's own checkpoint above may have just
  // reset it in the database, so the claim-time job.attempt would be stale.
  const attempt = progress.operationsDone > job.progress.operationsDone ? 0 : job.attempt;

  if (stop.stopKind === "http" || stop.stopKind === "network") {
    const retryAt = attempt < MAX_COLLECTION_ATTEMPTS - 1 ? new Date(deps.now() + nextBackoff(attempt) * 1000).toISOString() : null;
    await failJob(lease, stop, retryAt);
    return;
  }

  // graphql/protocol/parse: the provider responded but with a structural
  // problem, not a transient infra failure -- a stricter 3-try budget, then
  // terminal. (evidence-diagnostics.ts's reasonFor() already groups
  // "graphql" with "protocol"/"parse" as source_error, distinct from the
  // honest-incompleteness budget/deadline/rate_limited group.)
  await failJob(lease, stop, structuralRetryAt(attempt, deps));
}

/** The structural (graphql/protocol/parse/thrown) retry rule: 3 tries since
 * last progress, then terminal (see the http/network comment above). */
function structuralRetryAt(attempt: number, deps: CollectionWorkerDeps): string | null {
  return attempt < 2 ? new Date(deps.now() + nextBackoff(attempt) * 1000).toISOString() : null;
}

/**
 * Drives a cron invocation: repeatedly claims runnable jobs and runs one
 * slice each (in parallel, per claimed batch) until `budgetMs` is nearly
 * spent. A job released back to `queued` mid-tick (a budget/deadline stop)
 * can be re-claimed by a later iteration of this same loop, which is how one
 * invocation carries a job through many slices without waiting for the next
 * cron tick.
 */
export async function runCollectionTick(
  budgetMs = 240_000,
  deps: CollectionWorkerDeps = productionCollectionWorkerDeps,
): Promise<{ readonly slicesRun: number }> {
  const start = deps.now();
  const deadline = start + budgetMs;
  if (deps.retryPendingFanIns) {
    try {
      await deps.retryPendingFanIns(50);
    } catch (error) {
      await deps.captureError({
        route: "lib/collection/worker:runCollectionTick",
        statusCode: 500,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }
  if (deps.checkQueueHealth) {
    try {
      await alertIfQueueStuck(await deps.checkQueueHealth());
    } catch (error) {
      await deps.captureError({
        route: "lib/collection/worker:runCollectionTick",
        statusCode: 500,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }
  let slicesRun = 0;
  while (deps.now() < deadline - TICK_SAFETY_MARGIN_MS) {
    const jobs = await deps.claim(CLAIM_LIMIT, LEASE_SECONDS);
    if (jobs.length === 0) break;
    const sliceDeadline = Math.min(deadline, deps.now() + SLICE_TIME_BUDGET_MS);
    // allSettled, not all: one job's slice throwing (an unexpected bug or
    // infra failure below the collector's own stop classification) must
    // never abort the sibling jobs claimed in the same batch, and must never
    // leave their still-pending promises as unhandled rejections.
    const settled = await Promise.allSettled(jobs.map((job) => runCollectionSlice(job, sliceDeadline, deps)));
    for (let i = 0; i < settled.length; i++) {
      const outcome = settled[i]!;
      if (outcome.status !== "rejected") continue;
      const job = jobs[i]!;
      const message = outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
      const previousStop = job.lastStop ? `, previousStopKind=${job.lastStop.stopKind}` : "";
      await deps.captureError({
        route: "lib/collection/worker:runCollectionTick",
        statusCode: 500,
        error: new Error(`Collection slice failed for job ${job.id} (provider=${job.provider}${previousStop}): ${message}`),
      });
    }
    slicesRun += jobs.length;
  }
  return { slicesRun };
}
