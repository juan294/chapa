import "server-only";
import { z } from "zod";
import { canonicalJson, createScoringWindow, scoringInstant } from "@chapa/shared";
import type { ScoringWindow, SourceIdentity } from "@chapa/shared";
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
  const data = await call("scoring_v7_read_source", { ...args(detached), p_prior: prior });
  return data === null ? null : parse(data, detached, prior);
 } catch { throw new Error("Source storage unavailable"); }
}
