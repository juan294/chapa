import { describe, expect, it } from "vitest";
import { createScoringWindow, type CraftEpisode, type PrivateCriterionAssessment, type PrivateEvidenceClaim } from "@chapa/shared";
import { buildCraftInputs, calculateCraftV7, type CraftAssessmentContext } from "./craft-v7";

const window = createScoringWindow("2026-09-05T12:00:00Z");
const criteria = ["framing", "verification_debugging", "tool_judgment", "accepted_outcome"] as const;
const occurredAt = "2026-08-01T00:00:00.000Z";
const recordedAt = "2026-08-03T00:00:00.000Z";
function fixture(count = 1): CraftAssessmentContext {
  const claims: PrivateEvidenceClaim[] = [];
  const episodes: CraftEpisode[] = [];
  for (let index = 0; index < count; index++) {
    const workItemId = `work:${index}`;
    const claim: PrivateEvidenceClaim = {
      claimId: `claim:${index}`, revisionId: `claim-revision:${index}`, revision: 1, recordedAt,
      supersedesRevisionId: null, action: "create", ownerId: "owner", category: "delivered_benefit", workItemId,
      artifactRevision: "sha", claim: "A bounded task", baseline: { kind: "not_available", explanation: "No earlier measurement" },
      observedResult: "Accepted result", method: "Review", contributorRole: "Author", attribution: "individual",
      observationPeriod: { startInclusive: occurredAt, endExclusive: "2026-08-02T00:00:00Z" },
      evidenceReferenceIds: [`artifact:${index}`], provenance: "self_reported", limitations: [], counterevidence: [],
    };
    claims.push(claim);
    const assessments = criteria.map((criterion): PrivateCriterionAssessment & { criterion: typeof criterion } => ({
      assessmentId: `${index}:${criterion}`, revisionId: `${index}:${criterion}:1`, revision: 1,
      supersedesRevisionId: null, action: "create", recordedAt, claimRevisionId: claim.revisionId,
      workItemId, criterion, status: "accepted", rubricVersion: "v7", reasonCode: "criterion_demonstrated",
      evaluator: { id: "reviewer", kind: "human", version: "1", independent: true }, rationale: "Examined the artifact and outcome",
      assessedAt: recordedAt, evidenceReferenceIds: claim.evidenceReferenceIds, provenance: "independently_corroborated",
    }));
    episodes.push({ episodeId: `episode:${index}`, workItemId, occurredAt, artifactRevision: "sha", evidenceReferenceIds: claim.evidenceReferenceIds, assessments });
  }
  return { ownerId: "owner", window, claims, portfolios: [{ schemaVersion: "v7", uploadId: "upload", ownerId: "owner", receivedAt: recordedAt,
    reportPeriod: { startInclusive: occurredAt, endExclusive: "2026-08-02T00:00:00Z" }, coverage: "complete", episodes, diagnostics: null }],
    authorizedEvaluatorIds: ["reviewer"], referenceIds: claims.flatMap(claim => claim.evidenceReferenceIds) };
}

describe("Craft v7 evidence", () => {
  it("leaves absent portfolios not observed without manufacturing a zero", () => {
    expect(calculateCraftV7(buildCraftInputs({ ...fixture(), portfolios: [] })).result).toEqual({ status: "not_observed" });
  });
  it("uses four capped criteria, full precision trace and separate Artificer", () => {
    const inputs = buildCraftInputs(fixture(8));
    const output = calculateCraftV7(inputs);
    expect(output.result).toMatchObject({ status: "observed", composite: { kind: "point", value: 100 }, descriptor: "Artificer" });
    expect(output.trace.criteria.framing.weighted).toEqual({ lower: 25, upper: 25 });
    expect(calculateCraftV7(buildCraftInputs(fixture(9))).result).toEqual(output.result);
  });
  it("unions uploads and deduplicates each work item per criterion", () => {
    const context = fixture(2);
    const portfolio = context.portfolios[0]!;
    expect(buildCraftInputs({ ...context, portfolios: [portfolio, { ...portfolio, uploadId: "again" }] })).toEqual(buildCraftInputs(context));
  });
  it("does not convert owner, unauthorized or self-reported verdicts into credit", () => {
    for (const patch of [{ evaluator: { id: "owner", kind: "human" as const, version: "1", independent: true } },
      { provenance: "self_reported" as const }, { evaluator: { id: "stranger", kind: "human" as const, version: "1", independent: true } },
      { rationale: "" }, { rubricVersion: "other" }, { evidenceReferenceIds: ["unrelated"] }]) {
      const context = fixture();
      const portfolio = context.portfolios[0]!;
      const episodes = portfolio.episodes.map(episode => ({ ...episode, assessments: episode.assessments.map(a => ({ ...a, ...patch })) }));
      const inputs = buildCraftInputs({ ...context, portfolios: [{ ...portfolio, episodes }] });
      expect(inputs.counts.accepted_outcome).toEqual({ lower: 0, upper: 1 });
      expect(calculateCraftV7(inputs).result).toMatchObject({ descriptor: null });
    }
  });
  it("requires all four corroborated criteria on the SAME episode", () => {
    const context = fixture(8);
    const portfolio = context.portfolios[0]!;
    const episodes = portfolio.episodes.map((episode, i) => ({ ...episode, assessments: episode.assessments.map((a, j) => i % 4 === j ? { ...a, status: "rejected" as const, reasonCode: "criterion_not_demonstrated" as const } : a) }));
    expect(calculateCraftV7(buildCraftInputs({ ...context, portfolios: [{ ...portfolio, episodes }] })).result).toMatchObject({ descriptor: null });
  });
  it("cannot assemble independent corroboration from different artifact episodes", () => {
    const context = fixture(8);
    const portfolio = context.portfolios[0]!;
    const first = portfolio.episodes.map(episode => ({ ...episode, assessments: episode.assessments.map((a, i) => i < 2 ? a : { ...a, provenance: "automated_assessment" as const, evaluator: { ...a.evaluator, kind: "model" as const } }) }));
    const second = portfolio.episodes.map(episode => ({ ...episode, episodeId: `${episode.episodeId}:other`, artifactRevision: "other-sha", evidenceReferenceIds: episode.evidenceReferenceIds.map(ref => `${ref}:other`),
      assessments: episode.assessments.map((a, i) => ({ ...a, assessmentId: `${a.assessmentId}:other`, revisionId: `${a.revisionId}:other`, claimRevisionId: `${a.claimRevisionId}:other`, evidenceReferenceIds: a.evidenceReferenceIds.map(ref => `${ref}:other`),
        ...(i < 2 ? { provenance: "automated_assessment" as const, evaluator: { ...a.evaluator, kind: "model" as const } } : {}) })) }));
    const otherClaims = context.claims.map(claim => ({ ...claim, claimId: `${claim.claimId}:other`, revisionId: `${claim.revisionId}:other`, artifactRevision: "other-sha", evidenceReferenceIds: claim.evidenceReferenceIds.map(ref => `${ref}:other`) }));
    const inputs = buildCraftInputs({ ...context, claims: [...context.claims, ...otherClaims], referenceIds: [...context.referenceIds, ...otherClaims.flatMap(claim => claim.evidenceReferenceIds)], portfolios: [{ ...portfolio, episodes: [...first, ...second] }] });
    expect(inputs.independentlyCorroboratedCompleteEpisodes).toBe(0);
    expect(calculateCraftV7(inputs).result).toMatchObject({ descriptor: null });
  });
  it("resolves correction and retraction chains as of the reference instant", () => {
    const context = fixture();
    const portfolio = context.portfolios[0]!;
    const episode = portfolio.episodes[0]!;
    const first = episode.assessments[0]!;
    const correction = { ...first, revisionId: "correction", revision: 2, supersedesRevisionId: first.revisionId,
      action: "retract" as const, status: "retracted" as const, recordedAt: "2026-09-04T00:00:00Z", assessedAt: "2026-09-04T00:00:00Z" };
    const updated = { ...context, portfolios: [{ ...portfolio, episodes: [{ ...episode, assessments: [...episode.assessments, correction] }] }] };
    expect(buildCraftInputs(updated).counts.framing).toEqual({ lower: 0, upper: 1 });
    expect(buildCraftInputs({ ...updated, window: createScoringWindow("2026-09-03T00:00:00Z") }).counts.framing).toEqual({ lower: 1, upper: 1 });
  });
  it("does not count invalid, branching, or disconnected revision chains", () => {
    const context = fixture();
    const portfolio = context.portfolios[0]!;
    const episode = portfolio.episodes[0]!;
    const assessments = episode.assessments.map(a => ({ ...a, revision: 2, action: "correct" as const, supersedesRevisionId: "missing" }));
    expect(buildCraftInputs({ ...context, portfolios: [{ ...portfolio, episodes: [{ ...episode, assessments }] }] }).counts.framing.lower).toBe(0);
  });
  it("does not rejuvenate old episodes by uploading again or borrowing unrelated new evidence", () => {
    const context = fixture();
    const portfolio = context.portfolios[0]!;
    const episodes = portfolio.episodes.map(e => ({ ...e, occurredAt: "2024-01-01T00:00:00Z" }));
    expect(buildCraftInputs({ ...context, portfolios: [{ ...portfolio, receivedAt: window.referenceTime, episodes }] }).eligibleEpisodes).toBe(0);
    const unrelated = portfolio.episodes.map(e => ({ ...e, artifactRevision: "new-sha", evidenceReferenceIds: ["new-artifact"] }));
    expect(buildCraftInputs({ ...context, portfolios: [{ ...portfolio, episodes: unrelated }] }).counts.framing.lower).toBe(0);
  });
  it("does not equate episode date with its later outcome measurement horizon", () => {
    const context = fixture();
    const claims = context.claims.map(claim => ({ ...claim, observationPeriod: { startInclusive: "2026-08-02T00:00:00Z", endExclusive: "2026-08-03T00:00:00Z" } }));
    expect(buildCraftInputs({ ...context, claims }).counts.accepted_outcome.lower).toBe(1);
  });
  it.each([
    { startInclusive: "bad", endExclusive: "2026-08-02T00:00:00Z" },
    { startInclusive: "2026-08-02T00:00:00Z", endExclusive: "2026-08-01T00:00:00Z" },
    { startInclusive: "2027-01-01T00:00:00Z", endExclusive: "2027-01-02T00:00:00Z" },
    { startInclusive: "2026-07-31T00:00:00Z", endExclusive: "2027-01-02T00:00:00Z" },
  ])("does not accept malformed or not-yet-observed horizons", observationPeriod => {
    const context = fixture();
    const claims = context.claims.map(claim => ({ ...claim, observationPeriod }));
    expect(buildCraftInputs({ ...context, claims }).counts.accepted_outcome.lower).toBe(0);
  });
  it("accepts equivalent deserialized window key ordering", () => {
    const context = fixture();
    const reordered = Object.fromEntries(Object.entries(window).reverse()) as unknown as typeof window;
    expect(buildCraftInputs({ ...context, window: reordered }).counts).toEqual(buildCraftInputs(context).counts);
  });
  it("rejects nonfinite and inconsistent calculator inputs", () => {
    const inputs = buildCraftInputs(fixture());
    expect(() => calculateCraftV7({ ...inputs, eligibleEpisodes: Infinity })).toThrow();
    expect(() => calculateCraftV7({ ...inputs, counts: { ...inputs.counts, framing: { lower: NaN, upper: 1 } } })).toThrow();
    expect(() => calculateCraftV7({ ...inputs, independentlyCorroboratedCompleteEpisodes: 2 })).toThrow();
  });
});
