import { describe, expect, it } from "vitest";
import { prepareLedgerClaim } from "./engineering-evidence";
import { ledgerFixture } from "@/lib/evidence/test-fixtures";
describe("ledger transaction preparation", () => {
  it("allocates immutable owner-scoped claim identity and never accepts claimant verdicts", () => {
    const fixture = ledgerFixture();
    const claim = fixture.claims[0]!.claim;
    const result = prepareLedgerClaim("owner", { action: "claim", owner: "owner", channel: "core", previousRevisionId: null,
      category: claim.category, artifactRevision: claim.artifactRevision, occurredAt: fixture.claims[0]!.occurredAt,
      claim: claim.claim, baseline: claim.baseline, observedResult: claim.observedResult, method: claim.method,
      contributorRole: claim.contributorRole, attribution: claim.attribution, observationPeriod: claim.observationPeriod,
      references: fixture.references.map(ref => ({ artifactUri: ref.artifactUri, artifactRevision: ref.artifactRevision, observedAt: ref.observedAt })),
      limitations: [...claim.limitations], counterevidence: [...claim.counterevidence] }, "2026-09-05T12:00:00Z");
    expect(result.claim.provenance).toBe("self_reported");
    expect(result.claim.ownerId).toBe("owner");
    expect(result.claim.workItemId).toMatch(/^portfolio:owner:/);
    expect(result.claim.revisionId).not.toBe(claim.revisionId);
    expect(result.references.every(ref => ref.retention === "until_owner_withdrawal")).toBe(true);
  });
});
