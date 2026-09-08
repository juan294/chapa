import { createHash } from "node:crypto";
import { parseCandidateArtifactManifest, verifyLocalBuildManifest, assertUntrackedEvidenceOutput, type CandidateArtifactManifest } from "./candidate-artifact-manifest";
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

// Accepts both second-precision (`date -u +%Y-%m-%dT%H:%M:%SZ`, what the
// release-verification workflow actually generates) and millisecond-precision
// (`Date#toISOString()`) UTC timestamps. A stricter round-trip-through-
// toISOString() check rejects every second-precision timestamp, since
// toISOString() always appends milliseconds.
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

function assertIsoTimestamp(value: unknown, label: string): string {
  const stringValue = assertString(value, label);
  if (!ISO_TIMESTAMP_PATTERN.test(stringValue) || Number.isNaN(Date.parse(stringValue))) {
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

// Schema2 is additive: the historical schema1 parsers above retain their contract.
export const LOCAL_GATE_KEYS = ["sourceIdentity", "typecheck", "lint", "unitTests", "contractTests", "coverage", "build", "localProbes", "releaseDocs", "vercelConfig", "circularDependencies", "migrationValidation", "writeRegistration", "licenses", "vulnerabilities", "bundleBudget", "offlineReplay"] as const;
export const LOCAL_REQUIRED_SCENARIOS = ["deployment.local-candidate-identity", "health.core-dependencies", "profile.public-badge-read", "profile.public-share-read", "profile.share-verification", "locales.en-es", "auth.protected-write-denied"] as const;
export const PRODUCTION_V2_CHECK_KEYS = ["migrationAdmission", "productionIdentity", "productionProbes", "publicationReadback", "rollbackReadiness"] as const;
interface LocalCandidate {
  baselineTag: string; rollbackReference: string; developCommit: string; candidateTreeDigest: string; localUrl: string;
}
interface LocalProbes {
  discovered: number; executed: number; skipped: number; failed: number;
  required: Record<(typeof LOCAL_REQUIRED_SCENARIOS)[number], CheckStatus>;
}
export interface LocalCandidateResult {
  schemaVersion: 2; stage: "local-candidate"; mode: "local-candidate"; environment: "local"; status: OverallStatus;
  candidate: LocalCandidate; build: CandidateArtifactManifest; checks: Record<(typeof LOCAL_GATE_KEYS)[number], CheckStatus>;
  localProbes: LocalProbes; pendingProduction: Record<(typeof PRODUCTION_V2_CHECK_KEYS)[number], "pending">; generatedAt: string;
}
export interface FinalResultV2 {
  schemaVersion: 2; stage: "final"; status: OverallStatus;
  localCandidate: LocalCandidateResult; localCandidateDigest: string;
  mainCommit: string; mainTreeDigest: string;
  deployment: { environment: "production"; id: string; url: string; commit: string; treeDigest: string };
  checks: Record<(typeof PRODUCTION_V2_CHECK_KEYS)[number], CheckStatus>;
  tag: TagReference; release: ReleaseReference; readback: Readback; generatedAt: string;
}
const LOCAL_INPUT_KEYS = ["schemaVersion", "mode", "environment", "candidate", "build", "checks", "localProbes", "pendingProduction", "generatedAt"] as const;
const FINAL_V2_INPUT_KEYS = ["schemaVersion", "localCandidate", "mainCommit", "mainTreeDigest", "deployment", "checks", "tag", "release", "readback", "generatedAt"] as const;
function exactObject(raw: unknown, keys: readonly string[], label: string) {
  const value = assertPlainObject(raw, label);
  assertAllowlistedKeys(value, keys, label);
  for (const key of keys) if (!(key in value)) throw new Error(`${label} is missing required field ${key}`);
  return value;
}
function localUrl(raw: unknown) {
  const value = assertString(raw, "candidate.localUrl");
  // Check the original host spelling before URL canonicalization accepts decimal/short IPv4.
  if (!/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::[1-9][0-9]{0,4})?\/?$/.test(value)) throw new Error("Local target must be an explicit loopback origin without credentials, path, query or fragment");
  const url = new URL(value);
  if (url.port && Number(url.port) > 65535) throw new Error("Invalid local target port");
  return value;
}
function count(raw: unknown, label: string) {
  if (typeof raw !== "number" || !Number.isSafeInteger(raw) || raw < 0) throw new Error(`${label} must be a nonnegative integer`);
  return raw;
}
function localFields(raw: unknown): Omit<LocalCandidateResult, "stage" | "status"> {
  assertNoForbiddenFieldNames(raw);
  const value = exactObject(raw, LOCAL_INPUT_KEYS, "local candidate input");
  if (value.schemaVersion !== 2 || value.mode !== "local-candidate" || value.environment !== "local") throw new Error("Local qualification requires schemaVersion2, local-candidate mode and local environment");
  const c = exactObject(value.candidate, ["baselineTag", "rollbackReference", "developCommit", "candidateTreeDigest", "localUrl"], "candidate");
  const candidate = { baselineTag: assertTag(c.baselineTag, "candidate.baselineTag"), rollbackReference: assertTag(c.rollbackReference, "candidate.rollbackReference"),
    developCommit: assertSha(c.developCommit, "candidate.developCommit"), candidateTreeDigest: assertSha(c.candidateTreeDigest, "candidate.candidateTreeDigest"), localUrl: localUrl(c.localUrl) };
  const build = parseCandidateArtifactManifest(value.build);
  if (build.commit !== candidate.developCommit || build.treeDigest !== candidate.candidateTreeDigest) throw new Error("Candidate/build commit/tree identity mismatch");
  const checks = parseChecks(value.checks, LOCAL_GATE_KEYS, "checks");
  const p = exactObject(value.localProbes, ["discovered", "executed", "skipped", "failed", "required"], "localProbes");
  const localProbes = { discovered: count(p.discovered, "localProbes.discovered"), executed: count(p.executed, "localProbes.executed"), skipped: count(p.skipped, "localProbes.skipped"), failed: count(p.failed, "localProbes.failed"), required: parseChecks(p.required, LOCAL_REQUIRED_SCENARIOS, "localProbes.required") };
  if (localProbes.discovered < LOCAL_REQUIRED_SCENARIOS.length || localProbes.executed !== localProbes.discovered || localProbes.skipped !== 0) throw new Error("Local probes require complete discovery/execution and zero required skips");
  const failedRequired = Object.values(localProbes.required).filter(status => status === "failed").length;
  if (localProbes.failed > localProbes.executed || localProbes.failed < failedRequired) throw new Error("localProbes failed count is inconsistent with execution/scenarios");
  if ((localProbes.failed > 0 ? "failed" : "passed") !== checks.localProbes) throw new Error("localProbes check does not match complete browser status");
  const pending = exactObject(value.pendingProduction, PRODUCTION_V2_CHECK_KEYS, "pendingProduction");
  for (const key of PRODUCTION_V2_CHECK_KEYS) if (pending[key] !== "pending") throw new Error(`Production ${key} must remain pending in local proof`);
  const generatedAt = assertIsoTimestamp(value.generatedAt, "generatedAt");
  if (Date.parse(generatedAt) < Date.parse(build.builtAt)) throw new Error("Local proof predates its build");
  return { schemaVersion: 2, mode: "local-candidate", environment: "local", candidate, build, checks, localProbes,
    pendingProduction: { migrationAdmission: "pending", productionIdentity: "pending", productionProbes: "pending", publicationReadback: "pending", rollbackReadiness: "pending" }, generatedAt };
}
export function buildLocalCandidateResult(raw: unknown): LocalCandidateResult {
  const fields = localFields(raw);
  return Object.freeze({ ...fields, stage: "local-candidate", status: deriveOverallStatus(fields.checks) });
}
export function parseLocalCandidateResult(raw: unknown): LocalCandidateResult {
  assertNoForbiddenFieldNames(raw);
  const value = exactObject(raw, [...LOCAL_INPUT_KEYS, "stage", "status"], "local candidate result");
  if (value.stage !== "local-candidate") throw new Error("Expected local-candidate stage");
  const { stage: _stage, status, ...input } = value;
  const result = buildLocalCandidateResult(input);
  if (assertCheckStatus(status, "status") !== result.status) throw new Error("Local result status mismatch");
  return result;
}
function proofDigest(value: LocalCandidateResult) {
  return createHash("sha256").update(JSON.stringify(sortKeysDeep(value))).digest("hex");
}
export function buildFinalResultV2(raw: unknown): FinalResultV2 {
  assertNoForbiddenFieldNames(raw);
  const value = exactObject(raw, FINAL_V2_INPUT_KEYS, "final schema2 input");
  if (value.schemaVersion !== 2) throw new Error("Final schemaVersion must be2");
  const localCandidate = parseLocalCandidateResult(value.localCandidate);
  if (localCandidate.status !== "passed") throw new Error("Final proof requires passed local qualification");
  const mainCommit = assertSha(value.mainCommit, "mainCommit"), mainTreeDigest = assertSha(value.mainTreeDigest, "mainTreeDigest");
  if (mainTreeDigest !== localCandidate.candidate.candidateTreeDigest) throw new Error("Main tree differs from exact qualified candidate tree");
  const d = exactObject(value.deployment, ["environment", "id", "url", "commit", "treeDigest"], "deployment");
  if (d.environment !== "production") throw new Error("Actual production deployment identity required");
  const deployment = { environment: "production" as const, id: assertString(d.id, "deployment.id"), url: assertHttpsUrl(d.url, "deployment.url"), commit: assertSha(d.commit, "deployment.commit"), treeDigest: assertSha(d.treeDigest, "deployment.treeDigest") };
  const url = new URL(deployment.url);
  if (["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error("Production deployment must identify its actual public origin");
  if (deployment.commit !== mainCommit || deployment.treeDigest !== mainTreeDigest) throw new Error("Production deployment commit/tree identity mismatch");
  const checks = parseChecks(value.checks, PRODUCTION_V2_CHECK_KEYS, "checks");
  const t = exactObject(value.tag, TAG_REFERENCE_KEYS, "tag"), r = exactObject(value.release, RELEASE_REFERENCE_KEYS, "release");
  const tag = { name: assertTag(t.name, "tag.name"), target: assertSha(t.target, "tag.target") };
  const release = { tag: assertTag(r.tag, "release.tag"), target: assertTag(r.target, "release.target") };
  if (tag.target !== mainCommit || release.tag !== tag.name || release.target !== tag.name) throw new Error("Publication tag/release readback identity mismatch");
  const read = exactObject(value.readback, READBACK_KEYS, "readback");
  const readback = { tagVerifiedAt: assertIsoTimestamp(read.tagVerifiedAt, "readback.tagVerifiedAt"), releaseVerifiedAt: assertIsoTimestamp(read.releaseVerifiedAt, "readback.releaseVerifiedAt") };
  const generatedAt = assertIsoTimestamp(value.generatedAt, "generatedAt");
  if ([localCandidate.generatedAt, readback.tagVerifiedAt, readback.releaseVerifiedAt].some(at => Date.parse(at) > Date.parse(generatedAt))) throw new Error("Final proof predates required readback");
  return Object.freeze({ schemaVersion: 2, stage: "final", status: deriveOverallStatus(checks), localCandidate, localCandidateDigest: proofDigest(localCandidate), mainCommit, mainTreeDigest, deployment, checks, tag, release, readback, generatedAt });
}
export function parseFinalResultV2(raw: unknown): FinalResultV2 {
  assertNoForbiddenFieldNames(raw);
  const value = exactObject(raw, [...FINAL_V2_INPUT_KEYS, "stage", "status", "localCandidateDigest"], "final schema2 result");
  if (value.stage !== "final") throw new Error("Expected final stage");
  const { stage: _stage, status, localCandidateDigest, ...input } = value;
  const result = buildFinalResultV2(input);
  if (result.status !== assertCheckStatus(status, "status")) throw new Error("Final result status mismatch");
  if (localCandidateDigest !== result.localCandidateDigest) throw new Error("Local candidate proof digest mismatch");
  return result;
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

function stableStringify(result: PreviewResult | FinalResult | LocalCandidateResult | FinalResultV2): string {
  return `${JSON.stringify(sortKeysDeep(result), null, 2)}\n`;
}

export function writeResult(path: string, result: PreviewResult | FinalResult | LocalCandidateResult | FinalResultV2): void {
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

  if (stage !== "preview" && stage !== "final" && stage !== "local-candidate") throw new Error(`Unknown release result stage ${stage}`);
  const result = stage === "local-candidate" ? buildLocalCandidateResult(input)
    : stage === "final" ? input.schemaVersion === 2 ? buildFinalResultV2(input) : buildFinalResult(input) : buildPreviewResult(input);
  if (result.schemaVersion === 2) {
    const root = argument("--root", false) ?? process.cwd();
    assertUntrackedEvidenceOutput(root, outputPath);
    if (result.stage === "local-candidate") verifyLocalBuildManifest(result.build, root);
  }
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
