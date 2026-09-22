import { describe, expect, it } from "vitest";
import { reconcileCraftIdentity } from "./craft-identity";
import { ledgerFixture } from "./test-fixtures";
const time = "2026-09-05T12:00:00Z";
describe("Craft ledger reconciliation", () => {
  it("coalesces fresh claim/reference identities for the same retained artifact", () => {
    const base = ledgerFixture(); const claim = base.claims[0]!.claim; const assessment = base.assessments[0]!.assessment;
    const second = { ...claim, claimId: "second", revisionId: "second:1", workItemId: "work:2", evidenceReferenceIds: ["ref:2"] };
    const secondAssessment = { ...assessment, assessmentId: "second", revisionId: "second:1", claimRevisionId: second.revisionId, workItemId: second.workItemId, evidenceReferenceIds: ["ref:2"] };
    const facts = base.assessments[0]!.facts!;
    const metadata = new Map([[assessment.revisionId, { authorization: {}, facts }], [secondAssessment.revisionId, { authorization: {}, facts: { ...facts, identity: { ...facts.identity, referenceIds: ["ref:2"] } } }]]);
    const refs = ["ref:1", "ref:2"].map(reference_id => ({ reference_id, owner_handle: "owner", retention: "until_owner_withdrawal", artifact_uri: "https://example.org/result", artifact_revision: "sha" }));
    const result = reconcileCraftIdentity("owner", [claim, second], [assessment, secondAssessment], metadata, refs, time);
    expect(new Set(result.claims.map(row => row.workItemId)).size).toBe(1);
    expect(result.assessments.every(row => row.status === "accepted")).toBe(true);
    const conflicting = new Map(metadata); conflicting.set(secondAssessment.revisionId, { authorization: {}, facts: { ...facts, identity: { ...facts.identity, workKey: "different", referenceIds: ["ref:2"] } } });
    expect(reconcileCraftIdentity("owner", [claim, second], [assessment, secondAssessment], conflicting, refs, time).assessments.every(row => row.status === "unassessed")).toBe(true);
  });
  it("withholds ledger verdicts whose episode identity is unassessed", () => {
    const base = ledgerFixture(); const assessment = base.assessments[0]!.assessment;
    const result = reconcileCraftIdentity("owner", base.claims.map(row => row.claim), [assessment], new Map([[assessment.revisionId, { authorization: {}, facts: null }]]), [], time);
    expect(result.assessments[0]?.status).toBe("unassessed");
    expect(result.assessments[0]?.revisionId).toBe(assessment.revisionId);
  });
});
