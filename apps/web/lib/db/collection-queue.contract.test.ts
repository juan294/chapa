import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createScoringWindow, engineeringEventKey, observed } from "@chapa/shared";
import { getServiceClient } from "@/test/contract/invoke";
import { inspectLocalSql } from "@/test/contract/local-sql";
import { sourceEventFixture } from "./source-context-fixture";
import { readSourceObservation } from "./source-context";
import { readSourceManifest, readSourcePages } from "./source-context";
import { dbGetLinkedPlatformStrict, dbUpsertLinkedPlatform } from "./user-platforms";
import { issueScoreReceipt } from "@/lib/profile/issue-receipt";
import { readRenderableReceipt, scoreModelFrom } from "@/lib/profile/score-model";
import { hasDrawableCurrentReceipt, readScoringStatus } from "@/lib/collection/read-scoring-status";
import { observedReceiptViewModel } from "@/lib/profile/score-view-model";
import { resolveBadgeVerification } from "@/lib/profile/badge-verification";
import { getReceiptVerificationV7 } from "@/lib/verification/store";
import { EMPTY_CHECKPOINT } from "@/lib/collection/plan";
import { createSourceContext } from "@/lib/platform/source-context";
import { syntheticCollectionEvents, syntheticCollectionSource } from "./synthetic-collection-fixture";
import { EMPTY_PROGRESS,
  claimCollectionJobs, checkpointCollectionJob, enqueueCollectionJob, failCollectionJob, finishCollectionJob,
  isCollectionJobInProgress, listStagedEventKeys, readCollectionJobRecovery,
} from "./collection-queue";

const owner = "contract-collection-queue";
const db = getServiceClient;
const scale = process.env.SCORING_RUN_SCALE_CONTRACT === "1" ? it : it.skip;
const window = createScoringWindow("2026-09-05T12:00:00Z");
const source = { provider: "github" as const, host: "github.com", subjectId: "canonical-node" };
const requested = { provider: "github" as const, host: "github.com", login: owner };
const scope = { discovery: "owned_and_contributed" as const, repositoryIds: [] as readonly string[], eventKinds: [] as readonly string[] };
const coverage = {
  source, window, dataThrough: window.referenceTime, status: "complete", discovery: scope.discovery,
  repositoryIds: ["known"], repositoryDiscoveryComplete: true, eventKinds: {}, reasonCodes: [], unknownPeriods: [],
};
const access = createSourceContext({ owner, requestedSource: requested, window, scope }, { kind: "github" }).accessContextId;

async function cleanup() {
  // Local psql avoids PostgREST's 8s statement timeout while cascading a
  // published 100k generation. The helper verifies this exact local stack.
  inspectLocalSql(`DELETE FROM public.user_platforms WHERE handle = '${owner}';
    DELETE FROM public.scoring_v7_subjects WHERE owner_handle = '${owner}'`);
}

beforeEach(async () => {
  await cleanup();
  expect((await db().rpc("scoring_v7_ensure_subject", { p_owner: owner })).error).toBeNull();
});
afterEach(cleanup, 600_000);

/** Lease only this synthetic job; other local benchmark jobs may be awaiting retry. */
async function leaseExactJob(jobId: string) {
  const token = randomUUID();
  const { data, error } = await db().from("scoring_collection_jobs")
    .update({ state: "running", lease_token: token, lease_expires_at: new Date(Date.now() + 30 * 60_000).toISOString() })
    .eq("id", jobId).eq("state", "queued").select("id").single();
  expect(error).toBeNull();
  expect(data?.id).toBe(jobId);
  return token;
}

function v2Checkpoint(jobId: string, leaseToken: string, events: ReturnType<typeof syntheticCollectionEvents>, total = events.length) {
  return db().rpc("scoring_collection_checkpoint_v2", {
    p_job_id: jobId, p_lease_token: leaseToken, p_checkpoint: EMPTY_CHECKPOINT,
    p_event_keys: events.map(engineeringEventKey), p_events: events,
    p_progress: { ...EMPTY_PROGRESS, events: total }, p_release: false,
  });
}

function v2Finish(jobId: string, leaseToken: string, observationId: string, finishCoverage: object = coverage) {
  return db().rpc("scoring_collection_finish_v2", {
    p_job_id: jobId, p_lease_token: leaseToken, p_coverage: finishCoverage,
    p_observation: observationId, p_requested: requested, p_access: access,
    p_scope: scope, p_link_id: null, p_link_version: null,
  });
}

function issueInFreshLocalProcess(): { issuanceMs: number; peakRssBytes: number; osMaxRssBytes: number } {
  const env: NodeJS.ProcessEnv = { NODE_ENV: "test" };
  for (const key of ["PATH", "HOME", "TMPDIR", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY",
    "NEXTAUTH_SECRET", "CHAPA_VERIFICATION_SECRET", "CRON_SECRET", "ADMIN_SECRET"] as const) {
    if (process.env[key]) env[key] = process.env[key];
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !env.NEXTAUTH_SECRET
    || !env.CHAPA_VERIFICATION_SECRET || process.env.GITHUB_TOKEN) {
    throw new Error("Fresh issuance requires synthetic local credentials only");
  }
  const scratch = mkdtempSync(join(tmpdir(), "chapa-100k-issuance-"));
  try {
    const output = join(scratch, "profile.json");
    Object.assign(env, { SCORING_CHILD_ISSUANCE: "1", SCORING_CHILD_OWNER: owner,
      SCORING_CHILD_REFERENCE: window.referenceTime, SCORING_CHILD_OUTPUT: output });
    const result = spawnSync("/usr/bin/time", ["-l", "pnpm", "exec", "vitest", "run", "-c",
      "vitest.config.contract.ts", "apps/web/lib/db/receipt-issuance-process.contract.test.ts", "--maxWorkers=1"],
    { cwd: process.cwd(), env, encoding: "utf8", timeout: 180_000, maxBuffer: 1_000_000 });
    if (result.status !== 0) throw new Error(`Isolated issuance failed (status ${result.status}): ${result.stderr?.slice(-1200)}`);
    const match = result.stderr?.match(/(\d+)\s+maximum resident set size/);
    if (!match) throw new Error("Isolated issuance OS RSS unavailable");
    const child = JSON.parse(readFileSync(output, "utf8")) as { issuanceMs: number; peakRssBytes: number; receiptCount: number };
    if (child.receiptCount !== 1) throw new Error("Isolated issuance receipt count mismatch");
    return { issuanceMs: child.issuanceMs, peakRssBytes: child.peakRssBytes,
      osMaxRssBytes: Number(match[1]) };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

describe("collection generation v2 (real local database)", () => {
  it("checkpoints one event and publishes one immutable observation with an ID/count-only response", async () => {
    const job = await enqueueCollectionJob(owner, "github", "signup", window.referenceTime);
    const lease = await leaseExactJob(job.id);
    const event = syntheticCollectionEvents({ count: 1, seed: 294, window })[0]!;
    const staged = await v2Checkpoint(job.id, lease, [event]);
    expect(staged.error).toBeNull();
    expect(staged.data).toMatchObject({ status: "ok", stagedCount: 1 });

    const observationId = randomUUID();
    const finishCoverage = { ...coverage, source: syntheticCollectionSource(294), repositoryIds: [event.repositoryId] };
    const finished = await v2Finish(job.id, lease, observationId, finishCoverage);
    expect(finished.error).toBeNull();
    expect(finished.data).toEqual({ status: "ok", observationId, eventCount: 1 });
    expect(Buffer.byteLength(JSON.stringify(finished.data))).toBeLessThan(256);
    const observation = await db().from("scoring_v7_source_observations")
      .select("id,event_generation_id,payload").eq("id", observationId).single();
    expect(observation.error).toBeNull();
    expect(observation.data?.event_generation_id).toBeTruthy();
    expect(JSON.stringify(observation.data?.payload).length).toBeLessThan(256);
    const second = await v2Finish(job.id, lease, observationId, finishCoverage);
    expect(second.error).toBeNull();
    expect(second.data).toMatchObject({ status: "lease_mismatch" });
    expect(await readCollectionJobRecovery(job.id)).toMatchObject({
      state: "complete", observationId, observationDurable: true, leaseToken: null,
    });
    expect(await failCollectionJob({ id: job.id, leaseToken: lease },
      { provider: "github", operation: "finish", stopKind: "storage", httpStatus: null, retryAfterSeconds: null }, null))
      .toEqual({ status: "lease_mismatch" });
    expect((await db().from("scoring_v7_source_observations").select("id").eq("owner_handle", owner)).data).toHaveLength(1);
  });

  it("rejects stale leases and conflicting duplicate keys without partial writes", async () => {
    const job = await enqueueCollectionJob(owner, "github", "signup", window.referenceTime);
    const lease = await leaseExactJob(job.id);
    const event = syntheticCollectionEvents({ count: 1, seed: 294, window })[0]!;
    const stale = await v2Checkpoint(job.id, randomUUID(), [event]);
    expect(stale.error).toBeNull();
    expect(stale.data).toMatchObject({ status: "lease_mismatch" });
    const first = await v2Checkpoint(job.id, lease, [event]);
    expect(first.error).toBeNull();
    const changed = { ...event, measurements: { ...event.measurements, additions: observed(999_999, "complete", "source_observed") } };
    const collision = await v2Checkpoint(job.id, lease, [changed]);
    expect(collision.error).not.toBeNull();
    const generation = await db().from("scoring_collection_jobs").select("current_generation_id").eq("id", job.id).single();
    expect(generation.error).toBeNull();
    const rows = await db().from("scoring_collection_generation_events")
      .select("event_key,event").eq("generation_id", generation.data!.current_generation_id);
    expect(rows.error).toBeNull();
    expect(rows.data).toEqual([{ event_key: engineeringEventKey(event), event }]);
  });

  it("lists generation event keys beyond the first 1,000-row page", async () => {
    const job = await enqueueCollectionJob(owner, "github", "signup", window.referenceTime);
    const lease = await leaseExactJob(job.id);
    const events = syntheticCollectionEvents({ count: 1_101, seed: 294, window });
    const staged = await v2Checkpoint(job.id, lease, events);
    expect(staged.error).toBeNull();
    expect(staged.data).toMatchObject({ status: "ok", stagedCount: events.length });
    expect(await listStagedEventKeys(job.id)).toEqual(new Set(events.map(engineeringEventKey)));
  }, 30_000);

  it("routes a row-mode queued job only to the v2 claimer during worker overlap", async () => {
    const job = await enqueueCollectionJob(owner, "github", "signup", window.referenceTime);
    const lease = await leaseExactJob(job.id);
    const event = syntheticCollectionEvents({ count: 1, seed: 294, window })[0]!;
    const released = await db().rpc("scoring_collection_checkpoint_v2", {
      p_job_id: job.id, p_lease_token: lease, p_checkpoint: EMPTY_CHECKPOINT,
      p_event_keys: [engineeringEventKey(event)], p_events: [event],
      p_progress: { ...EMPTY_PROGRESS, events: 1 }, p_release: true,
    });
    expect(released.error).toBeNull();
    expect(released.data).toMatchObject({ status: "ok" });
    // Roll back the claim probes so no other local job's lease is changed.
    const oldClaims = inspectLocalSql(`BEGIN; SELECT EXISTS(SELECT 1 FROM public.scoring_collection_claim(100, 120) WHERE id = '${job.id}'); ROLLBACK;`);
    expect(oldClaims.split("\n")).toContain("f");
    const newClaims = inspectLocalSql(`BEGIN; SELECT EXISTS(SELECT 1 FROM public.scoring_collection_claim_v2(100, 120) WHERE id = '${job.id}'); ROLLBACK;`);
    expect(newClaims.split("\n")).toContain("t");
  });

  it("keeps a legacy job visible to old workers until a v2 checkpoint converts it", async () => {
    const job = await enqueueCollectionJob(owner, "github", "signup", window.referenceTime);
    const oldBefore = inspectLocalSql(`BEGIN; SELECT EXISTS(SELECT 1 FROM public.scoring_collection_claim(100, 120) WHERE id = '${job.id}'); ROLLBACK;`);
    expect(oldBefore.split("\n")).toContain("t");
    const lease = await leaseExactJob(job.id);
    const released = await db().rpc("scoring_collection_checkpoint_v2", {
      p_job_id: job.id, p_lease_token: lease, p_checkpoint: EMPTY_CHECKPOINT,
      p_event_keys: [], p_events: [], p_progress: EMPTY_PROGRESS, p_release: true,
    });
    expect(released.error).toBeNull();
    expect(released.data).toMatchObject({ status: "ok", stagedCount: 0 });
    const oldAfter = inspectLocalSql(`BEGIN; SELECT EXISTS(SELECT 1 FROM public.scoring_collection_claim(100, 120) WHERE id = '${job.id}'); ROLLBACK;`);
    const newAfter = inspectLocalSql(`BEGIN; SELECT EXISTS(SELECT 1 FROM public.scoring_collection_claim_v2(100, 120) WHERE id = '${job.id}'); ROLLBACK;`);
    expect(oldAfter.split("\n")).toContain("f");
    expect(newAfter.split("\n")).toContain("t");
  });

  it("accepts a storage diagnostic without admitting arbitrary stop kinds", async () => {
    const storage = { provider: "github", operation: "finish", stopKind: "storage", httpStatus: null, retryAfterSeconds: null };
    const allowed = await db().rpc("scoring_collection_valid_stop", { p_stop: storage });
    expect(allowed.error).toBeNull();
    expect(allowed.data).toBe(true);
    const invalid = await db().rpc("scoring_collection_valid_stop", { p_stop: { ...storage, stopKind: "unclassified" } });
    expect(invalid.error).toBeNull();
    expect(invalid.data).toBe(false);
  });

  it("keeps terminal event_limit failed on owner retry, reconnect and refresh until admin reset", async () => {
    const job = await enqueueCollectionJob(owner, "github", "signup", window.referenceTime);
    inspectLocalSql(`UPDATE public.scoring_collection_jobs SET state='failed',
      last_stop=jsonb_build_object('provider','github','operation','event_limit',
        'stopKind','protocol','httpStatus',NULL,'retryAfterSeconds',NULL)
      WHERE id='${job.id}'::uuid`);
    for (const reason of ["retry", "reconnect", "refresh"] as const) {
      const blocked = await enqueueCollectionJob(owner, "github", reason, window.referenceTime);
      expect(blocked.state).toBe("failed");
      expect(blocked.lastStop?.operation).toBe("event_limit");
      expect((await db().from("scoring_collection_jobs")
        .select("current_generation_id").eq("id", job.id).single()).data?.current_generation_id).toBeNull();
    }
    const admin = await enqueueCollectionJob(owner, "github", "admin", window.referenceTime);
    expect(admin.state).toBe("queued");
    expect(admin.lastStop).toBeNull();
    expect((await db().from("scoring_collection_jobs")
      .select("current_generation_id").eq("id", job.id).single()).data?.current_generation_id).toBeTruthy();
  });

  it("retries a terminal storage stop with its checkpoint and generation intact", async () => {
    const job = await enqueueCollectionJob(owner, "github", "signup", window.referenceTime);
    const lease = await leaseExactJob(job.id);
    const event = syntheticCollectionEvents({ count: 1, seed: 294, window })[0]!;
    const checkpoint = { version: 1, operations: [{ key: "repositories", cursor: "next", done: false }],
      discovered: { repositoryIds: [] } };
    const staged = await db().rpc("scoring_collection_checkpoint_v2", {
      p_job_id: job.id, p_lease_token: lease, p_checkpoint: checkpoint,
      p_event_keys: [engineeringEventKey(event)], p_events: [event],
      p_progress: { ...EMPTY_PROGRESS, events: 1 }, p_release: false,
    });
    expect(staged.data).toMatchObject({ status: "ok", stagedCount: 1 });
    const generationId = (await db().from("scoring_collection_jobs")
      .select("current_generation_id").eq("id", job.id).single()).data!.current_generation_id;
    const failed = await db().rpc("scoring_collection_fail", {
      p_job_id: job.id, p_lease_token: lease,
      p_stop: { provider: "github", operation: "finish", stopKind: "storage", httpStatus: null, retryAfterSeconds: null },
      p_retry_at: null,
    });
    expect(failed.error).toBeNull();
    expect(failed.data).toMatchObject({ status: "failed" });
    const retry = await enqueueCollectionJob(owner, "github", "retry", window.referenceTime);
    expect(retry.state).toBe("queued");
    expect(retry.checkpoint).toEqual(checkpoint);
    expect(retry.progress.events).toBe(1);
    expect(retry.lastStop).toBeNull();
    const retained = await db().from("scoring_collection_jobs")
      .select("current_generation_id").eq("id", job.id).single();
    expect(retained.data?.current_generation_id).toBe(generationId);
    expect((await db().from("scoring_collection_generation_events")
      .select("event_key", { count: "exact", head: true }).eq("generation_id", generationId)).count).toBe(1);
  });

  it("imports an in-flight legacy staged job in bounded steps without losing its event keys", async () => {
    const job = await enqueueCollectionJob(owner, "github", "signup", window.referenceTime);
    const lease = await leaseExactJob(job.id);
    const events = syntheticCollectionEvents({ count: 17_572, seed: 294, window });
    for (let start = 0; start < events.length; start += 2_000) {
      const batch = events.slice(start, start + 2_000);
      const old = await db().rpc("scoring_collection_checkpoint", {
        p_job_id: job.id, p_lease_token: lease, p_checkpoint: EMPTY_CHECKPOINT,
        p_event_keys: batch.map(engineeringEventKey), p_events: batch,
        p_progress: { ...EMPTY_PROGRESS, events: start + batch.length }, p_release: false,
      });
      expect(old.error).toBeNull();
      expect(old.data).toMatchObject({ status: "ok" });
    }
    const legacy = await db().from("scoring_collection_staged_events")
      .select("event_key", { count: "exact", head: true }).eq("job_id", job.id);
    expect(legacy.count).toBe(events.length);
    let imported = 0;
    for (let call = 0; call < 12 && imported < events.length; call++) {
      const step = await v2Checkpoint(job.id, lease, [], events.length);
      expect(step.error).toBeNull();
      expect(["importing", "ok"]).toContain(step.data?.status);
      expect(step.data?.importedCount ?? events.length).toBeGreaterThanOrEqual(imported);
      imported = step.data?.importedCount ?? events.length;
    }
    expect(imported).toBe(events.length);
    const generation = await db().from("scoring_collection_jobs").select("current_generation_id").eq("id", job.id).single();
    const rows = await db().from("scoring_collection_generation_events")
      .select("event_key", { count: "exact", head: true }).eq("generation_id", generation.data!.current_generation_id);
    expect(rows.count).toBe(events.length);
    expect((await listStagedEventKeys(job.id)).size).toBe(events.length);
  }, 240_000);

  it("keeps the first published generation unchanged across a same-day refresh", async () => {
    const firstEvent = syntheticCollectionEvents({ count: 1, seed: 294, window })[0]!;
    const secondEvent = syntheticCollectionEvents({ count: 2, seed: 294, window })[1]!;
    const finishCoverage = { ...coverage, source: syntheticCollectionSource(294), repositoryIds: [firstEvent.repositoryId, secondEvent.repositoryId] };
    const firstJob = await enqueueCollectionJob(owner, "github", "signup", window.referenceTime);
    const firstLease = await leaseExactJob(firstJob.id);
    expect((await v2Checkpoint(firstJob.id, firstLease, [firstEvent])).error).toBeNull();
    const firstObservation = randomUUID();
    expect((await v2Finish(firstJob.id, firstLease, firstObservation, finishCoverage)).data).toMatchObject({ status: "ok", eventCount: 1 });
    const firstGeneration = (await db().from("scoring_v7_source_observations")
      .select("event_generation_id").eq("id", firstObservation).single()).data!.event_generation_id;
    const refreshed = await enqueueCollectionJob(owner, "github", "refresh", window.referenceTime);
    expect(refreshed.id).toBe(firstJob.id);
    const secondLease = await leaseExactJob(refreshed.id);
    expect((await v2Checkpoint(refreshed.id, secondLease, [secondEvent])).error).toBeNull();
    const secondObservation = randomUUID();
    expect((await v2Finish(refreshed.id, secondLease, secondObservation, finishCoverage)).data).toMatchObject({ status: "ok", eventCount: 1 });
    const secondGeneration = (await db().from("scoring_v7_source_observations")
      .select("event_generation_id").eq("id", secondObservation).single()).data!.event_generation_id;
    expect(secondGeneration).not.toBe(firstGeneration);
    const originalRows = await db().from("scoring_collection_generation_events")
      .select("event_key,event").eq("generation_id", firstGeneration);
    expect(originalRows.data).toEqual([{ event_key: engineeringEventKey(firstEvent), event: firstEvent }]);
    const newRows = await db().from("scoring_collection_generation_events")
      .select("event_key").eq("generation_id", secondGeneration);
    expect(newRows.data).toEqual([{ event_key: engineeringEventKey(secondEvent) }]);
  });

  it.each(["scoring_v7_withdraw_with_receipts", "scoring_v7_delete_user_with_receipts"] as const)(
    "cascades a published generation on %s",
    async (operation) => {
      const job = await enqueueCollectionJob(owner, "github", "signup", window.referenceTime);
      const lease = await leaseExactJob(job.id);
      const event = syntheticCollectionEvents({ count: 1, seed: 294, window })[0]!;
      expect((await v2Checkpoint(job.id, lease, [event])).data).toMatchObject({ status: "ok", stagedCount: 1 });
      const observationId = randomUUID();
      const finishCoverage = { ...coverage, source: syntheticCollectionSource(294), repositoryIds: [event.repositoryId] };
      expect((await v2Finish(job.id, lease, observationId, finishCoverage)).data)
        .toEqual({ status: "ok", observationId, eventCount: 1 });
      const generationId = (await db().from("scoring_v7_source_observations")
        .select("event_generation_id").eq("id", observationId).single()).data!.event_generation_id;
      const result = operation === "scoring_v7_withdraw_with_receipts"
        ? await db().rpc(operation, { p_owner: owner, p_actor: owner, p_acknowledged: true })
        : await db().rpc(operation, { p_handle: owner });
      expect(result.error).toBeNull();
      expect((await db().from("scoring_collection_generations")
        .select("id").eq("id", generationId)).data).toEqual([]);
      expect((await db().from("scoring_collection_generation_events")
        .select("event_key").eq("generation_id", generationId)).data).toEqual([]);
      expect((await db().from("scoring_v7_source_observations")
        .select("id").eq("id", observationId)).data).toEqual([]);
    },
  );

  it("keeps the job running and unpublished when finish raises on invalid coverage", async () => {
    const job = await enqueueCollectionJob(owner, "github", "signup", window.referenceTime);
    const lease = await leaseExactJob(job.id);
    const event = syntheticCollectionEvents({ count: 1, seed: 294, window })[0]!;
    expect((await v2Checkpoint(job.id, lease, [event])).error).toBeNull();
    const observationId = randomUUID();
    const invalid = { ...coverage, source: syntheticCollectionSource(294), repositoryIds: ["foreign-repository"] };
    expect((await v2Finish(job.id, lease, observationId, invalid)).error).not.toBeNull();
    const jobState = await db().from("scoring_collection_jobs").select("state,observation_id").eq("id", job.id).single();
    expect(jobState.data).toEqual({ state: "running", observation_id: null });
    expect((await db().from("scoring_v7_source_observations").select("id").eq("id", observationId)).data).toEqual([]);
  });

  scale.each([17_572, 50_000])("profiles row staging, paged read and receipt issuance at %i events", async (count) => {
    const testBefore = performance.now();
    const postmasterStart = inspectLocalSql("SELECT pg_postmaster_start_time()");
    let peakRssBytes = process.memoryUsage().rss;
    const rssTimer = setInterval(() => { peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss); }, 50);
    const events = syntheticCollectionEvents({ count, seed: 294, window });
    const job = await enqueueCollectionJob(owner, "github", "signup", window.referenceTime);
    const lease = await leaseExactJob(job.id);
    const checkpointMs: number[] = [];
    let fixtureBytes = 0;
    let maxResponseBytes = 0;
    for (let start = 0; start < count; start += 1_000) {
      const batch = events.slice(start, start + 1_000);
      fixtureBytes += Buffer.byteLength(JSON.stringify(batch));
      const before = performance.now();
      const staged = await v2Checkpoint(job.id, lease, batch, start + batch.length);
      checkpointMs.push(performance.now() - before);
      expect(staged.error, `batch ${start}`).toBeNull();
      expect(staged.data).toMatchObject({ status: "ok", stagedCount: start + batch.length });
      maxResponseBytes = Math.max(maxResponseBytes, Buffer.byteLength(JSON.stringify(staged.data)));
    }
    const finishCoverage = { ...coverage, source: syntheticCollectionSource(294),
      repositoryIds: [...new Set(events.map(event => event.repositoryId))].sort() };
    const observationId = randomUUID();
    const finishBefore = performance.now();
    const finished = await v2Finish(job.id, lease, observationId, finishCoverage);
    const finishMs = performance.now() - finishBefore;
    expect(finished.error).toBeNull();
    expect(finished.data).toEqual({ status: "ok", observationId, eventCount: count });
    maxResponseBytes = Math.max(maxResponseBytes, Buffer.byteLength(JSON.stringify(finished.data)));
    const context = { owner, source: syntheticCollectionSource(294), requestedSource: requested,
      accessContextId: access, scope, window, link: null };
    const readBefore = performance.now();
    const manifest = await readSourceManifest(context);
    expect(manifest?.eventCount).toBe(count);
    let readCount = 0;
    for await (const page of readSourcePages(context, manifest!)) readCount += page.length;
    const readMs = performance.now() - readBefore;
    expect(readCount).toBe(count);
    const issueBefore = performance.now();
    expect(await issueScoreReceipt(owner, { referenceTime: window.referenceTime })).toEqual({ status: "issued" });
    const issuanceMs = performance.now() - issueBefore;
    const receipts = await db().from("scoring_v7_receipts")
      .select("policy_version,semantic_digest,core_semantic_digest").eq("owner_handle", owner);
    expect(receipts.data).toHaveLength(1);
    expect(receipts.data?.[0]).toMatchObject({ policy_version: "v7.2",
      semantic_digest: expect.stringMatching(/^[0-9a-f]{64}$/),
      core_semantic_digest: expect.stringMatching(/^[0-9a-f]{64}$/) });
    const p95Ms = [...checkpointMs].sort((a, b) => a - b)[Math.ceil(checkpointMs.length * 0.95) - 1]!;
    const profile = { case: "row-generation-profile", eventCount: count, batchSize: 1_000,
      fixtureBytes, overallWallMs: performance.now() - testBefore, peakRssBytes, maxResponseBytes,
      checkpoint: { batches: checkpointMs.length, p95Ms, maxMs: Math.max(...checkpointMs) },
      finishMs, readCount, readMs, issuanceMs,
      postmasterStart, postmasterEnd: inspectLocalSql("SELECT pg_postmaster_start_time()") };
    clearInterval(rssTimer);
    expect(profile.postmasterEnd).toBe(postmasterStart);
    if (process.env.SCORING_SCALE_PROFILE_DIR) {
      mkdirSync(process.env.SCORING_SCALE_PROFILE_DIR, { recursive: true });
      writeFileSync(`${process.env.SCORING_SCALE_PROFILE_DIR}/db-${count}-single.json`, `${JSON.stringify(profile, null, 2)}\n`);
    }
  }, 900_000);

  scale("stages and publishes 100,000 events, then rejects event 100,001 atomically", async () => {
    const testBefore = performance.now();
    const postmasterStart = inspectLocalSql("SELECT pg_postmaster_start_time()");
    let peakRssBytes = process.memoryUsage().rss;
    const rssTimer = setInterval(() => { peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss); }, 50);
    const job = await enqueueCollectionJob(owner, "github", "signup", window.referenceTime);
    const lease = await leaseExactJob(job.id);
    const events = syntheticCollectionEvents({ count: 100_001, seed: 294, window });
    const initialMs: number[] = [];
    const refreshMs: number[] = [];
    let maxResponseBytes = 0;
    let fixtureBytes = 0;
    for (let start = 0; start < 100_000; start += 1_000) {
      const batch = events.slice(start, start + 1_000);
      fixtureBytes += Buffer.byteLength(JSON.stringify(batch));
      const before = performance.now();
      const stage = await v2Checkpoint(job.id, lease, batch, start + batch.length);
      initialMs.push(performance.now() - before);
      maxResponseBytes = Math.max(maxResponseBytes, Buffer.byteLength(JSON.stringify(stage.data)));
      expect(stage.error, `initial generation batch ${start}`).toBeNull();
      expect(stage.data).toMatchObject({ status: "ok", stagedCount: start + batch.length });
      expect(performance.now() - before).toBeLessThan(8_000);
    }
    const finishCoverage = { ...coverage, source: syntheticCollectionSource(294),
      repositoryIds: [...new Set(events.slice(0, 100_000).map(event => event.repositoryId))].sort() };
    const observationId = randomUUID();
    const before = performance.now();
    const finished = await v2Finish(job.id, lease, observationId, finishCoverage);
    const finishMs = performance.now() - before;
    const finishResponseBytes = Buffer.byteLength(JSON.stringify(finished.data));
    expect(finishMs).toBeLessThan(8_000);
    expect(finished.error).toBeNull();
    expect(finished.data).toEqual({ status: "ok", observationId, eventCount: 100_000 });
    expect(Buffer.byteLength(JSON.stringify(finished.data))).toBeLessThan(256);
    expect((await db().from("scoring_collection_jobs").select("state").eq("id", job.id).single()).data?.state).toBe("complete");
    const isolatedIssuance = issueInFreshLocalProcess();
    const issuanceMs = isolatedIssuance.issuanceMs;
    const receipts = await db().from("scoring_v7_receipts")
      .select("policy_version,semantic_digest,core_semantic_digest").eq("owner_handle", owner);
    expect(receipts.error).toBeNull();
    expect(receipts.data).toHaveLength(1);
    expect(receipts.data?.[0]).toMatchObject({ policy_version: "v7.2",
      semantic_digest: expect.stringMatching(/^[0-9a-f]{64}$/),
      core_semantic_digest: expect.stringMatching(/^[0-9a-f]{64}$/) });
    const snapshot = await readRenderableReceipt(owner);
    expect(snapshot).not.toBeNull();
    const verification = await resolveBadgeVerification({
      stats: { handle: owner }, scoring: observedReceiptViewModel(owner, snapshot!),
    } as never);
    expect(verification?.hash).toMatch(/^v7\./);
    expect((await getReceiptVerificationV7(verification!.hash))?.signatureAuthenticated).toBe(true);

    // A refresh gets its own generation. Overflow must fail that job without
    // changing the already published 100,000-event observation.
    const refreshed = await enqueueCollectionJob(owner, "github", "refresh", window.referenceTime);
    const refreshLease = await leaseExactJob(refreshed.id);
    for (let start = 0; start < 100_000; start += 1_000) {
      const batch = events.slice(start, start + 1_000);
      const before = performance.now();
      const staged = await v2Checkpoint(refreshed.id, refreshLease, batch, start + batch.length);
      refreshMs.push(performance.now() - before);
      maxResponseBytes = Math.max(maxResponseBytes, Buffer.byteLength(JSON.stringify(staged.data)));
      expect(staged.error, `refresh generation batch ${start}`).toBeNull();
      expect(performance.now() - before).toBeLessThan(8_000);
    }
    const overflowBefore = performance.now();
    const rejected = await v2Checkpoint(refreshed.id, refreshLease, events.slice(100_000), 100_001);
    const overflowMs = performance.now() - overflowBefore;
    expect(rejected.error).toBeNull();
    expect(rejected.data).toMatchObject({ status: "event_limit", stagedCount: 100_000 });
    const terminal = await db().from("scoring_collection_jobs")
      .select("state,last_stop,lease_token,progress,current_generation_id").eq("id", refreshed.id).single();
    expect(terminal.data).toMatchObject({ state: "failed", lease_token: null,
      last_stop: { operation: "event_limit", stopKind: "protocol" },
      progress: { events: 100_000 } });
    expect((await db().from("scoring_collection_generation_events")
      .select("event_key", { count: "exact", head: true }).eq("generation_id", terminal.data!.current_generation_id)).count).toBe(100_000);
    expect((await db().from("scoring_v7_source_observations").select("event_generation_id").eq("id", observationId).single()).data?.event_generation_id)
      .not.toBe(terminal.data!.current_generation_id);
    const p95 = (samples: number[]) => [...samples].sort((a, b) => a - b)[Math.ceil(samples.length * 0.95) - 1]!;
    const profile = { case: "row-generation-100k", eventCount: 100_000, fixtureBytes,
      overallWallMs: performance.now() - testBefore, batchSize: 1000,
      initial: { batches: initialMs.length, p95Ms: p95(initialMs), maxMs: Math.max(...initialMs) },
      refresh: { batches: refreshMs.length, p95Ms: p95(refreshMs), maxMs: Math.max(...refreshMs) },
      finishMs, finishResponseBytes, issuanceMs, isolatedIssuance, overflowMs, maxResponseBytes, peakRssBytes,
      postmasterStart, postmasterEnd: inspectLocalSql("SELECT pg_postmaster_start_time()") };
    clearInterval(rssTimer);
    expect(profile.postmasterEnd).toBe(postmasterStart);
    if (process.env.SCORING_SCALE_PROFILE_OUTPUT) {
      mkdirSync(dirname(process.env.SCORING_SCALE_PROFILE_OUTPUT), { recursive: true });
      writeFileSync(process.env.SCORING_SCALE_PROFILE_OUTPUT, `${JSON.stringify(profile, null, 2)}\n`);
    }
  }, 900_000);

  scale("publishes one 100,000-event owner across GitHub and GitLab with paged reads and one receipt", async () => {
    const testBefore = performance.now();
    const postmasterStart = inspectLocalSql("SELECT pg_postmaster_start_time()");
    let peakRssBytes = process.memoryUsage().rss;
    const rssTimer = setInterval(() => { peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss); }, 50);
    expect(await dbUpsertLinkedPlatform(owner, "gitlab", "synthetic-remote", "synthetic-local-token", null, null)).toBe(true);
    const linked = await dbGetLinkedPlatformStrict(owner, "gitlab");
    expect(linked.status).toBe("linked");
    if (linked.status !== "linked") throw new Error("Synthetic GitLab link unavailable");
    const gitlabSource = { provider: "gitlab" as const, host: "gitlab.com", subjectId: "synthetic-subject-295" };
    const gitlabRequested = { provider: "gitlab" as const, host: "gitlab.com", login: linked.link.remoteLogin };
    const gitlabAccess = createSourceContext({ owner, requestedSource: gitlabRequested, window, scope },
      { kind: "linked", link: linked.link, accessToken: linked.link.tokens.accessToken }).accessContextId;
    const githubEvents = syntheticCollectionEvents({ count: 50_000, seed: 294, window });
    const gitlabEvents = syntheticCollectionEvents({ count: 50_000, seed: 295, window }).map(event => ({
      ...event, ...gitlabSource, actorId: gitlabSource.subjectId,
      canonicalProjectId: `gitlab:${event.repositoryId}`,
    }));
    const stageMs: Record<string, number[]> = { github: [], gitlab: [] };
    const finishMs: Record<string, number> = {};
    let maxResponseBytes = 0;
    let fixtureBytes = 0;
    const contexts = [];
    for (const entry of [
      { provider: "github" as const, events: githubEvents, source: syntheticCollectionSource(294),
        requested, access, link: null },
      { provider: "gitlab" as const, events: gitlabEvents, source: gitlabSource,
        requested: gitlabRequested, access: gitlabAccess, link: linked.link },
    ]) {
      const job = await enqueueCollectionJob(owner, entry.provider, "signup", window.referenceTime);
      const lease = await leaseExactJob(job.id);
      for (let start = 0; start < entry.events.length; start += 1_000) {
        const batch = entry.events.slice(start, start + 1_000);
        fixtureBytes += Buffer.byteLength(JSON.stringify(batch));
        const before = performance.now();
        const staged = await v2Checkpoint(job.id, lease, batch, start + 1_000);
        stageMs[entry.provider]!.push(performance.now() - before);
        expect(staged.error, `${entry.provider} batch ${start}`).toBeNull();
        expect(staged.data).toMatchObject({ status: "ok", stagedCount: start + 1_000 });
        maxResponseBytes = Math.max(maxResponseBytes, Buffer.byteLength(JSON.stringify(staged.data)));
      }
      const observationId = randomUUID();
      const providerCoverage = { ...coverage, source: entry.source,
        repositoryIds: [...new Set(entry.events.map(event => event.repositoryId))].sort() };
      const beforeFinish = performance.now();
      const finished = await db().rpc("scoring_collection_finish_v2", {
        p_job_id: job.id, p_lease_token: lease, p_coverage: providerCoverage,
        p_observation: observationId, p_requested: entry.requested, p_access: entry.access,
        p_scope: scope, p_link_id: entry.link?.id ?? null, p_link_version: entry.link?.updatedAt ?? null,
      });
      finishMs[entry.provider] = performance.now() - beforeFinish;
      expect(finished.error).toBeNull();
      expect(finished.data).toEqual({ status: "ok", observationId, eventCount: 50_000 });
      maxResponseBytes = Math.max(maxResponseBytes, Buffer.byteLength(JSON.stringify(finished.data)));
      contexts.push({ owner, source: entry.source, requestedSource: entry.requested,
        accessContextId: entry.access, scope, window,
        link: entry.link ? { id: entry.link.id, updatedAt: entry.link.updatedAt } : null });
    }
    const readBefore = performance.now();
    let readCount = 0;
    for (const context of contexts) {
      const manifest = await readSourceManifest(context);
      expect(manifest?.eventCount).toBe(50_000);
      for await (const page of readSourcePages(context, manifest!)) {
        expect(page.length).toBeLessThanOrEqual(500);
        readCount += page.length;
      }
    }
    const readMs = performance.now() - readBefore;
    expect(readCount).toBe(100_000);
    const issueBefore = performance.now();
    expect(await issueScoreReceipt(owner, { referenceTime: window.referenceTime })).toEqual({ status: "issued" });
    const issuanceMs = performance.now() - issueBefore;
    const receipts = await db().from("scoring_v7_receipts")
      .select("policy_version,semantic_digest,core_semantic_digest").eq("owner_handle", owner);
    expect(receipts.error).toBeNull();
    expect(receipts.data).toHaveLength(1);
    expect(receipts.data?.[0]).toMatchObject({ policy_version: "v7.2",
      semantic_digest: expect.stringMatching(/^[0-9a-f]{64}$/),
      core_semantic_digest: expect.stringMatching(/^[0-9a-f]{64}$/) });
    const snapshot = await readRenderableReceipt(owner);
    expect(snapshot).not.toBeNull();
    expect(await hasDrawableCurrentReceipt(owner)).toBe(true);
    expect(await readScoringStatus(owner)).toMatchObject({ kind: "ready", receiptDate: window.referenceDate });
    const model = scoreModelFrom(owner, snapshot);
    expect(model?.policyVersion).toBe("v7.2");
    expect(model?.identity?.revisionId).toBe(snapshot!.receipt.receipt.revisionId);
    const verification = await resolveBadgeVerification({
      stats: { handle: owner }, scoring: model,
    } as never);
    expect(verification?.hash).toMatch(/^v7\./);
    expect((await getReceiptVerificationV7(verification!.hash))?.signatureAuthenticated).toBe(true);
    const p95 = (samples: number[]) => [...samples].sort((a, b) => a - b)[Math.ceil(samples.length * 0.95) - 1]!;
    const profile = { case: "mixed-provider-100k", providerCounts: { github: 50_000, gitlab: 50_000 },
      fixtureBytes, overallWallMs: performance.now() - testBefore,
      batchSize: 1_000, readCount, readMs, finishMs, issuanceMs, maxResponseBytes, peakRssBytes,
      checkpoint: Object.fromEntries(Object.entries(stageMs).map(([provider, samples]) => [provider,
        { batches: samples.length, p95Ms: p95(samples), maxMs: Math.max(...samples) }])),
      postmasterStart, postmasterEnd: inspectLocalSql("SELECT pg_postmaster_start_time()") };
    clearInterval(rssTimer);
    expect(profile.postmasterEnd).toBe(postmasterStart);
    if (process.env.SCORING_SCALE_PROFILE_OUTPUT) {
      mkdirSync(dirname(process.env.SCORING_SCALE_PROFILE_OUTPUT), { recursive: true });
      writeFileSync(process.env.SCORING_SCALE_PROFILE_OUTPUT, `${JSON.stringify(profile, null, 2)}\n`);
    }
  }, 900_000);
});

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

  it("retry after protocol failure clears checkpoint (today's behavior, unchanged by migration 058)", async () => {
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

  // 2026-09-24: juan294's GitHub source staged 11,124 in-window commits and
  // failed at the old 10,000-event limit. The limit is now 50,000. The staged
  // keys must also be read past the API's 1,000-row page limit.
  it("stages, lists, finishes, and reads a source with more than 10,000 events through verified pages", async () => {
    const job = await enqueueCollectionJob(owner, "github", "signup", window.referenceTime);
    const lease = { id: job.id, leaseToken: await leaseExactJob(job.id) };
    const base = sourceEventFixture(source, window);
    const total = 12_000;
    const events = Array.from({ length: total }, (_, i) => ({ ...base, eventId: `event-${i}`, workItemId: `work-${i}`, artifactRevision: `revision-${i}`, artifactReferenceIds: [`artifact-${i}`],
      categories: [{ category: "implementation" as const, evidenceReferenceIds: [`artifact-${i}`] }],
      acceptance: observed({ method: "merged_change" as const, acceptedAt: "2026-09-01T12:00:00.000Z", acceptedResultId: `result-${i}` }, "complete", "source_observed") }));
    for (let i = 0; i < total; i += 1_000) {
      const outcome = await checkpointCollectionJob(lease, EMPTY_CHECKPOINT, events.slice(i, i + 1_000), { ...EMPTY_PROGRESS, events: i + 1_000 }, false);
      expect(outcome.status).toBe("ok");
    }
    expect((await listStagedEventKeys(job.id)).size).toBe(total);
    const observationId = randomUUID();
    expect(await finishCollectionJob(lease, { coverage, observationId, requested, access, scope, linkId: null, linkVersion: null }))
      .toEqual({ status: "ok", observationId });
    const read = await readSourceObservation({ owner, requestedSource: requested, source, window, scope, accessContextId: access, link: null });
    expect(read?.id).toBe(observationId);
    expect(read?.events).toHaveLength(total);
    expect(new Set(read?.events.map(engineeringEventKey)).size).toBe(total);
  }, 180_000);

  it("fails a job terminally when retryAt is null", async () => {
    await enqueueCollectionJob(owner, "github", "signup", window.referenceTime);
    const claimed = (await claimCollectionJobs(1, 120))[0]!;
    const stop = { provider: "github" as const, operation: "repositories", stopKind: "protocol" as const, httpStatus: null, retryAfterSeconds: null };
    expect(await failCollectionJob({ id: claimed.id, leaseToken: claimed.leaseToken! }, stop, null)).toEqual({ status: "failed" });
    const rows = await db().from("scoring_collection_jobs").select("state,last_stop").eq("id", claimed.id);
    expect(rows.data).toEqual([{ state: "failed", last_stop: stop }]);
  });

  it("routes a rate_limited stop to waiting_rate_limit without touching attempt (migration 058)", async () => {
    await enqueueCollectionJob(owner, "github", "signup", window.referenceTime);
    const claimed = (await claimCollectionJobs(1, 120))[0]!;
    const retryAt = new Date(Date.now() + 60_000).toISOString();
    expect(await failCollectionJob(
      { id: claimed.id, leaseToken: claimed.leaseToken! },
      { provider: "github", operation: "merged", stopKind: "rate_limited", httpStatus: 403, retryAfterSeconds: 60 },
      retryAt,
    )).toEqual({ status: "waiting_rate_limit" });
    const rows = await db().from("scoring_collection_jobs").select("state,attempt").eq("id", claimed.id);
    expect(rows.data).toEqual([{ state: "waiting_rate_limit", attempt: 0 }]);
  });

  it("fail with rate_limited keeps attempt across repeated rate limiting", async () => {
    await enqueueCollectionJob(owner, "github", "signup", window.referenceTime);
    let claimed = (await claimCollectionJobs(1, 120))[0]!;
    for (let i = 0; i < 3; i++) {
      const retryAt = new Date(Date.now() - 1000).toISOString(); // already due, so the next claim picks it straight back up
      await failCollectionJob(
        { id: claimed.id, leaseToken: claimed.leaseToken! },
        { provider: "github", operation: "merged", stopKind: "rate_limited", httpStatus: 403, retryAfterSeconds: 60 },
        retryAt,
      );
      claimed = (await claimCollectionJobs(1, 120))[0]!;
    }
    const rows = await db().from("scoring_collection_jobs").select("attempt").eq("id", claimed.id);
    expect(rows.data).toEqual([{ attempt: 0 }]);
  });

  it("fail with http increments attempt (keeps today's behavior)", async () => {
    await enqueueCollectionJob(owner, "github", "signup", window.referenceTime);
    const claimed = (await claimCollectionJobs(1, 120))[0]!;
    const retryAt = new Date(Date.now() + 60_000).toISOString();
    expect(await failCollectionJob(
      { id: claimed.id, leaseToken: claimed.leaseToken! },
      { provider: "github", operation: "merged", stopKind: "http", httpStatus: 503, retryAfterSeconds: null },
      retryAt,
    )).toEqual({ status: "retrying" });
    const rows = await db().from("scoring_collection_jobs").select("state,attempt").eq("id", claimed.id);
    expect(rows.data).toEqual([{ state: "retrying", attempt: 1 }]);
  });

  it("checkpoint with more done operations resets attempt", async () => {
    await enqueueCollectionJob(owner, "github", "signup", window.referenceTime);
    let claimed = (await claimCollectionJobs(1, 120))[0]!;
    await checkpointCollectionJob(
      { id: claimed.id, leaseToken: claimed.leaseToken! },
      EMPTY_CHECKPOINT, [], { ...EMPTY_PROGRESS, operationsDone: 1 }, false,
    );
    await failCollectionJob(
      { id: claimed.id, leaseToken: claimed.leaseToken! },
      { provider: "github", operation: "merged", stopKind: "http", httpStatus: 503, retryAfterSeconds: null },
      new Date(Date.now() - 1000).toISOString(),
    );
    claimed = (await claimCollectionJobs(1, 120))[0]!;
    const afterFail = await db().from("scoring_collection_jobs").select("attempt").eq("id", claimed.id);
    expect(afterFail.data).toEqual([{ attempt: 1 }]);
    await checkpointCollectionJob(
      { id: claimed.id, leaseToken: claimed.leaseToken! },
      EMPTY_CHECKPOINT, [], { ...EMPTY_PROGRESS, operationsDone: 2 }, false,
    );
    const afterProgress = await db().from("scoring_collection_jobs").select("attempt").eq("id", claimed.id);
    expect(afterProgress.data).toEqual([{ attempt: 0 }]);
  });

  it("checkpoint with the same done count keeps attempt", async () => {
    await enqueueCollectionJob(owner, "github", "signup", window.referenceTime);
    let claimed = (await claimCollectionJobs(1, 120))[0]!;
    await checkpointCollectionJob(
      { id: claimed.id, leaseToken: claimed.leaseToken! },
      EMPTY_CHECKPOINT, [], { ...EMPTY_PROGRESS, operationsDone: 1 }, false,
    );
    await failCollectionJob(
      { id: claimed.id, leaseToken: claimed.leaseToken! },
      { provider: "github", operation: "merged", stopKind: "http", httpStatus: 503, retryAfterSeconds: null },
      new Date(Date.now() - 1000).toISOString(),
    );
    claimed = (await claimCollectionJobs(1, 120))[0]!;
    await checkpointCollectionJob(
      { id: claimed.id, leaseToken: claimed.leaseToken! },
      EMPTY_CHECKPOINT, [], { ...EMPTY_PROGRESS, operationsDone: 1 }, false,
    );
    const rows = await db().from("scoring_collection_jobs").select("attempt").eq("id", claimed.id);
    expect(rows.data).toEqual([{ attempt: 1 }]);
  });

  it("retry after http failure keeps checkpoint, staged events and progress, resetting attempt to 0", async () => {
    const job = await enqueueCollectionJob(owner, "github", "signup", window.referenceTime);
    const claimed = (await claimCollectionJobs(1, 120))[0]!;
    const checkpoint = { version: 1 as const, operations: [{ key: "repositories", cursor: "abc", done: false }], discovered: { repositoryIds: [] } };
    const event = sourceEventFixture(source, window);
    await checkpointCollectionJob(
      { id: claimed.id, leaseToken: claimed.leaseToken! },
      checkpoint, [event], { ...EMPTY_PROGRESS, operationsKnown: 1, events: 1 }, false,
    );
    expect(await failCollectionJob(
      { id: claimed.id, leaseToken: claimed.leaseToken! },
      { provider: "github", operation: "repositories", stopKind: "http", httpStatus: 503, retryAfterSeconds: null },
      null,
    )).toEqual({ status: "failed" });
    const retried = await enqueueCollectionJob(owner, "github", "retry", window.referenceTime);
    expect(retried.id).toBe(job.id);
    expect(retried.state).toBe("queued");
    expect(retried.attempt).toBe(0);
    expect(retried.checkpoint).toEqual(checkpoint);
    expect(retried.progress).toEqual({ ...EMPTY_PROGRESS, operationsKnown: 1, events: 1 });
    expect(await listStagedEventKeys(job.id)).toEqual(new Set([engineeringEventKey(event)]));
  });

  it("progress accepts an optional boolean discovering key", async () => {
    await enqueueCollectionJob(owner, "github", "signup", window.referenceTime);
    const claimed = (await claimCollectionJobs(1, 120))[0]!;
    const { data, error } = await db().rpc("scoring_collection_checkpoint", {
      p_job_id: claimed.id,
      p_lease_token: claimed.leaseToken,
      p_checkpoint: EMPTY_CHECKPOINT,
      p_event_keys: [],
      p_events: [],
      p_progress: { operationsDone: 0, operationsKnown: 0, events: 0, requests: 0, discovering: true },
      p_release: false,
    });
    expect(error).toBeNull();
    expect((data as { status: string } | null)?.status).toBe("ok");
  });

  it("progress rejects a non-boolean discovering value", async () => {
    await enqueueCollectionJob(owner, "github", "signup", window.referenceTime);
    const claimed = (await claimCollectionJobs(1, 120))[0]!;
    const { error } = await db().rpc("scoring_collection_checkpoint", {
      p_job_id: claimed.id,
      p_lease_token: claimed.leaseToken,
      p_checkpoint: EMPTY_CHECKPOINT,
      p_event_keys: [],
      p_events: [],
      p_progress: { operationsDone: 0, operationsKnown: 0, events: 0, requests: 0, discovering: "yes" },
      p_release: false,
    });
    expect(error).not.toBeNull();
  });

  it("progress still rejects unknown keys", async () => {
    await enqueueCollectionJob(owner, "github", "signup", window.referenceTime);
    const claimed = (await claimCollectionJobs(1, 120))[0]!;
    const { error } = await db().rpc("scoring_collection_checkpoint", {
      p_job_id: claimed.id,
      p_lease_token: claimed.leaseToken,
      p_checkpoint: EMPTY_CHECKPOINT,
      p_event_keys: [],
      p_events: [],
      p_progress: { operationsDone: 0, operationsKnown: 0, events: 0, requests: 0, bogus: true },
      p_release: false,
    });
    expect(error).not.toBeNull();
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
    const privateFunctions = new Set([
      "scoring_collection_checkpoint_legacy_internal",
      "scoring_collection_finish_legacy_internal",
      "scoring_collection_event_key",
      "scoring_collection_protect_events",
    ]);
    for (const row of rows) {
      const [name, ...grants] = row.split("|");
      expect(grants).toEqual(["f", "f", privateFunctions.has(name!) ? "f" : "t"]);
    }
  });
});
