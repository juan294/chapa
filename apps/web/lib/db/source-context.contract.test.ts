import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createScoringWindow, engineeringEventKey } from "@chapa/shared";
import { getServiceClient } from "@/test/contract/invoke";
import { assertLocalSqlTarget, inspectLocalSql } from "@/test/contract/local-sql";
import { sourceEventFixture } from "./source-context-fixture";
import { readSourceObservation } from "./source-context";
import { databaseInstantMicros } from "./source-time";
import { EMPTY_CHECKPOINT } from "@/lib/collection/plan";
import { EMPTY_PROGRESS, enqueueCollectionJob } from "./collection-queue";
const owner = "contract-source-context";
const db = getServiceClient;
const window = createScoringWindow("2026-09-05T12:00:00Z");
const source = { provider: "github" as const, host: "github.com", subjectId: "canonical-node" };
const requested = { provider: "github", host: "github.com", login: owner };
const scope = { discovery: "explicit_repositories", repositoryIds: [], eventKinds: ["accepted_change"] };
const coverage = { source, window, dataThrough: window.referenceTime, status: "complete", discovery: scope.discovery, repositoryIds: [], repositoryDiscoveryComplete: true, eventKinds: { accepted_change: "complete" }, reasonCodes: [], unknownPeriods: [] };
const base = () => ({ p_owner: owner, p_actor: owner, p_source: source, p_requested: requested, p_access: "a".repeat(64), p_scope: scope, p_link_id: null, p_link_version: null });
const append = () => ({ ...base(), p_observation: randomUUID(), p_window: window, p_coverage: coverage, p_payload: { events: [] } });
async function cleanup() {
 assertLocalSqlTarget();
 expect((await db().from("user_platforms").delete().eq("handle", owner)).error).toBeNull();
 expect((await db().from("scoring_v7_subjects").delete().eq("owner_handle", owner)).error).toBeNull();
}
beforeEach(async () => { await cleanup(); expect((await db().rpc("scoring_v7_ensure_subject", { p_owner: owner })).error).toBeNull(); });
afterEach(cleanup);
async function leaseV2Fixture(jobId: string) {
 const lease = randomUUID();
 const result = await db().from("scoring_collection_jobs")
  .update({ state: "running", lease_token: lease, lease_expires_at: new Date(Date.now() + 120_000).toISOString() })
  .eq("id", jobId).eq("state", "queued").select("id").single();
 expect(result.error).toBeNull();
 return lease;
}
describe("source context RPC draft contracts", () => {
 it("forces RLS and restricts generation tables and v2 RPCs to the service role", () => {
  const tables = inspectLocalSql("SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity,has_table_privilege('anon',c.oid,'SELECT'),has_table_privilege('authenticated',c.oid,'SELECT'),has_table_privilege('service_role',c.oid,'SELECT'),has_table_privilege('service_role',c.oid,'INSERT'),has_table_privilege('service_role',c.oid,'UPDATE'),has_table_privilege('service_role',c.oid,'DELETE') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('scoring_collection_generations','scoring_collection_generation_events') ORDER BY c.relname");
  expect(tables.split("\n")).toEqual([
   "scoring_collection_generation_events|t|t|f|f|t|f|f|f",
   "scoring_collection_generations|t|t|f|f|t|f|f|f",
  ]);
  const functions = inspectLocalSql("SELECT p.proname,has_function_privilege('anon',p.oid,'EXECUTE'),has_function_privilege('authenticated',p.oid,'EXECUTE'),has_function_privilege('service_role',p.oid,'EXECUTE'),p.proconfig::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('scoring_collection_checkpoint_v2','scoring_collection_finish_v2') ORDER BY p.proname");
  const lines = functions.split("\n");
  expect(lines).toHaveLength(2);
  for (const line of lines) {
   expect(line).toMatch(/^scoring_collection_(checkpoint|finish)_v2\|f\|f\|t\|/);
   expect(line).toContain("search_path=");
  }
 });
 it("fails closed when the legacy read RPC selects a row-mode observation", async () => {
  const job = await enqueueCollectionJob(owner, "github", "signup", window.referenceTime);
  const lease = await leaseV2Fixture(job.id);
  const event = sourceEventFixture(source, window);
  const checkpoint = await db().rpc("scoring_collection_checkpoint_v2", {
   p_job_id: job.id, p_lease_token: lease, p_checkpoint: EMPTY_CHECKPOINT,
   p_event_keys: [engineeringEventKey(event)], p_events: [event],
   p_progress: { ...EMPTY_PROGRESS, events: 1 }, p_release: false,
  });
  expect(checkpoint.error).toBeNull();
  const finished = await db().rpc("scoring_collection_finish_v2", {
   p_job_id: job.id, p_lease_token: lease, p_coverage: { ...coverage, repositoryIds: [event.repositoryId] },
   p_observation: randomUUID(), p_requested: requested, p_access: base().p_access,
   p_scope: { ...scope, repositoryIds: [event.repositoryId] }, p_link_id: null, p_link_version: null,
  });
  expect(finished.error).toBeNull();
  const legacyRead = await db().rpc("scoring_v7_read_source", {
   ...base(), p_scope: { ...scope, repositoryIds: [event.repositoryId] }, p_window: window, p_prior: false,
  });
  expect(legacyRead.error).not.toBeNull();
 });
 it("rejects a changed linked grant at finish and withdrawal removes its generation rows", async () => {
  const linkId = randomUUID();
  expect((await db().from("user_platforms").insert({ id: linkId, handle: owner, platform: "gitlab", remote_login: "linked", access_token: "fixture-ciphertext" })).error).toBeNull();
  const link = await db().from("user_platforms").select("updated_at").eq("id", linkId).single();
  expect(link.error).toBeNull();
  const linkedSource = { provider: "gitlab" as const, host: "gitlab.com", subjectId: "synthetic-linked-subject" };
  const event = sourceEventFixture(linkedSource, window);
  const linkedRequested = { provider: "gitlab", host: "gitlab.com", login: "linked" };
  const linkedScope = { ...scope, repositoryIds: [event.repositoryId] };
  const linkedCoverage = { ...coverage, source: linkedSource, repositoryIds: [event.repositoryId] };
  const job = await enqueueCollectionJob(owner, "gitlab", "signup", window.referenceTime);
  const lease = await leaseV2Fixture(job.id);
  const checkpoint = await db().rpc("scoring_collection_checkpoint_v2", {
   p_job_id: job.id, p_lease_token: lease, p_checkpoint: EMPTY_CHECKPOINT,
   p_event_keys: [engineeringEventKey(event)], p_events: [event],
   p_progress: { ...EMPTY_PROGRESS, events: 1 }, p_release: false,
  });
  expect(checkpoint.error).toBeNull();
  expect((await db().from("user_platforms").update({ access_token: "rotated-ciphertext" }).eq("id", linkId)).error).toBeNull();
  const observationId = randomUUID();
  const finish = await db().rpc("scoring_collection_finish_v2", {
   p_job_id: job.id, p_lease_token: lease, p_coverage: linkedCoverage,
   p_observation: observationId, p_requested: linkedRequested, p_access: base().p_access,
   p_scope: linkedScope, p_link_id: linkId, p_link_version: link.data!.updated_at,
  });
  expect(finish.error).not.toBeNull();
  expect((await db().from("scoring_v7_source_observations").select("id").eq("id", observationId)).data).toEqual([]);
  const generation = (await db().from("scoring_collection_jobs").select("current_generation_id").eq("id", job.id).single()).data!.current_generation_id;
  const withdrawn = await db().rpc("scoring_v7_withdraw_with_receipts", { p_owner: owner, p_actor: owner, p_acknowledged: true });
  expect(withdrawn.error).toBeNull();
  expect((await db().from("scoring_collection_generations").select("id").eq("owner_handle", owner)).data).toEqual([]);
  expect((await db().from("scoring_collection_generation_events").select("generation_id").eq("generation_id", generation)).data).toEqual([]);
 });
 it("denies browser roles all source and token mutation RPCs", () => {
  const query = "SELECT p.proname,has_function_privilege('anon',p.oid,'EXECUTE'),has_function_privilege('authenticated',p.oid,'EXECUTE'),has_function_privilege('service_role',p.oid,'EXECUTE') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('scoring_v7_append_source','scoring_v7_read_source','scoring_v7_discover_source','scoring_v7_cas_link_tokens') ORDER BY p.proname";
  expect(inspectLocalSql(query).split("\n")).toEqual([
   "scoring_v7_append_source|f|f|t",
   "scoring_v7_cas_link_tokens|f|f|t",
   "scoring_v7_discover_source|f|f|t",
   "scoring_v7_read_source|f|f|t",
  ]);
 });
 it("persists a nonempty normalized event and replays it through the private adapter", async () => {
  const event = sourceEventFixture(source, window);
  const args = { ...append(), p_scope: { ...scope, repositoryIds: ["known", "inaccessible"] }, p_coverage: { ...coverage, repositoryIds: ["known"], status: "partial", repositoryDiscoveryComplete: false, reasonCodes: ["not_accessible"] }, p_payload: { events: [event] } };
  expect((await db().rpc("scoring_v7_append_source", args)).error).toBeNull();
  const read = await readSourceObservation({ owner, requestedSource: requested, source, window, scope: args.p_scope, accessContextId: args.p_access, link: null });
  expect(read).toEqual({ id: args.p_observation, window, coverage: args.p_coverage, events: [event] });
 });
 it("persists a complete changed-file list larger than 1,000 paths", async () => {
  const paths = Array.from({ length: 1_604 }, (_, index) => `src/file-${index}.ts`);
  const event = sourceEventFixture(source, window);
  const largeEvent = {
   ...event,
   measurements: {
    ...event.measurements,
    changedFiles: { status: "observed" as const, coverage: "complete" as const, provenance: "source_observed" as const, value: paths },
   },
  };
  const args = {
   ...append(),
   p_scope: { ...scope, repositoryIds: ["known"] },
   p_coverage: { ...coverage, repositoryIds: ["known"] },
   p_payload: { events: [largeEvent] },
  };
  expect((await db().rpc("scoring_v7_append_source", args)).error).toBeNull();
  const read = await readSourceObservation({ owner, requestedSource: requested, source, window, scope: args.p_scope, accessContextId: args.p_access, link: null });
  expect(read?.events[0]?.measurements.changedFiles).toMatchObject({ status: "observed", coverage: "complete", value: paths });
 });
 it("rejects foreign event repositories, raw measurement bodies, control characters and non-replayable dates", async () => {
  const event = sourceEventFixture(source, window);
  const args = { ...append(), p_scope: { ...scope, repositoryIds: ["known"] }, p_coverage: { ...coverage, repositoryIds: ["known"] } };
  const badEvents = [
   { ...event, repositoryId: "foreign" },
   { ...event, eventId: "bad\nidentity" },
   { ...event, occurredAt: "2026-09-01T12:00:00.000001Z" },
   { ...event, measurements: { ...event.measurements, additions: { status: "observed", coverage: "complete", provenance: "source_observed", value: { body: "private-raw-body" } } } },
   ...["2026-09-06T00:00:00.000Z", "2026-09-01T11:00:00.000Z"].map(acceptedAt => ({ ...event, acceptance: { status: "observed", coverage: "complete", provenance: "source_observed", value: { method: "merged_change", acceptedAt, acceptedResultId: "result1" } } })),
  ];
  for (const bad of badEvents) expect((await db().rpc("scoring_v7_append_source", { ...args, p_observation: randomUUID(), p_payload: { events: [bad] } })).error).not.toBeNull();
  expect((await db().from("scoring_v7_source_observations").select("id").eq("owner_handle", owner)).data).toEqual([]);
 });
 it("rejects NULL actor without source writes", async () => {
  expect((await db().rpc("scoring_v7_append_source", { ...append(), p_actor: null })).error).not.toBeNull();
  expect((await db().from("scoring_v7_sources").select("id").eq("owner_handle", owner)).data).toEqual([]);
 });
 it("retries exact observations, rejects revision conflicts and reads the exact original context", async () => {
  const args = append();
  expect((await db().rpc("scoring_v7_append_source", args)).error).toBeNull();
  expect((await db().rpc("scoring_v7_append_source", args)).error).toBeNull();
  expect((await db().rpc("scoring_v7_append_source", { ...args, p_payload: { events: [], progress: "private" } })).error).not.toBeNull();
  const read = await db().rpc("scoring_v7_read_source", { ...base(), p_window: window, p_prior: false });
  expect(read.error).toBeNull(); expect(read.data).toMatchObject({ id: args.p_observation, window, coverage, events: [] });
 });
 it("stores partial explicit-scope subsets while rejecting out-of-scope repositories", async () => {
  const args = append();
  const requested = { ...args, p_scope: { ...scope, repositoryIds: ["known", "inaccessible"] }, p_coverage: { ...coverage, status: "partial", repositoryDiscoveryComplete: false, repositoryIds: ["known"], reasonCodes: ["not_accessible"] } };
  expect((await db().rpc("scoring_v7_append_source", requested)).error).toBeNull();
  expect((await db().rpc("scoring_v7_append_source", { ...requested, p_observation: randomUUID(), p_coverage: { ...requested.p_coverage, repositoryIds: ["foreign"] } })).error).not.toBeNull();
 });
 it("rejects nonfinite and inconsistent read windows", async () => {
  for (const invalid of [{ ...window, referenceTime: "infinity" }, { ...window, startInclusive: window.endExclusive }, { ...window, referenceTime: "2026-09-05" }, { ...window, referenceTime: "2026-09-05T12:00:00Z" }, { ...window, calendarDays: "365" }]) {
   expect((await db().rpc("scoring_v7_read_source", { ...base(), p_window: invalid, p_prior: true })).error).not.toBeNull();
  }
 });
 it("discovers canonical identity without using requested login and refuses ambiguity", async () => {
  expect((await db().rpc("scoring_v7_append_source", append())).error).toBeNull();
  const { p_source: ignored, ...discovery } = base(); void ignored;
  expect((await db().rpc("scoring_v7_discover_source", discovery)).data).toEqual({ status: "found", source });
  const other = { ...source, subjectId: "other-canonical" };
  expect((await db().rpc("scoring_v7_append_source", { ...append(), p_source: other, p_coverage: { ...coverage, source: other } })).error).toBeNull();
  expect((await db().rpc("scoring_v7_discover_source", discovery)).data).toEqual({ status: "ambiguous" });
 });
 it("rotates every legacy update monotonically and refuses delayed old-link token changes", async () => {
  const id = randomUUID();
  expect((await db().from("user_platforms").insert({ id, handle: owner, platform: "gitlab", remote_login: "linked", access_token: "fixture-ciphertext" })).error).toBeNull();
  const first = await db().from("user_platforms").select("updated_at").eq("id", id).single();
  const second = await db().from("user_platforms").update({ updated_at: first.data!.updated_at }).eq("id", id).select("updated_at").single();
  expect(second.error).toBeNull();
  expect(databaseInstantMicros(second.data!.updated_at)).toBeGreaterThan(databaseInstantMicros(first.data!.updated_at));
  const cas = { p_owner: owner, p_actor: owner, p_platform: "gitlab", p_id: id, p_version: first.data!.updated_at, p_action: "delete", p_access_token: null, p_refresh_token: null, p_expires_at: null };
  expect((await db().rpc("scoring_v7_cas_link_tokens", cas)).data).toEqual({ status: "stale" });
  expect((await db().from("user_platforms").select("id").eq("id", id)).data).toHaveLength(1);
 });
 it("allows exactly one competing token update and rejects old grant deletion after relinking", async () => {
  const id = randomUUID();
  expect((await db().from("user_platforms").insert({ id, handle: owner, platform: "gitlab", remote_login: "linked", access_token: "original-ciphertext" })).error).toBeNull();
  const original = await db().from("user_platforms").select("updated_at").eq("id", id).single();
  const args = { p_owner: owner, p_actor: owner, p_platform: "gitlab", p_id: id, p_version: original.data!.updated_at, p_action: "update", p_access_token: "ciphertext-one", p_refresh_token: null, p_expires_at: null };
  const results = await Promise.all([db().rpc("scoring_v7_cas_link_tokens", args), db().rpc("scoring_v7_cas_link_tokens", { ...args, p_access_token: "ciphertext-two" })]);
  for (const result of results) expect(result.error).toBeNull();
  expect(results.map(result => result.data.status).sort()).toEqual(["stale", "updated"]);
  const winner = results[0]!.data.status === "updated" ? "ciphertext-one" : "ciphertext-two";
  expect((await db().from("user_platforms").select("access_token").eq("id", id).single()).data!.access_token).toBe(winner);
  expect((await db().from("user_platforms").delete().eq("id", id)).error).toBeNull();
  const replacement = randomUUID();
  expect((await db().from("user_platforms").insert({ id: replacement, handle: owner, platform: "gitlab", remote_login: "replacement", access_token: "new-link-ciphertext", updated_at: original.data!.updated_at })).error).toBeNull();
  expect((await db().rpc("scoring_v7_cas_link_tokens", { ...args, p_action: "delete", p_access_token: null })).data).toEqual({ status: "stale" });
  expect((await db().from("user_platforms").select("id,access_token").eq("handle", owner)).data).toEqual([{ id: replacement, access_token: "new-link-ciphertext" }]);
  const linkedSource = { provider: "gitlab", host: "gitlab.com", subjectId: "old-canonical" };
  expect((await db().rpc("scoring_v7_append_source", { ...append(), p_source: linkedSource, p_requested: { provider: "gitlab", host: "gitlab.com", login: "linked" }, p_link_id: id, p_link_version: original.data!.updated_at, p_coverage: { ...coverage, source: linkedSource } })).error).not.toBeNull();
 });
 it("serializes append and withdrawal without reviving source access", async () => {
  const [, withdrawal] = await Promise.all([db().rpc("scoring_v7_append_source", append()), db().rpc("scoring_v7_withdraw_with_receipts", { p_owner: owner, p_actor: owner, p_acknowledged: true })]);
  expect(withdrawal.error).toBeNull();
  expect((await db().from("scoring_v7_sources").select("id").eq("owner_handle", owner)).data).toEqual([]);
  expect((await db().rpc("scoring_v7_read_source", { ...base(), p_window: window, p_prior: false })).error).not.toBeNull();
 });
});
