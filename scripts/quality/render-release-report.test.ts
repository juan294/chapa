import { describe, expect, it } from "vitest";
import {
  analyzeReleaseRun,
  type RequiredCatalog,
  type ReleaseRun,
} from "./contracts";
import { renderReleaseReport } from "./render-release-report";

const catalog: RequiredCatalog = {
  schemaVersion: 1,
  scenarios: [
    {
      id: "deployment.preview-identity",
      owner: "release-operator",
      runner: "playwright",
      selector: "@release-required deployment.preview-identity",
      environments: ["preview"],
      safetyClass: "read-only",
      required: true,
      expectedOracles: ["http", "deployment-identity"],
      evidenceRetentionDays: 90,
    },
  ],
};

const run: ReleaseRun = {
  schemaVersion: 1,
  runId: "release-20260726-report",
  generatedAt: "2026-07-26T10:00:00.000Z",
  baselineTag: "v2.19.0",
  candidate: {
    developCommit: "a".repeat(40),
    candidateTreeDigest: "b".repeat(40),
    previewUrl: "https://candidate.example.test/",
    previewIdentity: "a".repeat(40),
  },
  obligations: [
    {
      scenarioId: "deployment.preview-identity",
      environment: "preview",
      required: true,
      status: "pending",
    },
  ],
  results: [
    {
      scenarioId: "deployment.preview-identity",
      environment: "preview",
      status: "passed",
      startedAt: "2026-07-26T10:01:00.000Z",
      finishedAt: "2026-07-26T10:02:00.000Z",
      runner: "playwright",
      evidence: {
        http: ["artifacts/version.json"],
        "deployment-identity": ["artifacts/preview-sha.txt"],
      },
      fixtures: [],
    },
  ],
  exceptions: [],
  manualObligations: [
    {
      id: "rollback.readiness",
      executor: "release-operator",
      executedAt: "2026-07-26T10:03:00.000Z",
      environment: "preview",
      candidate: "a".repeat(40),
      result: "Rollback readiness reviewed",
      status: "passed",
      evidence: ["artifacts/rollback-review.md"],
    },
  ],
  exploratoryCharters: [
    {
      id: "charter-report",
      candidate: "a".repeat(40),
      executorContext: "fresh-report-context",
      timeboxMinutes: 30,
      riskHypothesis: "The release could regress a high-risk interaction",
      changedCapability: "deployment identity",
      actors: ["release operator"],
      surfaces: ["/api/version"],
      states: ["deployed candidate"],
      externalSeams: ["Vercel"],
      environment: "preview",
      allowedOperations: ["read"],
      safetyClass: "read-only",
      candidateRecord: "quality/evidence/runs/release/candidate.json",
      maneuvers: Array.from({ length: 8 }, (_, index) => ({
        number: index + 1,
        status: "passed" as const,
        evidence: `artifacts/charter-${index + 1}.md`,
      })),
      findings: [],
      skippedHighRiskAreas: [],
      fixtures: [],
      decision: "pass",
    },
  ],
  rollbackReference: "docs/runbooks/rollback.md",
  tagAuthorization: { status: "pending" },
};

describe("renderReleaseReport", () => {
  it("is stable and includes identities, results, rollback, and pending authorization", () => {
    const analysis = analyzeReleaseRun(
      catalog,
      run,
      {
        stage: "pre-merge",
        now: new Date("2026-07-26T12:00:00.000Z"),
      },
    );

    const first = renderReleaseReport(catalog, run, analysis);
    const second = renderReleaseReport(catalog, run, analysis);

    expect(first).toBe(second);
    expect(first).toContain("# Release Evidence — release-20260726-report");
    expect(first).toContain("## Decision\n\nPASS");
    expect(first).toContain("- Stage: pre-merge");
    expect(first).toContain("- Generated at: 2026-07-26T10:00:00.000Z");
    expect(first).toContain(`- Develop commit: ${"a".repeat(40)}`);
    expect(first).toContain(
      "| deployment.preview-identity | preview | yes | passed |",
    );
    expect(first).toContain(
      "| charter-report | deployment identity | preview | 30 minutes | read-only | The release could regress a high-risk interaction | pass | 8/8 | 0 | 0 | quality/evidence/runs/release/candidate.json |",
    );
    expect(first).toContain(
      `| rollback.readiness | release-operator | 2026-07-26T10:03:00.000Z | preview | ${"a".repeat(40)} | passed | Rollback readiness reviewed | artifacts/rollback-review.md |`,
    );
    expect(first).toContain("## Rollback");
    expect(first).toContain("docs/runbooks/rollback.md");
    expect(first).toContain("## Tag authorization");
    expect(first).toContain("- Status: pending");
  });
});
