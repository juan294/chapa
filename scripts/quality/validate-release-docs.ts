#!/usr/bin/env node
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const PLAYBOOK = "docs/release/release-playbook.md";
const E2E_PLAYBOOK = "docs/playbooks/e2e-pro-release-verification.md";
const RELEASE_COMMAND = ".claude/commands/release.md";
const EXPLORE_COMMAND = ".claude/commands/explore-release.md";
const PRODPLAYBOOK_COMMAND = ".claude/commands/prodplaybook.md";
const DELEGATED_FILES = [
  "docs/runbooks/release-checklist.md",
  "docs/runbooks/deployment-smoke.md",
  "docs/runbooks/migrations.md",
  "docs/runbooks/rollback.md",
  "docs/runbooks/incident-response.md",
  "docs/runbooks/observability.md",
  "CLAUDE.md",
] as const;

// Terms belonging to the retired proof-of-proof evidence graph. None of
// these may appear in a live operational instruction — see
// docs/plans/2026-08-29-direct-proof-release-pipeline.md.
const RETIRED_EVIDENCE_TERMS = [
  "quality/release-required.json",
  "releasePrRunId",
  "releasePrRunAttempt",
  "preMergeEvidence",
  "pre-merge analyzer",
  "final analyzer",
  "merge-release-evidence",
  "evidence-manifest.json",
  "release-report.md",
] as const;

function read(root: string, file: string, errors: string[]): string {
  const target = path.join(root, file);
  if (!fs.existsSync(target)) {
    errors.push(`${file}: missing`);
    return "";
  }
  return fs.readFileSync(target, "utf8");
}

function lineCount(source: string): number {
  return source.endsWith("\n")
    ? source.slice(0, -1).split(/\r?\n/).length
    : source.split(/\r?\n/).length;
}

function requireText(
  source: string,
  file: string,
  text: string,
  errors: string[],
): void {
  if (!source.toLowerCase().includes(text.toLowerCase())) {
    errors.push(`${file}: missing required stage "${text}"`);
  }
}

function rejectRetiredTerms(source: string, file: string, errors: string[]): void {
  for (const term of RETIRED_EVIDENCE_TERMS) {
    if (source.includes(term)) {
      errors.push(`${file}: must not reference retired evidence machinery "${term}"`);
    }
  }
}

export function validateReleaseDocs(root = process.cwd()): string[] {
  const errors: string[] = [];
  const playbook = read(root, PLAYBOOK, errors);
  const releaseCommand = read(root, RELEASE_COMMAND, errors);
  const exploreCommand = read(root, EXPLORE_COMMAND, errors);
  const prodplaybookCommand = read(root, PRODPLAYBOOK_COMMAND, errors);

  if (playbook && lineCount(playbook) > 200) {
    errors.push(`${PLAYBOOK}: exceeds 200 lines`);
  }

  for (const stage of [
    "candidateTreeDigest",
    "merge authorization",
    "mainTreeDigest",
    "production identity",
    "tag authorization",
    "rollback",
    "PAUSED",
    "BLOCKED",
    "ROLLED_BACK",
    "PUBLICATION_PENDING",
  ]) {
    requireText(playbook, PLAYBOOK, stage, errors);
  }

  const lowerPlaybook = playbook.toLowerCase();

  const topologyProof = [
    "developTreeDigest=\"$(git rev-parse 'origin/develop^{tree}')\"",
    "prospectiveMainTreeDigest=\"$(git merge-tree --write-tree origin/main origin/develop)\"",
    "test \"$prospectiveMainTreeDigest\" = \"$developTreeDigest\"",
  ];
  if (
    topologyProof.some((instruction) => !playbook.includes(instruction)) ||
    playbook.includes("git merge-base --is-ancestor origin/main origin/develop")
  ) {
    errors.push(
      `${PLAYBOOK}: preflight must prove the prospective main tree equals the develop tree`,
    );
  }

  const releasePrCreationIndex = lowerPlaybook.indexOf("create or reuse the");
  const requiredChecksWaitIndex = lowerPlaybook.indexOf("gh pr checks");
  if (
    releasePrCreationIndex < 0 ||
    requiredChecksWaitIndex < 0 ||
    releasePrCreationIndex > requiredChecksWaitIndex
  ) {
    errors.push(
      `${PLAYBOOK}: release PR creation must precede the concurrent required-check and Preview wait`,
    );
  }

  const previewResultIndex = lowerPlaybook.indexOf("gh run download");
  const migrationsCheckIndex = lowerPlaybook.indexOf("pending migrations check (release");
  const promoteMergeIndex = lowerPlaybook.indexOf("gh pr merge --merge --auto");
  if (
    previewResultIndex < 0 ||
    migrationsCheckIndex < 0 ||
    promoteMergeIndex < 0 ||
    previewResultIndex > promoteMergeIndex ||
    migrationsCheckIndex > promoteMergeIndex
  ) {
    errors.push(
      `${PLAYBOOK}: required checks, migrations, and Preview proof must precede the promotion merge`,
    );
  }

  const mainTreeIndex = lowerPlaybook.indexOf("maintreedigest");
  const productionIdentityIndex = lowerPlaybook.indexOf("production identity");
  const tagIndex = lowerPlaybook.indexOf("git tag -a");
  if (
    mainTreeIndex < 0 ||
    productionIdentityIndex < 0 ||
    tagIndex < 0 ||
    mainTreeIndex > tagIndex ||
    productionIdentityIndex > tagIndex
  ) {
    errors.push(`${PLAYBOOK}: tree equality and production proof must precede tag`);
  }

  const releaseCreateIndex = lowerPlaybook.indexOf("gh release create");
  const releaseReadbackIndex = lowerPlaybook.indexOf("gh release view");
  const finalReceiptIndex = lowerPlaybook.indexOf("release:write-result");
  if (
    tagIndex < 0 ||
    releaseCreateIndex < 0 ||
    releaseReadbackIndex < 0 ||
    finalReceiptIndex < 0 ||
    tagIndex > releaseCreateIndex ||
    releaseCreateIndex > releaseReadbackIndex ||
    releaseReadbackIndex > finalReceiptIndex
  ) {
    errors.push(
      `${PLAYBOOK}: tag must precede GitHub Release readback, which must precede the final receipt upload`,
    );
  }

  if (!releaseCommand.includes(PLAYBOOK)) {
    errors.push(`${RELEASE_COMMAND}: must delegate to ${PLAYBOOK}`);
  }
  if (!exploreCommand.includes(PLAYBOOK)) {
    errors.push(`${EXPLORE_COMMAND}: must delegate to ${PLAYBOOK}`);
  }
  if (!prodplaybookCommand.includes(E2E_PLAYBOOK)) {
    errors.push(`${PRODPLAYBOOK_COMMAND}: must delegate to ${E2E_PLAYBOOK}`);
  }

  for (const contract of [
    "RELEASE_VERIFICATION_MODE=deep",
    "docs/agents/prodplaybook-report.md",
    "BLOCKED",
  ]) {
    requireText(prodplaybookCommand, PRODPLAYBOOK_COMMAND, contract, errors);
  }
  if (
    /\bgh\s+pr\s+(?:create|merge)\b|\bgit\s+tag\b|\bgh\s+release\s+create\b/i.test(
      prodplaybookCommand,
    )
  ) {
    errors.push(
      `${PRODPLAYBOOK_COMMAND}: verification-only command must not contain release mutations`,
    );
  }

  for (const gate of [
    "version choice",
    "full diff approval",
    "PR authorization",
    "merge authorization",
    "tag authorization",
  ]) {
    requireText(releaseCommand, RELEASE_COMMAND, gate, errors);
  }
  if (!releaseCommand.includes("gh pr merge --merge --auto")) {
    errors.push(`${RELEASE_COMMAND}: missing merge-commit auto-merge command`);
  }
  // A bare mention that deep verification exists and is optional is fine; an
  // invocation with an argument (e.g. `/explore-release $runDir/candidate.json`)
  // would mean the default path actually calls it as a required step.
  const unconditionalExploreRelease = /\/explore-release\s+\S/;
  if (
    unconditionalExploreRelease.test(playbook) ||
    unconditionalExploreRelease.test(releaseCommand)
  ) {
    errors.push(
      `${PLAYBOOK} and ${RELEASE_COMMAND}: deep verification must not be an unconditional step of the default release`,
    );
  }

  const scannedFiles = [
    RELEASE_COMMAND,
    EXPLORE_COMMAND,
    PRODPLAYBOOK_COMMAND,
    PLAYBOOK,
    ...DELEGATED_FILES,
  ];
  for (const file of scannedFiles) {
    const source =
      file === RELEASE_COMMAND
        ? releaseCommand
        : file === EXPLORE_COMMAND
          ? exploreCommand
          : file === PRODPLAYBOOK_COMMAND
            ? prodplaybookCommand
            : file === PLAYBOOK
              ? playbook
              : read(root, file, errors);
    // #1228 — inverted. Squash-merging develop into main does not record the
    // released develop commit as a parent, so the NEXT release PR computes a
    // stale merge-base. That produced a CONFLICTING PR, and a
    // conflicting PR runs none of its pull_request checks — the migrations gate
    // reports `skipped`, not failed. Chapa carried 40 hand-made back-merge
    // commits before this changed. A merge commit advances the shared merge-base
    // to the released develop commit and needs no reconciliation.
    if (/\bgh\s+pr\s+merge\s+--squash\b/.test(source)) {
      errors.push(
        `${file}: squash release semantics discard ancestry — releases merge (#1228)`,
      );
    }
    rejectRetiredTerms(source, file, errors);
  }

  for (const file of DELEGATED_FILES) {
    const source = read(root, file, []);
    if (!source.includes(PLAYBOOK)) {
      errors.push(`${file}: must delegate release ordering to ${PLAYBOOK}`);
    }
    if (/\bgh\s+pr\s+create\b|\bgit\s+tag\b/.test(source)) {
      errors.push(
        `${file}: subordinate documentation must not create release PRs or tags`,
      );
    }
  }

  return [...new Set(errors)];
}

function main(): void {
  const errors = validateReleaseDocs();
  if (errors.length > 0) {
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log("Release documentation contract passed.");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
