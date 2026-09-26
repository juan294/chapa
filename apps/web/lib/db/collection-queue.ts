import "server-only";
import { z } from "zod";
import { engineeringEventKey, type NormalizedEngineeringEvent } from "@chapa/shared";
import type { SourceDiagnostic, SourceProvider, StopKind } from "@/lib/platform/evidence-diagnostics";
import { EMPTY_CHECKPOINT, type CollectorCheckpoint } from "@/lib/collection/plan";
import { getSupabase } from "./supabase";

/**
 * Typed wrapper over the `scoring_collection_*` RPCs (migration 055, #1335
 * phase 3). Every mutating call is lease-token-gated: a stale worker (an
 * expired or already-superseded lease) gets `{ status: "lease_mismatch" }`
 * back instead of silently clobbering a fresher claim.
 */

export type CollectionJobState = "queued" | "running" | "waiting_rate_limit" | "retrying" | "complete" | "failed";
export type EnqueueReason = "signup" | "refresh" | "daily" | "reconnect" | "admin" | "retry";

export interface CollectionProgress {
  readonly operationsDone: number;
  readonly operationsKnown: number;
  readonly events: number;
  readonly requests: number;
  /** True while this job's collector can still add operations to the
   * checkpoint (#1342) -- `operationsKnown` is not yet final, so a
   * percentage would move backwards as discovery finds more work. Optional
   * for backward compatibility with rows written before this field existed:
   * a legacy row with no key is treated as still discovering unless the job
   * is `complete` (`lib/collection/status.ts`'s `discovering()`). */
  readonly discovering?: boolean;
}
export const EMPTY_PROGRESS: CollectionProgress = { operationsDone: 0, operationsKnown: 0, events: 0, requests: 0 };

export interface CollectionJob {
  readonly id: string;
  readonly ownerHandle: string;
  readonly provider: SourceProvider;
  readonly referenceDate: string;
  readonly referenceTime: string;
  readonly state: CollectionJobState;
  readonly checkpoint: CollectorCheckpoint;
  readonly progress: CollectionProgress;
  readonly attempt: number;
  readonly nextRunAt: string;
  readonly leaseToken: string | null;
  readonly leaseExpiresAt: string | null;
  readonly lastStop: SourceDiagnostic | null;
  readonly enqueueReason: EnqueueReason;
  readonly observationId: string | null;
}

const providerSchema = z.enum(["github", "bitbucket", "gitlab", "codeberg"]);
const stateSchema = z.enum(["queued", "running", "waiting_rate_limit", "retrying", "complete", "failed"]);
const reasonSchema = z.enum(["signup", "refresh", "daily", "reconnect", "admin", "retry"]);
const stopKindSchema = z.enum(["budget", "deadline", "rate_limited", "http", "graphql", "network", "protocol", "parse", "not_accessible"]);

const operationSchema = z.object({ key: z.string().min(1), cursor: z.string().nullable(), done: z.boolean() }).strict();
/** Round-trips `CollectorCheckpoint` (lib/collection/plan.ts) exactly, plus
 * the DB-only `{}` sentinel written before a job's first slice ever runs.
 */
const checkpointSchema: z.ZodType<CollectorCheckpoint> = z.union([
  z.object({}).strict().transform((): CollectorCheckpoint => EMPTY_CHECKPOINT),
  z.object({
    version: z.literal(1),
    operations: z.array(operationSchema),
    discovered: z.object({
      repositoryIds: z.array(z.string()),
      itemIds: z.record(z.string(), z.array(z.string())).optional(),
    }).strict(),
    state: z.record(z.string(), z.unknown()).optional(),
  }).strict(),
]);
const progressSchema: z.ZodType<CollectionProgress> = z.union([
  z.object({}).strict().transform((): CollectionProgress => EMPTY_PROGRESS),
  z.object({
    operationsDone: z.number().int().nonnegative(),
    operationsKnown: z.number().int().nonnegative(),
    events: z.number().int().nonnegative(),
    requests: z.number().int().nonnegative(),
    discovering: z.boolean().optional(),
  }).strict(),
]);
const stopSchema = z.object({
  provider: providerSchema,
  operation: z.string().min(1),
  stopKind: stopKindSchema,
  httpStatus: z.number().int().nullable(),
  retryAfterSeconds: z.number().int().nullable(),
}).strict().nullable();

const jobRowSchema = z.object({
  id: z.uuid(),
  owner_handle: z.string().min(1),
  provider: providerSchema,
  reference_date: z.string(),
  reference_time: z.string(),
  state: stateSchema,
  checkpoint: checkpointSchema,
  progress: progressSchema,
  attempt: z.number().int().nonnegative(),
  next_run_at: z.string(),
  lease_token: z.uuid().nullable(),
  lease_expires_at: z.string().nullable(),
  last_stop: stopSchema,
  enqueue_reason: reasonSchema,
  observation_id: z.uuid().nullable(),
}).loose();

function mapJobRow(row: unknown): CollectionJob {
  const parsed = jobRowSchema.parse(row);
  return {
    id: parsed.id,
    ownerHandle: parsed.owner_handle,
    provider: parsed.provider,
    referenceDate: parsed.reference_date,
    referenceTime: parsed.reference_time,
    state: parsed.state,
    checkpoint: parsed.checkpoint,
    progress: parsed.progress,
    attempt: parsed.attempt,
    nextRunAt: parsed.next_run_at,
    leaseToken: parsed.lease_token,
    leaseExpiresAt: parsed.lease_expires_at,
    lastStop: parsed.last_stop,
    enqueueReason: parsed.enqueue_reason,
    observationId: parsed.observation_id,
  };
}

async function rpc(name: string, input: object): Promise<unknown> {
  const db = getSupabase();
  if (!db) throw new Error(`${name}: Supabase client unavailable`);
  const { data, error } = await db.rpc(name, input);
  if (error) throw new Error(`${name} failed: ${error.message}`);
  return data;
}

/** Upserts on the (owner, provider, day) key. See migration 055 for the
 * exact re-enqueue semantics per prior job state and reason.
 */
export async function enqueueCollectionJob(
  owner: string,
  provider: SourceProvider,
  reason: EnqueueReason,
  referenceTime: string,
): Promise<CollectionJob> {
  try {
    return mapJobRow(await rpc("scoring_collection_enqueue", {
      p_owner: owner.toLowerCase(),
      p_provider: provider,
      p_reason: reason,
      p_reference_time: referenceTime,
    }));
  } catch (error) {
    throw new Error(`Collection enqueue unavailable: ${(error as Error).message}`, { cause: error });
  }
}

/** `FOR UPDATE SKIP LOCKED` claim. Also recovers a `running` job whose lease
 * has expired (a crashed or platform-killed worker).
 */
export async function claimCollectionJobs(limit: number, leaseSeconds: number): Promise<CollectionJob[]> {
  try {
    const data = await rpc("scoring_collection_claim_v2", { p_limit: limit, p_lease_seconds: leaseSeconds });
    return z.array(z.unknown()).parse(data).map(mapJobRow);
  } catch (error) {
    throw new Error(`Collection claim unavailable: ${(error as Error).message}`, { cause: error });
  }
}

export type CheckpointOutcome =
  | { readonly status: "ok"; readonly stagedCount: number }
  | { readonly status: "event_limit"; readonly stagedCount: number }
  | { readonly status: "lease_mismatch" };

const checkpointResultSchema = z.union([
  z.object({ status: z.literal("ok"), stagedCount: z.number().int().nonnegative() }).strict(),
  z.object({ status: z.literal("event_limit"), stagedCount: z.number().int().nonnegative() }).strict(),
  z.object({ status: z.literal("lease_mismatch") }).strict(),
  z.object({ status: z.literal("importing"), importedCount: z.number().int().nonnegative(), remainingCount: z.number().int().nonnegative() }).strict(),
]);

/**
 * Persists an advanced checkpoint and any newly discovered events for this
 * slice. `release: true` is the budget/deadline path: the job is handed back
 * to `queued` with `next_run_at = now()` so the same cron tick's claim loop
 * can immediately pick it back up for another slice.
 */
export async function checkpointCollectionJob(
  job: { readonly id: string; readonly leaseToken: string },
  checkpoint: CollectorCheckpoint,
  events: readonly NormalizedEngineeringEvent[],
  progress: CollectionProgress,
  release: boolean,
): Promise<CheckpointOutcome> {
  try {
    const input = {
      p_job_id: job.id,
      p_lease_token: job.leaseToken,
      p_checkpoint: checkpoint,
      p_event_keys: events.map((event) => engineeringEventKey(event)),
      p_events: events,
      p_progress: progress,
      p_release: release,
    };
    let result = checkpointResultSchema.parse(await rpc("scoring_collection_checkpoint_v2", input));
    if (result.status !== "importing") return result;

    // A pre-migration job can already hold thousands of staged rows. The v2
    // RPC imports at most 2,000 per call and ignores the new slice until the
    // import is complete. Poll with empty batches, then send this slice once.
    // A non-decreasing remainder is a protocol error, not an infinite loop.
    let previousRemaining = Number.POSITIVE_INFINITY;
    for (let page = 0; page < 32; page++) {
      if (result.status !== "importing") throw new Error("Legacy import returned an unexpected checkpoint result");
      if (result.remainingCount >= previousRemaining) throw new Error("Legacy import made no progress");
      previousRemaining = result.remainingCount;
      if (result.remainingCount === 0) {
        result = checkpointResultSchema.parse(await rpc("scoring_collection_checkpoint_v2", input));
        if (result.status === "importing") throw new Error("Legacy import restarted after completion");
        return result;
      }
      result = checkpointResultSchema.parse(await rpc("scoring_collection_checkpoint_v2", {
        ...input, p_event_keys: [], p_events: [], p_release: false,
      }));
    }
    throw new Error("Legacy import exceeded its bounded page budget");
  } catch (error) {
    throw new Error(`Collection checkpoint unavailable: ${(error as Error).message}`, { cause: error });
  }
}

export interface FinishAppendArgs {
  /** `SourceCoverage` (@chapa/shared) -- carries `source` and `window` too,
   * which `scoring_v7_append_source` reads back out of it. */
  readonly coverage: object;
  readonly observationId: string;
  readonly requested: { readonly provider: SourceProvider; readonly host: string; readonly login: string };
  readonly access: string;
  readonly scope: { readonly discovery: string; readonly repositoryIds: readonly string[]; readonly eventKinds: readonly string[] };
  readonly linkId: string | null;
  readonly linkVersion: string | null;
}

export type FinishOutcome =
  | { readonly status: "ok"; readonly observationId: string }
  | { readonly status: "event_limit"; readonly stagedCount: number }
  | { readonly status: "lease_mismatch" };

const finishResultSchema = z.union([
  z.object({ status: z.literal("ok"), observationId: z.uuid(), eventCount: z.number().int().nonnegative() }).strict(),
  z.object({ status: z.literal("event_limit"), stagedCount: z.number().int().nonnegative() }).strict(),
  z.object({ status: z.literal("lease_mismatch") }).strict(),
]);

/** Publishes a small manifest for the immutable event generation in the same
 * transaction as the `complete` state transition.
 */
export async function finishCollectionJob(
  job: { readonly id: string; readonly leaseToken: string },
  args: FinishAppendArgs,
): Promise<FinishOutcome> {
  try {
    const data = await rpc("scoring_collection_finish_v2", {
      p_job_id: job.id,
      p_lease_token: job.leaseToken,
      p_coverage: args.coverage,
      p_observation: args.observationId,
      p_requested: args.requested,
      p_access: args.access,
      p_scope: args.scope,
      p_link_id: args.linkId,
      p_link_version: args.linkVersion,
    });
    const result = finishResultSchema.parse(data);
    return result.status === "ok" ? { status: "ok", observationId: result.observationId } : result;
  } catch (error) {
    throw new Error(`Collection finish unavailable: ${(error as Error).message}`, { cause: error });
  }
}

/**
 * The `engineeringEventKey` of every event staged for this job by earlier
 * slices (and this one, once its own checkpoint call has landed), so the
 * worker can pass `stagedKeys` to the next `CollectSlice` call per
 * `lib/collection/plan.ts`. A `CollectSlice` only ever dedupes against these
 * keys. It never needs the rows' full JSONB bodies, so this reads only the
 * `event_key` column from the current generation and any legacy staging.
 */
export async function listStagedEventKeys(jobId: string): Promise<ReadonlySet<string>> {
  const db = getSupabase();
  if (!db) throw new Error("listStagedEventKeys: Supabase client unavailable");
  const { data: job, error: jobError } = await db.from("scoring_collection_jobs")
    .select("current_generation_id").eq("id", jobId).maybeSingle();
  if (jobError) throw new Error(`listStagedEventKeys failed: ${jobError.message}`);
  if (!job) throw new Error(`listStagedEventKeys failed: job ${jobId} not found`);
  // PostgREST returns at most `max_rows` (1,000) rows per request, so page
  // explicitly: a truncated key set makes every later slice re-send events.
  // During a legacy import both tables can contain keys. Once import is
  // complete, the generation has the full key set and only it needs paging.
  const keys = new Set<string>();
  let sources: readonly ("legacy" | "generation")[] = ["legacy"];
  if (job.current_generation_id) {
    const { data: generation, error: generationError } = await db.from("scoring_collection_generations")
      .select("legacy_import_done").eq("id", job.current_generation_id).single();
    if (generationError || !generation) {
      throw new Error(`listStagedEventKeys failed: ${generationError?.message ?? "generation not found"}`);
    }
    sources = generation.legacy_import_done ? ["generation"] : ["legacy", "generation"];
  }
  for (const source of sources) {
    for (let from = 0; ; from += STAGED_KEYS_PAGE) {
      const query = source === "legacy"
        ? db.from("scoring_collection_staged_events").select("event_key").eq("job_id", jobId)
        : db.from("scoring_collection_generation_events").select("event_key").eq("generation_id", job.current_generation_id!);
      const { data, error } = await query.order("event_key").range(from, from + STAGED_KEYS_PAGE - 1);
      if (error) throw new Error(`listStagedEventKeys failed: ${error.message}`);
      const rows = z.array(z.object({ event_key: z.string() }).strict()).parse(data ?? []);
      for (const row of rows) keys.add(row.event_key);
      if (rows.length < STAGED_KEYS_PAGE) break;
    }
  }
  return keys;
}
const STAGED_KEYS_PAGE = 1_000;

/** In-progress states: a job the owner or a visitor should see as "collection
 * running", as opposed to no job at all or a terminal `complete`/`failed`.
 */
const IN_PROGRESS_STATES: ReadonlySet<CollectionJobState> = new Set(["queued", "running", "waiting_rate_limit", "retrying"]);

/**
 * Whether today's (or the given `referenceDate`'s) job for this owner and
 * provider exists and has not yet reached a terminal state. Backs
 * `source-coordinator.ts`'s read-only `inProgress` reporting (#1335 phase 3,
 * step 3.7) -- a plain read, never a write, so a direct table select (service
 * role bypasses RLS, matching `dbGetPendingSends`'s pattern) is enough; no RPC
 * is needed for a read this simple.
 */
export async function isCollectionJobInProgress(
  owner: string,
  provider: SourceProvider,
  referenceDate: string,
): Promise<boolean> {
  const db = getSupabase();
  if (!db) return false;
  const { data, error } = await db
    .from("scoring_collection_jobs")
    .select("state")
    .eq("owner_handle", owner.toLowerCase())
    .eq("provider", provider)
    .eq("reference_date", referenceDate)
    .maybeSingle();
  if (error || !data) return false;
  const state = stateSchema.safeParse(data.state);
  return state.success && IN_PROGRESS_STATES.has(state.data);
}

/**
 * An owner's collection jobs for one reference date, across every connected
 * provider -- backs `lib/collection/read-scoring-status.ts` (called with
 * today's UTC date) and fan-in's retry sweep (called with a possibly-earlier
 * pending day). Reads via the `scoring_status` RPC (migration 056).
 */
export async function listCollectionJobsForDate(owner: string, referenceDate: string): Promise<CollectionJob[]> {
  try {
    const data = await rpc("scoring_status", { p_owner: owner.toLowerCase(), p_reference_date: referenceDate });
    return z.array(z.unknown()).parse(data).map(mapJobRow);
  } catch (error) {
    throw new Error(`Collection status unavailable: ${(error as Error).message}`, { cause: error });
  }
}

export interface PendingFanIn {
  readonly ownerHandle: string;
  readonly referenceDate: string;
  readonly referenceTime: string;
}
const pendingFanInRowSchema = z.object({
  owner_handle: z.string().min(1),
  reference_date: z.string(),
  reference_time: z.string(),
}).strict();

/**
 * Every (owner, day) whose jobs are all complete but has no recorded
 * issued/unchanged issuance attempt yet -- fan-in either never ran (a worker
 * crash between the last job completing and `onJobComplete`) or ran and
 * failed every time so far. `runCollectionTick` retries each of these at the
 * start of every tick (#1335 phase 4).
 */
export async function listPendingFanIns(limit: number): Promise<PendingFanIn[]> {
  try {
    const data = await rpc("scoring_collection_pending_fan_in", { p_limit: limit });
    return z.array(pendingFanInRowSchema).parse(data).map((row) => ({
      ownerHandle: row.owner_handle,
      referenceDate: row.reference_date,
      referenceTime: row.reference_time,
    }));
  } catch (error) {
    throw new Error(`Pending fan-in list unavailable: ${(error as Error).message}`, { cause: error });
  }
}

export interface CollectionQueueHealth {
  readonly queued: number;
  readonly running: number;
  readonly retrying: number;
  readonly waitingRateLimit: number;
  readonly failedToday: number;
  readonly oldestQueuedAgeMs: number;
  readonly expiredLeases: number;
  readonly oldestExpiredLeaseAgeMs: number;
}
const bigintish = z.union([z.number(), z.string()]).transform((v) => Number(v));
const queueHealthRowSchema = z.object({
  queued: bigintish,
  running: bigintish,
  retrying: bigintish,
  waiting_rate_limit: bigintish,
  failed_today: bigintish,
  oldest_queued_age_ms: bigintish,
  expired_leases: bigintish,
  oldest_expired_lease_age_ms: bigintish,
}).loose();

/** Shared by `/api/health`'s `scoringQueue` block and `runCollectionTick`'s
 * `scoring_queue_stuck` check (#1335 phase 4) -- one read, not two
 * independently-maintained queries over the same table.
 */
export async function dbReadCollectionQueueHealth(): Promise<CollectionQueueHealth> {
  try {
    const data = await rpc("scoring_collection_queue_health", {});
    const rows = z.array(z.unknown()).parse(data);
    const row = queueHealthRowSchema.parse(rows[0] ?? {});
    return {
      queued: row.queued,
      running: row.running,
      retrying: row.retrying,
      waitingRateLimit: row.waiting_rate_limit,
      failedToday: row.failed_today,
      oldestQueuedAgeMs: row.oldest_queued_age_ms,
      expiredLeases: row.expired_leases,
      oldestExpiredLeaseAgeMs: row.oldest_expired_lease_age_ms,
    };
  } catch (error) {
    throw new Error(`Collection queue health unavailable: ${(error as Error).message}`, { cause: error });
  }
}

export type FailOutcome =
  | { readonly status: "failed" | "retrying" | "waiting_rate_limit" }
  | { readonly status: "lease_mismatch" };

const failResultSchema = z.union([
  z.object({ status: z.enum(["failed", "retrying", "waiting_rate_limit"]) }).strict(),
  z.object({ status: z.literal("lease_mismatch") }).strict(),
]);

/** `retryAt: null` is terminal (`failed`). Otherwise the next state is
 * `waiting_rate_limit` (for a `rate_limited` stop) or `retrying`.
 */
export async function failCollectionJob(
  job: { readonly id: string; readonly leaseToken: string },
  stop: { readonly provider: SourceProvider; readonly operation: string; readonly stopKind: StopKind; readonly httpStatus: number | null; readonly retryAfterSeconds: number | null },
  retryAt: string | null,
): Promise<FailOutcome> {
  try {
    const data = await rpc("scoring_collection_fail", {
      p_job_id: job.id,
      p_lease_token: job.leaseToken,
      p_stop: stop,
      p_retry_at: retryAt,
    });
    return failResultSchema.parse(data);
  } catch (error) {
    throw new Error(`Collection fail unavailable: ${(error as Error).message}`, { cause: error });
  }
}
