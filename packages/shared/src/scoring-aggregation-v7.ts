import {
  observed, unknown, type EngineeringEvidenceInput, type EvidenceReasonCode,
  type NormalizedEngineeringEvent, type Observation, type RepositoryIdentity,
  type SourceIdentity, type EventMeasurements,
} from "./scoring-evidence";
import { createScoringWindow, isWithinScoringWindow, scoringDates, scoringInstant, type ScoringWindow } from "./scoring-window";
import { median } from "./stats-aggregation";
import { MICRO_PR_LINE_THRESHOLD } from "./constants";

/** Diagnostics retain their own measured sample; none is a core score input. */
export interface MeasuredRatio {
  readonly numerator: number;
  readonly denominator: number;
  readonly unknownCount: number;
  readonly value: number | null;
}
export interface AcceptedWorkObservation {
  readonly workItemId: string;
  readonly canonicalProjectId: string;
  readonly acceptedAt: string;
  readonly acceptedEventId: string;
  readonly evidenceReferenceIds: readonly string[];
}
export interface EngineeringAggregation {
  readonly schemaVersion: "v7";
  readonly window: ScoringWindow;
  readonly scope: EngineeringEvidenceInput["scope"];
  /** Dated, attributable observations; presence does not alone establish a practice. */
  readonly events: readonly NormalizedEngineeringEvent[];
  readonly assessments: EngineeringEvidenceInput["assessments"];
  readonly acceptedWork: readonly AcceptedWorkObservation[];
  readonly excludedEvents: readonly { readonly eventId: string; readonly reason: EvidenceReasonCode }[];
  readonly limitations: readonly EvidenceReasonCode[];
  /** All observed events, explicitly diagnostic. S09 builds the qualifying core calendar. */
  readonly observedEventCalendar: readonly { readonly date: string; readonly count: number }[];
  readonly diagnostics: {
    readonly descriptionRate: MeasuredRatio;
    readonly issueLinkageRate: MeasuredRatio;
    readonly featureBranchRate: MeasuredRatio;
    readonly microChangeRate: MeasuredRatio;
    readonly documentationOnlyRate: MeasuredRatio;
    readonly leadTimeHours: { readonly observations: readonly number[]; readonly unknownCount: number; readonly median: number | null };
    readonly authoredCommits: number;
    readonly authoredCommitsByRepository: Readonly<Record<string, number>>;
    readonly topRepositoryCommitShare: number | null;
    readonly maxAuthoredCommitsInTenMinutes: number;
  };
}

/** Stable private ordering only; not the public receipt serialization/hashing API. */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b, "en")).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
  return JSON.stringify(value);
}
function unique<T>(values: readonly T[]): T[] {
  return [...new Map(values.map(value => [stable(value), value])).entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, value]) => value);
}
export function evidenceSourceKey(source: SourceIdentity): string {
  return JSON.stringify([source.provider, source.host.toLowerCase(), source.subjectId]);
}
export function evidenceRepositoryKey(repository: RepositoryIdentity): string {
  // Repository identity belongs to the provider/host, not to the linked account.
  return JSON.stringify([repository.provider, repository.host.toLowerCase(), repository.repositoryId]);
}
export function engineeringEventKey(event: NormalizedEngineeringEvent): string {
  return JSON.stringify([evidenceRepositoryKey(event), event.actorId, event.kind, event.eventId]);
}
function assertWindow(window: ScoringWindow): void {
  if (stable(window) !== stable(createScoringWindow(window.referenceTime))) throw new RangeError("Inconsistent scoring window");
}

/** Union sufficient evidence before computing statistics. Associative, commutative, idempotent. */
export function mergeEngineeringEvidence(...inputs: readonly EngineeringEvidenceInput[]): EngineeringEvidenceInput {
  const first = inputs[0];
  if (!first) throw new RangeError("At least one evidence input is required");
  assertWindow(first.window);
  for (const input of inputs) {
    if (input.schemaVersion !== "v7" || stable(input.window) !== stable(first.window)) throw new RangeError("Cannot merge different scoring windows or versions");
    for (const source of input.scope.sources) if (stable(source.window) !== stable(first.window)) throw new RangeError("Source scoring window differs from request");
  }
  return {
    schemaVersion: "v7", window: first.window,
    scope: {
      sources: unique(inputs.flatMap(input => [...input.scope.sources])),
      excludedSources: unique(inputs.flatMap(input => [...input.scope.excludedSources])),
      ledgerRevisionIds: unique(inputs.flatMap(input => [...input.scope.ledgerRevisionIds])),
    },
    events: unique(inputs.flatMap(input => [...input.events])),
    repositoryAliases: unique(inputs.flatMap(input => [...input.repositoryAliases])),
    equivalentWorkItems: unique(inputs.flatMap(input => [...input.equivalentWorkItems])),
    assessments: unique(inputs.flatMap(input => [...input.assessments])),
  };
}

/** Versioned v7 complete-path classifier; an empty list cannot prove documentation-only. */
export function classifyDocumentationFiles(files: Observation<readonly string[]>): Observation<boolean> {
  if (files.status === "unknown") return files;
  if (files.coverage !== "complete" || files.value.length === 0) return unknown("partial", "partial_files");
  const documentation = files.value.every(path => {
    const segments = path.replaceAll("\\", "/").split("/");
    const basename = segments.at(-1) ?? "";
    if (!basename || segments.some(segment => !segment || segment === "." || segment === "..")) return false;
    return segments.slice(0, -1).some(segment => segment.toLowerCase() === "docs") ||
      /\.(md|mdx|rst|adoc|txt)$/i.test(basename) ||
      /^(README|CHANGELOG|LICENSE|CONTRIBUTING|CODE_OF_CONDUCT|SECURITY)(\.(md|mdx|rst|adoc|txt))?$/i.test(basename);
  });
  return observed(documentation, "complete", files.provenance);
}

function mergeObservation<T>(observations: readonly Observation<T>[]): Observation<T> {
  const known = observations.filter(item => item.status === "observed");
  if (!known.length) return unique(observations)[0]!;
  const complete = known.filter(item => item.coverage === "complete");
  const candidates = complete.length ? complete : known;
  // An explicit complete file list supersedes its partial prefix; conflicting complete facts do not.
  if (unique(candidates.map(item => item.value)).length > 1) return unknown("partial", "source_error");
  return unique(candidates)[0]!;
}
function normalizeEvent(event: NormalizedEngineeringEvent, project: string, workItemId: string): NormalizedEngineeringEvent {
  const files = event.measurements.changedFiles;
  return { ...event, host: event.host.toLowerCase(), canonicalProjectId: project, workItemId,
    occurredAt: scoringInstant(event.occurredAt).toISOString(),
    dataThrough: scoringInstant(event.dataThrough).toISOString(),
    artifactReferenceIds: unique(event.artifactReferenceIds),
    categories: unique(event.categories.map(category => ({ ...category, evidenceReferenceIds: unique(category.evidenceReferenceIds) }))),
    measurements: { ...event.measurements, changedFiles: files.status === "observed" ? { ...files, value: unique(files.value) } : files },
    acceptance: event.acceptance.status === "observed" ? { ...event.acceptance, value: { ...event.acceptance.value, acceptedAt: scoringInstant(event.acceptance.value.acceptedAt).toISOString() } } : event.acceptance,
  };
}
function addDocumentationCategory(event: NormalizedEngineeringEvent): NormalizedEngineeringEvent {
  const docs = classifyDocumentationFiles(event.measurements.changedFiles);
  if (event.kind !== "accepted_change" || event.provenance === "self_reported" || !event.artifactReferenceIds.length ||
    docs.status !== "observed" || !docs.value || docs.provenance === "self_reported" ||
    event.categories.some(category => category.category === "documentation_design")) return event;
  return { ...event, categories: [...event.categories, { category: "documentation_design", evidenceReferenceIds: event.artifactReferenceIds }] };
}
function poolDuplicates(events: readonly NormalizedEngineeringEvent[]): NormalizedEngineeringEvent[] {
  const groups = new Map<string, NormalizedEngineeringEvent[]>();
  for (const event of events) {
    const key = engineeringEventKey(event);
    const group = groups.get(key) ?? [];
    group.push(event); groups.set(key, group);
  }
  return [...groups.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, group]) => {
    const first = group[0]!;
    const immutable = (event: NormalizedEngineeringEvent) => [event.occurredAt, event.canonicalProjectId, event.workItemId, event.artifactRevision, event.attribution, event.provenance];
    if (unique(group.map(immutable)).length !== 1) throw new RangeError("Conflicting immutable engineering event identity");
    const measurements = poolMeasurements(group);
    return { ...first, dataThrough: group.map(event => event.dataThrough).sort().at(-1)!,
      artifactReferenceIds: unique(group.flatMap(event => [...event.artifactReferenceIds])),
      categories: unique(group.flatMap(event => [...event.categories])), measurements,
      acceptance: mergeObservation(group.map(event => event.acceptance)),
    };
  });
}
function poolMeasurements(group: readonly NormalizedEngineeringEvent[]): EventMeasurements {
  return Object.fromEntries((Object.keys(group[0]!.measurements) as (keyof EventMeasurements)[])
    .map(key => [key, mergeObservation<unknown>(group.map(event => event.measurements[key]))])) as unknown as EventMeasurements;
}
function diagnosticWork(events: readonly NormalizedEngineeringEvent[]): NormalizedEngineeringEvent[] {
  const groups = new Map<string, NormalizedEngineeringEvent[]>();
  for (const event of events) {
    const group = groups.get(event.workItemId) ?? [];
    group.push(event); groups.set(event.workItemId, group);
  }
  return [...groups.values()].map(group => ({ ...group[0]!, measurements: poolMeasurements(group) }));
}
function ratio(observations: readonly Observation<boolean>[]): MeasuredRatio {
  const measured = observations.filter(item => item.status === "observed");
  const numerator = measured.filter(item => item.value).length;
  return { numerator, denominator: measured.length, unknownCount: observations.length - measured.length, value: measured.length ? numerator / measured.length : null };
}
function finiteMeasurement(value: Observation<number>): Observation<number> {
  return value.status === "observed" && (!Number.isFinite(value.value) || value.value < 0) ? unknown("partial", "source_error") : value;
}
function microChange(event: NormalizedEngineeringEvent): Observation<boolean> {
  const additions = finiteMeasurement(event.measurements.additions);
  const deletions = finiteMeasurement(event.measurements.deletions);
  if (additions.status === "unknown") return additions;
  if (deletions.status === "unknown") return deletions;
  if (additions.coverage !== "complete" || deletions.coverage !== "complete" || additions.provenance !== deletions.provenance ||
    !Number.isSafeInteger(additions.value) || !Number.isSafeInteger(deletions.value)) return unknown("partial", "insufficient_evidence");
  return observed(additions.value + deletions.value < MICRO_PR_LINE_THRESHOLD, "complete", additions.provenance);
}
function burst(timestamps: readonly number[]): number {
  let first = 0; let max = 0;
  for (let last = 0; last < timestamps.length; last++) {
    while (timestamps[last]! - timestamps[first]! > 600_000) first++;
    max = Math.max(max, last - first + 1);
  }
  return max;
}

/** Connected equivalence links are transitive; conflicting accepted-event selections need correction. */
function resolveWorkEquivalence(input: EngineeringEvidenceInput) {
  const parents = new Map<string, string>();
  function root(id: string): string {
    const parent = parents.get(id);
    if (!parent || parent === id) { parents.set(id, id); return id; }
    const result = root(parent); parents.set(id, result); return result;
  }
  for (const link of input.equivalentWorkItems) {
    if (!link.evidenceReferenceIds.length || !link.workItemIds.length || !link.canonicalWorkItemId || !link.acceptedEventId) {
      throw new RangeError("Work equivalence requires evidence and explicit canonical identities");
    }
    for (const id of link.workItemIds) {
      const roots = [root(id), root(link.canonicalWorkItemId)].sort();
      parents.set(roots[1]!, roots[0]!);
    }
  }
  const groups = new Map<string, EngineeringEvidenceInput["equivalentWorkItems"][number][]>();
  for (const link of input.equivalentWorkItems) {
    const key = root(link.canonicalWorkItemId);
    const group = groups.get(key) ?? []; group.push(link); groups.set(key, group);
  }
  const workAliases = new Map<string, string>();
  const selectedAcceptance = new Map<string, string>();
  for (const group of groups.values()) {
    const canonical = group.map(link => link.canonicalWorkItemId).sort()[0]!;
    const acceptedIds = unique(group.map(link => link.acceptedEventId));
    if (acceptedIds.length !== 1) throw new RangeError("Conflicting accepted event selection");
    for (const link of group) for (const id of [...link.workItemIds, link.canonicalWorkItemId]) workAliases.set(id, canonical);
    selectedAcceptance.set(canonical, acceptedIds[0]!);
  }
  return { workAliases, selectedAcceptance };
}

/** Aggregate private normalized evidence; legacy scalar StatsData cannot be promoted to v7. */
export function aggregateEngineeringEvidence(raw: EngineeringEvidenceInput): EngineeringAggregation {
  const input = mergeEngineeringEvidence(raw);
  const limitations = new Set<EvidenceReasonCode>(input.scope.sources.flatMap(source => [...source.reasonCodes]));
  const excludedEvents: { eventId: string; reason: EvidenceReasonCode }[] = [];
  const aliases = new Map<string, string>();
  for (const alias of input.repositoryAliases) {
    if (!alias.evidenceReferenceIds.length || scoringInstant(alias.verifiedAt) > scoringInstant(input.window.referenceTime)) throw new RangeError("Repository alias needs contemporaneous verification evidence");
    for (const repository of alias.repositories) {
      const key = evidenceRepositoryKey(repository);
      if (aliases.has(key) && aliases.get(key) !== alias.canonicalProjectId) throw new RangeError("Conflicting verified repository aliases");
      aliases.set(key, alias.canonicalProjectId);
    }
  }
  const { workAliases, selectedAcceptance } = resolveWorkEquivalence(input);
  const sources = new Map<string, Set<string>>();
  for (const source of input.scope.sources) {
    const key = evidenceSourceKey(source.source);
    sources.set(key, new Set([...(sources.get(key) ?? []), ...source.repositoryIds]));
  }
  const allScoped: NormalizedEngineeringEvent[] = [];
  for (const event of input.events) {
    const reason = !sources.get(evidenceSourceKey(event))?.has(event.repositoryId) ? "not_accessible" : event.actorId !== event.subjectId || event.attribution === "unclear" ? "attribution_unknown" : null;
    if (reason) { excludedEvents.push({ eventId: event.eventId, reason }); limitations.add(reason); continue; }
    allScoped.push(normalizeEvent(event, aliases.get(evidenceRepositoryKey(event)) ?? evidenceRepositoryKey(event), workAliases.get(event.workItemId) ?? event.workItemId));
  }
  const pooled = poolDuplicates(allScoped).map(addDocumentationCategory);
  const events = pooled.filter(event => {
    if (isWithinScoringWindow(event.occurredAt, input.window)) return true;
    excludedEvents.push({ eventId: event.eventId, reason: "outside_window" }); return false;
  });
  const candidates = new Map<string, NormalizedEngineeringEvent[]>();
  for (const event of pooled) {
    if (event.acceptance.status !== "observed" || event.acceptance.coverage !== "complete" || event.acceptance.provenance === "self_reported" ||
      event.provenance === "self_reported" || !event.artifactReferenceIds.length || event.coverage === "legacy") continue;
    const group = candidates.get(event.workItemId) ?? [];
    group.push(event); candidates.set(event.workItemId, group);
  }
  const acceptedWork: AcceptedWorkObservation[] = [];
  for (const [workItemId, group] of candidates) {
    const selection = selectedAcceptance.get(workItemId);
    const chosen = selection ? group.filter(event => event.eventId === selection) : group;
    const acceptances = unique(chosen.map(event => event.acceptance.status === "observed" ? [event.canonicalProjectId, event.acceptance.value.acceptedAt, event.acceptance.value.acceptedResultId] : []));
    if (acceptances.length !== 1) { limitations.add("acceptance_time_unknown"); continue; }
    const first = chosen[0]!;
    if (first.acceptance.status !== "observed") continue;
    const acceptedAt = first.acceptance.value.acceptedAt;
    if (!isWithinScoringWindow(acceptedAt, input.window)) continue;
    if (first.occurredAt !== acceptedAt) { limitations.add("acceptance_time_unknown"); continue; }
    acceptedWork.push({ workItemId, canonicalProjectId: first.canonicalProjectId, acceptedAt, acceptedEventId: first.eventId, evidenceReferenceIds: unique(group.flatMap(event => [...event.artifactReferenceIds])) });
  }
  const prs = diagnosticWork(events.filter(event => event.kind === "accepted_change"));
  const leads = prs.map(event => finiteMeasurement(event.measurements.leadTimeHours));
  const leadTimes = leads.filter(item => item.status === "observed").map(item => item.value).sort((a, b) => a - b);
  const commits = [...new Map(events.filter(event => event.kind === "authored_commit")
    .map(event => [JSON.stringify([event.canonicalProjectId, event.workItemId, event.artifactRevision]), event])).values()];
  const repositoryCounts = new Map<string, number>();
  for (const commit of commits) repositoryCounts.set(commit.canonicalProjectId, (repositoryCounts.get(commit.canonicalProjectId) ?? 0) + 1);
  const calendar = new Map(scoringDates(input.window).map(date => [date, 0]));
  for (const event of events) {
    const date = event.occurredAt.slice(0, 10);
    calendar.set(date, calendar.get(date)! + 1);
    for (const field of [...Object.values(event.measurements), event.acceptance]) if (field.status === "unknown") limitations.add(field.reasonCode);
  }
  return {
    schemaVersion: "v7", window: input.window, scope: input.scope, events,
    assessments: input.assessments.filter(assessment => scoringInstant(assessment.recordedAt) <= scoringInstant(input.window.referenceTime) && scoringInstant(assessment.assessedAt) <= scoringInstant(input.window.referenceTime))
      .map(assessment => ({ ...assessment, workItemId: workAliases.get(assessment.workItemId) ?? assessment.workItemId })),
    acceptedWork: unique(acceptedWork), excludedEvents: unique(excludedEvents), limitations: [...limitations].sort(),
    observedEventCalendar: [...calendar].map(([date, count]) => ({ date, count })),
    diagnostics: {
      descriptionRate: ratio(prs.map(event => event.measurements.hasDescription)),
      issueLinkageRate: ratio(prs.map(event => event.measurements.hasIssueLink)),
      featureBranchRate: ratio(prs.map(event => event.measurements.usesFeatureBranch)),
      microChangeRate: ratio(prs.map(microChange)),
      documentationOnlyRate: ratio(prs.map(event => classifyDocumentationFiles(event.measurements.changedFiles))),
      leadTimeHours: { observations: leadTimes, unknownCount: leads.length - leadTimes.length, median: median(leadTimes) ?? null },
      authoredCommits: commits.length, authoredCommitsByRepository: Object.fromEntries(repositoryCounts),
      topRepositoryCommitShare: commits.length ? Math.max(...repositoryCounts.values()) / commits.length : null,
      maxAuthoredCommitsInTenMinutes: burst(commits.map(event => scoringInstant(event.occurredAt).getTime()).sort((a, b) => a - b)),
    },
  };
}
