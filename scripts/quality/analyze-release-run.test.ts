import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  analyzeReleaseRun,
  parseReleaseRun,
  type RequiredCatalog,
  type ReleaseRun,
} from "./contracts";

const DEVELOP = "a".repeat(40);
const TREE = "b".repeat(40);
const MAIN = "c".repeat(40);
const NOW = new Date("2026-07-26T12:00:00.000Z");

function catalog(): RequiredCatalog {
  return {
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
      {
        id: "studio.config-persistence",
        owner: "web",
        runner: "playwright",
        selector: "@release-required studio.config-persistence",
        environments: ["local-contract"],
        safetyClass: "synthetic-local-write",
        required: true,
        expectedOracles: ["ui", "http", "datastore", "cleanup"],
        evidenceRetentionDays: 90,
      },
      {
        id: "optional.visual-review",
        owner: "design",
        runner: "manual",
        selector: "optional.visual-review",
        environments: ["preview"],
        safetyClass: "read-only",
        required: false,
        expectedOracles: ["ui"],
        evidenceRetentionDays: 30,
      },
    ],
  };
}

function passingRun(): ReleaseRun {
  return {
    schemaVersion: 1,
    runId: "release-20260726-001",
    generatedAt: "2026-07-26T10:00:00.000Z",
    baselineTag: "v2.19.0",
    candidate: {
      developCommit: DEVELOP,
      candidateTreeDigest: TREE,
      previewUrl: "https://candidate.example.test/",
      previewIdentity: DEVELOP,
      mainCommit: MAIN,
      mainTreeDigest: TREE,
      productionUrl: "https://production.example.test/",
      productionIdentity: MAIN,
    },
    obligations: catalog().scenarios.flatMap((item) =>
      item.environments.map((environment) => ({
        scenarioId: item.id,
        required: item.required,
        environment,
        status: "pending" as const,
      })),
    ),
    results: [
      {
        scenarioId: "deployment.preview-identity",
        environment: "preview",
        status: "passed",
        startedAt: "2026-07-26T10:01:00.000Z",
        finishedAt: "2026-07-26T10:02:00.000Z",
        runner: "playwright",
        evidence: {
          http: ["artifacts/version-response.json"],
          "deployment-identity": ["artifacts/preview-sha.txt"],
        },
        fixtures: [],
      },
      {
        scenarioId: "studio.config-persistence",
        environment: "local-contract",
        status: "passed",
        startedAt: "2026-07-26T10:03:00.000Z",
        finishedAt: "2026-07-26T10:04:00.000Z",
        runner: "playwright",
        evidence: {
          ui: ["artifacts/studio.png"],
          http: ["artifacts/studio-response.json"],
          datastore: ["artifacts/studio-row.json"],
          cleanup: ["artifacts/studio-residue.json"],
        },
        fixtures: [
          {
            id: "release-20260726-001-studio",
            cleanupStatus: "removed",
            residueEvidence: "artifacts/studio-residue.json",
          },
        ],
      },
      {
        scenarioId: "optional.visual-review",
        environment: "preview",
        status: "passed",
        startedAt: "2026-07-26T10:05:00.000Z",
        finishedAt: "2026-07-26T10:06:00.000Z",
        runner: "manual",
        evidence: { ui: ["artifacts/visual-review.png"] },
        fixtures: [],
      },
    ],
    exceptions: [],
    manualObligations: [],
    exploratoryCharters: [completeCharter()],
    rollbackReference: "docs/runbooks/rollback.md",
    tagAuthorization: { status: "pending" },
  };
}

function reasons(run: unknown, inputCatalog: unknown = catalog()): string[] {
  return analyzeReleaseRun(inputCatalog, run, NOW).blockingReasons;
}

describe("analyzeReleaseRun", () => {
  it("passes the tracked synthetic release fixture", () => {
    const fixtureCatalog = JSON.parse(
      readFileSync("quality/release-required.json", "utf8"),
    ) as unknown;
    const fixtureRun = JSON.parse(
      readFileSync("quality/fixtures/passing-release-run.json", "utf8"),
    ) as unknown;

    expect(
      analyzeReleaseRun(fixtureCatalog, fixtureRun, {
        stage: "final",
        now: NOW,
      }),
    ).toMatchObject({ decision: "pass", blockingReasons: [] });
  });

  it("blocks a release with no independent exploratory charter", () => {
    const run = passingRun();
    run.exploratoryCharters = [];
    expect(reasons(run)).toContain(
      "exploratory: at least one complete charter is required",
    );
  });

  it.each([
    ["blocked-zero-pass.json", "results: zero scenarios passed"],
    [
      "blocked-required-skip.json",
      "scenario deployment.preview-identity/preview: required result status is skipped",
    ],
    [
      "blocked-candidate-mismatch.json",
      "candidate: preview identity does not match develop commit",
    ],
    [
      "blocked-missing-cleanup.json",
      "fixture fixture-missing-cleanup-studio: cleanup status is present",
    ],
    [
      "blocked-incomplete-charter.json",
      "exploratoryCharters[0].maneuvers: expected exactly maneuvers 1 through 8",
    ],
  ])("blocks tracked fixture %s with its stable reason", (name, reason) => {
    const fixtureCatalog = JSON.parse(
      readFileSync("quality/release-required.json", "utf8"),
    ) as unknown;
    const fixtureRun = JSON.parse(
      readFileSync(`quality/fixtures/${name}`, "utf8"),
    ) as unknown;

    expect(
      analyzeReleaseRun(fixtureCatalog, fixtureRun, {
        stage: "final",
        now: NOW,
      }),
    ).toMatchObject({
      decision: "blocked",
      blockingReasons: expect.arrayContaining([reason]),
    });
  });

  it("passes complete evidence", () => {
    expect(analyzeReleaseRun(catalog(), passingRun(), NOW)).toMatchObject({
      decision: "pass",
      counts: { passed: 3, failed: 0, skipped: 0, missing: 0 },
      blockingReasons: [],
    });
  });

  it("passes pre-merge without production-only evidence or production identity", () => {
    const inputCatalog = catalog();
    inputCatalog.scenarios.push({
      id: "deployment.production-identity",
      owner: "release-operator",
      runner: "playwright",
      selector: "@release-required deployment.production-identity",
      environments: ["production"],
      safetyClass: "read-only",
      required: true,
      expectedOracles: ["http", "deployment-identity"],
      evidenceRetentionDays: 90,
    });
    const run = passingRun();
    run.obligations.push({
      scenarioId: "deployment.production-identity",
      environment: "production",
      required: true,
      status: "pending",
    });
    delete run.candidate.mainCommit;
    delete run.candidate.mainTreeDigest;
    delete run.candidate.productionUrl;
    delete run.candidate.productionIdentity;

    expect(
      analyzeReleaseRun(inputCatalog, run, { stage: "pre-merge", now: NOW }),
    ).toMatchObject({
      decision: "pass",
      counts: { passed: 3, failed: 0, skipped: 0, missing: 0 },
      blockingReasons: [],
    });
  });

  it("permits the same scenario ID across environments and requires production at final", () => {
    const inputCatalog = catalog();
    inputCatalog.scenarios[0]!.environments = ["preview", "production"];
    const run = passingRun();
    run.obligations.push({
      scenarioId: "deployment.preview-identity",
      environment: "production",
      required: true,
      status: "pending",
    });

    expect(
      analyzeReleaseRun(inputCatalog, run, {
        stage: "pre-merge",
        now: NOW,
      }).decision,
    ).toBe("pass");
    expect(
      analyzeReleaseRun(inputCatalog, run, {
        stage: "final",
        now: NOW,
      }).blockingReasons,
    ).toContain(
      "scenario deployment.preview-identity/production: required result is missing",
    );

    run.results.push({
      ...run.results[0]!,
      environment: "production",
    });
    expect(
      analyzeReleaseRun(inputCatalog, run, {
        stage: "final",
        now: NOW,
      }).decision,
    ).toBe("pass");
  });

  it("blocks final analysis when production identity fields are missing", () => {
    const run = passingRun();
    delete run.candidate.mainCommit;
    delete run.candidate.mainTreeDigest;
    delete run.candidate.productionUrl;
    delete run.candidate.productionIdentity;

    expect(
      analyzeReleaseRun(catalog(), run, { stage: "final", now: NOW })
        .blockingReasons,
    ).toEqual(
      expect.arrayContaining([
        "candidate: main commit is missing",
        "candidate: main tree digest is missing",
        "candidate: production URL is missing",
        "candidate: production identity is missing",
      ]),
    );
  });

  it("blocks malformed or unsupported schemas", () => {
    const run = passingRun() as unknown as Record<string, unknown>;
    run.schemaVersion = 2;
    expect(reasons(run)).toContain("releaseRun.schemaVersion: expected 1");
  });

  it("rejects unsupported top-level release-run fields", () => {
    const run = passingRun() as unknown as Record<string, unknown>;
    run.unexpected = true;

    expect(parseReleaseRun(run)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([
        "releaseRun.unexpected: unsupported field",
      ]),
    });
  });

  it("enforces nested release-run schema fields and the run ID pattern", () => {
    const run = passingRun() as unknown as Record<string, unknown>;
    run.runId = "invalid/run";
    const candidate = run.candidate as Record<string, unknown>;
    candidate.unexpected = true;
    const obligations = run.obligations as Record<string, unknown>[];
    obligations[0]!.unexpected = true;
    run.manualObligations = [
      {
        id: "rollback.readiness",
        executor: "release-operator",
        executedAt: "2026-07-26T10:03:00.000Z",
        environment: "preview",
        candidate: DEVELOP,
        result: "Rollback readiness reviewed",
        status: "passed",
        evidence: ["artifacts/rollback-review.md"],
      },
    ];
    const manualObligations =
      run.manualObligations as unknown as Record<string, unknown>[];
    manualObligations[0]!.unexpected = true;
    const tagAuthorization = run.tagAuthorization as Record<string, unknown>;
    tagAuthorization.unexpected = true;

    expect(parseReleaseRun(run)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([
        "releaseRun.runId: expected a stable path-safe identifier",
        "candidate.unexpected: unsupported field",
        "obligations[0].unexpected: unsupported field",
        "manualObligations[0].unexpected: unsupported field",
        "releaseRun.tagAuthorization.unexpected: unsupported field",
      ]),
    });
  });

  it("rejects a non-ISO generated timestamp", () => {
    const run = passingRun();
    run.generatedAt = "2026-02-30T10:00:00.000Z";

    expect(parseReleaseRun(run)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([
        "releaseRun.generatedAt: expected an ISO date-time",
      ]),
    });
  });

  it("fully validates exception records", () => {
    const nullException = passingRun() as unknown as Record<string, unknown>;
    nullException.exceptions = [null];
    expect(parseReleaseRun(nullException)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([
        "exceptions[0]: expected an object",
      ]),
    });

    const malformed = passingRun() as unknown as {
      exceptions: Record<string, unknown>[];
    };
    malformed.exceptions = [
      {
        id: "exception-1",
        scenarioId: "optional.visual-review",
        reason: "Known visual variance",
        risk: "unknown",
        approvedBy: "release-operator",
        createdAt: "not-a-date",
        expiresAt: "2026-07-27T10:00:00.000Z",
        followUp: "issue-1",
        unexpected: true,
      },
    ];

    expect(parseReleaseRun(malformed)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([
        "exceptions[0].risk: unsupported risk",
        "exceptions[0].createdAt: expected an ISO date-time",
        "exceptions[0].unexpected: unsupported field",
      ]),
    });
  });

  it("blocks a mutable baseline ref", () => {
    const run = passingRun();
    run.baselineTag = "develop";
    const parsed = parseReleaseRun(run);

    expect(parsed.ok).toBe(false);
    expect(parsed.errors).toContain(
      "releaseRun.baselineTag: expected an immutable semantic-version tag or 40-character commit",
    );
  });

  it("strictly validates tag authorization fields", () => {
    const pending = passingRun();
    pending.tagAuthorization = {
      status: "pending",
      authorizedBy: "release-operator",
    };
    expect(parseReleaseRun(pending).ok).toBe(false);

    const authorized = passingRun();
    authorized.tagAuthorization = { status: "authorized" };
    expect(parseReleaseRun(authorized).ok).toBe(false);
  });

  it("blocks a charter missing executorContext at parse time", () => {
    const run = passingRun();
    delete (run.exploratoryCharters[0] as Partial<
      ReleaseRun["exploratoryCharters"][number]
    >).executorContext;

    expect(reasons(run)).toContain(
      "exploratoryCharters[0].executorContext: expected a non-empty string",
    );
  });

  it("blocks a charter missing its timebox at parse time", () => {
    const run = passingRun();
    delete (run.exploratoryCharters[0] as Partial<
      ReleaseRun["exploratoryCharters"][number]
    >).timeboxMinutes;

    expect(reasons(run)).toContain(
      "exploratoryCharters[0].timeboxMinutes: expected a positive integer",
    );
  });

  it("blocks unsupported charter fields at parse time", () => {
    const run = passingRun();
    (run.exploratoryCharters[0] as unknown as Record<string, unknown>).unexpected =
      true;

    expect(reasons(run)).toContain(
      "exploratoryCharters[0].unexpected: unsupported field",
    );
  });

  it("blocks a non-passing charter decision", () => {
    const run = passingRun();
    run.exploratoryCharters[0]!.decision = "blocked";

    expect(reasons(run)).toContain(
      "charter charter-1: decision is blocked",
    );
  });

  it.each([
    ["developCommit", "candidate.developCommit"],
    ["candidateTreeDigest", "candidate.candidateTreeDigest"],
    ["previewIdentity", "candidate.previewIdentity"],
    ["mainCommit", "candidate.mainCommit"],
    ["mainTreeDigest", "candidate.mainTreeDigest"],
    ["productionIdentity", "candidate.productionIdentity"],
  ] as const)("blocks a one-character %s identity", (field, path) => {
    const run = passingRun();
    run.candidate[field] = "a";
    const parsed = parseReleaseRun(run);

    expect(parsed.ok).toBe(false);
    expect(parsed.errors).toContain(
      `${path}: expected a lowercase 40-character Git identity`,
    );
  });

  it.each([
    ["previewUrl", "candidate.previewUrl"],
    ["productionUrl", "candidate.productionUrl"],
  ] as const)("blocks an invalid %s", (field, path) => {
    const run = passingRun();
    run.candidate[field] = "not-a-url";
    const parsed = parseReleaseRun(run);

    expect(parsed.ok).toBe(false);
    expect(parsed.errors).toContain(`${path}: expected a valid HTTP(S) URL`);
  });

  it("blocks zero passes and all-skipped runs", () => {
    const run = passingRun();
    run.results = run.results.map((result) => ({ ...result, status: "skipped" }));
    expect(reasons(run)).toContain("results: zero scenarios passed");
  });

  it("blocks an absent required result", () => {
    const run = passingRun();
    run.results = run.results.filter(
      (result) => result.scenarioId !== "studio.config-persistence",
    );
    expect(reasons(run)).toContain(
      "scenario studio.config-persistence/local-contract: required result is missing",
    );
  });

  it.each(["skipped", "failed"] as const)(
    "blocks a required %s result",
    (status) => {
      const run = passingRun();
      run.results[0]!.status = status;
      expect(reasons(run)).toContain(
        `scenario deployment.preview-identity/preview: required result status is ${status}`,
      );
    },
  );

  it("does not except a required failure", () => {
    const run = passingRun();
    run.results[0]!.status = "failed";
    run.exceptions.push(activeException("deployment.preview-identity"));
    expect(reasons(run)).toContain(
      "scenario deployment.preview-identity/preview: required result status is failed",
    );
  });

  it("blocks an optional failure without an active exception", () => {
    const run = passingRun();
    run.results[2]!.status = "failed";
    expect(reasons(run)).toContain(
      "scenario optional.visual-review/preview: optional failure lacks an active authorized exception",
    );
  });

  it("allows an optional failure with an active authorized exception", () => {
    const run = passingRun();
    run.results[2]!.status = "failed";
    run.exceptions.push(activeException("optional.visual-review"));
    expect(reasons(run)).not.toContain(
      "scenario optional.visual-review/preview: optional failure lacks an active authorized exception",
    );
  });

  it("blocks an expired optional exception", () => {
    const run = passingRun();
    run.results[2]!.status = "failed";
    run.exceptions.push({
      ...activeException("optional.visual-review"),
      expiresAt: "2026-07-26T11:59:59.000Z",
    });
    expect(reasons(run)).toContain(
      "scenario optional.visual-review/preview: optional failure lacks an active authorized exception",
    );
  });

  it.each([
    ["preview identity", (run: ReleaseRun) => {
      run.candidate.previewIdentity = "d".repeat(40);
    }, "candidate: preview identity does not match develop commit"],
    ["candidate tree", (run: ReleaseRun) => {
      run.candidate.mainTreeDigest = "d".repeat(40);
    }, "candidate: main tree digest does not match candidate tree digest"],
    ["production identity", (run: ReleaseRun) => {
      run.candidate.productionIdentity = "d".repeat(40);
    }, "candidate: production identity does not match main commit"],
  ] as const)("blocks %s mismatch", (_name, mutate, expected) => {
    const run = passingRun();
    mutate(run);
    expect(reasons(run)).toContain(expected);
  });

  it("blocks missing expected oracle evidence", () => {
    const run = passingRun();
    delete run.results[0]!.evidence.http;
    expect(reasons(run)).toContain(
      "scenario deployment.preview-identity/preview: missing evidence for oracle http",
    );
  });

  it.each([
    ["cleanup status", (run: ReleaseRun) => {
      run.results[1]!.fixtures[0]!.cleanupStatus = "present";
    }, "fixture release-20260726-001-studio: cleanup status is present"],
    ["residue evidence", (run: ReleaseRun) => {
      run.results[1]!.fixtures[0]!.residueEvidence = "";
    }, "fixture release-20260726-001-studio: zero-residue evidence is missing"],
  ] as const)("blocks incomplete fixture %s", (_name, mutate, expected) => {
    const run = passingRun();
    mutate(run);
    expect(reasons(run)).toContain(expected);
  });

  it("blocks a passed synthetic-local-write result with no cleanup fixture", () => {
    const run = passingRun();
    run.results[1]!.fixtures = [];

    expect(reasons(run)).toContain(
      "scenario studio.config-persistence/local-contract: passed synthetic-local-write result has no cleanup fixture",
    );
  });

  it("blocks duplicate and unknown results", () => {
    const run = passingRun();
    run.results.push({ ...run.results[0]! });
    run.results.push({
      ...run.results[0]!,
      scenarioId: "unknown.scenario",
    });
    expect(reasons(run)).toContain(
      "results: duplicate scenario id/environment deployment.preview-identity/preview",
    );
    expect(reasons(run)).toContain(
      "results: unknown scenario id/environment unknown.scenario/preview",
    );
  });

  it("blocks missing, unknown, and duplicate catalog obligations", () => {
    const run = passingRun();
    run.obligations = run.obligations.filter(
      (obligation) =>
        obligation.scenarioId !== "studio.config-persistence",
    );
    run.obligations.push(
      {
        scenarioId: "deployment.preview-identity",
        environment: "preview",
        required: true,
        status: "pending",
      },
      {
        scenarioId: "unknown.scenario",
        environment: "preview",
        required: true,
        status: "pending",
      },
    );

    const blockingReasons = reasons(run);
    expect(blockingReasons).toContain(
      "obligations: required catalog obligation studio.config-persistence/local-contract is missing",
    );
    expect(blockingReasons).toContain(
      "obligations: duplicate scenario id/environment deployment.preview-identity/preview",
    );
    expect(blockingReasons).toContain(
      "obligations: unknown scenario id/environment unknown.scenario/preview",
    );
  });

  it("does not block release.manual-arcs (non-required) from going entirely unattempted", () => {
    // #1190 — oauth.github-real and profile.authenticated-badge are the only
    // remaining manual arcs, and release.manual-arcs itself is now
    // required:false, since auth.github-login-redirect and
    // auth.protected-write-denied already exercise the auth surface
    // automatically on every preview. Clearing manualObligations entirely
    // must NOT block — a required-only enforcement gap here would silently
    // re-impose the human round trip this catalog change removes.
    const fixtureCatalog = JSON.parse(
      readFileSync("quality/release-required.json", "utf8"),
    ) as unknown;
    const fixtureRun = JSON.parse(
      readFileSync("quality/fixtures/passing-release-run.json", "utf8"),
    ) as ReleaseRun;
    fixtureRun.manualObligations = [];

    expect(reasons(fixtureRun, fixtureCatalog)).not.toContain(
      "manual obligations: required id oauth.github-real is missing",
    );
  });

  it("still blocks duplicate and unknown manual arcs, but not a mismatched non-required one", () => {
    const fixtureCatalog = JSON.parse(
      readFileSync("quality/release-required.json", "utf8"),
    ) as unknown;
    const fixtureRun = JSON.parse(
      readFileSync("quality/fixtures/passing-release-run.json", "utf8"),
    ) as ReleaseRun;
    fixtureRun.manualObligations.push(
      { ...fixtureRun.manualObligations[0]! },
      {
        ...fixtureRun.manualObligations[0]!,
        id: "unknown.manual-arc",
      },
    );
    fixtureRun.manualObligations.find(
      (obligation) => obligation.id === "profile.authenticated-badge",
    )!.candidate = "d".repeat(40);

    const blockingReasons = reasons(fixtureRun, fixtureCatalog);
    // Hygiene checks (malformed input) still apply regardless of requiredness.
    expect(blockingReasons).toContain(
      "manual obligations: duplicate id oauth.github-real",
    );
    expect(blockingReasons).toContain(
      "manual obligations: unknown id unknown.manual-arc",
    );
    // Evidence-quality enforcement is gated on requiredness — a mismatched
    // candidate on a non-required bundle must not block.
    expect(blockingReasons).not.toContain(
      "manual obligations: profile.authenticated-badge lacks passed candidate-bound evidence",
    );
  });

  it("still blocks a REQUIRED manual-arc bundle missing its obligation (genuinely required must still block)", () => {
    const requiredManualCatalog: RequiredCatalog = {
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
        {
          id: "release.manual-arcs",
          owner: "release-operator",
          runner: "manual",
          selector: "docs/runbooks/release-checklist.md",
          environments: ["preview"],
          safetyClass: "authorized-preview-interaction",
          required: true,
          expectedOracles: ["ui", "http"],
          evidenceRetentionDays: 90,
          manualObligationIds: ["oauth.github-real"],
        },
      ],
    };
    const baseRun: ReleaseRun = {
      schemaVersion: 1,
      runId: "release-required-manual-arcs",
      generatedAt: "2026-07-26T10:00:00.000Z",
      baselineTag: "v2.19.0",
      candidate: {
        developCommit: DEVELOP,
        candidateTreeDigest: TREE,
        previewUrl: "https://candidate.example.test/",
        previewIdentity: DEVELOP,
      },
      obligations: requiredManualCatalog.scenarios.flatMap((item) =>
        item.environments.map((environment) => ({
          scenarioId: item.id,
          required: item.required,
          environment,
          status: "pending" as const,
        })),
      ),
      results: [
        {
          scenarioId: "deployment.preview-identity",
          environment: "preview",
          status: "passed",
          startedAt: "2026-07-26T10:01:00.000Z",
          finishedAt: "2026-07-26T10:02:00.000Z",
          runner: "playwright",
          evidence: {
            http: ["artifacts/version-response.json"],
            "deployment-identity": ["artifacts/preview-sha.txt"],
          },
          fixtures: [],
        },
      ],
      exceptions: [],
      manualObligations: [],
      exploratoryCharters: [completeCharter()],
      rollbackReference: "docs/runbooks/rollback.md",
      tagAuthorization: { status: "pending" },
    };

    expect(
      analyzeReleaseRun(requiredManualCatalog, baseRun, {
        stage: "pre-merge",
        now: NOW,
      }).blockingReasons,
    ).toContain("manual obligations: required id oauth.github-real is missing");

    // Demoting the same bundle to non-required lets it go unattempted —
    // proving the gate above is genuinely conditioned on `required`, not a
    // coincidence of this particular fixture.
    const optionalManualCatalog: RequiredCatalog = {
      ...requiredManualCatalog,
      scenarios: requiredManualCatalog.scenarios.map((scenario) =>
        scenario.id === "release.manual-arcs"
          ? { ...scenario, required: false }
          : scenario,
      ),
    };
    const optionalRun: ReleaseRun = {
      ...baseRun,
      obligations: baseRun.obligations.map((obligation) =>
        obligation.scenarioId === "release.manual-arcs"
          ? { ...obligation, required: false }
          : obligation,
      ),
    };
    expect(
      analyzeReleaseRun(optionalManualCatalog, optionalRun, {
        stage: "pre-merge",
        now: NOW,
      }).blockingReasons,
    ).not.toContain(
      "manual obligations: required id oauth.github-real is missing",
    );
  });

  it.each([
    ["missing maneuver", (charter: ReleaseRun["exploratoryCharters"][number]) => {
      charter.maneuvers.pop();
    }, "exploratoryCharters[1].maneuvers: expected exactly maneuvers 1 through 8"],
    ["failed maneuver", (charter: ReleaseRun["exploratoryCharters"][number]) => {
      charter.maneuvers[0]!.status = "failed";
    }, "charter charter-1: maneuver 1 failed"],
    ["N/A without reason", (charter: ReleaseRun["exploratoryCharters"][number]) => {
      charter.maneuvers[0]!.status = "not-applicable";
      delete charter.maneuvers[0]!.reason;
    }, "charter charter-1: maneuver 1 is not-applicable without a reason"],
    ["skipped high-risk area", (charter: ReleaseRun["exploratoryCharters"][number]) => {
      charter.skippedHighRiskAreas.push("authorization");
    }, "charter charter-1: skipped high-risk areas remain"],
  ] as const)("blocks charter with %s", (_name, mutate, expected) => {
    const run = passingRun();
    const charter = completeCharter();
    mutate(charter);
    run.exploratoryCharters.push(charter);
    expect(reasons(run)).toContain(expected);
  });
});

function activeException(scenarioId: string) {
  return {
    id: `exception-${scenarioId}`,
    scenarioId,
    reason: "Known low-risk visual variance",
    risk: "low" as const,
    approvedBy: "release-operator",
    createdAt: "2026-07-26T10:00:00.000Z",
    expiresAt: "2026-07-27T10:00:00.000Z",
    followUp: "https://github.com/juan294/chapa/issues/9999",
  };
}

function completeCharter(): ReleaseRun["exploratoryCharters"][number] {
  return {
    id: "charter-1",
    candidate: DEVELOP,
    executorContext: "fresh-context-1",
    timeboxMinutes: 30,
    riskHypothesis: "Repeated interaction could produce inconsistent state",
    changedCapability: "studio configuration persistence",
    actors: ["profile owner"],
    surfaces: ["Studio"],
    states: ["saved configuration"],
    externalSeams: ["Supabase"],
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
  };
}
