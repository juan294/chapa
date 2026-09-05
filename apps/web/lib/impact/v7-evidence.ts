import {
  aggregateEngineeringEvidence, classifyDocumentationFiles, countBounds, createCoreScoringInputs,
  evidenceRepositoryKey, evidenceSourceKey, isWithinScoringWindow, scoringDates, scoringInstant, utcIsoWeek, SCORING_V7_POLICY,
  type CoreScoringInputs, type EngineeringAggregation, type EngineeringEvidenceInput, type EngineeringEventKind,
  type EvidenceReasonCode, type NormalizedEngineeringEvent, type PrivateCriterionAssessment, type QualityCriterion,
  type ScoringWindow, type SourceCoverage, type WorkCategory,
} from "@chapa/shared";

const criteria: readonly QualityCriterion[] = ["rationale", "verification", "review_or_correction", "outcome_followup"];
const categories: readonly WorkCategory[] = ["implementation", "verification_review", "documentation_design", "maintenance_support"];
const deliveryKinds: readonly EngineeringEventKind[] = ["accepted_change", "authored_commit", "issue_work", "documentation_design", "maintenance"];
const eventKinds: readonly EngineeringEventKind[] = [...deliveryKinds, "review", "practice_evidence"];
type Verdict = "accepted" | "rejected" | "unknown";
interface CriterionVerdict { readonly verdict: Verdict; readonly references: ReadonlySet<string> }
type WorkVerdicts = Map<string, Map<QualityCriterion, CriterionVerdict>>;
export interface ObservedCoreCounts {
  readonly deliveryUnits: number;
  readonly quality: Readonly<Record<QualityCriterion, number>>;
  readonly activeIsoWeeks: number;
  readonly eligibleProjects: number;
  readonly eligibleCategories: number;
}
export interface CoreEvidenceV7 {
  readonly inputs: CoreScoringInputs;
  readonly aggregation: EngineeringAggregation;
  /** Actual observed minima before saturation; score inputs are explicitly capped counts. */
  readonly observedCounts: ObservedCoreCounts;
  readonly activityCalendar: readonly { readonly date: string; readonly count: number }[];
  readonly limitations: readonly EvidenceReasonCode[];
}
function latestAssessments(records: readonly PrivateCriterionAssessment[]): PrivateCriterionAssessment[] {
  const groups = new Map<string, Map<number, PrivateCriterionAssessment>>();
  for (const record of records) {
    const revisions = groups.get(record.assessmentId) ?? new Map<number, PrivateCriterionAssessment>();
    const previous = revisions.get(record.revision);
    if (previous && JSON.stringify(previous) !== JSON.stringify(record)) throw new RangeError("Conflicting assessment revision");
    revisions.set(record.revision, record); groups.set(record.assessmentId, revisions);
  }
  return [...groups.values()].map(revisions => {
    const sorted = [...revisions.values()].sort((a, b) => a.revision - b.revision);
    for (const [index, record] of sorted.entries()) {
      const previous = sorted[index - 1];
      if (record.revision !== index + 1 || record.supersedesRevisionId !== (previous?.revisionId ?? null) ||
        (index === 0 ? record.action !== "create" : record.action === "create") ||
        (previous && (record.workItemId !== previous.workItemId || record.criterion !== previous.criterion ||
          scoringInstant(record.recordedAt) < scoringInstant(previous.recordedAt)))) throw new RangeError("Invalid assessment revision chain");
    }
    return sorted.at(-1)!;
  });
}
function workVerdicts(aggregation: EngineeringAggregation): WorkVerdicts {
  const registered = new Set(aggregation.scope.ledgerRevisionIds);
  const groups = new Map<string, PrivateCriterionAssessment[]>();
  for (const record of latestAssessments(aggregation.assessments)) {
    if (!criteria.includes(record.criterion as QualityCriterion)) continue;
    const key = JSON.stringify([record.workItemId, record.criterion, record.claimRevisionId]);
    const group = groups.get(key) ?? []; group.push(record); groups.set(key, group);
  }
  const claimVerdicts = new Map<string, { work: string; criterion: QualityCriterion; verdicts: CriterionVerdict[] }>();
  for (const records of groups.values()) {
    const first = records[0]!;
    const valid = records.filter(record => registered.has(record.claimRevisionId) && record.rubricVersion === "v7" &&
      record.provenance !== "self_reported" && record.rationale.trim() && record.evaluator.id && record.evaluator.version &&
      record.evidenceReferenceIds.length && record.action !== "retract" &&
      scoringInstant(record.assessedAt) <= scoringInstant(record.recordedAt));
    const accepted = valid.filter(record => record.status === "accepted" && record.reasonCode === "criterion_demonstrated");
    const rejected = valid.filter(record => record.status === "rejected" && record.reasonCode === "criterion_not_demonstrated");
    const verdict: Verdict = accepted.length && !rejected.length ? "accepted" : rejected.length && !accepted.length ? "rejected" : "unknown";
    const key = JSON.stringify([first.workItemId, first.criterion]);
    const group = claimVerdicts.get(key) ?? { work: first.workItemId, criterion: first.criterion as QualityCriterion, verdicts: [] };
    const supporting = verdict === "accepted" ? accepted : verdict === "rejected" ? rejected : [];
    group.verdicts.push({ verdict, references: new Set(supporting.flatMap(record => [...record.evidenceReferenceIds])) }); claimVerdicts.set(key, group);
  }
  const result: WorkVerdicts = new Map();
  for (const group of claimVerdicts.values()) {
    const accepted = group.verdicts.filter(item => item.verdict === "accepted");
    const verdict: Verdict = accepted.length ? "accepted" : group.verdicts.every(item => item.verdict === "rejected") ? "rejected" : "unknown";
    const values = result.get(group.work) ?? new Map<QualityCriterion, CriterionVerdict>();
    values.set(group.criterion, { verdict, references: new Set(group.verdicts.filter(item => item.verdict === verdict).flatMap(item => [...item.references])) }); result.set(group.work, values);
  }
  return result;
}
function addDate(map: Map<string, Set<string>>, key: string, date: string): void {
  const values = map.get(key) ?? new Set<string>(); values.add(date); map.set(key, values);
}
function eligibleCount(map: Map<string, Set<string>>): number {
  return [...map.values()].filter(dates => dates.size >= SCORING_V7_POLICY.breadthMinimumDates).length;
}
function acceptedKind(event: NormalizedEngineeringEvent): boolean {
  if (event.acceptance.status !== "observed") return false;
  const method = event.acceptance.value.method;
  return (event.kind === "accepted_change" && (method === "merged_change" || method === "linked_issue_result")) ||
    (event.kind === "authored_commit" && method === "default_branch_first_reachability") ||
    (event.kind === "issue_work" && method === "linked_issue_result") ||
    ((event.kind === "documentation_design" || event.kind === "maintenance") && method === "accepted_artifact");
}
function hasTrustedAcceptanceDate(event: NormalizedEngineeringEvent): boolean {
  return acceptedKind(event) && event.acceptance.status === "observed" && event.acceptance.coverage === "complete" &&
    event.acceptance.provenance !== "self_reported" && event.provenance !== "self_reported" && event.coverage !== "legacy" && event.artifactReferenceIds.length > 0;
}
function supportsVerdict(event: NormalizedEngineeringEvent, verdict: CriterionVerdict | undefined): boolean {
  return Boolean(verdict && event.artifactReferenceIds.some(ref => verdict.references.has(ref)));
}
function eventsByWork(events: readonly NormalizedEngineeringEvent[]): Map<string, NormalizedEngineeringEvent[]> {
  const result = new Map<string, NormalizedEngineeringEvent[]>();
  for (const event of events) {
    const group = result.get(event.workItemId) ?? []; group.push(event); result.set(event.workItemId, group);
  }
  return result;
}
function supportedCategories(event: NormalizedEngineeringEvent, verdicts: WorkVerdicts): Set<WorkCategory> {
  const result = new Set<WorkCategory>();
  if (event.provenance !== "self_reported" && event.coverage !== "legacy" && event.artifactReferenceIds.length) {
    const support = new Map<WorkCategory, Set<string>>();
    for (const category of event.categories) for (const reference of category.evidenceReferenceIds) {
      const references = support.get(category.category) ?? new Set<string>(); references.add(reference); support.set(category.category, references);
    }
    const docs = classifyDocumentationFiles(event.measurements.changedFiles);
    if (event.kind === "accepted_change" && docs.status === "observed" && docs.provenance !== "self_reported") {
      const category = docs.value ? "documentation_design" : "implementation";
      const refs = support.get(category) ?? new Set<string>(); event.artifactReferenceIds.forEach(ref => refs.add(ref)); support.set(category, refs);
    }
    for (const [category, references] of support) {
      if ([...references].some(reference => [...support].every(([other, refs]) => other === category || !refs.has(reference)))) result.add(category);
    }
  }
  for (const criterion of ["verification", "review_or_correction"] as const) {
    const value = verdicts.get(event.workItemId)?.get(criterion);
    if (value?.verdict === "accepted" && event.artifactReferenceIds.some(ref => value.references.has(ref))) result.add("verification_review");
  }
  return result;
}
function incompleteDates(source: SourceCoverage, window: ScoringWindow): Set<string> {
  const periods = [...source.unknownPeriods];
  const reference = scoringInstant(window.referenceTime).getTime();
  if (source.dataThrough && scoringInstant(source.dataThrough).getTime() < reference) periods.push({ startInclusive: source.dataThrough, endExclusive: window.endExclusive });
  if (!periods.length) periods.push({ startInclusive: window.startInclusive, endExclusive: window.endExclusive });
  const instants = periods.map(period => {
    const start = scoringInstant(period.startInclusive).getTime(); const end = scoringInstant(period.endExclusive).getTime();
    if (end <= start) throw new RangeError("Invalid unknown observation period");
    return { start, end };
  });
  return new Set(scoringDates(window).filter(date => {
    const start = scoringInstant(`${date}T00:00:00Z`).getTime();
    return instants.some(period => start < period.end && start + 86_400_000 > period.start && period.start <= reference);
  }));
}
function scoringEvents(aggregation: EngineeringAggregation): readonly NormalizedEngineeringEvent[] {
  const selections = new Map(aggregation.acceptanceSelections.map(selection => [selection.workItemId, selection.acceptedEventId]));
  // A mirrored acceptance cannot create another activity date, including after
  // its canonical acceptance has aged out. Independently dated reviews and
  // practice evidence remain eligible by their own artifact support.
  return aggregation.events.filter(event => {
    const selection = selections.get(event.workItemId);
    return !selection || selection === event.eventId || (event.kind !== "accepted_change" && !acceptedKind(event));
  });
}

/** Derive bounds in component units. Unknown item counts are never added directly to weeks/projects/categories. */
export function deriveCoreEvidenceV7(input: EngineeringEvidenceInput): CoreEvidenceV7 {
  const aggregation = aggregateEngineeringEvidence(input);
  const possible = input.events.some(event => event.attribution === "unclear") ? aggregateEngineeringEvidence({ ...input,
    events: input.events.map(event => event.attribution === "unclear" ? { ...event, attribution: "team_participation" } : event),
  }) : aggregation;
  const verdicts = workVerdicts(aggregation);
  const unresolvedSources = new Set(aggregation.scope.sources.filter(source => source.reasonCodes.includes("alias_unresolved")).map(source => evidenceSourceKey(source.source)));
  // Source-scoped identity uncertainty cannot establish additional independent
  // work. Retain it in possible evidence until the relationship is resolved.
  const knownEvents = scoringEvents(aggregation).filter(event => !unresolvedSources.has(evidenceSourceKey(event)));
  const possibleEvents = scoringEvents(possible);
  const dates = scoringDates(input.window);
  const activity = new Map(dates.map(date => [date, new Set<string>()]));
  const projectDates = new Map<string, Set<string>>(); const possibleProjectDates = new Map<string, Set<string>>();
  const categoryDates = new Map<string, Set<string>>(); const possibleCategoryDates = new Map<string, Set<string>>();
  const knownDelivery = new Set<string>(); const possibleDelivery = new Set<string>(); const unknownDeliveryItems = new Set<string>();
  const missingDelivery = new Set<string>();
  const pendingProjectDates = new Map<string, Set<string>>(); const pendingCategoryDates = new Map<string, Set<string>>();
  const flexibleAcceptanceItems = new Set<string>();
  const activeWeeks = new Set<string>(); const possibleWeeks = new Set<string>();
  const knownByWork = eventsByWork(knownEvents); const possibleByWork = eventsByWork(possibleEvents);
  const knownWork = new Set(knownByWork.keys()); const possibleWork = new Set(possibleByWork.keys());
  const acceptedEvents = new Map(knownEvents.filter(acceptedKind).map(event => [JSON.stringify([event.workItemId, event.eventId]), event]));
  const acceptedWork = new Set<string>();
  const addActivity = (work: string, project: string, date: string) => {
    activity.get(date)!.add(work); addDate(projectDates, project, date); activeWeeks.add(utcIsoWeek(`${date}T00:00:00Z`));
  };
  for (const work of aggregation.acceptedWork) {
    const event = acceptedEvents.get(JSON.stringify([work.workItemId, work.acceptedEventId]));
    if (!event) continue;
    const date = work.acceptedAt.slice(0, 10); acceptedWork.add(work.workItemId);
    knownDelivery.add(JSON.stringify([work.canonicalProjectId, date])); addActivity(work.workItemId, work.canonicalProjectId, date);
  }
  for (const event of knownEvents) {
    const supported = supportedCategories(event, verdicts);
    const date = event.occurredAt.slice(0, 10);
    const practice = criteria.some(criterion => {
      const value = verdicts.get(event.workItemId)?.get(criterion);
      return value?.verdict === "accepted" && event.artifactReferenceIds.some(ref => value.references.has(ref));
    });
    if ([...supported].some(category => category !== "implementation") || practice) addActivity(event.workItemId, event.canonicalProjectId, date);
    if (supported.size) addDate(projectDates, event.canonicalProjectId, date);
    for (const category of supported) addDate(categoryDates, category, date);
  }
  for (const event of possibleEvents) {
    const date = event.occurredAt.slice(0, 10);
    addDate(possibleProjectDates, event.canonicalProjectId, date); possibleWeeks.add(utcIsoWeek(event.occurredAt));
    // Missing semantic category assessment is not proof that other categories are absent.
    for (const category of categories) addDate(possibleCategoryDates, category, date);
    if (!acceptedWork.has(event.workItemId) && deliveryKinds.includes(event.kind)) {
      unknownDeliveryItems.add(event.workItemId);
      const trustedDate = hasTrustedAcceptanceDate(event) && event.acceptance.status === "observed" ? event.acceptance.value.acceptedAt : null;
      const possibleDates = trustedDate ? (isWithinScoringWindow(trustedDate, input.window) ? [scoringInstant(trustedDate).toISOString().slice(0, 10)] : []) : dates;
      for (const acceptedDate of possibleDates) if (activity.has(acceptedDate)) possibleDelivery.add(JSON.stringify([event.canonicalProjectId, acceptedDate]));
      if (trustedDate) {
        const acceptedDate = possibleDates[0];
        if (acceptedDate) {
          possibleWeeks.add(utcIsoWeek(`${acceptedDate}T00:00:00Z`));
          addDate(possibleProjectDates, event.canonicalProjectId, acceptedDate);
          for (const category of categories) addDate(possibleCategoryDates, category, acceptedDate);
        }
      } else {
        // One unresolved work item can add at most one acceptance date, even
        // though that date could fall anywhere in the scoring window.
        flexibleAcceptanceItems.add(event.workItemId);
        addDate(pendingProjectDates, event.canonicalProjectId, event.workItemId);
        for (const category of categories) addDate(pendingCategoryDates, category, event.workItemId);
      }
    }
  }
  for (const value of knownDelivery) possibleDelivery.add(value);
  for (const [project, knownDates] of projectDates) for (const date of knownDates) addDate(possibleProjectDates, project, date);
  for (const [category, knownDates] of categoryDates) for (const date of knownDates) addDate(possibleCategoryDates, category, date);
  for (const week of activeWeeks) possibleWeeks.add(week);
  let unboundedQuality = false; let unboundedDelivery = false;
  // Resolving identity can combine two-date repositories into one eligible
  // project. Existing repository buckets cannot bound that completion alone.
  let unboundedProjects = unresolvedSources.size > 0;
  const aliases = new Map(input.repositoryAliases.flatMap(alias => alias.repositories.map(repository => [evidenceRepositoryKey(repository), alias.canonicalProjectId] as const)));
  for (const source of aggregation.scope.sources) {
    const discoveryUnknown = !source.repositoryDiscoveryComplete || source.status === "unavailable" || source.status === "legacy";
    const stale = !source.dataThrough || scoringInstant(source.dataThrough) < scoringInstant(input.window.referenceTime);
    const missing = eventKinds.filter(kind => discoveryUnknown || stale || source.eventKinds[kind] !== "complete");
    if (!missing.length) continue;
    const unknownDates = incompleteDates(source, input.window);
    if (!unknownDates.size) continue;
    unboundedQuality = true;
    const deliveryMissing = missing.some(kind => deliveryKinds.includes(kind));
    if (deliveryMissing && discoveryUnknown) unboundedDelivery = true;
    if (discoveryUnknown) unboundedProjects = true;
    for (const date of unknownDates) {
      possibleWeeks.add(utcIsoWeek(`${date}T00:00:00Z`));
      for (const category of categories) addDate(possibleCategoryDates, category, date);
      for (const repositoryId of source.repositoryIds) {
        const key = evidenceRepositoryKey({ ...source.source, repositoryId });
        const project = aliases.get(key) ?? key;
        addDate(possibleProjectDates, project, date);
        if (deliveryMissing) missingDelivery.add(JSON.stringify([project, date]));
      }
    }
  }
  const lowerQuality = Object.fromEntries(criteria.map(criterion => [criterion, [...knownWork].filter(work => {
    const verdict = verdicts.get(work)?.get(criterion);
    return verdict?.verdict === "accepted" && knownByWork.get(work)!.some(event => supportsVerdict(event, verdict));
  }).length])) as Record<QualityCriterion, number>;
  const upperQuality = Object.fromEntries(criteria.map(criterion => [criterion, [...possibleWork].filter(work => {
    const verdict = verdicts.get(work)?.get(criterion);
    // An old rejection cannot rule out new, unrelated evidence on the same item.
    return verdict?.verdict !== "rejected" || possibleByWork.get(work)!.some(event => !supportsVerdict(event, verdict));
  }).length])) as Record<QualityCriterion, number>;
  const caps = SCORING_V7_POLICY.caps;
  const possibleEligible = (fixed: Map<string, Set<string>>, pending: Map<string, Set<string>>) =>
    [...new Set([...fixed.keys(), ...pending.keys()])].filter(key =>
      Math.min(dates.length, (fixed.get(key)?.size ?? 0) + (pending.get(key)?.size ?? 0)) >= SCORING_V7_POLICY.breadthMinimumDates).length;
  const deliveryCapacity = new Set([...knownDelivery, ...missingDelivery]);
  const deliveryUpper = Math.min(new Set([...possibleDelivery, ...missingDelivery]).size, deliveryCapacity.size + unknownDeliveryItems.size);
  const capped = (lower: number, upper: number, cap: number) => countBounds(Math.min(lower, cap), Math.min(Math.max(lower, upper), cap));
  const observedCounts = { deliveryUnits: knownDelivery.size, quality: lowerQuality, activeIsoWeeks: activeWeeks.size,
    eligibleProjects: eligibleCount(projectDates), eligibleCategories: eligibleCount(categoryDates) };
  const inputs = createCoreScoringInputs(input.window, {
    deliveryUnits: capped(knownDelivery.size, unboundedDelivery ? caps.delivery : deliveryUpper, caps.delivery),
    quality: Object.fromEntries(criteria.map(criterion => [criterion, capped(lowerQuality[criterion], unboundedQuality ? caps.qualityCriterion : upperQuality[criterion], caps.qualityCriterion)])) as CoreScoringInputs["counts"]["quality"],
    activeIsoWeeks: capped(activeWeeks.size, Math.min(new Set(dates.map(date => utcIsoWeek(`${date}T00:00:00Z`))).size, possibleWeeks.size + flexibleAcceptanceItems.size), caps.consistency),
    eligibleProjects: capped(observedCounts.eligibleProjects, unboundedProjects ? caps.breadthProjects : possibleEligible(possibleProjectDates, pendingProjectDates), caps.breadthProjects),
    eligibleCategories: capped(observedCounts.eligibleCategories, possibleEligible(possibleCategoryDates, pendingCategoryDates), caps.breadthCategories),
  });
  const limitations = new Set(aggregation.limitations);
  if (criteria.some(criterion => upperQuality[criterion] > lowerQuality[criterion])) limitations.add("not_assessed");
  return { inputs, aggregation, observedCounts, activityCalendar: [...activity].map(([date, work]) => ({ date, count: work.size })), limitations: [...limitations].sort() };
}
