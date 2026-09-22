import { describe, expect, it } from "vitest";
import { createScoringWindow } from "@chapa/shared";
import { projectEngineeringLedger } from "./projection";
import { ledgerFixture } from "./test-fixtures";
import { deriveCoreEvidenceV7 } from "@/lib/impact/v7-evidence";
const window = createScoringWindow("2026-09-05T12:00:00Z");
describe("ledger projection", () => {
  it("keeps self-reported claims unassessed and cannot promote PR/CI metadata to outcomes", () => {
    const snapshot = ledgerFixture();
    const input = projectEngineeringLedger({ ...snapshot, assessments: [] }, window);
    const core = deriveCoreEvidenceV7(input);
    expect(core.observedCounts.deliveryUnits).toBe(0);
    expect(core.observedCounts.quality.verification).toBe(0);
    expect(input.scope.sources[0]?.status).toBe("partial");
  });
  it("a qualified practice verdict cannot manufacture artifact acceptance", () => {
    const input = projectEngineeringLedger(ledgerFixture(), window);
    const core = deriveCoreEvidenceV7(input);
    expect(core.observedCounts.quality.verification).toBe(1);
    expect(core.observedCounts.deliveryUnits).toBe(0);
  });
  it("explicit reviewed acceptance has its own event time, independent of upload and measurement horizon", () => {
    const snapshot = ledgerFixture({ accepted: true });
    const input = projectEngineeringLedger(snapshot, window);
    const accepted = input.events.find(event => event.acceptance.status === "observed");
    expect(accepted?.occurredAt).toBe("2026-08-01T00:00:00.000Z");
    expect(deriveCoreEvidenceV7(input).observedCounts.deliveryUnits).toBe(1);
  });
  it("does not rejuvenate old accepted work from a current assessment", () => {
    const snapshot = ledgerFixture({ accepted: true, occurredAt: "2024-08-01T00:00:00Z" });
    const core = deriveCoreEvidenceV7(projectEngineeringLedger(snapshot, window));
    expect(core.observedCounts.deliveryUnits).toBe(0);
    expect(core.observedCounts.quality.verification).toBe(0);
  });
  it("preserves core/Craft separation and deduplicates linked work", () => {
    const snapshot = ledgerFixture({ accepted: true });
    const doubled = { ...snapshot, claims: [...snapshot.claims, ...snapshot.claims], assessments: [...snapshot.assessments, ...snapshot.assessments] };
    expect(deriveCoreEvidenceV7(projectEngineeringLedger(doubled, window)).observedCounts.deliveryUnits).toBe(1);
    expect(projectEngineeringLedger({ ...snapshot, claims: snapshot.claims.map(row => ({ ...row, channel: "craft" as const })) }, window).events).toEqual([]);
  });
  it("rejects missing refs, wrong claim revisions, claimant reviewers and declared conflicts", () => {
    const snapshot = ledgerFixture();
    for (const patch of [
      { evidenceReferenceIds: [] },

      { evaluator: { id: snapshot.ownerId, kind: "human" as const, version: "1", independent: true } },
      { claimRevisionId: "unrelated" },
    ]) {
      const changed = { ...snapshot, assessments: snapshot.assessments.map(row => ({ ...row, assessment: { ...row.assessment, ...patch } })) };
      expect(deriveCoreEvidenceV7(projectEngineeringLedger(changed, window)).observedCounts.quality.verification).toBe(0);
    }
  });
});

describe("ledger replay boundaries", () => {
  it("excludes conflicts and future reviewed acceptance", () => {
    const snapshot = ledgerFixture({ accepted: true });
    expect(projectEngineeringLedger({ ...snapshot, assessments: snapshot.assessments.map(row => ({ ...row, conflicts: ["Financial interest"] })) }, window).events).toEqual([]);
    expect(projectEngineeringLedger({ ...snapshot, assessments: snapshot.assessments.map(row => ({ ...row, facts: { ...row.facts!, acceptance: { ...row.facts!.acceptance!, acceptedAt: "2027-01-01T00:00:00Z" } } })) }, window).events).toEqual([]);
  });
  it("a subsequent retraction applies only after its recorded time", () => {
    const snapshot = ledgerFixture();
    const original = snapshot.assessments[0]!;
    const retracted = { ...original, assessment: { ...original.assessment, revision: 2, revisionId: "assessment:2", supersedesRevisionId: original.assessment.revisionId, action: "retract" as const, status: "retracted" as const, recordedAt: "2026-09-04T00:00:00Z", assessedAt: "2026-09-04T00:00:00Z" } };
    const both = { ...snapshot, assessments: [...snapshot.assessments, retracted] };
    expect(projectEngineeringLedger(both, createScoringWindow("2026-09-03T00:00:00Z")).events).toHaveLength(1);
    expect(projectEngineeringLedger(both, window).events).toHaveLength(0);
  });
});

it("keeps conflicting canonical project mappings unknown instead of last-writer wins", () => {
  const snapshot = ledgerFixture({ accepted: true });
  const claim = snapshot.claims[0]!;
  const assessment = snapshot.assessments[0]!;
  const otherClaim = { ...claim, claim: { ...claim.claim, claimId: "other-claim", revisionId: "other-claim-rev", workItemId: "other-work" } };
  const otherAssessment = { ...assessment, assessment: { ...assessment.assessment, assessmentId: "other-assessment", revisionId: "other-assessment-rev", claimRevisionId: "other-claim-rev", workItemId: "other-work" },
    facts: { ...assessment.facts!, identity: { ...assessment.facts!.identity, workKey: "other-work", repository: { provider: "github" as const, host: "github.com", subjectId: "owner", repositoryId: "different-repository" } } } };
  const result = projectEngineeringLedger({ ...snapshot, claims: [...snapshot.claims, otherClaim], assessments: [...snapshot.assessments, otherAssessment] }, window);
  expect(result.events).toEqual([]);
  expect(result.scope.sources[0]?.status).toBe("partial");
});

it("unions compatible criterion backing independently of review order", () => {
  const base = ledgerFixture({ accepted: true });
  const ref = { ...base.references[0]!, referenceId: "ref:2", artifactUri: "https://private.example.org/verification" };
  const claim = { ...base.claims[0]!, claim: { ...base.claims[0]!.claim, evidenceReferenceIds: ["ref:1", "ref:2"] } };
  const review = { ...base.assessments[0]!, facts: null, assessment: { ...base.assessments[0]!.assessment, assessmentId: "rationale:1", revisionId: "rationale-rev:1", criterion: "rationale" as const, evidenceReferenceIds: ["ref:2"] } };
  const snapshot = { ...base, claims: [claim], references: [...base.references, ref], assessments: [...base.assessments, review] };
  for (const assessments of [snapshot.assessments, [...snapshot.assessments].reverse()]) {
    const result = deriveCoreEvidenceV7(projectEngineeringLedger({ ...snapshot, assessments }, window));
    expect(result.observedCounts.quality.rationale).toBe(1);
    expect(result.observedCounts.quality.verification).toBe(1);
  }
});

it("uses distinct event identities for different artifact revisions of one accepted work", () => {
  const base = ledgerFixture({ accepted: true });
  const second = { ...base.claims[0]!, claim: { ...base.claims[0]!.claim, claimId: "second", revisionId: "second:1", artifactRevision: "sha2", evidenceReferenceIds: ["ref:2"] } };
  const assessment = { ...base.assessments[0]!, assessment: { ...base.assessments[0]!.assessment, assessmentId: "second-review", revisionId: "second-review:1", claimRevisionId: "second:1", evidenceReferenceIds: ["ref:2"] }, facts: { ...base.assessments[0]!.facts!, identity: { ...base.assessments[0]!.facts!.identity, referenceIds: ["ref:2"] }, acceptance: { ...base.assessments[0]!.facts!.acceptance!, referenceIds: ["ref:2"] } } };
  const input = projectEngineeringLedger({ ...base, claims: [...base.claims, second], references: [...base.references, { ...base.references[0]!, referenceId: "ref:2", artifactRevision: "sha2" }], assessments: [...base.assessments, assessment] }, window);
  expect(new Set(input.events.map(event => event.eventId)).size).toBe(2);
  expect(deriveCoreEvidenceV7(input).observedCounts.deliveryUnits).toBe(1);
});

it("reconciles selected acceptance with and without its provider while retaining separately dated practice", async () => {
  const { mergeEngineeringEvidence } = await import("@chapa/shared");
  const base = ledgerFixture({ accepted: true });
  const reviewed = base.assessments[0]!;
  const facts = { ...reviewed.facts!, occurredAt: "2026-08-10T00:00:00Z", identity: { ...reviewed.facts!.identity, equivalentWork: { canonicalWorkItemId: "external:work", acceptedEventId: "external:accepted" } } };
  const ledger = projectEngineeringLedger({ ...base, assessments: [{ ...reviewed, facts }] }, window);
  expect(deriveCoreEvidenceV7(ledger).observedCounts.deliveryUnits).toBe(1);
  expect(deriveCoreEvidenceV7(ledger).observedCounts.quality.verification).toBe(1);
  const accepted = ledger.events.find(event => event.acceptance.status === "observed")!;
  const provider = { ...ledger, assessments: [], equivalentWorkItems: [], events: [{ ...accepted, provider: "github" as const, host: "github.com", repositoryId: "repo", workItemId: "external:work", artifactReferenceIds: ["provider-ref"] }],
    repositoryAliases: [...ledger.repositoryAliases, { repositories: [{ provider: "github" as const, host: "github.com", subjectId: "owner", repositoryId: "repo" }], canonicalProjectId: accepted.canonicalProjectId, verifiedAt: window.referenceTime, evidenceReferenceIds: ["provider-ref"] }],
    scope: { ...ledger.scope, sources: [{ ...ledger.scope.sources[0]!, source: { provider: "github" as const, host: "github.com", subjectId: "owner" }, repositoryIds: ["repo"] }] } };
  const core = deriveCoreEvidenceV7(mergeEngineeringEvidence(ledger, provider));
  expect(core.observedCounts.deliveryUnits).toBe(1);
  expect(core.observedCounts.quality.verification).toBe(1);
  expect(ledger.events.some(event => event.kind === "practice_evidence" && event.occurredAt === "2026-08-10T00:00:00.000Z")).toBe(true);
});

it("withholds conflicting old/recent documentation acceptance before any known core activity", () => {
  const base = ledgerFixture({ accepted: true, occurredAt: "2024-08-01T00:00:00Z" });
  const first = base.assessments[0]!;
  const docs = { ...first.facts!, kind: "documentation_design" as const, categories: [{ category: "documentation_design" as const, referenceIds: ["ref:1"] }] };
  const secondClaim = { ...base.claims[0]!, claim: { ...base.claims[0]!.claim, claimId: "second", revisionId: "second:1", evidenceReferenceIds: ["ref:2"] } };
  const second = { ...first, assessment: { ...first.assessment, assessmentId: "second", revisionId: "second-review", claimRevisionId: "second:1", evidenceReferenceIds: ["ref:2"] }, facts: { ...docs, occurredAt: "2026-08-01T00:00:00Z", identity: { ...docs.identity, referenceIds: ["ref:2"] }, categories: [{ category: "documentation_design" as const, referenceIds: ["ref:2"] }], acceptance: { ...docs.acceptance!, acceptedAt: "2026-08-01T00:00:00Z", referenceIds: ["ref:2"] } } };
  const projected = projectEngineeringLedger({ ...base, claims: [...base.claims, secondClaim], references: [...base.references, { ...base.references[0]!, referenceId: "ref:2" }], assessments: [{ ...first, facts: docs }, second] }, window);
  expect(projected.events).toEqual([]);
  expect(deriveCoreEvidenceV7(projected).observedCounts.deliveryUnits).toBe(0);
  expect(deriveCoreEvidenceV7(projected).observedCounts).toEqual(deriveCoreEvidenceV7({ ...projected, events: [], assessments: [] }).observedCounts);
});

it.each(["automated_assessment", "independently_corroborated"] as const)("preserves linked acceptance with human plus %s evidence in either order", provenance => {
  const base = ledgerFixture({ accepted: true });
  const first = base.assessments[0]!;
  const facts = { ...first.facts!, identity: { ...first.facts!.identity, equivalentWork: { canonicalWorkItemId: "linked:work", acceptedEventId: "linked:accepted" } } };
  const human = { ...first, facts, assessment: { ...first.assessment, provenance: "human_assessed" as const } };
  const claim = { ...base.claims[0]!, claim: { ...base.claims[0]!.claim, claimId: "second", revisionId: "second:1", evidenceReferenceIds: ["ref:2"] } };
  const second = { ...first, facts: { ...facts, identity: { ...facts.identity, referenceIds: ["ref:2"] }, acceptance: { ...facts.acceptance!, referenceIds: ["ref:2"] } },
    assessment: { ...first.assessment, assessmentId: "second", revisionId: "second-review", claimRevisionId: "second:1", evidenceReferenceIds: ["ref:2"], provenance,
      evaluator: { ...first.assessment.evaluator, kind: provenance === "automated_assessment" ? "model" as const : "human" as const } } };
  const snapshot = { ...base, claims: [...base.claims, claim], references: [...base.references, { ...base.references[0]!, referenceId: "ref:2" }], assessments: [human, second] };
  const projections = [snapshot, { ...snapshot, claims: [...snapshot.claims].reverse(), assessments: [...snapshot.assessments].reverse() }].map(value => projectEngineeringLedger(value, window));
  for (const projected of projections) expect(deriveCoreEvidenceV7(projected).observedCounts.deliveryUnits).toBe(1);
  expect(projections[0]!.events.find(event => event.eventId === "linked:accepted")).toEqual(projections[1]!.events.find(event => event.eventId === "linked:accepted"));
});
