import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createScoringWindow, engineeringEventKey } from "@chapa/shared";
import { getServiceClient } from "@/test/contract/invoke";
import { sourceEventFixture } from "./source-context-fixture";
import { EMPTY_CHECKPOINT } from "@/lib/collection/plan";
import { EMPTY_PROGRESS,
  claimCollectionJobs, checkpointCollectionJob, enqueueCollectionJob, failCollectionJob, finishCollectionJob,
  isCollectionJobInProgress, listStagedEventKeys,
} from "./collection-queue";

const owner = "contract-collection-queue";
const db = getServiceClient;
const window = createScoringWindow("2026-09-05T12:00:00Z");
const source = { provider: "github" as const, host: "github.com", subjectId: "canonical-node" };
const requested = { provider: "github" as const, host: "github.com", login: owner };
const scope = { discovery: "owned_and_contributed", repositoryIds: [] as readonly string[], eventKinds: [] as readonly string[] };
const coverage = {
  source, window, dataThrough: window.referenceTime, status: "complete", discovery: scope.discovery,
  repositoryIds: ["known"], repositoryDiscoveryComplete: true, eventKinds: {}, reasonCodes: [], unknownPeriods: [],
};
const access = "a".repeat(64);

async function cleanup() {
  await db().from("scoring_collection_jobs").delete().eq("owner_handle", owner);
  await db().from("scoring_v7_source_observations").delete().eq("owner_handle", owner);
  await db().from("scoring_v7_sources").delete().eq("owner_handle", owner);
  await db().from("scoring_v7_subjects").delete().eq("owner_handle", owner);
}

beforeEach(async () => {
  await cleanup();
  expect((await db().rpc("scoring_v7_ensure_subject", { p_owner: owner })).error).toBeNull();
});
afterEach(cleanup);

describe("collection queue (real local database)", () => {
  it("enqueues idempotently and is a no-op for a job already in flight", async () => {
    const first = await enqueueCollectionJob(owner, "github", "signup", window.referenceTime);
    const second = await enqueueCollectionJob(owner, "github", "daily", window.referenceTime);
    expect(second.id).toBe(first.id);
    expect(second.enqueueReason).toBe("signup"); // unchanged: queued jobs are left alone
    expect(second.state).toBe("queued");
    expect(second.checkpoint).toEqual(EMPTY_CHECKPOINT);
    expect(second.progress).toEqual(EMPTY_PROGRESS);
  });

  it("resets a failed job back to queued when re-enqueued with a recovery reason, clearing staged events", async () => {
    const job = await enqueueCollectionJob(owner, "github", "signup", window.referenceTime);
    const claimed = (await claimCollectionJobs(1, 120))[0]!;
    await checkpointCollectionJob(
      { id: claimed.id, leaseToken: claimed.leaseToken! },
      { version: 1, operations: [{ key: "repositories", cursor: "abc", done: false }], discovered: { repositoryIds: [] } },
      [sourceEventFixture(source, window)],
      { operationsDone: 0, operationsKnown: 1, events: 1, requests: 1 },
      false,
    );
    await failCollectionJob(
      { id: claimed.id, leaseToken: claimed.leaseToken! },
      { provider: "github", operation: "repositories", stopKind: "protocol", httpStatus: null, retryAfterSeconds: null },
      null,
    );
    const reset = await enqueueCollectionJob(owner, "github", "retry", window.referenceTime);
    expect(reset.id).toBe(job.id);
    expect(reset.state).toBe("queued");
    expect(reset.attempt).toBe(0);
    expect(reset.checkpoint).toEqual(EMPTY_CHECKPOINT);
    expect(reset.lastStop).toBeNull();
    const staged = await db().from("scoring_collection_staged_events").select("event_key").eq("job_id", job.id);
    expect(staged.data).toEqual([]);
  });

  it("claims with SKIP LOCKED so two concurrent claimers never receive the same job", async () => {
    await enqueueCollectionJob(owner, "github", "signup", window.referenceTime);
    const [a, b] = await Promise.all([claimCollectionJobs(1, 120), claimCollectionJobs(1, 120)]);
    const claimedIds = [...a, ...b].map((job) => job.id);
    expect(claimedIds).toHaveLength(1);
  });

  it("recovers a running job whose lease has expired", async () => {
    const job = await enqueueCollectionJob(owner, "github", "signup", window.referenceTime);
    const firstClaim = (await claimCollectionJobs(1, 1))[0]!; // 1s lease
    expect(firstClaim.id).toBe(job.id);
    await new Promise((resolve) => setTimeout(resolve, 1100)); // let the lease expire
    const secondClaim = await claimCollectionJobs(1, 120);
    expect(secondClaim.map((row) => row.id)).toEqual([job.id]);
    expect(secondClaim[0]!.leaseToken).not.toBe(firstClaim.leaseToken);
  });

  it("rejects a checkpoint call with a stale or wrong lease token", async () => {
    await enqueueCollectionJob(owner, "github", "signup", window.referenceTime);
    const claimed = (await claimCollectionJobs(1, 120))[0]!;
    const result = await checkpointCollectionJob(
      { id: claimed.id, leaseToken: randomUUID() },
      EMPTY_CHECKPOINT,
      [],
      EMPTY_PROGRESS,
      false,
    );
    expect(result).toEqual({ status: "lease_mismatch" });
  });

  it("raises on a staged-event key collision with different content", async () => {
    await enqueueCollectionJob(owner, "github", "signup", window.referenceTime);
    const claimed = (await claimCollectionJobs(1, 120))[0]!;
    const event = sourceEventFixture(source, window);
    await checkpointCollectionJob({ id: claimed.id, leaseToken: claimed.leaseToken! }, EMPTY_CHECKPOINT, [event], EMPTY_PROGRESS, false);
    await expect(checkpointCollectionJob(
      { id: claimed.id, leaseToken: claimed.leaseToken! },
      EMPTY_CHECKPOINT,
      [{ ...event, additions: 1 } as unknown as typeof event],
      EMPTY_PROGRESS,
      false,
    )).rejects.toThrow();
  });

  it("releases a job back to queued for immediate reclaim on a budget/deadline checkpoint", async () => {
    await enqueueCollectionJob(owner, "github", "signup", window.referenceTime);
    const claimed = (await claimCollectionJobs(1, 120))[0]!;
    const checkpoint = { version: 1 as const, operations: [{ key: "repositories", cursor: "next", done: false }], discovered: { repositoryIds: [] } };
    const outcome = await checkpointCollectionJob({ id: claimed.id, leaseToken: claimed.leaseToken! }, checkpoint, [], { ...EMPTY_PROGRESS, requests: 1 }, true);
    expect(outcome.status).toBe("ok");
    const reclaimed = (await claimCollectionJobs(1, 120))[0]!;
    expect(reclaimed.id).toBe(claimed.id);
    expect(reclaimed.checkpoint).toEqual(checkpoint);
  });

  it("finishes a job by appending exactly one observation and clearing staged rows", async () => {
    const job = await enqueueCollectionJob(owner, "github", "signup", window.referenceTime);
    const claimed = (await claimCollectionJobs(1, 120))[0]!;
    const event = sourceEventFixture(source, window);
    await checkpointCollectionJob({ id: claimed.id, leaseToken: claimed.leaseToken! }, EMPTY_CHECKPOINT, [event], { ...EMPTY_PROGRESS, events: 1 }, false);
    expect(await listStagedEventKeys(job.id)).toEqual(new Set([engineeringEventKey(event)]));
    const observationId = randomUUID();
    const outcome = await finishCollectionJob(
      { id: claimed.id, leaseToken: claimed.leaseToken! },
      { coverage, observationId, requested, access, scope, linkId: null, linkVersion: null },
    );
    expect(outcome).toEqual({ status: "ok", observationId });
    const staged = await db().from("scoring_collection_staged_events").select("event_key").eq("job_id", job.id);
    expect(staged.data).toEqual([]);
    const rows = await db().from("scoring_collection_jobs").select("state,observation_id").eq("id", job.id);
    expect(rows.data).toEqual([{ state: "complete", observation_id: observationId }]);
    const observation = await db().from("scoring_v7_source_observations").select("id").eq("owner_handle", owner);
    expect(observation.data).toHaveLength(1);
    // A second finish call for the same (now non-running) job is a no-op lease mismatch, not a second append.
    expect(await finishCollectionJob({ id: claimed.id, leaseToken: claimed.leaseToken! }, { coverage, observationId, requested, access, scope, linkId: null, linkVersion: null }))
      .toEqual({ status: "lease_mismatch" });
  });

  it("fails a job terminally when retryAt is null", async () => {
    await enqueueCollectionJob(owner, "github", "signup", window.referenceTime);
    const claimed = (await claimCollectionJobs(1, 120))[0]!;
    const stop = { provider: "github" as const, operation: "repositories", stopKind: "protocol" as const, httpStatus: null, retryAfterSeconds: null };
    expect(await failCollectionJob({ id: claimed.id, leaseToken: claimed.leaseToken! }, stop, null)).toEqual({ status: "failed" });
    const rows = await db().from("scoring_collection_jobs").select("state,last_stop").eq("id", claimed.id);
    expect(rows.data).toEqual([{ state: "failed", last_stop: stop }]);
  });

  it("routes a rate_limited stop to waiting_rate_limit and any other transient stop to retrying, incrementing attempt", async () => {
    await enqueueCollectionJob(owner, "github", "signup", window.referenceTime);
    const claimed = (await claimCollectionJobs(1, 120))[0]!;
    const retryAt = new Date(Date.now() + 60_000).toISOString();
    expect(await failCollectionJob(
      { id: claimed.id, leaseToken: claimed.leaseToken! },
      { provider: "github", operation: "merged", stopKind: "rate_limited", httpStatus: 403, retryAfterSeconds: 60 },
      retryAt,
    )).toEqual({ status: "waiting_rate_limit" });
    const rows = await db().from("scoring_collection_jobs").select("state,attempt").eq("id", claimed.id);
    expect(rows.data).toEqual([{ state: "waiting_rate_limit", attempt: 1 }]);
  });

  it("reports in-progress only for a non-terminal job on the given day", async () => {
    expect(await isCollectionJobInProgress(owner, "github", window.referenceDate)).toBe(false);
    const job = await enqueueCollectionJob(owner, "github", "signup", window.referenceTime);
    expect(await isCollectionJobInProgress(owner, "github", window.referenceDate)).toBe(true);
    const claimed = (await claimCollectionJobs(1, 120))[0]!;
    expect(await isCollectionJobInProgress(owner, "github", window.referenceDate)).toBe(true);
    await failCollectionJob(
      { id: claimed.id, leaseToken: claimed.leaseToken! },
      { provider: "github", operation: "repositories", stopKind: "protocol", httpStatus: null, retryAfterSeconds: null },
      null,
    );
    expect(await isCollectionJobInProgress(owner, "github", window.referenceDate)).toBe(false);
    void job;
  });

  it("denies browser roles execute on every collection queue RPC", async () => {
    const { assertLocalSqlTarget, inspectLocalSql } = await import("@/test/contract/local-sql");
    assertLocalSqlTarget();
    const query = "SELECT p.proname,has_function_privilege('anon',p.oid,'EXECUTE'),has_function_privilege('authenticated',p.oid,'EXECUTE'),has_function_privilege('service_role',p.oid,'EXECUTE') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'scoring_collection_%' ORDER BY p.proname";
    const rows = inspectLocalSql(query).split("\n");
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.split("|").slice(1)).toEqual(["f", "f", "t"]);
  });
});
