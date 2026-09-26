import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createScoringWindow, engineeringEventKey, isWithinScoringWindow } from "@chapa/shared";
import { getServiceClient } from "@/test/contract/invoke";
import { assertLocalSqlTarget } from "@/test/contract/local-sql";
import { enqueueCollectionJob, EMPTY_PROGRESS } from "@/lib/db/collection-queue";
import { syntheticCollectionEvents, syntheticCollectionSource } from "@/lib/db/synthetic-collection-fixture";
import { EMPTY_CHECKPOINT } from "./plan";

vi.mock("@/lib/analytics/schedule-server-event", () => ({ scheduleServerEvent: vi.fn() }));

import { productionCollectionWorkerDeps, runCollectionSlice, type CollectionWorkerDeps } from "./worker";

const db = getServiceClient;
// The 50k fixture runs as a separate scale gate; concurrent large inserts
// can saturate the shared local PostgREST pool and obscure worker timing.
const scale = process.env.SCORING_RUN_SCALE_CONTRACT === "1" ? it : it.skip;
const owner = "contract-prior-seed";
const priorWindow = createScoringWindow("2026-09-05T12:00:00.000Z");
const currentWindow = createScoringWindow("2026-09-06T12:00:00.000Z");
const source = syntheticCollectionSource(819);
const requested = { provider: "github" as const, host: "github.com", login: owner };
const access = "c".repeat(64);
const scope = { discovery: "owned_and_contributed" as const, repositoryIds: [] as string[], eventKinds: [] as string[] };

async function cleanup() {
 assertLocalSqlTarget();
 expect((await db().from("scoring_v7_subjects").delete().eq("owner_handle", owner)).error).toBeNull();
}
beforeEach(async () => {
 await cleanup();
 expect((await db().rpc("scoring_v7_ensure_subject", { p_owner: owner })).error).toBeNull();
});
afterEach(cleanup);

describe("large prior seed through the real local database", () => {
 scale("reuses a 50k prior source within the 60-second slice and 120-second lease", async () => {
  const events = syntheticCollectionEvents({ count: 50_000, seed: 819, window: priorWindow });
  const repositories = [...new Set(events.map(event => event.repositoryId))].sort();
  const oldJob = await enqueueCollectionJob(owner, "github", "signup", priorWindow.referenceTime);
  const oldLease = randomUUID();
  expect((await db().from("scoring_collection_jobs").update({ state: "running", lease_token: oldLease,
   lease_expires_at: new Date(Date.now() + 300_000).toISOString() }).eq("id", oldJob.id)).error).toBeNull();
  for (let start = 0; start < events.length; start += 1_000) {
   const batch = events.slice(start, start + 1_000);
   const result = await db().rpc("scoring_collection_checkpoint_v2", {
    p_job_id: oldJob.id, p_lease_token: oldLease, p_checkpoint: EMPTY_CHECKPOINT,
    p_event_keys: batch.map(engineeringEventKey), p_events: batch,
    p_progress: { ...EMPTY_PROGRESS, events: start + batch.length }, p_release: false,
   });
   expect(result.error).toBeNull();
   expect(result.data).toMatchObject({ status: "ok", stagedCount: start + batch.length });
  }
  const finish = await db().rpc("scoring_collection_finish_v2", {
   p_job_id: oldJob.id, p_lease_token: oldLease,
   p_coverage: { source, window: priorWindow, dataThrough: priorWindow.referenceTime,
    status: "complete", discovery: "owned_and_contributed", repositoryIds: repositories,
    repositoryDiscoveryComplete: true, eventKinds: {}, reasonCodes: [], unknownPeriods: [] },
   p_observation: randomUUID(), p_requested: requested, p_access: access, p_scope: scope,
   p_link_id: null, p_link_version: null,
  });
  expect(finish.error).toBeNull();
  expect(finish.data).toMatchObject({ status: "ok", eventCount: 50_000 });

  const queued = await enqueueCollectionJob(owner, "github", "daily", currentWindow.referenceTime);
  const leaseToken = randomUUID();
  const leaseExpiresAt = new Date(Date.now() + 120_000).toISOString();
  const exact = await db().from("scoring_collection_jobs").update({ state: "running", lease_token: leaseToken,
   lease_expires_at: leaseExpiresAt }).eq("id", queued.id).eq("state", "queued").select("id").single();
  expect(exact.error).toBeNull();
  expect(exact.data?.id).toBe(queued.id);
  const job = { ...queued, state: "running" as const, leaseToken, leaseExpiresAt };
  const collect = vi.fn<CollectionWorkerDeps["collect"]>().mockImplementation(async (_input, _credential, checkpoint) => ({
   events: [], checkpoint, done: false, discoveryComplete: false, coverage: null, stop: null, requests: 0,
  }));
  const deps: CollectionWorkerDeps = { ...productionCollectionWorkerDeps,
   resolveCredential: async () => ({ status: "ok", resolved: {
    context: { owner, requestedSource: requested, window: currentWindow, scope }, token: null,
    accessContextId: access, requested, link: null,
   } }),
   collect, emitDiagnostics: vi.fn(), captureError: vi.fn(), onJobComplete: vi.fn(), onJobFailed: vi.fn(),
  };
  const began = Date.now();
  await runCollectionSlice(job, began + 60_000, deps);
  const elapsedMs = Date.now() - began;
  expect(elapsedMs).toBeLessThan(60_000);
  expect(collect).toHaveBeenCalledOnce();
  const retained = events.filter(event => isWithinScoringWindow(event.occurredAt, currentWindow));
  const row = await db().from("scoring_collection_jobs").select("state,progress,checkpoint").eq("id", job.id).single();
  expect(row.error).toBeNull();
  expect(row.data?.state).toBe("queued");
  expect(row.data?.progress.events).toBe(retained.length);
  expect(row.data?.checkpoint.discovered.itemIds.seededWorkItemIds.length).toBeGreaterThan(0);
  const staged = await db().from("scoring_collection_generations").select("event_count").eq("job_id", job.id).single();
  expect(staged.error).toBeNull();
  expect(staged.data?.event_count).toBe(retained.length);
 }, 600_000);
});
