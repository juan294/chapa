import "server-only";
import { randomUUID } from "node:crypto";
import { createScoringWindow } from "@chapa/shared";
import {
  checkpointCollectionJob, claimCollectionJobs, failCollectionJob, finishCollectionJob, listStagedEvents,
  type CollectionJob, type CollectionProgress,
} from "@/lib/db/collection-queue";
import { readSourceAuthorization, type SourceAuthorization, type SourceProvider } from "@/lib/platform/source-authorization";
import { refreshSourceLink } from "@/lib/platform/source-refresh";
import { createSourceContext, type SourceContextInput } from "@/lib/platform/source-context";
import { emitSourceDiagnostics } from "@/lib/platform/evidence-diagnostics";
import { captureServerError } from "@/lib/analytics/server-errors";
import { MAX_COLLECTION_ATTEMPTS, nextBackoff } from "./backoff";
import { collectSourceSlice } from "./collect-source-slice";
import type { CollectSlice } from "./plan";

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
  } catch { return { status: "not_accessible" }; }
};

export interface CollectionWorkerDeps {
  readonly claim: (limit: number, leaseSeconds: number) => Promise<readonly CollectionJob[]>;
  readonly checkpoint: typeof checkpointCollectionJob;
  readonly finish: typeof finishCollectionJob;
  readonly fail: typeof failCollectionJob;
  readonly listStaged: typeof listStagedEvents;
  readonly resolveCredential: ResolveCredential;
  readonly collect: CollectSlice;
  readonly emitDiagnostics: typeof emitSourceDiagnostics;
  /** Reports a slice that rejected unexpectedly (a bug, or a genuine
   * infrastructure failure below the collector's own stop classification --
   * `runCollectionSlice` otherwise never throws for an ordinary collection
   * outcome). Never blocks other jobs in the same tick's batch on this.
   */
  readonly captureError: typeof captureServerError;
  /** No-op in this phase; phase 4 fills it in with fan-in issuance. */
  readonly onJobComplete: (job: CollectionJob) => Promise<void> | void;
  readonly now: () => number;
}

export const productionCollectionWorkerDeps: CollectionWorkerDeps = {
  claim: claimCollectionJobs,
  checkpoint: checkpointCollectionJob,
  finish: finishCollectionJob,
  fail: failCollectionJob,
  listStaged: listStagedEvents,
  resolveCredential,
  collect: collectSourceSlice,
  emitDiagnostics: emitSourceDiagnostics,
  captureError: captureServerError,
  onJobComplete: () => undefined,
  now: () => Date.now(),
};

/** Per-tick claim batch size and lease length. */
const CLAIM_LIMIT = 4;
const LEASE_SECONDS = 120;
/** Per-slice request budget and wall-clock share of the tick's deadline. */
const MAX_REQUESTS_PER_SLICE = 150;
const SLICE_TIME_BUDGET_MS = 60_000;
/** Stop claiming new work this long before the tick's own deadline, so the
 * last claimed batch has time to finish and the response can still return.
 */
const TICK_SAFETY_MARGIN_MS = 20_000;

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

  const credentialResult = await deps.resolveCredential(job.ownerHandle, job.provider, job.referenceTime);
  if (credentialResult.status !== "ok") {
    await deps.fail(lease, { provider: job.provider, operation: "resolve_credential", stopKind: "not_accessible", httpStatus: null, retryAfterSeconds: null }, null);
    return;
  }
  const { resolved } = credentialResult;

  const staged = await deps.listStaged(job.id);
  const result = await deps.collect(
    resolved.context,
    { token: resolved.token },
    job.checkpoint,
    { maxRequests: MAX_REQUESTS_PER_SLICE, deadlineAt },
    staged,
  );

  const progress: CollectionProgress = {
    operationsDone: result.checkpoint.operations.filter((op) => op.done).length,
    operationsKnown: result.checkpoint.operations.length,
    events: staged.length + result.events.length,
    requests: result.requests,
  };

  if (result.done) {
    await deps.checkpoint(lease, result.checkpoint, result.events, progress, false);
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
    await deps.checkpoint(lease, result.checkpoint, result.events, progress, true);
    return;
  }

  // Preserves the phase-1 evidence_source_stop telemetry at its new call
  // site -- collection moved from source-coordinator.ts (which emitted one
  // event per collect() attempt) into this worker.
  deps.emitDiagnostics(job.ownerHandle, [stop]);

  if (stop.stopKind === "budget" || stop.stopKind === "deadline") {
    await deps.checkpoint(lease, result.checkpoint, result.events, progress, true);
    return;
  }

  // Every other stop kind persists this slice's progress (release=false --
  // fail() owns the next state transition) before deciding retry policy.
  await deps.checkpoint(lease, result.checkpoint, result.events, progress, false);

  if (stop.stopKind === "rate_limited") {
    const retryAt = new Date(deps.now() + (stop.retryAfterSeconds ?? 60) * 1000).toISOString();
    await deps.fail(lease, stop, retryAt);
    return;
  }

  // Access was lost mid-slice (e.g. a linked platform's token was revoked
  // between requests) -- terminal immediately, exactly like the credential-
  // resolution stage above. Retrying on a schedule can never fix a
  // reconnect-required failure, so this must never fall into the
  // structural-retry bucket below.
  if (stop.stopKind === "not_accessible") {
    await deps.fail(lease, stop, null);
    return;
  }

  if (stop.stopKind === "http" || stop.stopKind === "network") {
    const retryAt = job.attempt < MAX_COLLECTION_ATTEMPTS - 1 ? new Date(deps.now() + nextBackoff(job.attempt) * 1000).toISOString() : null;
    await deps.fail(lease, stop, retryAt);
    return;
  }

  // graphql/protocol/parse: the provider responded but with a structural
  // problem, not a transient infra failure -- a stricter 3-try budget, then
  // terminal. (evidence-diagnostics.ts's reasonFor() already groups
  // "graphql" with "protocol"/"parse" as source_error, distinct from the
  // honest-incompleteness budget/deadline/rate_limited group.)
  const retryAt = job.attempt < 2 ? new Date(deps.now() + nextBackoff(job.attempt) * 1000).toISOString() : null;
  await deps.fail(lease, stop, retryAt);
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
