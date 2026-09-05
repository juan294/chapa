import {
  observed, unknown, scoringInstant, evidenceRepositoryKey,
  type EngineeringEvidenceInput, type ImmutableRevision, type NormalizedEngineeringEvent, type ScoringWindow,
} from "@chapa/shared";
import type { EngineeringLedgerSnapshot, LedgerAssessmentRecord } from "./types";

function latest<T extends ImmutableRevision>(records: readonly T[], time: string, groupId: (row: T) => string): T[] {
  const groups = new Map<string, Map<number, T>>();
  for (const row of records) {
    if (scoringInstant(row.recordedAt) > scoringInstant(time)) continue;
    const group = groups.get(groupId(row)) ?? new Map<number, T>();
    const duplicate = group.get(row.revision);
    if (duplicate && JSON.stringify(duplicate) !== JSON.stringify(row)) throw new RangeError("Conflicting ledger revision");
    group.set(row.revision, row); groups.set(groupId(row), group);
  }
  return [...groups.values()].map(group => {
    const chain = [...group.values()].sort((a, b) => a.revision - b.revision);
    for (const [index, row] of chain.entries()) {
      const prior = chain[index - 1];
      if (row.revision !== index + 1 || row.supersedesRevisionId !== (prior?.revisionId ?? null) || (prior ? row.action === "create" || scoringInstant(row.recordedAt) < scoringInstant(prior.recordedAt) : row.action !== "create")) throw new RangeError("Invalid ledger revision chain");
    }
    return chain.at(-1)!;
  });
}

/** Private ledger projection. Semantic credit comes exclusively from immutable accountable reviews. */
export function projectEngineeringLedger(snapshot: EngineeringLedgerSnapshot, window: ScoringWindow): EngineeringEvidenceInput {
  const source = { provider: "portfolio" as const, host: "ledger.chapa", subjectId: snapshot.ownerId };
  const coreRows = snapshot.claims.filter(row => row.channel === "core" && row.claim.ownerId === snapshot.ownerId);
  const claims = latest(coreRows.map(row => row.claim), window.referenceTime, row => row.claimId).filter(row => row.action !== "retract");
  const rows = new Map(coreRows.map(row => [row.claim.revisionId, row]));
  const references = new Map(snapshot.references.filter(ref => ref.ownerId === snapshot.ownerId && ref.retention === "until_owner_withdrawal" && ref.expiresAt === null).map(ref => [ref.referenceId, ref]));
  const reviewByRevision = new Map(snapshot.assessments.map(row => [row.assessment.revisionId, row]));
  const latestReviews = latest(snapshot.assessments.map(row => row.assessment), window.referenceTime, row => row.assessmentId);
  const events: NormalizedEngineeringEvent[] = [];
  const assessments: EngineeringEvidenceInput["assessments"][number][] = [];
  const equivalences: EngineeringEvidenceInput["equivalentWorkItems"][number][] = [];
  const aliases: EngineeringEvidenceInput["repositoryAliases"][number][] = [];
  let pending = false;
  const independentlyDated = new Map<string, string>();
  const validReview = (row: LedgerAssessmentRecord, claim: typeof claims[number]) => {
    const a = row.assessment;
    const start = scoringInstant(claim.observationPeriod.startInclusive);
    const end = scoringInstant(claim.observationPeriod.endExclusive);
    return a.claimRevisionId === claim.revisionId && a.workItemId === claim.workItemId && a.action !== "retract" &&
      a.status !== "retracted" && a.status !== "unassessed" && a.rubricVersion === "v7" && a.rationale.trim() &&
      a.evaluator.id !== snapshot.ownerId && a.evaluator.version.trim() && !row.conflicts.length && a.provenance !== "self_reported" &&
      scoringInstant(row.authorizedAt) <= scoringInstant(a.assessedAt) && scoringInstant(a.assessedAt) <= scoringInstant(a.recordedAt) &&
      scoringInstant(a.assessedAt) <= scoringInstant(window.referenceTime) && start < end && end <= scoringInstant(claim.recordedAt) && end <= scoringInstant(a.assessedAt) &&
      a.evidenceReferenceIds.length > 0 && a.evidenceReferenceIds.every(id => {
        const ref = references.get(id);
        return ref && ref.artifactRevision === claim.artifactRevision && claim.evidenceReferenceIds.includes(id) && scoringInstant(ref.observedAt) <= scoringInstant(a.assessedAt);
      }) && (a.provenance !== "independently_corroborated" || (a.evaluator.kind === "human" && a.evaluator.independent));
  };
  const claimsByRevision = new Map(claims.map(claim => [claim.revisionId, claim]));
  const reviewsByClaim = new Map<string, LedgerAssessmentRecord[]>();
  for (const assessment of latestReviews) {
    const claim = claimsByRevision.get(assessment.claimRevisionId);
    const row = reviewByRevision.get(assessment.revisionId)!;
    if (!claim || !validReview(row, claim)) continue;
    const group = reviewsByClaim.get(claim.revisionId) ?? [];
    group.push(row); reviewsByClaim.set(claim.revisionId, group);
  }
  for (const claim of claims) {
    const reviews = reviewsByClaim.get(claim.revisionId) ?? [];
    const facts = reviews.filter(row => row.facts && row.facts.identity.referenceIds.length && row.facts.identity.referenceIds.every(id => row.assessment.evidenceReferenceIds.includes(id)));
    if (!facts.length) { pending = true; continue; }
    // Multiple factual descriptions must agree. Disagreement remains a visible completion uncertainty.
    if (new Set(facts.map(row => JSON.stringify(row.facts))).size !== 1) { pending = true; continue; }
    const reviewed = facts[0]!;
    const fact = reviewed.facts!;
    const occurredAt = scoringInstant(fact.occurredAt).toISOString();
    if (scoringInstant(occurredAt) > scoringInstant(reviewed.assessment.assessedAt) || (fact.acceptance && scoringInstant(fact.acceptance.acceptedAt) > scoringInstant(reviewed.assessment.assessedAt)) || !rows.has(claim.revisionId)) { pending = true; continue; }
    const repositoryId = `portfolio:${snapshot.ownerId}:project:${fact.identity.projectKey}`;
    const repository = { ...source, repositoryId };
    const canonicalProjectId = fact.identity.repository ? evidenceRepositoryKey(fact.identity.repository) : `portfolio:${snapshot.ownerId}:project:${fact.identity.projectKey}`;
    const workItemId = `portfolio:${snapshot.ownerId}:work:${fact.identity.workKey}`;
    aliases.push({ repositories: fact.identity.repository ? [repository, fact.identity.repository] : [repository], canonicalProjectId, verifiedAt: reviewed.assessment.recordedAt, evidenceReferenceIds: fact.identity.referenceIds });
    if (fact.identity.equivalentWork) equivalences.push({ workItemIds: [workItemId, fact.identity.equivalentWork.canonicalWorkItemId],
      canonicalWorkItemId: fact.identity.equivalentWork.canonicalWorkItemId, acceptedEventId: fact.identity.equivalentWork.acceptedEventId, evidenceReferenceIds: fact.identity.referenceIds });
    const allowedRefs = new Set(reviewed.assessment.evidenceReferenceIds);
    if (fact.categories.some(category => category.referenceIds.some(id => !allowedRefs.has(id))) || fact.acceptance?.referenceIds.some(id => !allowedRefs.has(id))) { pending = true; continue; }
    const provenance = reviewed.assessment.provenance;
    const acceptance = fact.acceptance ? observed({ method: fact.acceptance.method, acceptedAt: scoringInstant(fact.acceptance.acceptedAt).toISOString(), acceptedResultId: fact.acceptance.acceptedResultId }, "complete", provenance) : unknown("partial", "acceptance_time_unknown");
    const eventTime = acceptance.status === "observed" ? acceptance.value.acceptedAt : occurredAt;
    events.push({ schemaVersion: "v7", ...repository, actorId: snapshot.ownerId,
      eventId: `${workItemId}:claim:${claim.revisionId}:artifact:${encodeURIComponent(claim.artifactRevision)}:${fact.acceptance ? "accepted" : "practice"}:${eventTime}`,
      kind: fact.kind, occurredAt: eventTime, dataThrough: window.referenceTime, canonicalProjectId, workItemId,
      artifactRevision: claim.artifactRevision, artifactReferenceIds: [...new Set(reviews.flatMap(row => row.assessment.evidenceReferenceIds))].sort(),
      attribution: fact.attribution, provenance, coverage: "complete", acceptance,
      categories: fact.categories.map(category => ({ category: category.category, evidenceReferenceIds: category.referenceIds })),
      measurements: { changedFiles: unknown("unavailable", "not_supported"), additions: unknown("unavailable", "not_supported"), deletions: unknown("unavailable", "not_supported"),
        leadTimeHours: unknown("unavailable", "not_supported"), hasDescription: unknown("unavailable", "not_supported"), hasIssueLink: unknown("unavailable", "not_supported"), usesFeatureBranch: unknown("unavailable", "not_supported") } });
    independentlyDated.set(events.at(-1)!.eventId, occurredAt);
    // Preserve complete historical chains for the core engine's own revision validation.
    const acceptedIds = new Set(reviews.map(row => row.assessment.assessmentId));
    assessments.push(...snapshot.assessments.filter(row => acceptedIds.has(row.assessment.assessmentId) && row.assessment.claimRevisionId === claim.revisionId).map(row => ({ ...row.assessment, workItemId })));
  }
  // Conflicting mappings cannot be resolved by arrival order. Remove affected credit
  // and retain completion uncertainty until an accountable correction reconciles it.
  const projectMappings = new Map<string, Set<string>>();
  for (const alias of aliases) {
    const key = evidenceRepositoryKey(alias.repositories[0]!);
    const values = projectMappings.get(key) ?? new Set<string>();
    values.add(alias.canonicalProjectId); projectMappings.set(key, values);
  }
  const linkedIdentity = new Map<string, Set<string>>();
  for (const link of equivalences) for (const id of link.workItemIds) {
    const identities = linkedIdentity.get(id) ?? new Set<string>();
    identities.add(link.canonicalWorkItemId); linkedIdentity.set(id, identities);
  }
  const canonicalWork = (id: string) => {
    const identities = linkedIdentity.get(id);
    return identities?.size === 1 ? [...identities][0]! : id;
  };
  const artifactWorks = new Map<string, Set<string>>();
  for (const event of events) for (const id of event.artifactReferenceIds) {
    const reference = references.get(id);
    if (!reference) continue;
    const key = JSON.stringify([reference.artifactUri, reference.artifactRevision]);
    const works = artifactWorks.get(key) ?? new Set<string>();
    works.add(canonicalWork(event.workItemId)); artifactWorks.set(key, works);
  }
  const acceptedDates = new Map<string, Set<string>>();
  for (const event of events) if (event.acceptance.status === "observed") {
    const key = canonicalWork(event.workItemId);
    const dates = acceptedDates.get(key) ?? new Set<string>();
    dates.add(event.acceptance.value.acceptedAt); acceptedDates.set(key, dates);
  }
  const rejectedWorks = new Set<string>();
  for (const event of events) {
    if ((acceptedDates.get(canonicalWork(event.workItemId))?.size ?? 0) > 1 || (linkedIdentity.get(event.workItemId)?.size ?? 0) > 1 || (projectMappings.get(evidenceRepositoryKey(event))?.size ?? 0) > 1 || event.artifactReferenceIds.some(id => {
      const ref = references.get(id);
      return ref && (artifactWorks.get(JSON.stringify([ref.artifactUri, ref.artifactRevision]))?.size ?? 0) > 1;
    })) rejectedWorks.add(event.workItemId);
  }
  if (rejectedWorks.size) pending = true;
  const reconciledEvents: NormalizedEngineeringEvent[] = [];
  const anchors = new Map<string, NormalizedEngineeringEvent[]>();
  for (const event of events.filter(event => !rejectedWorks.has(event.workItemId))) {
    const selected = equivalences.find(link => link.workItemIds.includes(event.workItemId));
    if (!selected || event.acceptance.status !== "observed") { reconciledEvents.push(event); continue; }
    // Keep the actual performed-practice date and revision-specific backing even
    // when shared aggregation selects an external canonical acceptance event.
    reconciledEvents.push({ ...event, kind: "practice_evidence", occurredAt: independentlyDated.get(event.eventId)!, acceptance: unknown("partial", "acceptance_time_unknown") });
    const key = JSON.stringify([canonicalWork(event.workItemId), selected.acceptedEventId]);
    const group = anchors.get(key) ?? [];
    group.push({ ...event, eventId: selected.acceptedEventId, artifactRevision: event.acceptance.value.acceptedResultId }); anchors.set(key, group);
  }
  for (const group of anchors.values()) {
    // Designation is evidence metadata, not part of the accepted-result identity.
    // Keep each review's provenance on its practice record; use the least strong
    // supporting designation on the aggregate anchor, deterministically.
    const designationRank = (event: NormalizedEngineeringEvent) => event.provenance === "automated_assessment" ? 0 : event.provenance === "independently_corroborated" ? 2 : 1;
    const first = [...group].sort((a, b) => designationRank(a) - designationRank(b) || a.eventId.localeCompare(b.eventId) || a.artifactRevision.localeCompare(b.artifactRevision))[0]!;
    if (new Set(group.map(event => JSON.stringify([event.kind, event.canonicalProjectId, event.acceptance.status === "observed" ? event.acceptance.value : null]))).size !== 1) { pending = true; continue; }
    reconciledEvents.push({ ...first, artifactReferenceIds: [...new Set(group.flatMap(event => event.artifactReferenceIds))].sort(),
      categories: group.flatMap(event => event.categories).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) });
  }
  const repositoryIds = [...new Set(reconciledEvents.map(event => event.repositoryId))];
  const kinds = ["accepted_change", "authored_commit", "review", "issue_work", "documentation_design", "maintenance", "practice_evidence"] as const;
  const status = pending ? "partial" as const : "complete" as const;
  return { schemaVersion: "v7", window, events: reconciledEvents,
    repositoryAliases: [...new Map(aliases.filter(alias => repositoryIds.includes(alias.repositories[0]!.repositoryId)).map(alias => [evidenceRepositoryKey(alias.repositories[0]!), alias])).values()], equivalentWorkItems: equivalences.filter(link => link.workItemIds.every(id => !rejectedWorks.has(id))), assessments: assessments.filter(assessment => !rejectedWorks.has(assessment.workItemId)),
    scope: { sources: [{ source, window, dataThrough: window.referenceTime, status, discovery: "registered_ledger", repositoryIds, repositoryDiscoveryComplete: !pending,
      eventKinds: Object.fromEntries(kinds.map(kind => [kind, status])), reasonCodes: pending ? ["not_assessed"] : [], unknownPeriods: pending ? [{ startInclusive: window.startInclusive, endExclusive: window.endExclusive }] : [] }],
      excludedSources: [], ledgerRevisionIds: claims.map(claim => claim.revisionId) } };
}
