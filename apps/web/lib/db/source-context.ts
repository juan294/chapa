import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { canonicalJson, createScoringWindow, engineeringEventKey, scoringInstant } from "@chapa/shared";
import type { NormalizedEngineeringEvent, ScoringWindow, SourceIdentity } from "@chapa/shared";
import type { StrictLinkedPlatform } from "./user-platforms";
import { getSupabase } from "./supabase";

const text = z.string().min(1).max(1024).refine(s => !/[\u0000-\u001f\u007f]/.test(s));
const instant = z.string().refine(s => { try { scoringInstant(s); return true; } catch { return false; } });
const status = z.enum(["complete", "partial", "unavailable", "stale", "legacy"]);
const provenance = z.enum(["source_observed", "self_reported", "automated_assessment", "human_assessed", "independently_corroborated"]);
const reason = z.enum(["criterion_demonstrated", "criterion_not_demonstrated", "not_assessed", "not_accessible", "not_supported", "pagination_incomplete", "discovery_incomplete", "source_error", "stale_data", "legacy_aggregate", "acceptance_time_unknown", "attribution_unknown", "alias_unresolved", "partial_files", "outside_window", "retracted", "insufficient_evidence"]);
const kind = z.enum(["accepted_change", "authored_commit", "review", "issue_work", "documentation_design", "maintenance", "practice_evidence"]);
const sourceSchema = z.object({ provider: z.enum(["github", "gitlab", "bitbucket", "codeberg"]), host: text, subjectId: text }).strict();
const windowSchema = z.object({ referenceTime: instant, referenceDate: text, startInclusive: instant, endExclusive: instant, calendarDays: z.literal(365) }).strict()
 .refine(w => canonicalJson(w) === canonicalJson(createScoringWindow(w.referenceTime)));
const observation = <T extends z.ZodType>(value: T) => z.discriminatedUnion("status", [
 z.object({ status: z.literal("observed"), value, coverage: status, provenance }).strict(),
 z.object({ status: z.literal("unknown"), coverage: z.enum(["partial", "unavailable", "stale", "legacy"]), reasonCode: reason }).strict(),
]);
const acceptance = z.object({ method: z.enum(["merged_change", "default_branch_first_reachability", "linked_issue_result", "accepted_artifact"]), acceptedAt: instant, acceptedResultId: text }).strict();
const eventSchema = sourceSchema.extend({ repositoryId: text, actorId: text, eventId: text, schemaVersion: z.literal("v7"), kind,
 occurredAt: instant, dataThrough: instant, canonicalProjectId: text, workItemId: text, artifactRevision: text, artifactReferenceIds: z.array(text).max(1000),
 attribution: z.enum(["individual", "team_participation", "unclear"]), provenance, coverage: status,
 measurements: z.object({ changedFiles: observation(z.array(text).max(10000)), additions: observation(z.number().int().nonnegative()), deletions: observation(z.number().int().nonnegative()), leadTimeHours: observation(z.number().nonnegative()), hasDescription: observation(z.boolean()), hasIssueLink: observation(z.boolean()), usesFeatureBranch: observation(z.boolean()) }).strict(),
 categories: z.array(z.object({ category: z.enum(["implementation", "verification_review", "documentation_design", "maintenance_support"]), evidenceReferenceIds: z.array(text).max(1000) }).strict()).max(4),
 acceptance: observation(acceptance),
}).strict();
const coverageSchema = z.object({ source: sourceSchema, window: windowSchema, dataThrough: instant.nullable(), status,
 discovery: z.enum(["owned_and_contributed", "contribution_search", "registered_ledger", "explicit_repositories", "legacy_upload"]), repositoryIds: z.array(text).max(10000), repositoryDiscoveryComplete: z.boolean(),
 eventKinds: z.partialRecord(kind, status), reasonCodes: z.array(reason).max(100), unknownPeriods: z.array(z.object({ startInclusive: instant, endExclusive: instant }).strict()).max(1000),
}).strict();
const valueSchema = z.object({ id: z.uuid(), window: windowSchema, coverage: coverageSchema, events: z.array(eventSchema).max(50000) }).strict();
export type StoredSourceObservation = z.infer<typeof valueSchema>;
const manifestSchema = z.object({
 id: z.uuid(), window: windowSchema, coverage: coverageSchema,
 storageMode: z.enum(["jsonb", "rows"]), eventCount: z.number().int().min(0).max(100000),
 eventGenerationId: z.uuid().nullable(), eventKeysSha256: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
}).strict().superRefine((manifest, check) => {
 if (manifest.storageMode === "rows" && (!manifest.eventGenerationId || !manifest.eventKeysSha256)) check.addIssue({ code: "custom", message: "Missing row generation" });
 if (manifest.storageMode === "jsonb" && (manifest.eventGenerationId || manifest.eventKeysSha256)) check.addIssue({ code: "custom", message: "Unexpected row generation" });
});
export type SourceObservationManifest = z.infer<typeof manifestSchema>;
const pageSchema = z.array(z.object({ eventKey: z.string().min(1), event: eventSchema }).strict()).max(500);
export interface SourceStorageContext {
 readonly owner: string;
 readonly requestedSource: { readonly provider: string; readonly host: string; readonly login: string };
 readonly source: SourceIdentity;
 readonly accessContextId: string;
 readonly scope: { readonly discovery: string; readonly repositoryIds: readonly string[]; readonly eventKinds: readonly string[] };
 readonly window: ScoringWindow;
 readonly link: Pick<StrictLinkedPlatform, "id" | "updatedAt"> | null;
}
function parse(value: unknown, context: SourceStorageContext, prior: boolean): StoredSourceObservation {
 const parsed = valueSchema.parse(value);
 const ref = scoringInstant(parsed.window.referenceTime).getTime(), requested = scoringInstant(context.window.referenceTime).getTime();
 if (canonicalJson(parsed.coverage.source) !== canonicalJson(context.source) || canonicalJson(parsed.coverage.window) !== canonicalJson(parsed.window) ||
   parsed.coverage.discovery !== context.scope.discovery || (prior ? ref >= requested : canonicalJson(parsed.window) !== canonicalJson(context.window))) throw new Error();
 const start = scoringInstant(parsed.window.startInclusive).getTime();
 if (parsed.coverage.dataThrough !== null && scoringInstant(parsed.coverage.dataThrough).getTime() > ref) throw new Error();
 if (parsed.coverage.status === "complete" && (!parsed.coverage.repositoryDiscoveryComplete || parsed.coverage.dataThrough === null || scoringInstant(parsed.coverage.dataThrough).getTime() !== ref || context.scope.eventKinds.some(k => parsed.coverage.eventKinds[k as keyof typeof parsed.coverage.eventKinds] !== "complete"))) throw new Error();
 if (context.scope.discovery === "explicit_repositories") {
  if (parsed.coverage.repositoryIds.some(id => !context.scope.repositoryIds.includes(id))) throw new Error();
  if ((parsed.coverage.status === "complete" || parsed.coverage.repositoryDiscoveryComplete) && canonicalJson([...new Set(context.scope.repositoryIds)].sort()) !== canonicalJson([...new Set(parsed.coverage.repositoryIds)].sort())) throw new Error();
 }
 for (const period of parsed.coverage.unknownPeriods) {
  const a = scoringInstant(period.startInclusive).getTime(), b = scoringInstant(period.endExclusive).getTime();
  if (a >= b || (parsed.coverage.status === "complete" && a <= ref && b > start)) throw new Error();
 }
 for (const event of parsed.events) {
  const at = scoringInstant(event.occurredAt).getTime(), through = scoringInstant(event.dataThrough).getTime();
  if (!parsed.coverage.repositoryIds.includes(event.repositoryId) || (context.scope.discovery === "explicit_repositories" && !context.scope.repositoryIds.includes(event.repositoryId))) throw new Error();
  if (event.acceptance.status === "observed") {
   const accepted = scoringInstant(event.acceptance.value.acceptedAt).getTime();
   if (accepted > through || accepted > ref || (event.kind === "accepted_change" && accepted !== at)) throw new Error();
  }
  if (event.provider !== context.source.provider || event.host !== context.source.host || event.subjectId !== context.source.subjectId || at < start || at > ref || through < at || through > ref) throw new Error();
 }
 return parsed;
}
function args(context: SourceStorageContext) {
 windowSchema.parse(context.window); sourceSchema.parse(context.source);
 if (context.source.provider !== context.requestedSource.provider || context.source.host !== context.requestedSource.host) throw new Error();
 return { p_owner: context.owner.toLowerCase(), p_actor: context.owner.toLowerCase(), p_source: context.source, p_requested: context.requestedSource, p_access: context.accessContextId, p_scope: context.scope,
  p_link_id: context.link?.id ?? null, p_link_version: context.link?.updatedAt ?? null, p_window: context.window };
}
async function call(name: string, values: object) {
 const db = getSupabase(); if (!db) throw new Error();
 const { data, error } = await db.rpc(name, values); if (error) throw new Error(); return data;
}
/** Current authorization precedes canonical identity discovery. Ambiguity never
 * falls back to an arbitrary provider subject or uses the login as an ID.
 */
export async function discoverStoredSource(context: Omit<SourceStorageContext, "source">): Promise<{ status: "missing" | "ambiguous" } | { status: "found"; source: SourceIdentity }> {
 try {
  const detached = JSON.parse(canonicalJson(context)) as typeof context;
  const data = await call("scoring_v7_discover_source", { p_owner: detached.owner.toLowerCase(), p_actor: detached.owner.toLowerCase(), p_requested: detached.requestedSource,
   p_access: detached.accessContextId, p_scope: detached.scope, p_link_id: detached.link?.id ?? null, p_link_version: detached.link?.updatedAt ?? null });
  const parsed = z.union([z.object({ status: z.enum(["missing", "ambiguous"]) }).strict(), z.object({ status: z.literal("found"), source: sourceSchema }).strict()]).parse(data);
  if (parsed.status === "found" && (parsed.source.provider !== detached.requestedSource.provider || parsed.source.host !== detached.requestedSource.host)) throw new Error();
  return parsed;
 } catch { throw new Error("Source storage discovery failed"); }
}
export async function appendSourceObservation(context: SourceStorageContext, value: unknown): Promise<StoredSourceObservation> {
 try {
  const detached = JSON.parse(canonicalJson(context)) as SourceStorageContext;
  const parsed = parse(value, detached, false);
  const data = await call("scoring_v7_append_source", { ...args(detached), p_observation: parsed.id, p_coverage: parsed.coverage, p_payload: { events: parsed.events } });
  const committed = parse(data, detached, false);
  if (canonicalJson(committed) !== canonicalJson(parsed)) throw new Error();
  return committed;
 } catch { throw new Error("Source storage append failed"); }
}
export async function readSourceObservation(context: SourceStorageContext, prior = false): Promise<StoredSourceObservation | null> {
 try {
  const detached = JSON.parse(canonicalJson(context)) as SourceStorageContext;
  const manifest = await readSourceManifest(detached, prior);
  if (!manifest) return null;
  const events: NormalizedEngineeringEvent[] = [];
  for await (const page of readSourcePages(detached, manifest)) events.push(...page);
  return parse({ id: manifest.id, window: manifest.window, coverage: manifest.coverage, events }, detached, prior);
 } catch { throw new Error("Source storage unavailable"); }
}

/** Selects one exact or prior observation; the manifest carries the immutable
 * generation and expected digest used to verify all subsequent pages. */
export async function readSourceManifest(context: SourceStorageContext, prior = false): Promise<SourceObservationManifest | null> {
 try {
  const detached = JSON.parse(canonicalJson(context)) as SourceStorageContext;
  const data = await call("scoring_v7_read_source_manifest", { ...args(detached), p_prior: prior });
  if (data === null) return null;
  const manifest = manifestSchema.parse(data);
  parse({ id: manifest.id, window: manifest.window, coverage: manifest.coverage, events: [] }, detached, prior);
  return manifest;
 } catch { throw new Error("Source storage unavailable"); }
}

/** Pages a selected observation with a stable key cursor. A consumer must read
 * the iterator to completion before treating its contents as complete. */
export async function* readSourcePages(context: SourceStorageContext, selected: SourceObservationManifest): AsyncIterable<readonly NormalizedEngineeringEvent[]> {
 try {
  const detached = JSON.parse(canonicalJson(context)) as SourceStorageContext;
  const manifest = manifestSchema.parse(JSON.parse(canonicalJson(selected)));
  const prior = manifest.window.referenceTime !== detached.window.referenceTime;
  parse({ id: manifest.id, window: manifest.window, coverage: manifest.coverage, events: [] }, detached, prior);
  const base = { ...args(detached), p_prior: prior };
  if (manifest.storageMode === "jsonb") {
   const data = await call("scoring_v7_read_source", base);
   const observation = parse(data, detached, prior);
   if (observation.id !== manifest.id || canonicalJson(observation.coverage) !== canonicalJson(manifest.coverage) ||
     observation.events.length !== manifest.eventCount) throw new Error();
   for (let index = 0; index < observation.events.length; index += 500) yield observation.events.slice(index, index + 500);
   return;
  }
  const digest = createHash("sha256");
  let afterKey: string | null = null;
  let count = 0;
  while (true) {
   const data = await call("scoring_v7_read_source_page", { ...base, p_observation: manifest.id,
    p_generation: manifest.eventGenerationId, p_after_key: afterKey, p_limit: 500 });
   const rows = pageSchema.parse(data);
   const page: NormalizedEngineeringEvent[] = [];
   for (const row of rows) {
    if (row.eventKey !== engineeringEventKey(row.event) ||
      (afterKey !== null && Buffer.compare(Buffer.from(row.eventKey), Buffer.from(afterKey)) <= 0)) throw new Error();
    if (count > 0) digest.update("\n");
    digest.update(row.eventKey);
    afterKey = row.eventKey;
    page.push(row.event as NormalizedEngineeringEvent);
    count++;
    if (count > manifest.eventCount) throw new Error();
   }
   parse({ id: manifest.id, window: manifest.window, coverage: manifest.coverage, events: page }, detached, prior);
   if (page.length) yield page;
   if (rows.length < 500) break;
  }
  if (count !== manifest.eventCount || digest.digest("hex") !== manifest.eventKeysSha256) throw new Error();
 } catch { throw new Error("Source storage unavailable"); }
}
