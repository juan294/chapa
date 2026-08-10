import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "../..");

function workflow(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), "utf8");
}

describe("release verification workflow contract", () => {
  const release = workflow(".github/workflows/release-verification.yml");
  const importer = workflow("scripts/quality/import-ci-evidence.ts");
  const artifactContract = workflow(
    "scripts/quality/release-artifact-contract.json",
  );

  it("accepts the complete immutable candidate identity", () => {
    expect(release).toContain("workflow_dispatch:");
    expect(release).toContain("workflow_call:");
    for (const input of [
      "baselineTag",
      "developCommit",
      "candidateTreeDigest",
      "previewUrl",
      "runId",
      "releasePrRunId",
      "releasePrRunAttempt",
      "preMergeEvidence",
    ]) {
      expect(release).toMatch(new RegExp(`\\n\\s{6}${input}:`));
    }
    expect(release).toContain("ref: ${{ inputs.developCommit }}");
    expect(release).toContain("HEAD^{tree}");
    expect(release).not.toContain("fetch-depth: 0");
    expect(release).toContain('git fetch --no-tags --depth=1 origin "$BASELINE_TAG"');
  });

  it("selects and imports one exact-SHA CI run attempt", () => {
    expect(release).toContain("head_sha=${DEVELOP_COMMIT}");
    expect(release).toContain('.event == "push"');
    expect(release).toContain("run_attempt");
    expect(release).toContain("actions/runs/${CI_RUN_ID}/artifacts");
    expect(release).toContain("gh run download");
    expect(importer).toContain("fragment candidate");
    expect(importer).toContain("does not match selected attempt");
    expect(release).toContain(
      'actions/runs/${RELEASE_PR_RUN_ID}',
    );
    expect(release).toContain('.event == "pull_request"');
    expect(release).toContain('.path == ".github/workflows/ci.yml"');
    expect(release).toContain('.base.ref == "main"');
    expect(release).toContain(
      "actions/runs/${PR_RUN_ID}/attempts/${PR_RUN_ATTEMPT}/jobs",
    );
    expect(release).toContain("pending-production-migrations.json");
    expect(artifactContract).toContain("database.pending-migrations");
    expect(release).toContain(".runId == $runId");
    expect(importer).toContain(
      "`${options.contract.buildArtifactSlug}-${options.runId}-`",
    );
    expect(importer).toContain(
      "artifact.name === expectedBuildArtifactName",
    );
    expect(importer).not.toContain(
      'artifact.name === "nextjs-build"',
    );
    const importJob = release.slice(
      release.indexOf("import-ci:"),
      release.indexOf("import-release-pr:"),
    );
    expect(importJob.indexOf("actions/checkout@v6")).toBeLessThan(
      importJob.indexOf("Download candidate bootstrap"),
    );
  });

  it("selects normalized inputs by exact basename and uses the executable merger", () => {
    expect(artifactContract).toContain(
      '"contract-and-local-journey.json"',
    );
    expect(release).toContain(
      'jq -r \'.ciArtifacts[] | select(.mergeFragment) | .basename\'',
    );
    expect(release).toContain('jq -r \'.journeySidecarBasename\'');
    expect(release).not.toContain(
      "JSON.parse(fs.readFileSync(jsonFiles[0]",
    );
    expect(release).toContain(
      "scripts/quality/merge-release-evidence.ts",
    );
    expect(release).toContain("--pre-merge-evidence");
    expect(release).toContain("--journey-sidecar");
    expect(release).toContain(
      "(.manualObligations | type == \"array\" and length > 0)",
    );
  });

  it("uses the immutable preview URL and candidate identity for required probes", () => {
    expect(release).toContain("EXPECTED_DEPLOYMENT_COMMIT: ${{ inputs.developCommit }}");
    expect(release).toContain('EXPECTED_DEPLOYMENT_ENV: "preview"');
    expect(release).toContain("PLAYWRIGHT_BASE_URL: ${{ inputs.previewUrl }}");
    expect(release).toContain(
      "VERCEL_AUTOMATION_BYPASS_SECRET: ${{ secrets.VERCEL_AUTOMATION_BYPASS_SECRET }}",
    );
    expect(
      release.match(
        /VERCEL_AUTOMATION_BYPASS_SECRET: \$\{\{ secrets\.VERCEL_AUTOMATION_BYPASS_SECRET \}\}/g,
      ),
    ).toHaveLength(3);
    expect(release).toMatch(
      /workflow_call:[\s\S]*?secrets:\s+VERCEL_AUTOMATION_BYPASS_SECRET:\s+required: true/,
    );
    expect(release).toContain("Require Vercel automation bypass secret");
    const previewJob = release.slice(
      release.indexOf("  preview:"),
      release.indexOf("  aggregate:"),
    );
    expect(previewJob.slice(0, previewJob.indexOf("    steps:"))).not.toContain(
      "VERCEL_AUTOMATION_BYPASS_SECRET",
    );
    expect(release).toContain('DEPLOYMENT_SMOKE_STRICT: "true"');
    expect(release).toContain("e2e/release-required.spec.ts");
    expect(release).toContain("--grep @release-required");
    expect(release).toContain("uses: actions/cache@v5");
    expect(release).toContain(
      "key: playwright-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}",
    );
    expect(release).toContain("playwright install-deps chromium");
    expect(release).toContain("--stage pre-merge");
    expect(release).toContain("-git-");
    expect(release).toContain(
      'environments: ["local-contract", "ci-build", "preview"]',
    );
    expect(release).toContain('"authorized-preview-interaction"');
  });

  it("always publishes allowlisted raw and final evidence", () => {
    expect(release).toContain("if: always()");
    expect(release).toContain("name: Release Evidence");
    expect(release).toContain("retention-days: 90");
    expect(release).toContain("retention-days: 30");
    for (const artifact of [
      "candidate.json",
      "release-run.json",
      "evidence-manifest.json",
      "release-report.md",
      "cleanup-proof.json",
    ]) {
      expect(release).toContain(artifact);
    }
    expect(release).toContain("release-diagnostics.json");
    const diagnosticsStep = release.slice(
      release.indexOf("- name: Ensure durable blocked diagnostics exist"),
      release.indexOf("- name: Upload durable final release evidence"),
    );
    expect(diagnosticsStep).toContain(
      "> aggregate/final-evidence/release-diagnostics.json",
    );
    expect(diagnosticsStep).toContain(
      `jq -e 'type == "object" and (.decision | type == "string")'`,
    );
    expect(diagnosticsStep).not.toContain(
      "> aggregate/final-evidence/release-run.json",
    );
    expect(
      workflow("scripts/quality/merge-release-evidence.ts"),
    ).toContain("duplicate scenario fragment");
    expect(release).toContain('test "${{ steps.decision.outputs.decision }}" = "pass"');
  });

  it("does not contain release or deployment mutations", () => {
    expect(release).not.toMatch(/\b(vercel\s+deploy|vercel\s+promote|gh\s+release\s+create)\b/);
    expect(release).not.toMatch(/\bgit\s+(push|merge|tag)\b/);
    expect(release).not.toMatch(/\bsupabase\s+(db\s+push|migration\s+up)\b/);
  });
});

describe("producer workflow evidence contract", () => {
  const ci = workflow(".github/workflows/ci.yml");
  const nightly = workflow(".github/workflows/nightly-prod-probe.yml");

  it("preserves current protected aggregate job names", () => {
    expect(ci).toMatch(/\n\s+name: Test\n/);
    expect(ci).toMatch(/\n\s+name: E2E Tests\n/);
    expect(ci).toMatch(/\n\s+name: Deployment Smoke\n/);
    expect(ci).toMatch(/\n\s+name: Lint & Typecheck\n/);
  });

  it("uploads allowlisted normalized CI evidence even after failures", () => {
    expect(ci).toContain("if: always()");
    expect(ci).toContain("release-evidence-${{ github.run_id }}-${{ github.run_attempt }}");
    expect(ci).toContain(".release-evidence/");
    expect(ci).toContain("retention-days: 30");
    expect(ci).toContain('STATUS="skipped"');
    expect(ci).toContain('scenarioId: "database.pending-migrations"');
    expect(ci).toContain('environment: "ci-build"');
    expect(ci).toContain("evidence: {configuration: [$evidenceUri]");
    expect(ci).toContain('evidence: {ui: [$evidenceUri]');
    expect(ci).toContain(
      "nextjs-build-${{ github.run_id }}-${{ github.run_attempt }}",
    );
    expect(ci).not.toMatch(/\n\s+name: nextjs-build\s*\n/);
  });

  it("keeps nightly runner and production target identities separate", () => {
    expect(nightly).toContain("runnerCommit");
    expect(nightly).toContain("targetCommit");
    expect(nightly).toContain("targetEnvironment");
    expect(nightly).toContain('authorizationEligible: false');
    expect(nightly).toContain('environment: "production"');
    expect(nightly).toContain("nightly-production-fragment.json");
    expect(nightly).toContain("if: always()");
    expect(nightly).toContain("retention-days: 30");
  });
});
