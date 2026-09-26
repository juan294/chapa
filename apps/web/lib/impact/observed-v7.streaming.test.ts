import { describe, expect, it } from "vitest";
import { mergeEngineeringEvidence, observed, unknown, createScoringWindow,
  type EngineeringEvidenceInput, type NormalizedEngineeringEvent, type PrivateCriterionAssessment,
  type PublicObservedScoringReceipt, type SourceCoverage } from "@chapa/shared";
import { beginCanonicalReceiptEvidenceSpool, receiptSemanticIdentity } from "../profile/receipt-semantic-identity";
import { beginObservedEvidence } from "./v7-evidence-streaming";
import { computeObservedImpactV7 } from "./observed-v7";
import { computeObservedImpactV7FromReduction } from "./observed-v7-streaming";

const window = createScoringWindow("2026-09-26T12:00:00.000Z");
const github = { provider: "github" as const, host: "github.com", subjectId: "person" };
const gitlab = { provider: "gitlab" as const, host: "gitlab.com", subjectId: "person" };
const yes = <T>(value: T) => observed(value, "complete", "source_observed");
function event(index: number): NormalizedEngineeringEvent {
  const id = index.toString(36);
  const source = index % 7 === 0 ? gitlab : github;
  const kind = index % 5 === 0 ? "accepted_change" as const : "authored_commit" as const;
  const occurredAt = `2026-09-${String(1 + index % 20).padStart(2, "0")}T12:00:00.000Z`;
  return { ...source, schemaVersion: "v7", repositoryId: source.provider === "github" ? "repo-gh" : "repo-gl",
    actorId: source.subjectId, eventId: `event-${id}`, kind, occurredAt, dataThrough: window.referenceTime,
    canonicalProjectId: "unverified", workItemId: `work-${id}`, artifactRevision: `rev-${id}`,
    artifactReferenceIds: [`ref-${id}`], attribution: index % 31 === 0 ? "unclear" : "individual",
    provenance: "source_observed", coverage: "complete", categories: [],
    measurements: { changedFiles: kind === "accepted_change" ? yes(["docs/readme.md"]) : unknown("unavailable", "not_supported"),
      additions: yes(10), deletions: yes(2), leadTimeHours: yes(1), hasDescription: yes(true), hasIssueLink: yes(false), usesFeatureBranch: yes(true) },
    acceptance: kind === "accepted_change" ? yes({ method: "merged_change", acceptedAt: occurredAt, acceptedResultId: `result-${id}` })
      : unknown("unavailable", "not_supported") };
}
function coverage(source: typeof github | typeof gitlab, repositoryId: string): SourceCoverage {
  return { source, window, dataThrough: window.referenceTime, status: "complete", discovery: "explicit_repositories",
    repositoryIds: [repositoryId], repositoryDiscoveryComplete: true, eventKinds: {}, reasonCodes: [], unknownPeriods: [] };
}
function input(events: readonly NormalizedEngineeringEvent[]): EngineeringEvidenceInput {
  return { schemaVersion: "v7", window, scope: { sources: [coverage(github, "repo-gh"), coverage(gitlab, "repo-gl")],
    excludedSources: [], ledgerRevisionIds: [] }, events, repositoryAliases: [], equivalentWorkItems: [], assessments: [] };
}
function reduce(evidence: EngineeringEvidenceInput, pageSize: number) {
  const { events: ignored, ...meta } = evidence; void ignored;
  const reducer = beginObservedEvidence(meta);
  const ordered = mergeEngineeringEvidence(evidence).events;
  for (let start = 0; start < ordered.length; start += pageSize) reducer.addSortedPage(ordered.slice(start, start + pageSize));
  return computeObservedImpactV7FromReduction(reducer.finish());
}
function receipt(core: ReturnType<typeof computeObservedImpactV7FromReduction>): PublicObservedScoringReceipt {
  return { schemaVersion: "v7", policyVersion: "v7.2", action: "create", window,
    core: core.core, inputs: core.inputs, limitations: core.limitations } as unknown as PublicObservedScoringReceipt;
}

describe("paged observed scoring parity", () => {
  it("matches the pinned observed scorer across 40 seeded mixed-provider layouts", () => {
    let state = 294;
    const next = () => (state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0);
    const fileFacts = [
      yes(["docs/guide.md"]), yes(["docs/other.md", "README.md"]),
      yes(["src/feature.ts"]), yes(["src/other.ts"]), yes([]),
      observed(["docs/draft.md"], "partial", "source_observed"),
      observed(["src/draft.ts"], "partial", "source_observed"),
      unknown("unavailable", "not_supported"),
    ];
    for (let sample = 0; sample < 40; sample++) {
      const rows: NormalizedEngineeringEvent[] = [];
      for (let index = 0, count = 24 + next() % 37; index < count; index++) {
        const original = event(sample * 1_000 + index);
        const item: NormalizedEngineeringEvent = { ...original, workItemId: `group-${sample}-${Math.floor(index / 8)}`,
          attribution: next() % 7 === 0 ? "unclear" : "individual",
          measurements: { ...original.measurements, changedFiles: fileFacts[next() % fileFacts.length]! } };
        rows.push(item);
        if (next() % 3 === 0) rows.push({ ...item, measurements: { ...item.measurements,
          changedFiles: fileFacts[next() % fileFacts.length]! } });
        if (next() % 5 === 0) rows.push(item);
      }
      for (let index = rows.length - 1; index > 0; index--) {
        const other = next() % (index + 1);
        [rows[index], rows[other]] = [rows[other]!, rows[index]!];
      }
      const evidence = input(rows);
      const expected = computeObservedImpactV7(evidence);
      for (const pageSize of [1, 7, 31]) {
        const actual = reduce(evidence, pageSize);
        expect(actual.inputs, `sample ${sample}`).toEqual(expected.inputs);
        expect(actual.observedCounts, `sample ${sample}`).toEqual(expected.observedCounts);
        expect(actual.activityCalendar, `sample ${sample}`).toEqual(expected.activityCalendar);
        expect(actual.limitations, `sample ${sample}`).toEqual(expected.limitations);
        expect(actual.core, `sample ${sample}`).toEqual(expected.core);
        expect(actual.trace, `sample ${sample}`).toEqual(expected.trace);
        expect(actual.acceptedWork, `sample ${sample}`).toEqual(expected.aggregation.acceptedWork);
        expect(actual.diagnostics, `sample ${sample}`).toEqual(expected.aggregation.diagnostics);
      }
    }
  });

  it.each([1, 999, 1_001])("matches bounds, calendar, limitations, exact score and tier at %i events", count => {
    const evidence = input(Array.from({ length: count }, (_, index) => event(index)));
    const expected = computeObservedImpactV7(evidence);
    for (const pageSize of [1, 37, 500]) {
      const actual = reduce(evidence, pageSize);
      expect(actual.inputs).toEqual(expected.inputs);
      expect(actual.observedCounts).toEqual(expected.observedCounts);
      expect(actual.activityCalendar).toEqual(expected.activityCalendar);
      expect(actual.limitations).toEqual(expected.limitations);
      expect(actual.core).toEqual(expected.core);
      expect(actual.trace).toEqual(expected.trace);
    }
  });

  it("preserves mirrored acceptance and verified repository aliases across providers", () => {
    const first = event(5);
    const mirror = { ...event(7), kind: "issue_work" as const, workItemId: "mirror-work", acceptance: yes({
      method: "linked_issue_result" as const, acceptedAt: first.occurredAt, acceptedResultId: "result-5" }), occurredAt: first.occurredAt };
    const evidence = { ...input([first, mirror]),
      repositoryAliases: [{ repositories: [first, mirror], canonicalProjectId: "same-project", verifiedAt: window.referenceTime, evidenceReferenceIds: ["alias-proof"] }],
      equivalentWorkItems: [{ workItemIds: [first.workItemId, mirror.workItemId], canonicalWorkItemId: first.workItemId,
        acceptedEventId: first.eventId, evidenceReferenceIds: ["same-work-proof"] }] };
    const expected = computeObservedImpactV7(evidence);
    const actual = reduce(evidence, 1);
    expect(actual.inputs).toEqual(expected.inputs);
    expect(actual.acceptedWork).toEqual(expected.aggregation.acceptedWork);
    expect(actual.core).toEqual(expected.core);
  });

  it("matches artifact-supported quality and keeps an empty support set for known work", () => {
    const supported = event(5);
    const unsupported = event(10);
    const assessment = (item: NormalizedEngineeringEvent, reference: string): PrivateCriterionAssessment => ({
      revisionId: `revision-${item.eventId}`, revision: 1, supersedesRevisionId: null, action: "create",
      recordedAt: "2026-09-25T12:00:00.000Z", assessmentId: `assessment-${item.eventId}`,
      claimRevisionId: `claim-${item.eventId}`, workItemId: item.workItemId, criterion: "verification", status: "accepted",
      rubricVersion: "v7", reasonCode: "criterion_demonstrated", evaluator: { id: "human", kind: "human", version: "1", independent: true },
      rationale: "Reviewed artifact", assessedAt: "2026-09-25T11:00:00.000Z", evidenceReferenceIds: [reference], provenance: "human_assessed",
    });
    const evidence = { ...input([supported, unsupported]),
      scope: { ...input([]).scope, ledgerRevisionIds: [`claim-${supported.eventId}`, `claim-${unsupported.eventId}`] },
      assessments: [assessment(supported, supported.artifactReferenceIds[0]!), assessment(unsupported, "unrelated-ref")] };
    const expected = computeObservedImpactV7(evidence);
    const actual = reduce(evidence, 1);
    expect(actual.inputs).toEqual(expected.inputs);
    expect(actual.observedCounts).toEqual(expected.observedCounts);
    expect(actual.selectedWorkSupport.get(supported.workItemId)?.has(supported.artifactReferenceIds[0]!)).toBe(true);
    expect(actual.selectedWorkSupport.has(unsupported.workItemId)).toBe(true);
    expect(actual.selectedWorkSupport.get(unsupported.workItemId)?.has("unrelated-ref")).toBe(false);
  });

  it.runIf(process.env.SCORING_STREAMING_LARGE === "1")("matches the 17,572-event observed reference", () => {
    const evidence = input(Array.from({ length: 17_572 }, (_, index) => event(index)));
    const expected = computeObservedImpactV7(evidence);
    const actual = reduce(evidence, 500);
    expect(actual.inputs).toEqual(expected.inputs);
    expect(actual.core).toEqual(expected.core);
    expect(actual.trace).toEqual(expected.trace);
  }, 180_000);

  it.runIf(process.env.SCORING_STREAMING_LARGE === "1")("matches the 17,572-event mixed-provider scorer and private digest oracles", async () => {
    const rows = Array.from({ length: 17_572 }, (_, index) => event(index));
    const evidence = input(rows);
    const { events: ignored, ...meta } = evidence; void ignored;
    const expected = computeObservedImpactV7(evidence);
    const spool = await beginCanonicalReceiptEvidenceSpool();
    try {
      for (let offset = rows.length; offset > 0; offset -= 500) await spool.addPage(rows.slice(Math.max(0, offset - 500), offset));
      const reducer = beginObservedEvidence(meta);
      let page: NormalizedEngineeringEvent[] = [];
      for await (const item of spool.scorerSortedEvents()) {
        page.push(item);
        if (page.length === 500) { reducer.addSortedPage(page); page = []; }
      }
      if (page.length) reducer.addSortedPage(page);
      const actual = computeObservedImpactV7FromReduction(reducer.finish());
      expect(actual.inputs).toEqual(expected.inputs);
      expect(actual.observedCounts).toEqual(expected.observedCounts);
      expect(actual.core).toEqual(expected.core);
      expect(actual.trace).toEqual(expected.trace);
      const selectedReceipt = receipt(actual);
      expect(await spool.digest(selectedReceipt, meta)).toBe(await receiptSemanticIdentity(selectedReceipt, evidence));
    } finally {
      await spool.dispose();
    }
  }, 180_000);

  it.runIf(process.env.SCORING_STREAMING_100K === "1")("reduces 100,000 distinct accepted works from lazy pages", () => {
    const { events: ignored, ...meta } = input([]); void ignored;
    const reducer = beginObservedEvidence(meta);
    const base = event(5);
    const start = performance.now();
    let sampledPeakRss = process.memoryUsage().rss;
    for (let offset = 0; offset < 100_000; offset += 500) {
      const page = Array.from({ length: 500 }, (_, localIndex) => {
        const id = String(offset + localIndex).padStart(6, "0");
        return { ...base, eventId: `event-${id}`, workItemId: `work-${id}`, artifactRevision: `rev-${id}`,
          artifactReferenceIds: [`ref-${id}`], acceptance: yes({ method: "merged_change" as const,
            acceptedAt: base.occurredAt, acceptedResultId: `result-${id}` }) };
      });
      reducer.addSortedPage(page);
      sampledPeakRss = Math.max(sampledPeakRss, process.memoryUsage().rss);
    }
    const result = computeObservedImpactV7FromReduction(reducer.finish());
    sampledPeakRss = Math.max(sampledPeakRss, process.memoryUsage().rss);
    // Delivery units are distinct project/date pairs; this fixture puts all
    // accepted works in one repository on one date.
    expect(result.observedCounts.deliveryUnits).toBe(1);
    expect(result.acceptedWork).toHaveLength(100_000);
    expect(result.selectedWorkSupport.size).toBe(100_000);
    console.log("streaming100k", JSON.stringify({ wallMs: Math.round(performance.now() - start), sampledPeakRss,
      deliveryUnits: result.observedCounts.deliveryUnits, core: result.core }));
  }, 180_000);

  it.runIf(process.env.SCORING_STREAMING_100K === "1")("runs 100,000 mixed-provider works through spool, scorer and digest", async () => {
    const { events: ignored, ...meta } = input([]); void ignored;
    const base = event(5);
    const unclear = process.env.SCORING_STREAMING_UNCLEAR === "1";
    const spool = await beginCanonicalReceiptEvidenceSpool();
    try {
      for (let offset = 0; offset < 100_000; offset += 500) {
        const page = Array.from({ length: 500 }, (_, localIndex) => {
          const index = offset + localIndex;
          const id = String(index).padStart(6, "0");
          const source = index % 7 === 0 ? gitlab : github;
          return { ...base, ...source, repositoryId: source.provider === "github" ? "repo-gh" : "repo-gl",
            eventId: `event-${id}`, workItemId: `work-${id}`, artifactRevision: `rev-${id}`,
            attribution: unclear && index % 10 === 0 ? "unclear" as const : "individual" as const,
            artifactReferenceIds: [`ref-${id}`], acceptance: yes({ method: "merged_change" as const,
              acceptedAt: base.occurredAt, acceptedResultId: `result-${id}` }) };
        });
        await spool.addPage(page);
      }
      const reducer = beginObservedEvidence(meta);
      let page: NormalizedEngineeringEvent[] = [];
      for await (const item of spool.scorerSortedEvents()) {
        page.push(item);
        if (page.length === 500) { reducer.addSortedPage(page); page = []; }
      }
      if (page.length) reducer.addSortedPage(page);
      const actual = computeObservedImpactV7FromReduction(reducer.finish());
      expect(actual.acceptedWork).toHaveLength(unclear ? 90_000 : 100_000);
      expect(actual.selectedWorkSupport.size).toBe(unclear ? 90_000 : 100_000);
      expect(actual.observedCounts.deliveryUnits).toBe(2);
      expect(await spool.digest(receipt(actual), meta)).toMatch(/^[0-9a-f]{64}$/);
      expect(spool.scratchStats().peakDiskBytes).toBeLessThan(384 * 1_024 * 1_024);
    } finally {
      await spool.dispose();
    }
  }, 180_000);
});
