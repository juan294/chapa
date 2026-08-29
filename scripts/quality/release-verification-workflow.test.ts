import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "../..");

function workflow(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), "utf8");
}

describe("release verification workflow contract", () => {
  const release = workflow(".github/workflows/release-verification.yml");

  it("accepts exactly the five retained immutable candidate inputs", () => {
    expect(release).toContain("workflow_dispatch:");
    expect(release).toContain("workflow_call:");
    for (const input of [
      "baselineTag",
      "developCommit",
      "candidateTreeDigest",
      "previewUrl",
      "runId",
    ]) {
      expect(release).toMatch(new RegExp(`\\n\\s{6}${input}:`));
    }
    for (const removedInput of ["releasePrRunId", "releasePrRunAttempt", "preMergeEvidence"]) {
      expect(release).not.toContain(removedInput);
    }
  });

  it("checks out the exact developCommit with minimal history", () => {
    expect(release).toContain("ref: ${{ inputs.developCommit }}");
    expect(release).toContain("fetch-depth: 1");
    expect(release).not.toContain("fetch-depth: 0");
  });

  it("verifies HEAD equals developCommit and HEAD tree equals candidateTreeDigest", () => {
    expect(release).toContain('ACTUAL_COMMIT="$(git rev-parse HEAD)"');
    expect(release).toContain("HEAD^{tree}");
    expect(release).toContain('test "$ACTUAL_COMMIT" = "$DEVELOP_COMMIT"');
    expect(release).toContain('test "$ACTUAL_TREE" = "$CANDIDATE_TREE_DIGEST"');
  });

  it("verifies the baseline tag is annotated and resolves to the current production rollback commit", () => {
    expect(release).toContain('git fetch --no-tags --depth=1 origin "$BASELINE_TAG"');
    expect(release).toContain('git cat-file -t "$BASELINE_TAG"');
    expect(release).toMatch(/TAG_TYPE.*=.*"tag"/);
    expect(release).toContain("https://chapa.thecreativetoken.com/api/version");
    expect(release).toContain("PRODUCTION_COMMIT");
    expect(release).toContain('test "$PRODUCTION_COMMIT" = "$TAG_COMMIT"');
  });

  it("verifies the immutable Preview identity via release:verify-identity", () => {
    expect(release).toContain("release:verify-identity");
    expect(release).toContain("VERCEL_AUTOMATION_BYPASS_SECRET");
    expect(release).toMatch(
      /workflow_call:[\s\S]*?secrets:\s+VERCEL_AUTOMATION_BYPASS_SECRET:\s+required: true/,
    );
  });

  it("runs the default Preview scenario mode", () => {
    expect(release).toContain("RELEASE_VERIFICATION_MODE: default");
    expect(release).toContain("e2e/release-required.spec.ts");
    expect(release).toContain("--grep @release-required");
  });

  it("writes and uploads exactly one release-result.json unconditionally", () => {
    expect(release).toContain("release:write-result");
    expect(release).toContain("--stage preview");
    const uploadStep = release.slice(
      release.indexOf("Upload release result"),
      release.indexOf("Upload release result") + 400,
    );
    expect(uploadStep).toContain("if: always()");
    expect(uploadStep).toContain("release-result.json");
    expect(release.match(/uses: actions\/upload-artifact@v7/g)?.length).toBe(1);
  });

  it("propagates the direct check status after uploading the result", () => {
    const uploadIndex = release.indexOf("Upload release result");
    const writeResultIndex = release.indexOf("release:write-result");
    expect(writeResultIndex).toBeLessThan(uploadIndex);
    expect(release).toContain("outputs:");
    expect(release).toMatch(/status:\s*\$\{\{\s*steps\.[\w-]+\.outcome/);
  });

  it("contains no evidence-graph import, aggregation, analyzer, renderer, or charter machinery", () => {
    for (const removed of [
      "import-ci",
      "import-release-pr",
      "aggregate:",
      "merge-release-evidence",
      "analyze-release-run",
      "render-release-report",
      "release:analyze",
      "release:render-report",
      "release:collect-evidence",
      "release:prepare-run",
      "release:merge-evidence",
      "quality:validate",
      "preMergeEvidence",
      "exploratoryCharters",
      "evidence-manifest",
      "release-artifact-contract",
    ]) {
      expect(release).not.toContain(removed);
    }
  });

  it("does not contain release, deploy, database, Git, or publication mutations", () => {
    expect(release).not.toMatch(/\b(vercel\s+deploy|vercel\s+promote|gh\s+release\s+create)\b/);
    expect(release).not.toMatch(/\bgit\s+(push|merge|tag)\b/);
    expect(release).not.toMatch(/\bsupabase\s+(db\s+push|migration\s+up)\b/);
  });

  it("has read-only permissions and a candidate-scoped concurrency group", () => {
    expect(release).toMatch(/permissions:\s*\n\s*contents:\s*read/);
    expect(release).not.toContain("actions: read");
    expect(release).toContain(
      "group: release-verification-${{ inputs.developCommit }}-${{ inputs.runId }}",
    );
    expect(release).toContain("cancel-in-progress: false");
  });

  it("contains exactly one job", () => {
    expect(release.match(/^  [a-z][\w-]*:\n\s+name:/gm)?.length).toBe(1);
  });
});

describe("producer workflow evidence contract", () => {
  const ci = workflow(".github/workflows/ci.yml");
  const nightly = workflow(".github/workflows/nightly-prod-probe.yml");

  it("no longer creates a .release-evidence directory or uploads release-evidence artifacts", () => {
    expect(ci).not.toContain(".release-evidence");
    expect(ci).not.toMatch(/release-evidence-\$\{\{/);
  });

  it("preserves current protected aggregate job names", () => {
    expect(ci).toMatch(/\n\s+name: Test\n/);
    expect(ci).toMatch(/\n\s+name: E2E Tests\n/);
    expect(ci).toMatch(/\n\s+name: Deployment Smoke\n/);
    expect(ci).toMatch(/\n\s+name: Lint & Typecheck\n/);
    expect(ci).toMatch(/\n\s+name: Contract \(real DB\)\n/);
    expect(ci).toMatch(/\n\s+name: Pending Migrations Check \(release PR\)\n/);
  });

  it("keeps the Next.js build artifact used by E2E shards", () => {
    expect(ci).toContain("nextjs-build-${{ github.run_id }}-${{ github.run_attempt }}");
    expect(ci).not.toMatch(/\n\s+name: nextjs-build\s*\n/);
  });

  it("fails the pending-migrations job closed when production read credentials are missing", () => {
    const migrationJob = ci.slice(
      ci.indexOf("pending-migrations-check:"),
    );
    expect(migrationJob).toContain("::error::");
    expect(migrationJob).toContain("exit 1");
    expect(migrationJob).not.toContain("::notice::");
    expect(migrationJob).not.toMatch(/STATUS="skipped"/);
    expect(migrationJob).toContain("pnpm run check:pending-migrations");
  });

  it("keeps nightly runner and production target identities separate", () => {
    expect(nightly).toContain("runnerCommit");
    expect(nightly).toContain("targetCommit");
    expect(nightly).toContain("targetEnvironment");
    expect(nightly).toContain("authorizationEligible: false");
    expect(nightly).toContain('environment: "production"');
    expect(nightly).toContain("nightly-production-fragment.json");
    expect(nightly).toContain("if: always()");
    expect(nightly).toContain("retention-days: 30");
  });
});
