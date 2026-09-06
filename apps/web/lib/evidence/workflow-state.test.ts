import { describe, expect, it } from "vitest";
import { ledgerFixture } from "./test-fixtures";
import { evidenceWorkflowItems, summarizeEvidenceWorkflow } from "./workflow-state";
import type { EngineeringLedgerSnapshot } from "./types";

const base = ledgerFixture({ accepted: true });

/** The same claim, submitted but not yet ruled on by anyone. */
const unassessed: EngineeringLedgerSnapshot = { ...base, assessments: [] };

describe("owner evidence workflow states", () => {
  it("shows an accountable acceptance as accepted", () => {
    const [item] = evidenceWorkflowItems(base);

    expect(item).toMatchObject({
      claimId: "claim:1",
      workItemId: "ledger:owner:work:1",
      channel: "core",
      state: "accepted",
      assessedCriteria: [{ criterion: "verification", status: "accepted" }],
    });
  });

  it("shows a submitted claim with no assessment as pending, not accepted", () => {
    expect(evidenceWorkflowItems(unassessed)[0]!.state).toBe("pending");
    expect(evidenceWorkflowItems(unassessed)[0]!.assessedCriteria).toEqual([]);
  });

  it("shows a rejected assessment as rejected", () => {
    const rejected: EngineeringLedgerSnapshot = { ...base,
      assessments: [{ ...base.assessments[0]!, assessment: { ...base.assessments[0]!.assessment, status: "rejected", reasonCode: "criterion_not_demonstrated" } }] };

    expect(evidenceWorkflowItems(rejected)[0]!.state).toBe("rejected");
  });

  it("treats an unassessed verdict as still pending", () => {
    const pending: EngineeringLedgerSnapshot = { ...base,
      assessments: [{ ...base.assessments[0]!, assessment: { ...base.assessments[0]!.assessment, status: "unassessed", reasonCode: "not_assessed" } }] };

    expect(evidenceWorkflowItems(pending)[0]!.state).toBe("pending");
  });

  it("shows the owner's own retraction as withdrawn regardless of past verdicts", () => {
    const withdrawn: EngineeringLedgerSnapshot = { ...base,
      claims: [{ ...base.claims[0]!, claim: { ...base.claims[0]!.claim, revisionId: "claim-rev:2", revision: 2, supersedesRevisionId: "claim-rev:1", action: "retract" } }] };

    expect(evidenceWorkflowItems(withdrawn)[0]!.state).toBe("withdrawn");
  });

  it("ignores a retracted assessment when deciding the state", () => {
    const retracted: EngineeringLedgerSnapshot = { ...base,
      assessments: [{ ...base.assessments[0]!, assessment: { ...base.assessments[0]!.assessment, status: "retracted" } }] };

    expect(evidenceWorkflowItems(retracted)[0]!.state).toBe("pending");
  });

  it("reads only the latest revision of a claim", () => {
    const corrected: EngineeringLedgerSnapshot = { ...base,
      claims: [
        base.claims[0]!,
        { ...base.claims[0]!, claim: { ...base.claims[0]!.claim, revisionId: "claim-rev:2", revision: 2, supersedesRevisionId: "claim-rev:1", action: "correct" } },
      ] };

    const items = evidenceWorkflowItems(corrected);
    expect(items).toHaveLength(1);
    expect(items[0]!.revisionId).toBe("claim-rev:2");
    // The assessment named the first revision, so the correction is pending again.
    expect(items[0]!.state).toBe("pending");
  });

  it("counts each state and reports an empty Craft portfolio", () => {
    expect(summarizeEvidenceWorkflow(evidenceWorkflowItems(base))).toEqual({
      pending: 0, accepted: 1, rejected: 0, withdrawn: 0, craftPortfolioEmpty: true,
    });
  });

  it("stops reporting an empty Craft portfolio once a Craft episode is submitted", () => {
    const withCraft: EngineeringLedgerSnapshot = { ...base,
      claims: [...base.claims, { ...base.claims[0]!, channel: "craft", claim: { ...base.claims[0]!.claim, claimId: "claim:2", revisionId: "claim-rev:craft" } }] };

    const summary = summarizeEvidenceWorkflow(evidenceWorkflowItems(withCraft));
    expect(summary.craftPortfolioEmpty).toBe(false);
    expect(summary.pending).toBe(1);
  });
});
