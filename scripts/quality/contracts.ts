export const SUPPORTED_ENVIRONMENTS = [
  "local-contract",
  "ci-build",
  "preview",
  "production",
] as const;
export const SUPPORTED_SAFETY_CLASSES = [
  "read-only",
  "synthetic-local-write",
  "authorized-preview-interaction",
  "production-operation",
  "outward-effect",
] as const;
export const SUPPORTED_ORACLES = [
  "ui",
  "http",
  "datastore",
  "vendor",
  "telemetry",
  "cleanup",
  "deployment-identity",
  "configuration",
] as const;

export type ReleaseEnvironment = (typeof SUPPORTED_ENVIRONMENTS)[number];
export type SafetyClass = (typeof SUPPORTED_SAFETY_CLASSES)[number];
export type OracleClass = (typeof SUPPORTED_ORACLES)[number];
export type ScenarioStatus = "pending" | "passed" | "failed" | "skipped";

export interface RequiredScenario {
  id: string;
  owner: string;
  runner: string;
  selector: string;
  environments: ReleaseEnvironment[];
  safetyClass: SafetyClass;
  required: boolean;
  expectedOracles: OracleClass[];
  evidenceRetentionDays: number;
  manualObligationIds?: string[];
}

export interface RequiredCatalog {
  schemaVersion: 1;
  scenarios: RequiredScenario[];
}

export interface CandidateIdentity {
  developCommit: string;
  candidateTreeDigest: string;
  previewUrl: string;
  previewIdentity?: string;
  mainCommit?: string;
  mainTreeDigest?: string;
  productionUrl?: string;
  productionIdentity?: string;
}

export interface ReleaseObligation {
  scenarioId: string;
  required: boolean;
  environment: ReleaseEnvironment;
  status: ScenarioStatus;
}

export interface EvidenceFixture {
  id: string;
  cleanupStatus: "removed" | "present" | "unknown";
  residueEvidence: string;
}

export interface ScenarioResult {
  scenarioId: string;
  environment: ReleaseEnvironment;
  status: Exclude<ScenarioStatus, "pending">;
  startedAt: string;
  finishedAt: string;
  runner: string;
  evidence: Record<string, string[]>;
  fixtures: EvidenceFixture[];
  notes?: string;
}

export interface ReleaseException {
  id: string;
  scenarioId: string;
  reason: string;
  risk: "low" | "medium" | "high";
  approvedBy: string;
  createdAt: string;
  expiresAt: string;
  followUp: string;
}

export interface CharterManeuver {
  number: number;
  status: "passed" | "failed" | "not-applicable";
  evidence?: string;
  reason?: string;
}

export interface CharterFinding {
  id: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "triaged" | "untriaged";
  summary: string;
  reference?: string;
}

export interface ExploratoryCharter {
  id: string;
  candidate: string;
  executorContext: string;
  timeboxMinutes: number;
  riskHypothesis: string;
  changedCapability: string;
  actors: string[];
  surfaces: string[];
  states: string[];
  externalSeams: string[];
  environment: ReleaseEnvironment;
  allowedOperations: string[];
  safetyClass: SafetyClass;
  candidateRecord: string;
  maneuvers: CharterManeuver[];
  findings: CharterFinding[];
  skippedHighRiskAreas: string[];
  fixtures: EvidenceFixture[];
  decision: "pass" | "blocked";
}

export interface ManualObligation {
  id: string;
  executor: string;
  executedAt: string;
  environment: ReleaseEnvironment;
  candidate: string;
  result: string;
  status: "passed" | "failed" | "skipped";
  evidence: string[];
}

export interface ReleaseRun {
  schemaVersion: 1;
  runId: string;
  generatedAt: string;
  baselineTag: string;
  candidate: CandidateIdentity;
  obligations: ReleaseObligation[];
  results: ScenarioResult[];
  exceptions: ReleaseException[];
  manualObligations: ManualObligation[];
  exploratoryCharters: ExploratoryCharter[];
  rollbackReference: string;
  tagAuthorization: {
    status: "pending" | "authorized";
    authorizedBy?: string;
    authorizedAt?: string;
  };
}

export interface EvidenceFragment {
  schemaVersion: 1;
  runId: string;
  environment: ReleaseEnvironment;
  candidateIdentity: string;
  results: ScenarioResult[];
}

export interface EvidenceManifest {
  schemaVersion: 1;
  runId: string;
  stage: "pre-merge" | "final";
  candidate: CandidateIdentity;
  results: ScenarioResult[];
  exploratoryCharters: ExploratoryCharter[];
  manualObligations: ManualObligation[];
  exceptions: ReleaseException[];
  rollbackReference: string;
  tagAuthorization: ReleaseRun["tagAuthorization"];
}

export interface AnalysisResult {
  stage: "pre-merge" | "final";
  decision: "pass" | "blocked";
  counts: {
    passed: number;
    failed: number;
    skipped: number;
    missing: number;
  };
  blockingReasons: string[];
}

export interface AnalysisOptions {
  stage: "pre-merge" | "final";
  now?: Date;
}

export type ParseResult<T> =
  | { ok: true; value: T; errors: [] }
  | { ok: false; errors: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

function pushRequiredString(
  errors: string[],
  record: Record<string, unknown>,
  field: string,
  path: string,
): void {
  if (!isNonEmptyString(record[field])) {
    errors.push(`${path}.${field}: expected a non-empty string`);
  }
}

function pushUnsupportedFields(
  errors: string[],
  record: Record<string, unknown>,
  allowedFields: readonly string[],
  path: string,
): void {
  const allowed = new Set(allowedFields);
  Object.keys(record).forEach((field) => {
    if (!allowed.has(field)) errors.push(`${path}.${field}: unsupported field`);
  });
}

export function isIsoDateTime(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(
      value,
    );
  if (!match) return false;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] =
    match;
  const offsetHourText = match[7];
  const offsetMinuteText = match[8];
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return (
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth[month - 1]! &&
    Number(hourText) <= 23 &&
    Number(minuteText) <= 59 &&
    Number(secondText) <= 59 &&
    (offsetHourText === undefined || Number(offsetHourText) <= 23) &&
    (offsetMinuteText === undefined || Number(offsetMinuteText) <= 59) &&
    Number.isFinite(Date.parse(value))
  );
}

function validateScenarioResult(
  raw: unknown,
  path: string,
  errors: string[],
): raw is ScenarioResult {
  if (!isRecord(raw)) {
    errors.push(`${path}: expected an object`);
    return false;
  }
  const allowedFields = new Set([
    "scenarioId",
    "environment",
    "status",
    "startedAt",
    "finishedAt",
    "runner",
    "evidence",
    "fixtures",
    "notes",
  ]);
  Object.keys(raw).forEach((field) => {
    if (!allowedFields.has(field)) errors.push(`${path}.${field}: unsupported field`);
  });
  ["scenarioId", "runner"].forEach((field) =>
    pushRequiredString(errors, raw, field, path),
  );
  for (const field of ["startedAt", "finishedAt"]) {
    if (!isIsoDateTime(raw[field])) {
      errors.push(`${path}.${field}: expected an ISO date-time`);
    }
  }
  if (
    !SUPPORTED_ENVIRONMENTS.includes(raw.environment as ReleaseEnvironment)
  ) {
    errors.push(`${path}.environment: unsupported environment`);
  }
  if (!["passed", "failed", "skipped"].includes(String(raw.status))) {
    errors.push(`${path}.status: unsupported status`);
  }
  if (!isRecord(raw.evidence)) {
    errors.push(`${path}.evidence: expected an object`);
  } else {
    Object.entries(raw.evidence).forEach(([oracle, files]) => {
      if (!isStringArray(files) || files.length === 0) {
        errors.push(`${path}.evidence.${oracle}: expected non-empty paths`);
      }
    });
  }
  if (!Array.isArray(raw.fixtures)) {
    errors.push(`${path}.fixtures: expected an array`);
  } else {
    raw.fixtures.forEach((fixture, index) =>
      validateFixture(fixture, `${path}.fixtures[${index}]`, errors),
    );
  }
  if (raw.notes !== undefined && typeof raw.notes !== "string") {
    errors.push(`${path}.notes: expected a string`);
  }
  return true;
}

export function parseScenarioResult(
  raw: unknown,
  path = "result",
): ParseResult<ScenarioResult> {
  const errors: string[] = [];
  validateScenarioResult(raw, path, errors);
  return errors.length
    ? { ok: false, errors }
    : { ok: true, value: raw as ScenarioResult, errors: [] };
}

export function parseEvidenceFragment(
  raw: unknown,
  path = "fragment",
): ParseResult<EvidenceFragment> {
  const errors: string[] = [];
  if (!isRecord(raw)) return { ok: false, errors: [`${path}: expected an object`] };
  const allowedFields = new Set([
    "schemaVersion",
    "runId",
    "environment",
    "candidateIdentity",
    "results",
  ]);
  Object.keys(raw).forEach((field) => {
    if (!allowedFields.has(field)) errors.push(`${path}.${field}: unsupported field`);
  });
  if (raw.schemaVersion !== 1) errors.push(`${path}.schemaVersion: expected 1`);
  pushRequiredString(errors, raw, "runId", path);
  if (
    !SUPPORTED_ENVIRONMENTS.includes(raw.environment as ReleaseEnvironment)
  ) {
    errors.push(`${path}.environment: unsupported environment`);
  }
  if (
    typeof raw.candidateIdentity !== "string" ||
    !/^[0-9a-f]{40}$/.test(raw.candidateIdentity)
  ) {
    errors.push(
      `${path}.candidateIdentity: expected a lowercase 40-character Git identity`,
    );
  }
  if (!Array.isArray(raw.results)) {
    errors.push(`${path}.results: expected an array`);
  } else {
    raw.results.forEach((result, index) => {
      validateScenarioResult(result, `${path}.results[${index}]`, errors);
      if (
        isRecord(result) &&
        result.environment !== raw.environment
      ) {
        errors.push(
          `${path}.results[${index}].environment: does not match fragment environment`,
        );
      }
    });
  }
  return errors.length
    ? { ok: false, errors }
    : { ok: true, value: raw as unknown as EvidenceFragment, errors: [] };
}

export function parseRequiredCatalog(raw: unknown): ParseResult<RequiredCatalog> {
  const errors: string[] = [];
  if (!isRecord(raw)) {
    return { ok: false, errors: ["catalog: expected an object"] };
  }
  pushUnsupportedFields(
    errors,
    raw,
    ["schemaVersion", "scenarios"],
    "catalog",
  );
  if (raw.schemaVersion !== 1) {
    errors.push("catalog.schemaVersion: expected 1");
  }
  if (!Array.isArray(raw.scenarios) || raw.scenarios.length === 0) {
    errors.push("catalog.scenarios: expected a non-empty array");
  } else {
    const ids = new Set<string>();
    raw.scenarios.forEach((item, index) => {
      const path = `scenarios[${index}]`;
      if (!isRecord(item)) {
        errors.push(`${path}: expected an object`);
        return;
      }
      pushUnsupportedFields(
        errors,
        item,
        [
          "id",
          "owner",
          "runner",
          "selector",
          "environments",
          "safetyClass",
          "required",
          "expectedOracles",
          "evidenceRetentionDays",
          "manualObligationIds",
        ],
        path,
      );
      ["id", "owner", "runner", "selector"].forEach((field) =>
        pushRequiredString(errors, item, field, path),
      );
      if (
        typeof item.id !== "string" ||
        !/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/.test(item.id)
      ) {
        errors.push(`${path}.id: expected a stable dotted scenario ID`);
      }
      if (!Array.isArray(item.environments) || item.environments.length === 0) {
        errors.push(`${path}.environments: expected a non-empty array`);
      } else {
        const environments = item.environments;
        environments.forEach((environment) => {
          if (
            !SUPPORTED_ENVIRONMENTS.includes(
              environment as ReleaseEnvironment,
            )
          ) {
            errors.push(`${path}.environments: unsupported environment`);
          }
        });
        if (new Set(environments).size !== environments.length) {
          errors.push(`${path}.environments: duplicate environment`);
        }
      }
      if (
        !SUPPORTED_SAFETY_CLASSES.includes(item.safetyClass as SafetyClass)
      ) {
        errors.push(`${path}.safetyClass: unsupported safety class`);
      }
      if (typeof item.required !== "boolean") {
        errors.push(`${path}.required: expected a boolean`);
      }
      if (
        !isStringArray(item.expectedOracles) ||
        item.expectedOracles.length === 0
      ) {
        errors.push(`${path}.expectedOracles: expected a non-empty array`);
      } else {
        item.expectedOracles.forEach((oracle) => {
          if (!SUPPORTED_ORACLES.includes(oracle as OracleClass)) {
            errors.push(`${path}.expectedOracles: unsupported oracle ${oracle}`);
          }
        });
        if (new Set(item.expectedOracles).size !== item.expectedOracles.length) {
          errors.push(`${path}.expectedOracles: duplicate oracle`);
        }
      }
      if (
        !Number.isInteger(item.evidenceRetentionDays) ||
        Number(item.evidenceRetentionDays) <= 0
      ) {
        errors.push(`${path}.evidenceRetentionDays: expected a positive integer`);
      }
      if (item.manualObligationIds !== undefined) {
        if (
          !isStringArray(item.manualObligationIds) ||
          item.manualObligationIds.length === 0
        ) {
          errors.push(
            `${path}.manualObligationIds: expected a non-empty array`,
          );
        } else if (
          new Set(item.manualObligationIds).size !==
          item.manualObligationIds.length
        ) {
          errors.push(`${path}.manualObligationIds: duplicate id`);
        }
      }
      if (
        item.id === "release.manual-arcs" &&
        (!isStringArray(item.manualObligationIds) ||
          item.manualObligationIds.length === 0)
      ) {
        errors.push(
          `${path}.manualObligationIds: release.manual-arcs requires declared ids`,
        );
      }
      if (isNonEmptyString(item.id)) {
        if (ids.has(item.id)) {
          errors.push(`scenarios: duplicate scenario id ${item.id}`);
        }
        ids.add(item.id);
      }
    });
  }
  return errors.length
    ? { ok: false, errors }
    : { ok: true, value: raw as unknown as RequiredCatalog, errors: [] };
}

function validateFixture(
  raw: unknown,
  path: string,
  errors: string[],
): raw is EvidenceFixture {
  if (!isRecord(raw)) {
    errors.push(`${path}: expected an object`);
    return false;
  }
  const allowedFields = new Set(["id", "cleanupStatus", "residueEvidence"]);
  Object.keys(raw).forEach((field) => {
    if (!allowedFields.has(field)) {
      errors.push(`${path}.${field}: unsupported field`);
    }
  });
  pushRequiredString(errors, raw, "id", path);
  if (!["removed", "present", "unknown"].includes(String(raw.cleanupStatus))) {
    errors.push(`${path}.cleanupStatus: unsupported status`);
  }
  if (typeof raw.residueEvidence !== "string") {
    errors.push(`${path}.residueEvidence: expected a string`);
  }
  return true;
}

function validateReleaseException(
  raw: unknown,
  path: string,
  errors: string[],
): raw is ReleaseException {
  if (!isRecord(raw)) {
    errors.push(`${path}: expected an object`);
    return false;
  }
  const allowedFields = new Set([
    "id",
    "scenarioId",
    "reason",
    "risk",
    "approvedBy",
    "createdAt",
    "expiresAt",
    "followUp",
  ]);
  Object.keys(raw).forEach((field) => {
    if (!allowedFields.has(field)) {
      errors.push(`${path}.${field}: unsupported field`);
    }
  });
  ["id", "scenarioId", "reason", "approvedBy", "followUp"].forEach((field) =>
    pushRequiredString(errors, raw, field, path),
  );
  if (!["low", "medium", "high"].includes(String(raw.risk))) {
    errors.push(`${path}.risk: unsupported risk`);
  }
  ["createdAt", "expiresAt"].forEach((field) => {
    if (!isIsoDateTime(raw[field])) {
      errors.push(`${path}.${field}: expected an ISO date-time`);
    }
  });
  return true;
}

function validateExploratoryCharter(
  raw: unknown,
  path: string,
  errors: string[],
): raw is ExploratoryCharter {
  if (!isRecord(raw)) {
    errors.push(`${path}: expected an object`);
    return false;
  }
  const allowedFields = new Set([
    "id",
    "candidate",
    "executorContext",
    "timeboxMinutes",
    "riskHypothesis",
    "changedCapability",
    "actors",
    "surfaces",
    "states",
    "externalSeams",
    "environment",
    "allowedOperations",
    "safetyClass",
    "candidateRecord",
    "maneuvers",
    "findings",
    "skippedHighRiskAreas",
    "fixtures",
    "decision",
  ]);
  Object.keys(raw).forEach((field) => {
    if (!allowedFields.has(field)) {
      errors.push(`${path}.${field}: unsupported field`);
    }
  });
  [
    "id",
    "executorContext",
    "riskHypothesis",
    "changedCapability",
    "candidateRecord",
  ].forEach((field) =>
    pushRequiredString(errors, raw, field, path),
  );
  if (
    !Number.isInteger(raw.timeboxMinutes) ||
    Number(raw.timeboxMinutes) <= 0
  ) {
    errors.push(`${path}.timeboxMinutes: expected a positive integer`);
  }
  ["actors", "surfaces", "states", "allowedOperations"].forEach((field) => {
    if (!isStringArray(raw[field]) || raw[field].length === 0) {
      errors.push(`${path}.${field}: expected a non-empty array of strings`);
    }
  });
  if (!isStringArray(raw.externalSeams)) {
    errors.push(`${path}.externalSeams: expected an array of strings`);
  }
  if (
    !SUPPORTED_ENVIRONMENTS.includes(raw.environment as ReleaseEnvironment)
  ) {
    errors.push(`${path}.environment: unsupported environment`);
  }
  if (!SUPPORTED_SAFETY_CLASSES.includes(raw.safetyClass as SafetyClass)) {
    errors.push(`${path}.safetyClass: unsupported safety class`);
  }
  if (
    typeof raw.candidate !== "string" ||
    !/^[0-9a-f]{40}$/.test(raw.candidate)
  ) {
    errors.push(
      `${path}.candidate: expected a lowercase 40-character Git identity`,
    );
  }
  if (raw.decision !== "pass" && raw.decision !== "blocked") {
    errors.push(`${path}.decision: expected pass or blocked`);
  }
  if (!Array.isArray(raw.maneuvers)) {
    errors.push(`${path}.maneuvers: expected exactly maneuvers 1 through 8`);
  } else {
    const numbers = raw.maneuvers
      .filter(isRecord)
      .map((maneuver) => maneuver.number);
    const exactNumbers =
      raw.maneuvers.length === 8 &&
      Array.from({ length: 8 }, (_, index) => index + 1).every(
        (number) => numbers.filter((value) => value === number).length === 1,
      );
    if (!exactNumbers) {
      errors.push(`${path}.maneuvers: expected exactly maneuvers 1 through 8`);
    }
    raw.maneuvers.forEach((maneuver, index) => {
      const maneuverPath = `${path}.maneuvers[${index}]`;
      if (!isRecord(maneuver)) {
        errors.push(`${maneuverPath}: expected an object`);
        return;
      }
      const allowedManeuverFields = new Set([
        "number",
        "status",
        "evidence",
        "reason",
      ]);
      Object.keys(maneuver).forEach((field) => {
        if (!allowedManeuverFields.has(field)) {
          errors.push(`${maneuverPath}.${field}: unsupported field`);
        }
      });
      if (!Number.isInteger(maneuver.number)) {
        errors.push(`${maneuverPath}.number: expected an integer`);
      }
      if (
        !["passed", "failed", "not-applicable"].includes(
          String(maneuver.status),
        )
      ) {
        errors.push(`${maneuverPath}.status: unsupported status`);
      }
      if (
        maneuver.evidence !== undefined &&
        typeof maneuver.evidence !== "string"
      ) {
        errors.push(`${maneuverPath}.evidence: expected a string`);
      }
      if (
        maneuver.reason !== undefined &&
        typeof maneuver.reason !== "string"
      ) {
        errors.push(`${maneuverPath}.reason: expected a string`);
      }
    });
  }
  if (!Array.isArray(raw.findings)) {
    errors.push(`${path}.findings: expected an array`);
  } else {
    raw.findings.forEach((finding, index) => {
      const findingPath = `${path}.findings[${index}]`;
      if (!isRecord(finding)) {
        errors.push(`${findingPath}: expected an object`);
        return;
      }
      const allowedFindingFields = new Set([
        "id",
        "severity",
        "status",
        "summary",
        "reference",
      ]);
      Object.keys(finding).forEach((field) => {
        if (!allowedFindingFields.has(field)) {
          errors.push(`${findingPath}.${field}: unsupported field`);
        }
      });
      ["id", "summary"].forEach((field) =>
        pushRequiredString(errors, finding, field, findingPath),
      );
      if (
        !["low", "medium", "high", "critical"].includes(
          String(finding.severity),
        )
      ) {
        errors.push(`${findingPath}.severity: unsupported severity`);
      }
      if (!["triaged", "untriaged"].includes(String(finding.status))) {
        errors.push(`${findingPath}.status: unsupported status`);
      }
      if (
        finding.reference !== undefined &&
        typeof finding.reference !== "string"
      ) {
        errors.push(`${findingPath}.reference: expected a string`);
      }
    });
  }
  if (!isStringArray(raw.skippedHighRiskAreas)) {
    errors.push(`${path}.skippedHighRiskAreas: expected an array of strings`);
  }
  if (!Array.isArray(raw.fixtures)) {
    errors.push(`${path}.fixtures: expected an array`);
  } else {
    raw.fixtures.forEach((fixture, index) =>
      validateFixture(fixture, `${path}.fixtures[${index}]`, errors),
    );
  }
  return true;
}

export function parseReleaseRun(raw: unknown): ParseResult<ReleaseRun> {
  const errors: string[] = [];
  if (!isRecord(raw)) {
    return { ok: false, errors: ["releaseRun: expected an object"] };
  }
  const allowedFields = new Set([
    "schemaVersion",
    "runId",
    "generatedAt",
    "baselineTag",
    "candidate",
    "obligations",
    "results",
    "exceptions",
    "manualObligations",
    "exploratoryCharters",
    "rollbackReference",
    "tagAuthorization",
  ]);
  Object.keys(raw).forEach((field) => {
    if (!allowedFields.has(field)) {
      errors.push(`releaseRun.${field}: unsupported field`);
    }
  });
  if (raw.schemaVersion !== 1) {
    errors.push("releaseRun.schemaVersion: expected 1");
  }
  ["runId", "rollbackReference"].forEach((field) =>
    pushRequiredString(errors, raw, field, "releaseRun"),
  );
  if (
    typeof raw.runId !== "string" ||
    !/^[0-9A-Za-z][0-9A-Za-z._-]*$/.test(raw.runId)
  ) {
    errors.push("releaseRun.runId: expected a stable path-safe identifier");
  }
  if (!isIsoDateTime(raw.generatedAt)) {
    errors.push("releaseRun.generatedAt: expected an ISO date-time");
  }
  if (
    typeof raw.baselineTag !== "string" ||
    !/^(?:v?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?|[0-9a-f]{40})$/.test(
      raw.baselineTag,
    )
  ) {
    errors.push(
      "releaseRun.baselineTag: expected an immutable semantic-version tag or 40-character commit",
    );
  }
  if (!isRecord(raw.candidate)) {
    errors.push("releaseRun.candidate: expected an object");
  } else {
    const candidate = raw.candidate;
    pushUnsupportedFields(
      errors,
      candidate,
      [
        "developCommit",
        "candidateTreeDigest",
        "previewUrl",
        "previewIdentity",
        "mainCommit",
        "mainTreeDigest",
        "productionUrl",
        "productionIdentity",
      ],
      "candidate",
    );
    const identity = /^[0-9a-f]{40}$/;
    ["developCommit", "candidateTreeDigest"].forEach((field) => {
      if (
        typeof candidate[field] !== "string" ||
        !identity.test(candidate[field])
      ) {
        errors.push(
          `candidate.${field}: expected a lowercase 40-character Git identity`,
        );
      }
    });
    [
      "previewIdentity",
      "mainCommit",
      "mainTreeDigest",
      "productionIdentity",
    ].forEach((field) => {
      if (
        candidate[field] !== undefined &&
        (typeof candidate[field] !== "string" ||
          !identity.test(candidate[field]))
      ) {
        errors.push(
          `candidate.${field}: expected a lowercase 40-character Git identity`,
        );
      }
    });
    ["previewUrl", "productionUrl"].forEach((field) => {
      const required = field === "previewUrl";
      if (candidate[field] === undefined && !required) return;
      if (typeof candidate[field] !== "string") {
        errors.push(`candidate.${field}: expected a valid HTTP(S) URL`);
        return;
      }
      try {
        const url = new URL(candidate[field]);
        if (!["http:", "https:"].includes(url.protocol)) {
          errors.push(`candidate.${field}: expected a valid HTTP(S) URL`);
        }
      } catch {
        errors.push(`candidate.${field}: expected a valid HTTP(S) URL`);
      }
    });
  }
  if (!Array.isArray(raw.obligations)) {
    errors.push("releaseRun.obligations: expected an array");
  } else {
    raw.obligations.forEach((obligation, index) => {
      const path = `obligations[${index}]`;
      if (!isRecord(obligation)) {
        errors.push(`${path}: expected an object`);
        return;
      }
      pushUnsupportedFields(
        errors,
        obligation,
        ["scenarioId", "required", "environment", "status"],
        path,
      );
      pushRequiredString(errors, obligation, "scenarioId", path);
      if (
        !SUPPORTED_ENVIRONMENTS.includes(
          obligation.environment as ReleaseEnvironment,
        )
      ) {
        errors.push(`${path}.environment: unsupported environment`);
      }
      if (typeof obligation.required !== "boolean") {
        errors.push(`${path}.required: expected a boolean`);
      }
      if (
        !["pending", "passed", "failed", "skipped"].includes(
          String(obligation.status),
        )
      ) {
        errors.push(`${path}.status: unsupported status`);
      }
    });
  }
  if (!Array.isArray(raw.results)) {
    errors.push("releaseRun.results: expected an array");
  } else {
    raw.results.forEach((item, index) =>
      validateScenarioResult(item, `results[${index}]`, errors),
    );
  }
  if (!Array.isArray(raw.exceptions)) {
    errors.push("releaseRun.exceptions: expected an array");
  } else {
    raw.exceptions.forEach((exception, index) =>
      validateReleaseException(exception, `exceptions[${index}]`, errors),
    );
  }
  if (!Array.isArray(raw.manualObligations)) {
    errors.push("releaseRun.manualObligations: expected an array");
  } else {
    raw.manualObligations.forEach((obligation, index) => {
      const path = `manualObligations[${index}]`;
      if (!isRecord(obligation)) {
        errors.push(`${path}: expected an object`);
        return;
      }
      pushUnsupportedFields(
        errors,
        obligation,
        [
          "id",
          "executor",
          "executedAt",
          "environment",
          "candidate",
          "result",
          "status",
          "evidence",
        ],
        path,
      );
      ["id", "executor", "result"].forEach((field) =>
        pushRequiredString(errors, obligation, field, path),
      );
      if (!isIsoDateTime(obligation.executedAt)) {
        errors.push(`${path}.executedAt: expected an ISO date-time`);
      }
      if (
        !SUPPORTED_ENVIRONMENTS.includes(
          obligation.environment as ReleaseEnvironment,
        )
      ) {
        errors.push(`${path}.environment: unsupported environment`);
      }
      if (
        typeof obligation.candidate !== "string" ||
        !/^[0-9a-f]{40}$/.test(obligation.candidate)
      ) {
        errors.push(
          `${path}.candidate: expected a lowercase 40-character Git identity`,
        );
      }
      if (
        !["passed", "failed", "skipped"].includes(String(obligation.status))
      ) {
        errors.push(`${path}.status: unsupported status`);
      }
      if (
        !isStringArray(obligation.evidence) ||
        obligation.evidence.length === 0
      ) {
        errors.push(`${path}.evidence: expected a non-empty array`);
      }
    });
  }
  if (!Array.isArray(raw.exploratoryCharters)) {
    errors.push("releaseRun.exploratoryCharters: expected an array");
  } else {
    raw.exploratoryCharters.forEach((charter, index) =>
      validateExploratoryCharter(
        charter,
        `exploratoryCharters[${index}]`,
        errors,
      ),
    );
  }
  if (!isRecord(raw.tagAuthorization)) {
    errors.push("releaseRun.tagAuthorization: expected an object");
  } else {
    pushUnsupportedFields(
      errors,
      raw.tagAuthorization,
      ["status", "authorizedBy", "authorizedAt"],
      "releaseRun.tagAuthorization",
    );
    if (raw.tagAuthorization.status === "pending") {
      if (
        raw.tagAuthorization.authorizedBy !== undefined ||
        raw.tagAuthorization.authorizedAt !== undefined
      ) {
        errors.push(
          "releaseRun.tagAuthorization: pending authorization cannot include authorization fields",
        );
      }
    } else if (raw.tagAuthorization.status === "authorized") {
      if (!isNonEmptyString(raw.tagAuthorization.authorizedBy)) {
        errors.push(
          "releaseRun.tagAuthorization.authorizedBy: expected a non-empty string",
        );
      }
      if (!isIsoDateTime(raw.tagAuthorization.authorizedAt)) {
        errors.push(
          "releaseRun.tagAuthorization.authorizedAt: expected an ISO date-time",
        );
      }
    } else {
      errors.push("releaseRun.tagAuthorization.status: unsupported status");
    }
  }
  return errors.length
    ? { ok: false, errors }
    : { ok: true, value: raw as unknown as ReleaseRun, errors: [] };
}

function isActiveException(
  exception: ReleaseException | undefined,
  now: Date,
): boolean {
  if (!exception) return false;
  return (
    isNonEmptyString(exception.id) &&
    isNonEmptyString(exception.reason) &&
    isNonEmptyString(exception.approvedBy) &&
    isNonEmptyString(exception.followUp) &&
    ["low", "medium", "high"].includes(exception.risk) &&
    Number.isFinite(Date.parse(exception.createdAt)) &&
    Number.isFinite(Date.parse(exception.expiresAt)) &&
    Date.parse(exception.expiresAt) > now.getTime()
  );
}

function analyzeFixture(
  fixture: EvidenceFixture,
  runId: string,
  reasons: string[],
): void {
  if (!fixture.id.includes(runId)) {
    reasons.push(`fixture ${fixture.id}: id is not scoped to run ${runId}`);
  }
  if (fixture.cleanupStatus !== "removed") {
    reasons.push(
      `fixture ${fixture.id}: cleanup status is ${fixture.cleanupStatus}`,
    );
  }
  if (!fixture.residueEvidence.trim()) {
    reasons.push(`fixture ${fixture.id}: zero-residue evidence is missing`);
  }
}

export function analyzeReleaseRun(
  catalogRaw: unknown,
  runRaw: unknown,
  options: Date | AnalysisOptions = { stage: "final" },
): AnalysisResult {
  const stage = options instanceof Date ? "final" : options.stage;
  const now = options instanceof Date ? options : (options.now ?? new Date());
  const catalogResult = parseRequiredCatalog(catalogRaw);
  const runResult = parseReleaseRun(runRaw);
  const schemaReasons = [
    ...(catalogResult.ok ? [] : catalogResult.errors),
    ...(runResult.ok ? [] : runResult.errors),
  ];
  if (!catalogResult.ok || !runResult.ok) {
    return {
      stage,
      decision: "blocked",
      counts: { passed: 0, failed: 0, skipped: 0, missing: 0 },
      blockingReasons: schemaReasons,
    };
  }

  const catalog = catalogResult.value;
  const run = runResult.value;
  const reasons: string[] = [];
  const key = (scenarioId: string, environment: ReleaseEnvironment): string =>
    `${scenarioId}\u0000${environment}`;
  const label = (
    scenarioId: string,
    environment: ReleaseEnvironment,
  ): string => `${scenarioId}/${environment}`;
  const catalogRequirements = catalog.scenarios.flatMap((scenario) =>
    scenario.environments.map((environment) => ({
      scenario,
      environment,
      key: key(scenario.id, environment),
    })),
  );
  const evaluatedRequirements = catalogRequirements.filter(
    ({ environment }) => stage === "final" || environment !== "production",
  );
  const catalogByKey = new Map(
    catalogRequirements.map((requirement) => [
      requirement.key,
      requirement,
    ]),
  );
  const evaluatedKeys = new Set(
    evaluatedRequirements.map((requirement) => requirement.key),
  );
  const resultByKey = new Map<string, ScenarioResult>();

  for (const result of run.results) {
    const resultKey = key(result.scenarioId, result.environment);
    if (!catalogByKey.has(resultKey)) {
      reasons.push(
        `results: unknown scenario id/environment ${label(result.scenarioId, result.environment)}`,
      );
    }
    if (resultByKey.has(resultKey)) {
      reasons.push(
        `results: duplicate scenario id/environment ${label(result.scenarioId, result.environment)}`,
      );
    } else {
      resultByKey.set(resultKey, result);
    }
  }

  const obligationKeys = new Set<string>();
  for (const obligation of run.obligations) {
    const obligationKey = key(obligation.scenarioId, obligation.environment);
    const requirement = catalogByKey.get(obligationKey);
    if (!requirement) {
      reasons.push(
        `obligations: unknown scenario id/environment ${label(obligation.scenarioId, obligation.environment)}`,
      );
    }
    if (obligationKeys.has(obligationKey)) {
      reasons.push(
        `obligations: duplicate scenario id/environment ${label(obligation.scenarioId, obligation.environment)}`,
      );
    }
    obligationKeys.add(obligationKey);
    if (
      requirement &&
      obligation.required !== requirement.scenario.required
    ) {
      reasons.push(
        `obligations: requiredness mismatch for ${label(obligation.scenarioId, obligation.environment)}`,
      );
    }
  }
  for (const requirement of catalogRequirements) {
    if (!obligationKeys.has(requirement.key)) {
      reasons.push(
        `obligations: required catalog obligation ${label(requirement.scenario.id, requirement.environment)} is missing`,
      );
    }
  }

  if (
    !run.results.some(
      (result) =>
        evaluatedKeys.has(key(result.scenarioId, result.environment)) &&
        result.status === "passed",
    )
  ) {
    reasons.push("results: zero scenarios passed");
  }

  let missing = 0;
  for (const { scenario, environment, key: requirementKey } of evaluatedRequirements) {
    const result = resultByKey.get(requirementKey);
    const scenarioLabel = label(scenario.id, environment);
    if (!result) {
      if (scenario.required) {
        missing += 1;
        reasons.push(`scenario ${scenarioLabel}: required result is missing`);
      }
      continue;
    }
    if (scenario.required && result.status !== "passed") {
      reasons.push(
        `scenario ${scenarioLabel}: required result status is ${result.status}`,
      );
    } else if (!scenario.required && result.status !== "passed") {
      const exception = run.exceptions.find(
        (item) => item.scenarioId === scenario.id,
      );
      if (!isActiveException(exception, now)) {
        reasons.push(
          `scenario ${scenarioLabel}: optional failure lacks an active authorized exception`,
        );
      }
    }
    if (result.status === "passed") {
      for (const oracle of scenario.expectedOracles) {
        if (!result.evidence[oracle]?.length) {
          reasons.push(
            `scenario ${scenarioLabel}: missing evidence for oracle ${oracle}`,
          );
        }
      }
      if (
        scenario.safetyClass === "synthetic-local-write" &&
        !result.fixtures.some(
          (fixture) =>
            fixture.cleanupStatus === "removed" &&
            fixture.residueEvidence.trim().length > 0,
        )
      ) {
        reasons.push(
          `scenario ${scenarioLabel}: passed synthetic-local-write result has no cleanup fixture`,
        );
      }
    }
    result.fixtures.forEach((fixture) =>
      analyzeFixture(fixture, run.runId, reasons),
    );
  }

  const manualArcScenario = evaluatedRequirements.find(
    ({ scenario }) => scenario.id === "release.manual-arcs",
  )?.scenario;
  if (manualArcScenario) {
    const expectedManualIds = new Set(
      manualArcScenario.manualObligationIds ?? [],
    );
    const manualById = new Map<string, ManualObligation[]>();
    for (const obligation of run.manualObligations) {
      const matching = manualById.get(obligation.id) ?? [];
      matching.push(obligation);
      manualById.set(obligation.id, matching);
      if (!expectedManualIds.has(obligation.id)) {
        reasons.push(`manual obligations: unknown id ${obligation.id}`);
      }
    }
    for (const expectedId of expectedManualIds) {
      const matching = manualById.get(expectedId) ?? [];
      // Duplicate-id hygiene applies regardless of requiredness — a
      // malformed record is a data-integrity problem whether or not the
      // bundling scenario currently blocks a release on it.
      if (matching.length > 1) {
        reasons.push(`manual obligations: duplicate id ${expectedId}`);
      }
      // Per docs/playbooks/e2e-pro-release-verification.md ("the analyzer
      // rejects a missing required current-release result") — completeness
      // enforcement below is scoped to REQUIRED manual-arc bundles. A
      // non-required bundle (release.manual-arcs demoted per #1190) must be
      // able to go genuinely unattempted without blocking; without this
      // gate every manual id in manualObligationIds would still force a
      // human round trip regardless of the scenario's own `required` flag.
      if (!manualArcScenario.required) continue;
      if (matching.length === 0) {
        reasons.push(`manual obligations: required id ${expectedId} is missing`);
        continue;
      }
      if (
        !matching.some(
          (obligation) =>
            obligation.status === "passed" &&
            obligation.candidate === run.candidate.developCommit &&
            manualArcScenario.environments.includes(obligation.environment) &&
            obligation.evidence.length > 0,
        )
      ) {
        reasons.push(
          `manual obligations: ${expectedId} lacks passed candidate-bound evidence`,
        );
      }
    }
  }

  if (run.candidate.previewIdentity !== run.candidate.developCommit) {
    reasons.push("candidate: preview identity does not match develop commit");
  }
  if (stage === "final") {
    if (!run.candidate.mainCommit) {
      reasons.push("candidate: main commit is missing");
    }
    if (!run.candidate.mainTreeDigest) {
      reasons.push("candidate: main tree digest is missing");
    } else if (
      run.candidate.mainTreeDigest !== run.candidate.candidateTreeDigest
    ) {
      reasons.push(
        "candidate: main tree digest does not match candidate tree digest",
      );
    }
    if (!run.candidate.productionUrl) {
      reasons.push("candidate: production URL is missing");
    }
    if (!run.candidate.productionIdentity) {
      reasons.push("candidate: production identity is missing");
    } else if (run.candidate.productionIdentity !== run.candidate.mainCommit) {
      reasons.push("candidate: production identity does not match main commit");
    }
  }

  if (run.exploratoryCharters.length === 0) {
    reasons.push("exploratory: at least one complete charter is required");
  }

  for (const charter of run.exploratoryCharters) {
    if (charter.decision !== "pass") {
      reasons.push(`charter ${charter.id}: decision is ${charter.decision}`);
    }
    if (charter.candidate !== run.candidate.developCommit) {
      reasons.push(`charter ${charter.id}: candidate identity mismatch`);
    }
    for (let number = 1; number <= 8; number += 1) {
      const maneuver = charter.maneuvers.find((item) => item.number === number);
      if (!maneuver) {
        reasons.push(`charter ${charter.id}: missing maneuver ${number}`);
        continue;
      }
      if (maneuver.status === "failed") {
        reasons.push(`charter ${charter.id}: maneuver ${number} failed`);
      }
      if (maneuver.status === "passed" && !maneuver.evidence?.trim()) {
        reasons.push(
          `charter ${charter.id}: maneuver ${number} passed without evidence`,
        );
      }
      if (
        maneuver.status === "not-applicable" &&
        !maneuver.reason?.trim()
      ) {
        reasons.push(
          `charter ${charter.id}: maneuver ${number} is not-applicable without a reason`,
        );
      }
    }
    if (charter.skippedHighRiskAreas.length) {
      reasons.push(`charter ${charter.id}: skipped high-risk areas remain`);
    }
    if (charter.findings.some((finding) => finding.status === "untriaged")) {
      reasons.push(`charter ${charter.id}: untriaged findings remain`);
    }
    charter.fixtures.forEach((fixture) =>
      analyzeFixture(fixture, run.runId, reasons),
    );
  }

  const counts = {
    passed: run.results.filter(
      (result) =>
        evaluatedKeys.has(key(result.scenarioId, result.environment)) &&
        result.status === "passed",
    ).length,
    failed: run.results.filter(
      (result) =>
        evaluatedKeys.has(key(result.scenarioId, result.environment)) &&
        result.status === "failed",
    ).length,
    skipped: run.results.filter(
      (result) =>
        evaluatedKeys.has(key(result.scenarioId, result.environment)) &&
        result.status === "skipped",
    ).length,
    missing,
  };
  return {
    stage,
    decision: reasons.length ? "blocked" : "pass",
    counts,
    blockingReasons: [...new Set(reasons)],
  };
}
