import { describe, expect, it } from "vitest";
import { parseLedgerCommand, validateArtifactLocator } from "./validation";
const now = "2026-09-05T12:00:00Z";
const claim = {
  action: "claim", owner: "owner", channel: "core", previousRevisionId: null,
  category: "delivered_benefit", artifactRevision: "sha", occurredAt: "2026-08-01T00:00:00Z",
  claim: "Reduced response time", baseline: { kind: "measured", value: "100ms" }, observedResult: "80ms",
  method: "Repeated fixed query sample", contributorRole: "Implemented query", attribution: "individual",
  observationPeriod: { startInclusive: "2026-08-02T00:00:00Z", endExclusive: "2026-09-01T00:00:00Z" },
  references: [{ artifactUri: "https://github.com/owner/repo/pull/1", artifactRevision: "sha", observedAt: "2026-09-01T00:00:00Z" }],
  limitations: ["Single workload"], counterevidence: ["Memory overhead increased"],
};
describe("ledger input boundary", () => {
  it.each(["delivered_benefit", "correctness_security", "performance_accessibility", "reliability_cost", "design_documentation", "mentoring_review", "maintenance_incident_recovery"])("admits %s without AI/report or LOC requirements", category => {
    expect(parseLedgerCommand({ ...claim, category }, now)).toMatchObject({ category });
    expect(parseLedgerCommand({ ...claim, channel: "craft", category }, now)).toMatchObject({ channel: "craft" });
  });
  it("rejects claimant-injected trusted identities and verdicts", () => {
    for (const extra of [{ provenance: "independently_corroborated" }, { canonicalProjectId: "github:trusted" }, { evaluator: { id: "reviewer" } }, { status: "accepted" }]) {
      expect(() => parseLedgerCommand({ ...claim, ...extra }, now)).toThrow();
    }
  });
  it("requires explicit attribution, method, baseline and counterevidence field", () => {
    for (const key of ["attribution", "method", "baseline", "counterevidence", "observationPeriod"]) {
      const body = { ...claim } as Record<string, unknown>; delete body[key];
      expect(() => parseLedgerCommand(body, now)).toThrow();
    }
  });
  it("rejects future/malformed observed horizons while allowing earlier work dates", () => {
    expect(parseLedgerCommand(claim, now)).toMatchObject({ occurredAt: claim.occurredAt });
    for (const endExclusive of ["bad", "2026-07-01T00:00:00Z", "2027-01-01T00:00:00Z"]) {
      expect(() => parseLedgerCommand({ ...claim, observationPeriod: { ...claim.observationPeriod, endExclusive } }, now)).toThrow();
    }
  });
  it.each(["http://127.0.0.1/x", "https://127.0.0.1/x", "https://[::1]/x", "https://localhost/x", "https://169.254.169.254/latest", "https://user:secret@example.com/x", "file:///etc/passwd", "data:text/html,secret", "https://example.com:8080/x"])("rejects unsafe artifact locator %s", uri => {
    expect(() => validateArtifactLocator(uri)).toThrow();
  });
  it("bounds locators and bodies without fetching an arbitrary URL", () => {
    expect(validateArtifactLocator("https://git.example.org/private/repo/1")).toBe("https://git.example.org/private/repo/1");
    expect(() => parseLedgerCommand({ ...claim, references: [{ ...claim.references[0], body: "x".repeat(65537) }] }, now)).toThrow();
  });
  it("public aggregate consent requires acknowledging historic downloaded copies", () => {
    expect(() => parseLedgerCommand({ action: "consent", owner: "owner", enabled: true }, now)).toThrow();
    expect(parseLedgerCommand({ action: "consent", owner: "owner", enabled: true, publicationAcknowledged: true }, now)).toMatchObject({ enabled: true });
  });
});
