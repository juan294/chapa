import { renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const TAG_PATTERN = /^v\d+\.\d+\.\d+$/;
const HTTPS_URL_PATTERN = /^https:\/\//;
const RUN_ATTEMPT_PATTERN = /^[1-9][0-9]*$/;
const FORBIDDEN_FIELD_NAME_PATTERN = /authorization|cookie|secret|token/i;

export type CheckStatus = "passed" | "failed";
export type OverallStatus = "passed" | "failed";
export type ReleaseVerificationMode = "default" | "deep";

export interface Candidate {
  baselineTag: string;
  rollbackReference: string;
  developCommit: string;
  candidateTreeDigest: string;
  previewUrl: string;
}

export interface PreviewSource {
  repository: string;
  workflowRunId: string;
  workflowRunAttempt: string;
  headSha: string;
}

export interface PreviewChecks {
  sourceIdentity: CheckStatus;
  previewIdentity: CheckStatus;
  previewProbes: CheckStatus;
  rollbackReadiness: CheckStatus;
}

export interface PreviewResult {
  readonly schemaVersion: 1;
  readonly stage: "preview";
  readonly status: OverallStatus;
  readonly mode: ReleaseVerificationMode;
  readonly candidate: Candidate;
  readonly source: PreviewSource;
  readonly checks: PreviewChecks;
  readonly generatedAt: string;
}

export interface FinalChecks {
  sourceIdentity: CheckStatus;
  previewIdentity: CheckStatus;
  previewProbes: CheckStatus;
  rollbackReadiness: CheckStatus;
  productionIdentity: CheckStatus;
  productionProbes: CheckStatus;
}

export interface TagReference {
  name: string;
  target: string;
}

export interface ReleaseReference {
  tag: string;
  target: string;
}

export interface Readback {
  tagVerifiedAt: string;
  releaseVerifiedAt: string;
}

export interface FinalResult {
  readonly schemaVersion: 1;
  readonly stage: "final";
  readonly status: OverallStatus;
  readonly mode: ReleaseVerificationMode;
  readonly candidate: Candidate;
  readonly source: PreviewSource;
  readonly checks: FinalChecks;
  readonly mainCommit: string;
  readonly mainTreeDigest: string;
  readonly productionUrl: string;
  readonly tag: TagReference;
  readonly release: ReleaseReference;
  readonly readback: Readback;
  readonly generatedAt: string;
}

// ---------------------------------------------------------------------------
// Generic recursive guards
// ---------------------------------------------------------------------------

/**
 * Applies regardless of the field allowlists below: a field name matching
 * this pattern anywhere in the object graph is rejected outright, so an
 * accidental future field never becomes a channel for a live credential.
 */
function assertNoForbiddenFieldNames(value: unknown, path = "$"): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenFieldNames(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_FIELD_NAME_PATTERN.test(key)) {
        throw new Error(
          `release result contains a forbidden secret-bearing field name "${key}" at ${path}.${key}`,
        );
      }
      assertNoForbiddenFieldNames(nested, `${path}.${key}`);
    }
  }
}

function assertPlainObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function assertAllowlistedKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  label: string,
): void {
  const extra = Object.keys(value).filter((key) => !allowedKeys.includes(key));
  if (extra.length > 0) {
    throw new Error(`${label} has unknown field(s): ${extra.join(", ")}`);
  }
}

function assertString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function assertSha(value: unknown, label: string): string {
  const stringValue = assertString(value, label);
  if (!SHA_PATTERN.test(stringValue)) {
    throw new Error(`${label} must be a full 40-character lowercase hex Git SHA`);
  }
  return stringValue;
}

function assertTag(value: unknown, label: string): string {
  const stringValue = assertString(value, label);
  if (!TAG_PATTERN.test(stringValue)) {
    throw new Error(`${label} must be an annotated release tag matching vX.Y.Z`);
  }
  return stringValue;
}

function assertHttpsUrl(value: unknown, label: string): string {
  const stringValue = assertString(value, label);
  if (!HTTPS_URL_PATTERN.test(stringValue)) {
    throw new Error(`${label} must be an HTTPS URL`);
  }
  try {
    new URL(stringValue);
  } catch {
    throw new Error(`${label} must be a valid URL`);
  }
  return stringValue;
}

function assertRunId(value: unknown, label: string): string {
  return assertString(value, label);
}

function assertRunAttempt(value: unknown, label: string): string {
  const stringValue = assertString(value, label);
  if (!RUN_ATTEMPT_PATTERN.test(stringValue)) {
    throw new Error(`${label} must be a positive integer string`);
  }
  return stringValue;
}

function assertIsoTimestamp(value: unknown, label: string): string {
  const stringValue = assertString(value, label);
  const parsed = new Date(stringValue);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== stringValue) {
    throw new Error(`${label} must be an ISO-8601 timestamp`);
  }
  return stringValue;
}

function assertCheckStatus(value: unknown, label: string): CheckStatus {
  if (value !== "passed" && value !== "failed") {
    throw new Error(`${label} must be "passed" or "failed"`);
  }
  return value;
}

function assertMode(value: unknown, label: string): ReleaseVerificationMode {
  if (value !== "default" && value !== "deep") {
    throw new Error(`${label} must be "default" or "deep"`);
  }
  return value;
}

const CANDIDATE_KEYS = [
  "baselineTag",
  "rollbackReference",
  "developCommit",
  "candidateTreeDigest",
  "previewUrl",
] as const;

function parseCandidate(raw: unknown): Candidate {
  const value = assertPlainObject(raw, "candidate");
  assertAllowlistedKeys(value, CANDIDATE_KEYS, "candidate");
  return {
    baselineTag: assertTag(value.baselineTag, "candidate.baselineTag"),
    rollbackReference: assertTag(value.rollbackReference, "candidate.rollbackReference"),
    developCommit: assertSha(value.developCommit, "candidate.developCommit"),
    candidateTreeDigest: assertSha(value.candidateTreeDigest, "candidate.candidateTreeDigest"),
    previewUrl: assertHttpsUrl(value.previewUrl, "candidate.previewUrl"),
  };
}

const SOURCE_KEYS = ["repository", "workflowRunId", "workflowRunAttempt", "headSha"] as const;

function parseSource(raw: unknown): PreviewSource {
  const value = assertPlainObject(raw, "source");
  assertAllowlistedKeys(value, SOURCE_KEYS, "source");
  return {
    repository: assertString(value.repository, "source.repository"),
    workflowRunId: assertRunId(value.workflowRunId, "source.workflowRunId"),
    workflowRunAttempt: assertRunAttempt(value.workflowRunAttempt, "source.workflowRunAttempt"),
    headSha: assertSha(value.headSha, "source.headSha"),
  };
}

const PREVIEW_CHECK_KEYS = [
  "sourceIdentity",
  "previewIdentity",
  "previewProbes",
  "rollbackReadiness",
] as const;

function parseChecks<T extends readonly string[]>(
  raw: unknown,
  checkKeys: T,
  label: string,
): Record<T[number], CheckStatus> {
  const value = assertPlainObject(raw, label);
  assertAllowlistedKeys(value, checkKeys, label);
  const result = {} as Record<T[number], CheckStatus>;
  for (const key of checkKeys) {
    if (!(key in value)) {
      throw new Error(`${label} is missing required check "${key}"`);
    }
    result[key as T[number]] = assertCheckStatus(value[key], `${label}.${key}`);
  }
  return result;
}

function deriveOverallStatus(
  checks: Record<string, CheckStatus> | PreviewChecks | FinalChecks,
): OverallStatus {
  return Object.values(checks).every((status) => status === "passed") ? "passed" : "failed";
}

function assertOverallStatusMatches(
  status: OverallStatus,
  checks: Record<string, CheckStatus> | PreviewChecks | FinalChecks,
  label: string,
): void {
  const derived = deriveOverallStatus(checks);
  if (status !== derived) {
    throw new Error(
      `${label} status "${status}" does not match the derived status "${derived}" from its checks`,
    );
  }
}

const PREVIEW_RESULT_KEYS = [
  "schemaVersion",
  "stage",
  "status",
  "mode",
  "candidate",
  "source",
  "checks",
  "generatedAt",
] as const;

/**
 * Validates a fully-assembled preview result, whether freshly built or
 * read back from a prior stage (e.g. by `buildFinalResult`). This is the
 * single source of truth for the shape — there is no separate "trusted"
 * path that skips these checks.
 */
export function parsePreviewResult(raw: unknown): PreviewResult {
  assertNoForbiddenFieldNames(raw);
  const value = assertPlainObject(raw, "preview result");
  assertAllowlistedKeys(value, PREVIEW_RESULT_KEYS, "preview result");

  if (value.schemaVersion !== 1) {
    throw new Error('preview result schemaVersion must be 1');
  }
  if (value.stage !== "preview") {
    throw new Error('preview result stage must be "preview"');
  }

  const candidate = parseCandidate(value.candidate);
  const source = parseSource(value.source);
  if (candidate.developCommit !== source.headSha) {
    throw new Error(
      `candidate/source SHA mismatch: candidate.developCommit ${candidate.developCommit} != source.headSha ${source.headSha}`,
    );
  }

  const checks = parseChecks(value.checks, PREVIEW_CHECK_KEYS, "checks");
  const status = assertCheckStatus(value.status, "status");
  assertOverallStatusMatches(status, checks, "preview result");
  const mode = assertMode(value.mode, "mode");
  const generatedAt = assertIsoTimestamp(value.generatedAt, "generatedAt");

  return Object.freeze({
    schemaVersion: 1,
    stage: "preview",
    status,
    mode,
    candidate,
    source,
    checks,
    generatedAt,
  });
}

export interface BuildPreviewResultInput {
  mode: ReleaseVerificationMode | string;
  candidate: Candidate;
  source: PreviewSource;
  checks: PreviewChecks;
  generatedAt: string;
}

const BUILD_PREVIEW_INPUT_KEYS = ["mode", "candidate", "source", "checks", "generatedAt"] as const;

export function buildPreviewResult(input: BuildPreviewResultInput): PreviewResult {
  assertNoForbiddenFieldNames(input);
  assertAllowlistedKeys(
    assertPlainObject(input, "preview build input"),
    BUILD_PREVIEW_INPUT_KEYS,
    "preview build input",
  );
  const checks = parseChecks(input.checks, PREVIEW_CHECK_KEYS, "checks");
  const candidate = parseCandidate(input.candidate);
  const source = parseSource(input.source);
  if (candidate.developCommit !== source.headSha) {
    throw new Error(
      `candidate/source SHA mismatch: candidate.developCommit ${candidate.developCommit} != source.headSha ${source.headSha}`,
    );
  }
  const status = deriveOverallStatus(checks);
  const mode = assertMode(input.mode, "mode");
  const generatedAt = assertIsoTimestamp(input.generatedAt, "generatedAt");

  return parsePreviewResult({
    schemaVersion: 1,
    stage: "preview",
    status,
    mode,
    candidate,
    source,
    checks,
    generatedAt,
  });
}

const FINAL_CHECK_KEYS = [
  "sourceIdentity",
  "previewIdentity",
  "previewProbes",
  "rollbackReadiness",
  "productionIdentity",
  "productionProbes",
] as const;

const PRODUCTION_CHECK_KEYS = ["productionIdentity", "productionProbes"] as const;

const TAG_REFERENCE_KEYS = ["name", "target"] as const;
const RELEASE_REFERENCE_KEYS = ["tag", "target"] as const;
const READBACK_KEYS = ["tagVerifiedAt", "releaseVerifiedAt"] as const;

const FINAL_RESULT_KEYS = [
  "schemaVersion",
  "stage",
  "status",
  "mode",
  "candidate",
  "source",
  "checks",
  "mainCommit",
  "mainTreeDigest",
  "productionUrl",
  "tag",
  "release",
  "readback",
  "generatedAt",
] as const;

export function parseFinalResult(raw: unknown): FinalResult {
  assertNoForbiddenFieldNames(raw);
  const value = assertPlainObject(raw, "final result");
  assertAllowlistedKeys(value, FINAL_RESULT_KEYS, "final result");

  if (value.schemaVersion !== 1) {
    throw new Error('final result schemaVersion must be 1');
  }
  if (value.stage !== "final") {
    throw new Error('final result stage must be "final"');
  }

  const candidate = parseCandidate(value.candidate);
  const source = parseSource(value.source);
  if (candidate.developCommit !== source.headSha) {
    throw new Error(
      `candidate/source SHA mismatch: candidate.developCommit ${candidate.developCommit} != source.headSha ${source.headSha}`,
    );
  }

  const checks = parseChecks(value.checks, FINAL_CHECK_KEYS, "checks");
  const mainCommit = assertSha(value.mainCommit, "mainCommit");
  const mainTreeDigest = assertSha(value.mainTreeDigest, "mainTreeDigest");
  if (mainTreeDigest !== candidate.candidateTreeDigest) {
    throw new Error(
      `main tree ${mainTreeDigest} does not match candidate tree ${candidate.candidateTreeDigest}`,
    );
  }
  const productionUrl = assertHttpsUrl(value.productionUrl, "productionUrl");

  const tagValue = assertPlainObject(value.tag, "tag");
  assertAllowlistedKeys(tagValue, TAG_REFERENCE_KEYS, "tag");
  const tag: TagReference = {
    name: assertTag(tagValue.name, "tag.name"),
    target: assertSha(tagValue.target, "tag.target"),
  };
  if (tag.target !== mainCommit) {
    throw new Error(`tag target ${tag.target} does not equal main commit ${mainCommit}`);
  }

  const releaseValue = assertPlainObject(value.release, "release");
  assertAllowlistedKeys(releaseValue, RELEASE_REFERENCE_KEYS, "release");
  const release: ReleaseReference = {
    tag: assertTag(releaseValue.tag, "release.tag"),
    target: assertTag(releaseValue.target, "release.target"),
  };
  if (release.target !== tag.name) {
    throw new Error(`release target ${release.target} does not equal tag ${tag.name}`);
  }

  const readbackValue = assertPlainObject(value.readback, "readback");
  assertAllowlistedKeys(readbackValue, READBACK_KEYS, "readback");
  const readback: Readback = {
    tagVerifiedAt: assertIsoTimestamp(readbackValue.tagVerifiedAt, "readback.tagVerifiedAt"),
    releaseVerifiedAt: assertIsoTimestamp(
      readbackValue.releaseVerifiedAt,
      "readback.releaseVerifiedAt",
    ),
  };

  const status = assertCheckStatus(value.status, "status");
  assertOverallStatusMatches(status, checks, "final result");
  const mode = assertMode(value.mode, "mode");
  const generatedAt = assertIsoTimestamp(value.generatedAt, "generatedAt");

  return Object.freeze({
    schemaVersion: 1,
    stage: "final",
    status,
    mode,
    candidate,
    source,
    checks,
    mainCommit,
    mainTreeDigest,
    productionUrl,
    tag,
    release,
    readback,
    generatedAt,
  });
}

export interface BuildFinalResultInput {
  preview: PreviewResult;
  mainCommit: string;
  mainTreeDigest: string;
  productionUrl: string;
  checks: Record<(typeof PRODUCTION_CHECK_KEYS)[number], CheckStatus>;
  tag: TagReference;
  release: ReleaseReference;
  readback: Readback;
  generatedAt: string;
}

const BUILD_FINAL_INPUT_KEYS = [
  "preview",
  "mainCommit",
  "mainTreeDigest",
  "productionUrl",
  "checks",
  "tag",
  "release",
  "readback",
  "generatedAt",
] as const;

export function buildFinalResult(input: BuildFinalResultInput): FinalResult {
  assertNoForbiddenFieldNames(input);
  assertAllowlistedKeys(
    assertPlainObject(input, "final build input"),
    BUILD_FINAL_INPUT_KEYS,
    "final build input",
  );
  const preview = parsePreviewResult(input.preview);
  const productionChecks = parseChecks(input.checks, PRODUCTION_CHECK_KEYS, "checks");
  const checks: FinalChecks = { ...preview.checks, ...productionChecks };

  return parseFinalResult({
    schemaVersion: 1,
    stage: "final",
    status: deriveOverallStatus(checks),
    mode: preview.mode,
    candidate: preview.candidate,
    source: preview.source,
    checks,
    mainCommit: input.mainCommit,
    mainTreeDigest: input.mainTreeDigest,
    productionUrl: input.productionUrl,
    tag: input.tag,
    release: input.release,
    readback: input.readback,
    generatedAt: input.generatedAt,
  });
}

// ---------------------------------------------------------------------------
// Writer: an audit receipt, not an analyzer or an authorization decision.
// ---------------------------------------------------------------------------

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, sortKeysDeep((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

function stableStringify(result: PreviewResult | FinalResult): string {
  return `${JSON.stringify(sortKeysDeep(result), null, 2)}\n`;
}

export function writeResult(path: string, result: PreviewResult | FinalResult): void {
  const tempPath = join(dirname(path), `.${Date.now()}-${process.pid}.tmp`);
  writeFileSync(tempPath, stableStringify(result));
  renameSync(tempPath, path);
}

// ---------------------------------------------------------------------------
// CLI: run a direct check, capture its exit status, write the result either
// way, then propagate the captured status. This module never analyzes its
// own evidence and never grants authorization.
// ---------------------------------------------------------------------------

function argument(name: string, required = true): string | undefined {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (required && !value) throw new Error(`missing required argument ${name}`);
  return value;
}

export async function main(): Promise<void> {
  const { readFileSync } = await import("node:fs");
  const stage = argument("--stage");
  const inputPath = argument("--input")!;
  const outputPath = argument("--output")!;
  const input = JSON.parse(readFileSync(inputPath, "utf8"));

  const result = stage === "final" ? buildFinalResult(input) : buildPreviewResult(input);
  writeResult(outputPath, result);

  if (result.status !== "passed") {
    throw new Error(`release result status is "${result.status}"`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
