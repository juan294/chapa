import { createHash, randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createScoringWindow, engineeringEventKey } from "@chapa/shared";
import type { NormalizedEngineeringEvent } from "@chapa/shared";
import { getServiceClient } from "@/test/contract/invoke";
import { assertLocalSqlTarget, inspectLocalSql } from "@/test/contract/local-sql";
import { EMPTY_CHECKPOINT } from "@/lib/collection/plan";
import { EMPTY_PROGRESS, enqueueCollectionJob } from "./collection-queue";
import { sourceEventFixture } from "./source-context-fixture";
import { readSourceManifest, readSourcePages } from "./source-context";
import type { SourceStorageContext } from "./source-context";
import { syntheticCollectionEvents, syntheticCollectionSource } from "./synthetic-collection-fixture";

const db = getServiceClient;
// Run scale cases separately from the default concurrent contract suite so
// fixture insertion does not saturate the shared local PostgREST connection pool.
const scale = process.env.SCORING_RUN_SCALE_CONTRACT === "1" ? it : it.skip;
const owner = "contract-source-pages";
const window = createScoringWindow("2026-09-05T12:00:00.000Z");
const laterWindow = createScoringWindow("2026-09-06T12:00:00.000Z");
const source = syntheticCollectionSource(294);
const requested = { provider: "github", host: "github.com", login: owner };
const access = "b".repeat(64);

type PageRow = { eventKey: string; event: NormalizedEngineeringEvent };
type Manifest = {
  id: string;
  window: typeof window;
  coverage: Record<string, unknown>;
  storageMode: "jsonb" | "rows";
  eventCount: number;
  eventGenerationId: string | null;
  eventKeysSha256: string | null;
};

function scope(repositoryIds: string[]) {
  return { discovery: "owned_and_contributed", repositoryIds, eventKinds: [] as string[] };
}
function coverage(
  eventSource = source,
  eventWindow = window,
  repositoryIds: string[] = [],
  discovery = "owned_and_contributed",
) {
  return {
    source: eventSource, window: eventWindow, dataThrough: eventWindow.referenceTime,
    status: "complete", discovery, repositoryIds, repositoryDiscoveryComplete: true,
    eventKinds: {}, reasonCodes: [], unknownPeriods: [],
  };
}
function context(
  eventSource = source,
  eventWindow = window,
  repositoryIds: string[] = [],
  requestedSource = requested,
  link: { id: string; updatedAt: string } | null = null,
) {
  return {
    p_owner: owner, p_actor: owner, p_source: eventSource, p_requested: requestedSource,
    p_access: access, p_scope: scope(repositoryIds), p_link_id: link?.id ?? null,
    p_link_version: link?.updatedAt ?? null, p_window: eventWindow,
  };
}
function storageContext(
  eventSource = source,
  eventWindow = window,
  repositoryIds: string[] = [],
): SourceStorageContext {
  return {
    owner, source: eventSource, requestedSource: requested, accessContextId: access,
    scope: scope(repositoryIds), window: eventWindow, link: null,
  };
}
function sortedKeys(events: readonly NormalizedEngineeringEvent[]) {
  return events.map(engineeringEventKey).sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
}
function digestKeys(keys: readonly string[]) {
  const hash = createHash("sha256");
  keys.forEach((key, index) => hash.update((index ? "\n" : "") + key));
  return hash.digest("hex");
}
function verifyPages(manifest: Manifest, pages: readonly (readonly PageRow[])[]) {
  const keys = pages.flatMap(page => page.map(row => row.eventKey));
  if (keys.length !== manifest.eventCount) throw new Error("Source page count mismatch");
  for (let index = 1; index < keys.length; index++) {
    if (Buffer.compare(Buffer.from(keys[index - 1]!), Buffer.from(keys[index]!)) >= 0) {
      throw new Error("Source page key order mismatch");
    }
  }
  if (digestKeys(keys) !== manifest.eventKeysSha256) throw new Error("Source page digest mismatch");
  return keys;
}

async function cleanup() {
  assertLocalSqlTarget();
  expect((await db().from("user_platforms").delete().eq("handle", owner)).error).toBeNull();
  expect((await db().from("scoring_v7_subjects").delete().eq("owner_handle", owner)).error).toBeNull();
}
beforeEach(async () => {
  await cleanup();
  expect((await db().rpc("scoring_v7_ensure_subject", { p_owner: owner })).error).toBeNull();
});
afterEach(cleanup);

async function publish(events: readonly NormalizedEngineeringEvent[], eventWindow = window) {
  const repositories = [...new Set(events.map(event => event.repositoryId))].sort();
  const job = await enqueueCollectionJob(owner, "github", "signup", eventWindow.referenceTime);
  const lease = randomUUID();
  const claimed = await db().from("scoring_collection_jobs").update({
    state: "running", lease_token: lease,
    lease_expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
  }).eq("id", job.id).eq("state", "queued").select("id").single();
  expect(claimed.error).toBeNull();
  for (let offset = 0; offset < events.length; offset += 1_000) {
    const batch = events.slice(offset, offset + 1_000);
    const stage = await db().rpc("scoring_collection_checkpoint_v2", {
      p_job_id: job.id, p_lease_token: lease, p_checkpoint: EMPTY_CHECKPOINT,
      p_event_keys: batch.map(engineeringEventKey), p_events: batch,
      p_progress: { ...EMPTY_PROGRESS, events: offset + batch.length }, p_release: false,
    });
    expect(stage.error).toBeNull();
    expect(stage.data).toMatchObject({ status: "ok", stagedCount: offset + batch.length });
  }
  const observationId = randomUUID();
  const finish = await db().rpc("scoring_collection_finish_v2", {
    p_job_id: job.id, p_lease_token: lease,
    p_coverage: coverage(
      events[0] ? { provider: events[0].provider, host: events[0].host, subjectId: events[0].subjectId } : source,
      eventWindow, repositories,
    ),
    p_observation: observationId,
    p_requested: requested,
    p_access: access, p_scope: scope(repositories), p_link_id: null, p_link_version: null,
  });
  expect(finish.error).toBeNull();
  expect(finish.data).toMatchObject({ status: "ok", observationId, eventCount: events.length });
  return { observationId, repositories };
}
async function manifest(args: ReturnType<typeof context>, prior = false): Promise<Manifest> {
  const result = await db().rpc("scoring_v7_read_source_manifest", { ...args, p_prior: prior });
  expect(result.error).toBeNull();
  expect(result.data).not.toBeNull();
  return result.data as Manifest;
}
async function page(args: ReturnType<typeof context>, selected: Manifest, afterKey: string | null) {
  const result = await db().rpc("scoring_v7_read_source_page", {
    ...args, p_prior: false, p_observation: selected.id,
    p_generation: selected.eventGenerationId, p_after_key: afterKey, p_limit: 500,
  });
  expect(result.error).toBeNull();
  return result.data as PageRow[];
}

describe("paged source observations (real local database)", () => {
  it("exposes service-only fixed-search-path RPCs", () => {
    const lines = inspectLocalSql("SELECT p.proname,has_function_privilege('anon',p.oid,'EXECUTE'),has_function_privilege('authenticated',p.oid,'EXECUTE'),has_function_privilege('service_role',p.oid,'EXECUTE'),p.proconfig::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('scoring_v7_read_source_manifest','scoring_v7_read_source_page') ORDER BY p.proname").split("\n");
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(line).toMatch(/^scoring_v7_read_source_(manifest|page)\|f\|f\|t\|/);
      expect(line).toContain("search_path=");
    }
  });

  it("pages 1,001 exact and prior events with a matching ordered-key digest", async () => {
    const events = syntheticCollectionEvents({ count: 1_001, seed: 294, window });
    const { repositories } = await publish(events);
    const exactContext = context(source, window, repositories);
    const exact = await manifest(exactContext);
    expect(exact).toMatchObject({ storageMode: "rows", eventCount: 1_001, window });
    expect(exact.eventKeysSha256).toBe(digestKeys(sortedKeys(events)));
    const first = await page(exactContext, exact, null);
    const second = await page(exactContext, exact, first.at(-1)!.eventKey);
    const third = await page(exactContext, exact, second.at(-1)!.eventKey);
    expect([first.length, second.length, third.length]).toEqual([500, 500, 1]);
    expect(verifyPages(exact, [first, second, third])).toEqual(sortedKeys(events));

    const priorContext = context(source, laterWindow, repositories);
    const prior = await manifest(priorContext, true);
    expect(prior.id).toBe(exact.id);
    expect(prior.window).toEqual(window);
    const priorFirst = await db().rpc("scoring_v7_read_source_page", {
      ...priorContext, p_prior: true, p_observation: prior.id,
      p_generation: prior.eventGenerationId, p_after_key: null, p_limit: 500,
    });
    expect(priorFirst.error).toBeNull();
    expect(priorFirst.data).toEqual(first);
    const priorClientContext = storageContext(source, laterWindow, repositories);
    const priorClientManifest = await readSourceManifest(priorClientContext, true);
    expect(priorClientManifest?.id).toBe(exact.id);
    const priorKeys: string[] = [];
    for await (const priorPage of readSourcePages(priorClientContext, priorClientManifest!)) {
      expect(priorPage.length).toBeLessThanOrEqual(500);
      priorKeys.push(...priorPage.map(engineeringEventKey));
    }
    expect(priorKeys).toEqual(sortedKeys(events));
  });

  it("detects missing and overlapping middle pages before accepting an observation", async () => {
    const events = syntheticCollectionEvents({ count: 1_001, seed: 294, window });
    const { repositories } = await publish(events);
    const args = context(source, window, repositories);
    const selected = await manifest(args);
    const first = await page(args, selected, null);
    const middle = await page(args, selected, first.at(-1)!.eventKey);
    const last = await page(args, selected, middle.at(-1)!.eventKey);
    expect(() => verifyPages(selected, [first, last])).toThrow("count mismatch");
    expect(() => verifyPages(selected, [first, middle, middle, last])).toThrow();
    expect(verifyPages(selected, [first, middle, last])).toHaveLength(1_001);
  });

  it("uses UTF-8 byte order for Unicode event keys and the manifest digest", async () => {
    const base = syntheticCollectionEvents({ count: 1, seed: 294, window })[0]!;
    const events = [{ ...base, eventId: "\uE000" }, { ...base, eventId: "\u{10000}" }];
    const { repositories } = await publish(events);
    const args = context(source, window, repositories);
    const selected = await manifest(args);
    const rows = await page(args, selected, null);
    expect(rows.map(row => row.eventKey)).toEqual(sortedKeys(events));
    expect(selected.eventKeysSha256).toBe(digestKeys(sortedKeys(events)));
  });

  it("rejects a stale linked version between page calls", async () => {
    const linkId = randomUUID();
    expect((await db().from("user_platforms").insert({
      id: linkId, handle: owner, platform: "gitlab", remote_login: "linked",
      access_token: "fixture-ciphertext",
    })).error).toBeNull();
    const linkRow = await db().from("user_platforms").select("updated_at").eq("id", linkId).single();
    expect(linkRow.error).toBeNull();
    const linkedSource = { provider: "gitlab" as const, host: "gitlab.com", subjectId: "synthetic-linked" };
    const events = Array.from({ length: 501 }, (_, index) => ({
      ...sourceEventFixture(linkedSource, window), eventId: `linked-${index}`,
    }));
    const repositories = ["known"];
    const job = await enqueueCollectionJob(owner, "gitlab", "signup", window.referenceTime);
    const lease = randomUUID();
    expect((await db().from("scoring_collection_jobs").update({
      state: "running", lease_token: lease,
      lease_expires_at: new Date(Date.now() + 120_000).toISOString(),
    }).eq("id", job.id)).error).toBeNull();
    const stage = await db().rpc("scoring_collection_checkpoint_v2", {
      p_job_id: job.id, p_lease_token: lease, p_checkpoint: EMPTY_CHECKPOINT,
      p_event_keys: events.map(engineeringEventKey), p_events: events,
      p_progress: { ...EMPTY_PROGRESS, events: events.length }, p_release: false,
    });
    expect(stage.error).toBeNull();
    const linkedRequested = { provider: "gitlab", host: "gitlab.com", login: "linked" };
    const link = { id: linkId, updatedAt: linkRow.data!.updated_at };
    expect((await db().rpc("scoring_collection_finish_v2", {
      p_job_id: job.id, p_lease_token: lease,
      p_coverage: coverage(linkedSource, window, repositories),
      p_observation: randomUUID(), p_requested: linkedRequested,
      p_access: access, p_scope: scope(repositories),
      p_link_id: link.id, p_link_version: link.updatedAt,
    })).error).toBeNull();
    const args = context(linkedSource, window, repositories, linkedRequested, link);
    const selected = await manifest(args);
    const first = await page(args, selected, null);
    expect(first).toHaveLength(500);
    expect((await db().from("user_platforms").update({ access_token: "rotated-ciphertext" }).eq("id", linkId)).error).toBeNull();
    const second = await db().rpc("scoring_v7_read_source_page", {
      ...args, p_prior: false, p_observation: selected.id,
      p_generation: selected.eventGenerationId,
      p_after_key: first.at(-1)!.eventKey, p_limit: 500,
    });
    expect(second.error).not.toBeNull();
  });

  scale("reads 50,000 published events in bounded pages", async () => {
    const started = performance.now();
    const events = syntheticCollectionEvents({ count: 50_000, seed: 294, window });
    const { repositories } = await publish(events);
    const args = context(source, window, repositories);
    const selected = await manifest(args);
    expect(selected.eventCount).toBe(50_000);
    let after: string | null = null;
    const hash = createHash("sha256");
    let count = 0;
    let maxPageBytes = 0;
    let maxPageMs = 0;
    while (count < selected.eventCount) {
      const pageStarted = performance.now();
      const rows = await page(args, selected, after);
      maxPageMs = Math.max(maxPageMs, performance.now() - pageStarted);
      maxPageBytes = Math.max(maxPageBytes, Buffer.byteLength(JSON.stringify(rows)));
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.length).toBeLessThanOrEqual(500);
      for (const row of rows) hash.update((count++ ? "\n" : "") + row.eventKey);
      after = rows.at(-1)!.eventKey;
    }
    expect(hash.digest("hex")).toBe(selected!.eventKeysSha256);
    const priorContext = storageContext(source, laterWindow, repositories);
    const priorManifest = await readSourceManifest(priorContext, true);
    expect(priorManifest?.id).toBe(selected.id);
    const priorHash = createHash("sha256");
    let priorCount = 0;
    let maxPriorPageMs = 0;
    const priorStarted = performance.now();
    let lastPageAt = performance.now();
    for await (const priorPage of readSourcePages(priorContext, priorManifest!)) {
      maxPriorPageMs = Math.max(maxPriorPageMs, performance.now() - lastPageAt);
      expect(priorPage.length).toBeLessThanOrEqual(500);
      for (const event of priorPage) priorHash.update((priorCount++ ? "\n" : "") + engineeringEventKey(event));
      lastPageAt = performance.now();
    }
    expect(priorCount).toBe(50_000);
    expect(priorHash.digest("hex")).toBe(selected.eventKeysSha256);
    console.info(JSON.stringify({
      case: "source-pages-50000", rows: count, elapsedMs: Math.round(performance.now() - started),
      maxPageMs: Math.round(maxPageMs), maxPageBytes,
      priorClientMs: Math.round(performance.now() - priorStarted),
      maxPriorPageMs: Math.round(maxPriorPageMs),
    }));
  }, 600_000);

  scale("reads a directly seeded 100,000-row published generation without lifting the writer cap", async () => {
    const started = performance.now();
    const generationId = randomUUID();
    const observationId = randomUUID();
    const fixture = sourceEventFixture(source, window);
    const fixtureSql = JSON.stringify(fixture).replaceAll("'", "''");
    const windowSql = JSON.stringify(window).replaceAll("'", "''");
    const coverageSql = JSON.stringify(coverage(source, window, ["known"])).replaceAll("'", "''");
    const scopeSql = JSON.stringify(scope(["known"])).replaceAll("'", "''");
    inspectLocalSql(`
      INSERT INTO public.scoring_v7_sources(owner_handle,provider,host,subject_id,access_context_id,declared_scope)
      VALUES('${owner}','github','github.com','${source.subjectId}','${access}','${scopeSql}'::jsonb);
      INSERT INTO public.scoring_collection_generations(id,owner_handle,provider,host,subject_id,event_count,legacy_import_done)
      VALUES('${generationId}','${owner}','github','github.com','${source.subjectId}',100000,true);
      WITH rows AS (
        SELECT lpad(n::text,6,'0') AS event_id, ('${fixtureSql}'::jsonb ||
          jsonb_build_object('eventId',lpad(n::text,6,'0'))) AS event
        FROM generate_series(1,100000) AS n
      )
      INSERT INTO public.scoring_collection_generation_events(generation_id,event_key,repository_id,event)
      SELECT '${generationId}'::uuid,public.scoring_collection_event_key(event),'known',event FROM rows;
      UPDATE public.scoring_collection_generations SET published_at=now() WHERE id='${generationId}'::uuid;
      INSERT INTO public.scoring_v7_source_observations(
        id,owner_handle,source_id,reference_time,window_start,window_end,data_through,
        coverage,payload,event_storage_mode,event_generation_id)
      SELECT '${observationId}'::uuid,'${owner}',id,
        ('${windowSql}'::jsonb->>'referenceTime')::timestamptz,
        ('${windowSql}'::jsonb->>'startInclusive')::timestamptz,
        ('${windowSql}'::jsonb->>'endExclusive')::timestamptz,
        ('${windowSql}'::jsonb->>'referenceTime')::timestamptz,
        '${coverageSql}'::jsonb,'{"eventStorage":"generation"}'::jsonb,'rows','${generationId}'::uuid
      FROM public.scoring_v7_sources WHERE owner_handle='${owner}' AND access_context_id='${access}';
    `);
    const clientContext = storageContext(source, window, ["known"]);
    const selected = await readSourceManifest(clientContext);
    expect(selected).toMatchObject({ id: observationId, eventCount: 100_000, storageMode: "rows" });
    let seen = 0;
    const hash = createHash("sha256");
    let maxPageBytes = 0;
    let maxPageMs = 0;
    let lastPageAt = performance.now();
    for await (const rows of readSourcePages(clientContext, selected!)) {
      const pageStarted = performance.now();
      maxPageMs = Math.max(maxPageMs, pageStarted - lastPageAt);
      maxPageBytes = Math.max(maxPageBytes, Buffer.byteLength(JSON.stringify(rows)));
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.length).toBeLessThanOrEqual(500);
      for (const event of rows) hash.update((seen++ ? "\n" : "") + engineeringEventKey(event));
      lastPageAt = performance.now();
    }
    expect(hash.digest("hex")).toBe(selected!.eventKeysSha256);
    console.info(JSON.stringify({
      case: "source-pages-100000", rows: seen, elapsedMs: Math.round(performance.now() - started),
      maxPageMs: Math.round(maxPageMs), maxPageBytes,
    }));
  }, 600_000);
});
