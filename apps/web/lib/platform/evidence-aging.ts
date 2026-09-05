import {
  aggregateEngineeringEvidence, createScoringWindow, isWithinScoringWindow, observed, scoringInstant, unknown,
  type AcceptanceMethod, type EngineeringEventKind, type EngineeringEvidenceInput, type NormalizedEngineeringEvent,
  type Observation, type ObservationPeriod, type ScoringWindow, type SourceCoverage,
} from "@chapa/shared";
import { isValidHandle, isValidEmuHandle } from "@/lib/validation";

type Forge = "github" | "gitlab" | "bitbucket" | "codeberg";
export interface SupplementalEventV2 {
  readonly eventId: string;
  readonly repositoryId: string;
  readonly actorId: string;
  readonly workItemId: string;
  readonly kind: EngineeringEventKind;
  readonly occurredAt: string;
  readonly artifactRevision: string;
  readonly files?: readonly string[];
  readonly additions?: number;
  readonly deletions?: number;
  readonly leadTimeHours?: number;
  readonly hasDescription?: boolean;
  readonly hasIssueLink?: boolean;
  readonly usesFeatureBranch?: boolean;
  readonly acceptance?: { readonly method: AcceptanceMethod; readonly acceptedAt: string; readonly acceptedResultId: string };
}
/** Client imports are declarations. This protocol contains no authorization or rubric verdict fields. */
export interface SupplementalEvidenceV2 {
  readonly schemaVersion: "supplemental-v2";
  readonly targetHandle: string;
  readonly source: { readonly provider: Forge; readonly host: string; readonly subjectId: string; readonly handle: string };
  readonly observationPeriod: ObservationPeriod;
  readonly observedThrough: string;
  readonly events: readonly SupplementalEventV2[];
}
export interface StoredSupplementalEvidenceV2 {
  readonly uploadId: string;
  readonly uploadedAt: string;
  readonly value: SupplementalEvidenceV2;
}
const kinds = ["accepted_change", "authored_commit", "review", "issue_work", "documentation_design", "maintenance", "practice_evidence"] as const;
export class SupplementalEvidenceConflict extends RangeError {
  constructor() { super("Conflicting immutable supplemental event"); this.name = "SupplementalEvidenceConflict"; }
}
function fail(): never { throw new RangeError("Invalid supplemental evidence v2"); }
function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) fail();
  return value as Record<string, unknown>;
}
function string(value: unknown, maximum = 256): string {
  if (typeof value !== "string" || !value.trim() || value.length > maximum || /[\u0000-\u001f\u007f]/.test(value)) fail();
  return value;
}
function instant(value: unknown): number { return scoringInstant(string(value, 40)).getTime(); }
function optionalCount(value: unknown, maximum: number): void {
  if (value !== undefined && (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > maximum)) fail();
}
/** Strict bounded validation runs on writes and cached/durable reads. Owner comes from authenticated context. */
export function parseSupplementalEvidenceV2(value: unknown, owner: string, referenceTime: string): SupplementalEvidenceV2 {
  const reference = instant(referenceTime);
  const root = object(value, ["schemaVersion", "targetHandle", "source", "observationPeriod", "observedThrough", "events"]);
  if (root.schemaVersion !== "supplemental-v2" || typeof root.targetHandle !== "string" || !isValidHandle(root.targetHandle) || root.targetHandle.toLowerCase() !== owner.toLowerCase()) fail();
  const source = object(root.source, ["provider", "host", "subjectId", "handle"]);
  if (!["github", "gitlab", "bitbucket", "codeberg"].includes(string(source.provider)) ||
    !/^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/.test(string(source.host)) ||
    (source.provider === "github" ? !isValidEmuHandle(string(source.handle)) : !string(source.handle, 100)) || (source.provider === "github" && String(source.handle).toLowerCase() === owner.toLowerCase())) fail();
  const subject = string(source.subjectId);
  const period = object(root.observationPeriod, ["startInclusive", "endExclusive"]);
  const start = instant(period.startInclusive), end = instant(period.endExclusive), through = instant(root.observedThrough);
  if (start >= end || end > reference || through < start || through > end || through > reference) fail();
  if (!Array.isArray(root.events) || root.events.length > 1000) fail();
  const immutableEvents = new Map<string, string>();
  for (const raw of root.events) {
    const event = object(raw, ["eventId", "repositoryId", "actorId", "workItemId", "kind", "occurredAt", "artifactRevision", "files", "additions", "deletions", "leadTimeHours", "hasDescription", "hasIssueLink", "usesFeatureBranch", "acceptance"]);
    for (const field of ["eventId", "repositoryId", "workItemId", "artifactRevision"]) string(event[field]);
    if (event.actorId !== subject || !kinds.some(kind => kind === event.kind)) fail();
    const occurred = instant(event.occurredAt);
    if (occurred < start || occurred >= end || occurred > through) fail();
    // Same identity as shared aggregation, scoped to this declared source.
    // Measurements and optional acceptance observations remain independently mergeable.
    const key = JSON.stringify([event.repositoryId, event.actorId, event.kind, event.eventId]);
    const facts = JSON.stringify([event.workItemId, occurred, event.artifactRevision]);
    const prior = immutableEvents.get(key);
    if (prior !== undefined && prior !== facts) throw new SupplementalEvidenceConflict();
    immutableEvents.set(key, facts);
    optionalCount(event.additions, 10_000_000); optionalCount(event.deletions, 10_000_000);
    if (event.leadTimeHours !== undefined && (typeof event.leadTimeHours !== "number" || !Number.isFinite(event.leadTimeHours) || event.leadTimeHours < 0 || event.leadTimeHours > 1_000_000)) fail();
    if (event.files !== undefined) {
      if (!Array.isArray(event.files) || event.files.length > 1000) fail();
      for (const file of event.files) string(file, 1024);
    }
    for (const field of ["hasDescription", "hasIssueLink", "usesFeatureBranch"]) if (event[field] !== undefined && typeof event[field] !== "boolean") fail();
    if (event.acceptance !== undefined) {
      const acceptance = object(event.acceptance, ["method", "acceptedAt", "acceptedResultId"]);
      if (!["merged_change", "default_branch_first_reachability", "linked_issue_result", "accepted_artifact"].includes(string(acceptance.method)) || instant(acceptance.acceptedAt) !== occurred) fail();
      string(acceptance.acceptedResultId);
    }
  }
  // Reconstruct through JSON to prevent mutation through retained caller object references.
  return JSON.parse(JSON.stringify(value)) as SupplementalEvidenceV2;
}
function measurement<T>(value: T | undefined): Observation<T> {
  return value === undefined ? unknown("partial", "not_assessed") : observed(value, "partial", "self_reported");
}
function sourceIdentity(value: SupplementalEvidenceV2) {
  return { provider: "supplemental" as const, host: "chapa-upload", subjectId: JSON.stringify([value.source.provider, value.source.host, value.source.subjectId]) };
}
function repositoryId(value: SupplementalEvidenceV2, repository: string): string {
  return JSON.stringify([value.source.provider, value.source.host, repository]);
}
function normalize(value: SupplementalEvidenceV2, event: SupplementalEventV2): NormalizedEngineeringEvent {
  const source = sourceIdentity(value), repository = repositoryId(value, event.repositoryId);
  const work = JSON.stringify([repository, event.workItemId]);
  return {
    ...source, schemaVersion: "v7", repositoryId: repository, actorId: source.subjectId, eventId: event.eventId,
    kind: event.kind, occurredAt: event.occurredAt, dataThrough: event.occurredAt,
    canonicalProjectId: repository, workItemId: work, artifactRevision: event.artifactRevision,
    artifactReferenceIds: [], attribution: "individual", provenance: "self_reported", coverage: "partial",
    measurements: {
      changedFiles: measurement(event.files), additions: measurement(event.additions), deletions: measurement(event.deletions),
      leadTimeHours: measurement(event.leadTimeHours), hasDescription: measurement(event.hasDescription),
      hasIssueLink: measurement(event.hasIssueLink), usesFeatureBranch: measurement(event.usesFeatureBranch),
    }, categories: [], acceptance: measurement(event.acceptance),
  };
}
/** Recompute from immutable dated declarations. uploadedAt controls historical visibility, never event eligibility. */
export function ageSupplementalEvidence(records: readonly StoredSupplementalEvidenceV2[], owner: string, window: ScoringWindow): EngineeringEvidenceInput {
  const canonicalWindow = createScoringWindow(window.referenceTime);
  if ((Object.keys(canonicalWindow) as (keyof ScoringWindow)[]).some(key => canonicalWindow[key] !== window[key])) fail();
  const sources = new Map<string, SourceCoverage>();
  const events: NormalizedEngineeringEvent[] = [];
  for (const record of records) {
    if (instant(record.uploadedAt) > instant(window.referenceTime)) continue;
    const value = parseSupplementalEvidenceV2(record.value, owner, record.uploadedAt);
    const source = sourceIdentity(value), key = source.subjectId;
    const previous = sources.get(key);
    const active = value.events.filter(event => isWithinScoringWindow(event.occurredAt, window));
    events.push(...active.map(event => normalize(value, event)));
    sources.set(key, {
      source, window, dataThrough: [previous?.dataThrough, value.observedThrough].filter((date): date is string => Boolean(date)).sort((a, b) => instant(a) - instant(b)).at(-1)!,
      status: "partial", discovery: "explicit_repositories", repositoryDiscoveryComplete: false,
      repositoryIds: [...new Set([...(previous?.repositoryIds ?? []), ...active.map(event => repositoryId(value, event.repositoryId))])].sort(),
      eventKinds: Object.fromEntries(kinds.map(kind => [kind, "partial"])),
      reasonCodes: ["attribution_unknown", "alias_unresolved", "not_assessed"], unknownPeriods: [{ startInclusive: window.startInclusive, endExclusive: window.endExclusive }],
    });
  }
  const input: EngineeringEvidenceInput = { schemaVersion: "v7", window, events,
    scope: { sources: [...sources.values()].sort((a, b) => a.source.subjectId.localeCompare(b.source.subjectId)), excludedSources: [], ledgerRevisionIds: [] },
    repositoryAliases: [], equivalentWorkItems: [], assessments: [] };
  // Reuse shared immutable-identity checks and sufficient-observation pooling before any score consumer sees the union.
  const aggregated = aggregateEngineeringEvidence(input);
  return { ...input, events: [...aggregated.events].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) };
}
