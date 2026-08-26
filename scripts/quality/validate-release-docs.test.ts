import { afterEach, describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { validateReleaseDocs } from "./validate-release-docs";

const roots: string[] = [];
const delegatedFiles = [
  "docs/runbooks/release-checklist.md",
  "docs/runbooks/deployment-smoke.md",
  "docs/runbooks/migrations.md",
  "docs/runbooks/rollback.md",
  "docs/runbooks/incident-response.md",
  "docs/runbooks/observability.md",
  "CLAUDE.md",
];

function write(root: string, file: string, source: string): void {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, source);
}

function compliantRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "release-docs-"));
  roots.push(root);
  write(
    root,
    "docs/release/release-playbook.md",
    [
      "# Release",
      "Fix developCommit and candidateTreeDigest.",
      "Obtain release PR authorization and create or reuse the release PR.",
      "Run the pre-merge analyzer.",
      "Obtain merge authorization.",
      "gh pr merge --squash --auto",
      "Verify mainTreeDigest and production identity.",
      "Run the final analyzer.",
      "Obtain tag authorization.",
      "git tag -a vX.Y.Z mainCommit",
      "Use the rollback runbook.",
    ].join("\n"),
  );
  write(
    root,
    ".claude/commands/release.md",
    [
      "Read docs/release/release-playbook.md completely.",
      "STOP for version choice.",
      "STOP for full diff approval.",
      "STOP for PR authorization.",
      "STOP for merge authorization.",
      "gh pr merge --squash --auto",
      "STOP for tag authorization.",
    ].join("\n"),
  );
  write(
    root,
    ".claude/commands/explore-release.md",
    "Read docs/release/release-playbook.md. Never tag.",
  );
  write(
    root,
    ".claude/commands/prodplaybook.md",
    [
      "Read docs/playbooks/e2e-pro-release-verification.md completely.",
      "Use quality/release-required.json as requiredness authority.",
      "Run the Release Coverage Freshness Audit.",
      "Verify exact-SHA evidence and reject zero passes.",
      "Use fresh context charters with all eight maneuvers.",
      "Prove zero unexpected residue or report BLOCKED.",
      "This command never versions, creates a release PR, merges, tags, or publishes.",
    ].join("\n"),
  );
  for (const file of delegatedFiles) {
    write(root, file, "Ordering: docs/release/release-playbook.md\n");
  }
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("validateReleaseDocs", () => {
  it("accepts one short delegated tag-last procedure", () => {
    expect(validateReleaseDocs(compliantRoot())).toEqual([]);
  });

  it("rejects a playbook over 200 lines", () => {
    const root = compliantRoot();
    write(
      root,
      "docs/release/release-playbook.md",
      Array.from({ length: 201 }, (_, index) => `line ${index + 1}`).join("\n"),
    );

    expect(validateReleaseDocs(root)).toContain(
      "docs/release/release-playbook.md: exceeds 200 lines",
    );
  });

  it("rejects a release command that does not delegate", () => {
    const root = compliantRoot();
    write(root, ".claude/commands/release.md", "Standalone release procedure");

    expect(validateReleaseDocs(root)).toContain(
      ".claude/commands/release.md: must delegate to docs/release/release-playbook.md",
    );
  });

  it("requires the standalone production verification command", () => {
    const root = compliantRoot();
    fs.rmSync(path.join(root, ".claude/commands/prodplaybook.md"));

    expect(validateReleaseDocs(root)).toContain(
      ".claude/commands/prodplaybook.md: missing",
    );
  });

  it("rejects release mutations in the production verification command", () => {
    const root = compliantRoot();
    write(
      root,
      ".claude/commands/prodplaybook.md",
      [
        "Read docs/playbooks/e2e-pro-release-verification.md completely.",
        "Use quality/release-required.json as requiredness authority.",
        "Run the Release Coverage Freshness Audit.",
        "Verify exact-SHA evidence and reject zero passes.",
        "Use fresh context charters with all eight maneuvers.",
        "Prove zero unexpected residue or report BLOCKED.",
        "git tag -a vX.Y.Z mainCommit",
      ].join("\n"),
    );

    expect(validateReleaseDocs(root)).toContain(
      ".claude/commands/prodplaybook.md: verification-only command must not contain release mutations",
    );
  });

  it("rejects tag instructions before final analysis and authorization", () => {
    const root = compliantRoot();
    write(
      root,
      "docs/release/release-playbook.md",
      [
        "# Release",
        "Fix candidateTreeDigest.",
        "git tag -a vX.Y.Z mainCommit",
        "Run the pre-merge analyzer.",
        "Obtain merge authorization.",
        "Verify mainTreeDigest and production identity.",
        "Run the final analyzer.",
        "Obtain tag authorization.",
        "Use rollback.",
      ].join("\n"),
    );

    expect(validateReleaseDocs(root)).toContain(
      "docs/release/release-playbook.md: git tag must follow final analyzer and tag authorization",
    );
  });

  it("rejects pre-merge analysis before the release PR exists", () => {
    const root = compliantRoot();
    write(
      root,
      "docs/release/release-playbook.md",
      [
        "# Release",
        "Fix candidateTreeDigest.",
        "Run the pre-merge analyzer.",
        "Obtain release PR authorization and create or reuse the release PR.",
        "Obtain merge authorization.",
        "gh pr merge --squash --auto",
        "Verify mainTreeDigest and production identity.",
        "Run the final analyzer.",
        "Obtain tag authorization.",
        "git tag -a vX.Y.Z mainCommit",
        "Use rollback.",
      ].join("\n"),
    );

    expect(validateReleaseDocs(root)).toContain(
      "docs/release/release-playbook.md: release PR creation must precede pre-merge analysis",
    );
  });

  it("rejects merge-commit semantics and subordinate procedures", () => {
    const root = compliantRoot();
    write(
      root,
      "docs/runbooks/release-checklist.md",
      [
        "Ordering: docs/release/release-playbook.md",
        "gh pr create --base main --head develop",
        "gh pr merge --merge",
      ].join("\n"),
    );

    const errors = validateReleaseDocs(root);
    expect(errors).toContain(
      "docs/runbooks/release-checklist.md: merge-commit release semantics conflict with squash-only policy",
    );
    expect(errors).toContain(
      "docs/runbooks/release-checklist.md: subordinate documentation must not create release PRs or tags",
    );
  });
});

describe("repository release procedure", () => {
  const repositoryRoot = path.resolve(import.meta.dirname, "../..");
  const readRepositoryFile = (file: string): string =>
    fs.readFileSync(path.join(repositoryRoot, file), "utf8");
  const playbook = readRepositoryFile("docs/release/release-playbook.md");
  const releaseCommand = readRepositoryFile(".claude/commands/release.md");
  const rollbackRunbook = readRepositoryFile("docs/runbooks/rollback.md");
  const studioFlagPlan = readRepositoryFile(
    "docs/plans/2026-08-26-creator-studio-revival-phases/phase-5.md",
  );
  const explore = readRepositoryFile(".claude/commands/explore-release.md");
  const prodplaybook = readRepositoryFile(
    ".claude/commands/prodplaybook.md",
  );

  it("documents exact dispatch, evidence download, and final assembly", () => {
    expect(playbook.split(/\r?\n/).length).toBeLessThanOrEqual(200);
    for (const required of [
      "STOP — external CI/preview authorization",
      "releasePrRunId",
      "releasePrRunAttempt",
      "pre-merge-evidence.json",
      "manualObligationIds",
      "gh workflow run release-verification.yml",
      "gh run download",
      "merge-release-evidence.ts",
      "--scenario-ids deployment.production-identity,health.core-dependencies,profile.public-badge-read,profile.public-share-read",
    ]) {
      expect(playbook).toContain(required);
    }
    expect(playbook.indexOf('rollbackReference="$baselineTag"')).toBeLessThan(
      playbook.indexOf('--rollback-reference "$rollbackReference"'),
    );
  });

  it("binds the release baseline and rollback target to production identity", () => {
    for (const required of [
      'productionVersion="$(curl -fsS "$productionUrl/api/version")"',
      'select(.environment == "production") | .commitSha',
      'mainCommit="$(git rev-parse origin/main)"',
      'test "$productionCommit" = "$mainCommit"',
      'git for-each-ref --points-at "$mainCommit"',
      'git cat-file -t "$baselineTag"',
      '${baselineTag}^{commit}',
    ]) {
      expect(playbook).toContain(required);
    }
    expect(releaseCommand).toContain("Do not use `git describe`");
    expect(rollbackRunbook).toContain('${approvedRollbackTag}^{commit}');
    expect(rollbackRunbook).toContain(
      'test "$restoredCommit" = "$approvedRollbackCommit"',
    );
  });

  it("treats early stale Studio flag reads as cache convergence, not failure", () => {
    expect(studioFlagPlan).toContain("up to about five minutes");
    expect(studioFlagPlan).toContain(
      "An early stale flag read is not failure or rollback evidence",
    );
  });

  it("binds charter execution to candidate authorization and workflow input", () => {
    expect(explore).toContain(
      '"environments": ["local-contract", "ci-build", "preview"]',
    );
    expect(explore).toContain('"authorized-preview-interaction"');
    expect(explore).toContain("pre-merge-evidence.json");
    expect(explore).toContain("manualObligationIds");
    expect(explore).toContain("issue-creation authorization");
  });

  it("keeps prodplaybook exhaustive, fresh, and verification-only", () => {
    for (const required of [
      "Release Coverage Freshness Audit",
      "quality/release-required.json",
      "zero passes",
      "exact-SHA",
      "fresh context",
      "all eight maneuvers",
      "zero unexpected residue",
      "docs/agents/prodplaybook-report.md",
    ]) {
      expect(prodplaybook).toContain(required);
    }
    expect(prodplaybook).not.toMatch(
      /\bgh\s+pr\s+(?:create|merge)\b|\bgit\s+tag\b|\bgh\s+release\s+create\b/i,
    );
  });
});
