import { describe, expect, it } from "vitest";
import { aggregateEngineeringEvidence, classifyDocumentationFiles, mergeEngineeringEvidence } from "./scoring-aggregation-v7";
import { beginEngineeringAggregationV7 } from "./scoring-aggregation-v7-streaming";
import { observed, unknown, type EngineeringEvidenceInput, type NormalizedEngineeringEvent } from "./scoring-evidence";
import { createScoringWindow } from "./scoring-window";

const window = createScoringWindow("2026-09-26T12:00:00.000Z");
const source = { provider: "github" as const, host: "github.com", subjectId: "synthetic-person" };
const yes = <T>(value: T) => observed(value, "complete", "source_observed");
function event(index: number): NormalizedEngineeringEvent {
  const id = index.toString(36);
  return { ...source, schemaVersion: "v7", repositoryId: "repo", actorId: source.subjectId,
    eventId: `event-${id}`, kind: index % 5 === 0 ? "accepted_change" : "authored_commit",
    occurredAt: `2026-09-${String(1 + index % 20).padStart(2, "0")}T12:00:00.000Z`, dataThrough: window.referenceTime,
    canonicalProjectId: "unverified", workItemId: `work-${id}`, artifactRevision: `rev-${id}`,
    artifactReferenceIds: [`ref-${id}`], attribution: "individual", provenance: "source_observed", coverage: "complete",
    categories: [], measurements: { changedFiles: index % 5 === 0 ? yes(["docs/readme.md"]) : unknown("unavailable", "not_supported"),
      additions: yes(10), deletions: yes(2), leadTimeHours: yes(1), hasDescription: yes(true), hasIssueLink: yes(false), usesFeatureBranch: yes(true) },
    acceptance: index % 5 === 0 ? yes({ method: "merged_change", acceptedAt: `2026-09-${String(1 + index % 20).padStart(2, "0")}T12:00:00.000Z`, acceptedResultId: `result-${id}` })
      : unknown("unavailable", "not_supported") };
}
function input(events: readonly NormalizedEngineeringEvent[]): EngineeringEvidenceInput {
  return { schemaVersion: "v7", window, scope: { sources: [{ source, window, dataThrough: window.referenceTime, status: "complete",
    discovery: "explicit_repositories", repositoryIds: ["repo"], repositoryDiscoveryComplete: true, eventKinds: {}, reasonCodes: [], unknownPeriods: [] }],
    excludedSources: [], ledgerRevisionIds: [] }, events, repositoryAliases: [], equivalentWorkItems: [], assessments: [] };
}
function reduce(evidence: EngineeringEvidenceInput, pageSize: number) {
  const { events: ignored, ...meta } = evidence; void ignored;
  const reducer = beginEngineeringAggregationV7(meta);
  const ordered = mergeEngineeringEvidence(evidence).events;
  for (let start = 0; start < ordered.length; start += pageSize) reducer.addSortedPage(ordered.slice(start, start + pageSize));
  return aggregateEngineeringEvidence(reducer.finish());
}

describe("streaming engineering aggregation", () => {
  it("matches the pinned aggregation across 40 seeded file, duplicate, and attribution layouts", () => {
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
      const expected = aggregateEngineeringEvidence(evidence);
      for (const pageSize of [1, 7, 31]) {
        const actual = reduce(evidence, pageSize);
        expect(actual.acceptedWork, `sample ${sample}`).toEqual(expected.acceptedWork);
        expect(actual.acceptanceSelections, `sample ${sample}`).toEqual(expected.acceptanceSelections);
        expect(actual.excludedEvents, `sample ${sample}`).toEqual(expected.excludedEvents);
        expect(actual.limitations, `sample ${sample}`).toEqual(expected.limitations);
        expect(actual.observedEventCalendar, `sample ${sample}`).toEqual(expected.observedEventCalendar);
        expect(actual.diagnostics, `sample ${sample}`).toEqual(expected.diagnostics);
        const projected = (items: typeof actual.events) => items.map(item => [item.eventId, item.workItemId,
          item.categories, item.measurements.changedFiles.status, classifyDocumentationFiles(item.measurements.changedFiles)]);
        expect(projected(actual.events), `sample ${sample}`).toEqual(projected(expected.events));
      }
    }
  });

  it.each([1, 999, 1_001])("matches selection, diagnostics, calendar and limitations at %i events", count => {
    const evidence = input(Array.from({ length: count }, (_, index) => event(index)));
    const expected = aggregateEngineeringEvidence(evidence);
    for (const pageSize of [1, 37, 500]) {
      const actual = reduce(evidence, pageSize);
      expect(actual.acceptedWork).toEqual(expected.acceptedWork);
      expect(actual.acceptanceSelections).toEqual(expected.acceptanceSelections);
      expect(actual.excludedEvents).toEqual(expected.excludedEvents);
      expect(actual.limitations).toEqual(expected.limitations);
      expect(actual.observedEventCalendar).toEqual(expected.observedEventCalendar);
      expect(actual.diagnostics).toEqual(expected.diagnostics);
      expect(actual.events.map(item => [item.eventId, item.workItemId, item.canonicalProjectId])).toEqual(
        expected.events.map(item => [item.eventId, item.workItemId, item.canonicalProjectId]));
    }
  });

  it("rejects unsorted input so callers cannot bypass the scorer spool", () => {
    const evidence = input([event(2), event(1)]);
    const { events: ignored, ...meta } = evidence; void ignored;
    const reducer = beginEngineeringAggregationV7(meta);
    expect(() => reducer.addSortedPage([event(2), event(1)])).toThrow(/sort/i);
  });

  it("preserves duplicate pooling when complete changed-file lists or scalar facts disagree", () => {
    const first = event(5);
    const variant = { ...first, measurements: { ...first.measurements,
      changedFiles: yes(["src/feature.ts"]), hasDescription: yes(false) } };
    const evidence = input([first, variant, first]);
    const expected = aggregateEngineeringEvidence(evidence);
    const actual = reduce(evidence, 1);
    expect(actual.diagnostics).toEqual(expected.diagnostics);
    expect(actual.limitations).toEqual(expected.limitations);
    expect(actual.acceptedWork).toEqual(expected.acceptedWork);
    expect(actual.events[0]?.measurements.changedFiles.status).toBe("unknown");
  });

  it.each([
    ["documentation", ["docs/guide.md"], ["docs/other.md"]],
    ["code", ["src/feature.ts"], ["src/other.ts"]],
  ])("preserves work-level conflict between distinct %s file lists", (_label, firstFiles, secondFiles) => {
    const first = { ...event(5), measurements: { ...event(5).measurements, changedFiles: yes(firstFiles) } };
    const second = { ...event(10), workItemId: first.workItemId,
      measurements: { ...event(10).measurements, changedFiles: yes(secondFiles) },
      acceptance: unknown("unavailable", "not_supported") };
    const evidence = input([first, second]);
    const expected = aggregateEngineeringEvidence(evidence);
    const actual = reduce(evidence, 1);
    expect(actual.diagnostics).toEqual(expected.diagnostics);
    expect(actual.limitations).toEqual(expected.limitations);
    expect(expected.diagnostics.documentationOnlyRate.unknownCount).toBe(1);
  });

  it.runIf(process.env.SCORING_STREAMING_LARGE === "1")("matches the 17,572-event reference in bounded pages", () => {
    const evidence = input(Array.from({ length: 17_572 }, (_, index) => event(index)));
    const expected = aggregateEngineeringEvidence(evidence);
    const actual = reduce(evidence, 500);
    expect(actual.acceptedWork).toEqual(expected.acceptedWork);
    expect(actual.diagnostics).toEqual(expected.diagnostics);
    expect(actual.observedEventCalendar).toEqual(expected.observedEventCalendar);
  }, 180_000);
});
