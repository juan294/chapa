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
    "pre-merge analyzer",
    "merge authorization",
    "mainTreeDigest",
    "production identity",
    "final analyzer",
    "tag authorization",
    "rollback",
  ]) {
    requireText(playbook, PLAYBOOK, stage, errors);
  }

  const lowerPlaybook = playbook.toLowerCase();
  const releasePrIndex = lowerPlaybook.indexOf("create or reuse the");
  const preMergeAnalyzerIndex = lowerPlaybook.indexOf("run the pre-merge analyzer");
  const squashMergeIndex = lowerPlaybook.indexOf("gh pr merge --squash --auto");
  if (
    releasePrIndex < 0 ||
    preMergeAnalyzerIndex < 0 ||
    releasePrIndex > preMergeAnalyzerIndex
  ) {
    errors.push(
      `${PLAYBOOK}: release PR creation must precede pre-merge analysis`,
    );
  }
  if (
    preMergeAnalyzerIndex < 0 ||
    squashMergeIndex < 0 ||
    preMergeAnalyzerIndex > squashMergeIndex
  ) {
    errors.push(
      `${PLAYBOOK}: pre-merge analysis must precede squash merge`,
    );
  }

  const tagIndex = lowerPlaybook.indexOf("git tag");
  const finalAnalyzerIndex = lowerPlaybook.indexOf("final analyzer");
  const tagAuthorizationIndex = lowerPlaybook.indexOf("tag authorization");
  if (
    tagIndex < 0 ||
    finalAnalyzerIndex < 0 ||
    tagAuthorizationIndex < 0 ||
    tagIndex < finalAnalyzerIndex ||
    tagIndex < tagAuthorizationIndex
  ) {
    errors.push(
      `${PLAYBOOK}: git tag must follow final analyzer and tag authorization`,
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
    "quality/release-required.json",
    "Release Coverage Freshness Audit",
    "exact-SHA",
    "zero passes",
    "fresh context",
    "eight maneuvers",
    "zero unexpected residue",
    "BLOCKED",
  ]) {
    requireText(
      prodplaybookCommand,
      PRODPLAYBOOK_COMMAND,
      contract,
      errors,
    );
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
  if (!releaseCommand.includes("gh pr merge --squash --auto")) {
    errors.push(`${RELEASE_COMMAND}: missing squash auto-merge command`);
  }

  const scannedFiles = [
    RELEASE_COMMAND,
    EXPLORE_COMMAND,
    PLAYBOOK,
    ...DELEGATED_FILES,
  ];
  for (const file of scannedFiles) {
    const source =
      file === RELEASE_COMMAND
        ? releaseCommand
        : file === EXPLORE_COMMAND
          ? exploreCommand
          : file === PLAYBOOK
            ? playbook
            : read(root, file, errors);
    if (/\bgh\s+pr\s+merge\s+--merge\b/.test(source)) {
      errors.push(
        `${file}: merge-commit release semantics conflict with squash-only policy`,
      );
    }
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
