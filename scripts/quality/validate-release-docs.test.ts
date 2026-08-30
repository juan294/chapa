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

function compliantPlaybook(): string {
  return [
    "# Release",
    "Fix candidateTreeDigest.",
    "Create or reuse the release PR.",
    "gh pr checks --required --watch --fail-fast",
    "pending migrations check (release PR) is a required check.",
    "gh run download the Preview release-result.json",
    "Obtain merge authorization.",
    "gh pr merge --merge --auto",
    "Verify mainTreeDigest and production identity.",
    "Obtain tag authorization.",
    "git tag -a vX.Y.Z mainCommit",
    "gh release create",
    "gh release view",
    "release:write-result",
    "Use the rollback runbook.",
    "Recovery outcomes: PAUSED, BLOCKED, ROLLED_BACK, PUBLICATION_PENDING.",
  ].join("\n");
}

function compliantRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "release-docs-"));
  roots.push(root);
  write(root, "docs/release/release-playbook.md", compliantPlaybook());
  write(
    root,
    ".claude/commands/release.md",
    [
      "Read docs/release/release-playbook.md completely.",
      "STOP for version choice.",
      "STOP for full diff approval.",
      "STOP for PR authorization.",
      "STOP for merge authorization.",
      "gh pr merge --merge --auto",
      "STOP for tag authorization.",
      "Deep verification (/prodplaybook, /explore-release) is separate and explicit.",
    ].join("\n"),
  );
  write(
    root,
    ".claude/commands/explore-release.md",
    "Read docs/release/release-playbook.md. Accept a fixed commit. Never tag.",
  );
  write(
    root,
    ".claude/commands/prodplaybook.md",
    [
      "Read docs/playbooks/e2e-pro-release-verification.md completely.",
      "Run RELEASE_VERIFICATION_MODE=deep deployed probes.",
      "Write docs/agents/prodplaybook-report.md.",
      "Report PASS or BLOCKED.",
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
  it("accepts one short delegated direct-proof procedure", () => {
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
        "Run RELEASE_VERIFICATION_MODE=deep deployed probes.",
        "Write docs/agents/prodplaybook-report.md.",
        "Report PASS or BLOCKED.",
        "git tag -a vX.Y.Z mainCommit",
      ].join("\n"),
    );

    expect(validateReleaseDocs(root)).toContain(
      ".claude/commands/prodplaybook.md: verification-only command must not contain release mutations",
    );
  });

  it("rejects tag instructions before tree/production proof", () => {
    const root = compliantRoot();
    write(
      root,
      "docs/release/release-playbook.md",
      [
        "# Release",
        "Fix candidateTreeDigest.",
        "git tag -a vX.Y.Z mainCommit",
        "gh release create",
        "gh release view",
        "release:write-result",
        "Create or reuse the release PR.",
        "gh pr checks --required --watch --fail-fast",
        "pending migrations check (release PR) is a required check.",
        "gh run download the Preview release-result.json",
        "Obtain merge authorization.",
        "gh pr merge --merge --auto",
        "Verify mainTreeDigest and production identity.",
        "Obtain tag authorization.",
        "Use rollback. PAUSED BLOCKED ROLLED_BACK PUBLICATION_PENDING",
      ].join("\n"),
    );

    expect(validateReleaseDocs(root)).toContain(
      "docs/release/release-playbook.md: tree equality and production proof must precede tag",
    );
  });

  it("rejects required checks and Preview proof after the promotion merge", () => {
    const root = compliantRoot();
    write(
      root,
      "docs/release/release-playbook.md",
      [
        "# Release",
        "Fix candidateTreeDigest.",
        "Create or reuse the release PR.",
        "gh pr merge --merge --auto",
        "gh pr checks --required --watch --fail-fast",
        "pending migrations check (release PR) is a required check.",
        "gh run download the Preview release-result.json",
        "Obtain merge authorization.",
        "Verify mainTreeDigest and production identity.",
        "Obtain tag authorization.",
        "git tag -a vX.Y.Z mainCommit",
        "gh release create",
        "gh release view",
        "release:write-result",
        "Use rollback. PAUSED BLOCKED ROLLED_BACK PUBLICATION_PENDING",
      ].join("\n"),
    );

    expect(validateReleaseDocs(root)).toContain(
      "docs/release/release-playbook.md: required checks, migrations, and Preview proof must precede the promotion merge",
    );
  });

  it("rejects squash release semantics and subordinate procedures", () => {
    const root = compliantRoot();
    write(
      root,
      "docs/runbooks/release-checklist.md",
      [
        "Ordering: docs/release/release-playbook.md",
        "gh pr create --base main --head develop",
        "gh pr merge --squash",
      ].join("\n"),
    );

    const errors = validateReleaseDocs(root);
    expect(errors).toContain(
      "docs/runbooks/release-checklist.md: squash release semantics discard ancestry — releases merge (#1228)",
    );
    expect(errors).toContain(
      "docs/runbooks/release-checklist.md: subordinate documentation must not create release PRs or tags",
    );
  });

  it("rejects retired evidence-graph machinery anywhere in the scanned files", () => {
    const root = compliantRoot();
    write(
      root,
      "docs/runbooks/migrations.md",
      "Ordering: docs/release/release-playbook.md\nquality/release-required.json\n",
    );

    expect(validateReleaseDocs(root)).toContain(
      'docs/runbooks/migrations.md: must not reference retired evidence machinery "quality/release-required.json"',
    );
  });

  it("rejects an unconditional /explore-release invocation in the default release path", () => {
    const root = compliantRoot();
    write(
      root,
      "docs/release/release-playbook.md",
      `${compliantPlaybook()}\nRun /explore-release $runDir/candidate.json\n`,
    );

    expect(validateReleaseDocs(root)).toContain(
      "docs/release/release-playbook.md and .claude/commands/release.md: deep verification must not be an unconditional step of the default release",
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
  const explore = readRepositoryFile(".claude/commands/explore-release.md");
  const prodplaybook = readRepositoryFile(".claude/commands/prodplaybook.md");
  const e2eProPlaybook = readRepositoryFile(
    "docs/playbooks/e2e-pro-release-verification.md",
  );

  it("documents exact dispatch, one concurrent wave, and tag-last publication", () => {
    expect(playbook.split(/\r?\n/).length).toBeLessThanOrEqual(200);
    for (const required of [
      "STOP — Gate 1: approve the release",
      "STOP — Gate 2: authorize production",
      "gh workflow run release-verification.yml",
      "gh run download",
      "gh pr merge --merge --auto",
      "gh release create",
      "gh release view",
      "release:write-result",
    ]) {
      expect(playbook).toContain(required);
    }
  });

  it("binds the release baseline and rollback target to production identity", () => {
    for (const required of [
      'productionCommit="$(printf \'%s\' "$productionVersion" | jq -er \'select(.environment == "production") | .commitSha\')"',
      'mainCommit="$(git rev-parse origin/main)"',
      'test "$productionCommit" = "$mainCommit"',
      'test "$(git cat-file -t "$baselineTag")" = tag',
      '${baselineTag}^{commit}',
      'rollbackReference="$baselineTag"',
    ]) {
      expect(playbook).toContain(required);
    }
    expect(releaseCommand).toContain("Do not use `git describe`");
    expect(rollbackRunbook).toContain('${approvedRollbackTag}^{commit}');
    expect(rollbackRunbook).toContain(
      'test "$restoredCommit" = "$approvedRollbackCommit"',
    );
  });

  it("keeps deep verification explicit, risk-selected, and never a default gate", () => {
    expect(explore).toContain("docs/release/release-playbook.md");
    expect(explore).toContain("Fixed, immutable candidate only");
    expect(explore).toContain("Never a required or unconditional step");
    expect(prodplaybook).toContain("docs/playbooks/e2e-pro-release-verification.md");
    expect(prodplaybook).toContain("never a required step of a default");
  });

  it("keeps prodplaybook read-only and verification-only", () => {
    for (const required of [
      "RELEASE_VERIFICATION_MODE=deep",
      "docs/agents/prodplaybook-report.md",
      "BLOCKED",
    ]) {
      expect(prodplaybook).toContain(required);
    }
    expect(prodplaybook).not.toMatch(
      /\bgh\s+pr\s+(?:create|merge)\b|\bgit\s+tag\b|\bgh\s+release\s+create\b/i,
    );
  });

  it("documents default vs. deep scenario scope through the live scenario selector, not a JSON catalog", () => {
    expect(e2eProPlaybook).toContain(
      "apps/web/e2e/helpers/release-required-environments.ts",
    );
    expect(e2eProPlaybook).toContain("scripts/quality/release-result.ts");
    expect(e2eProPlaybook).toContain("Historical note");
  });
});
