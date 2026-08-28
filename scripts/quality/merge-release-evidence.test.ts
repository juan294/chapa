import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type {
  EvidenceFragment,
  ExploratoryCharter,
  ReleaseRun,
  ScenarioResult,
} from "./contracts";
import {
  analyzeReleaseRun,
  parseRequiredCatalog,
} from "./contracts";
import { mergeReleaseEvidence } from "./merge-release-evidence";
import { prepareReleaseRun } from "./prepare-release-run";

const developCommit = "a".repeat(40);
const mainCommit = "b".repeat(40);
const treeDigest = "c".repeat(40);
const now = "2026-07-26T10:00:00.000Z";
const catalogRaw = JSON.parse(
  readFileSync("quality/release-required.json", "utf8"),
) as unknown;
const parsedRequiredCatalog = parseRequiredCatalog(catalogRaw);
if (!parsedRequiredCatalog.ok) {
  throw new Error(parsedRequiredCatalog.errors.join("\n"));
}
const requiredCatalog = parsedRequiredCatalog.value;

function result(
  scenarioId: string,
  evidence: Record<string, string[]> = { http: ["evidence.json"] },
  environment: ScenarioResult["environment"] = "preview",
): ScenarioResult {
  return {
    scenarioId,
    environment,
    status: "passed",
    startedAt: now,
    finishedAt: now,
    runner: "test",
    evidence,
    fixtures: [],
  };
}

function fragment(
  environment: EvidenceFragment["environment"],
  candidateIdentity: string,
  results: ScenarioResult[],
): EvidenceFragment {
  return {
    schemaVersion: 1,
    runId: "source-run",
    environment,
    candidateIdentity,
    results,
  };
}

const charter: ExploratoryCharter = {
  id: "changed-profile-flow",
  candidate: developCommit,
  executorContext: "fresh preview browser session",
  timeboxMinutes: 30,
  riskHypothesis: "A recovery path can retain stale profile state.",
  changedCapability: "profile recovery",
  actors: ["profile owner"],
  surfaces: ["profile editor"],
  states: ["recovering"],
  externalSeams: [],
  environment: "preview",
  allowedOperations: ["read-only"],
  safetyClass: "read-only",
  candidateRecord:
    "quality/evidence/runs/release-2026-07-26/candidate.json",
  maneuvers: Array.from({ length: 8 }, (_, index) => ({
    number: index + 1,
    status: "passed" as const,
    evidence: `charter.json#maneuver-${index + 1}`,
  })),
  findings: [],
  skippedHighRiskAreas: [],
  fixtures: [],
  decision: "pass",
};

function run(): ReleaseRun {
  const scenarioIds = [
    "operations.vercel-cron-registration",
    "database.pending-migrations",
    "studio.config-persistence",
    "profile.snapshot-integrity",
    "deployment.preview-identity",
    "release.manual-arcs",
    "deployment.production-identity",
  ];
  return {
    schemaVersion: 1,
    runId: "release-2026-07-26",
    generatedAt: now,
    baselineTag: "v1.0.0",
    candidate: {
      developCommit,
      candidateTreeDigest: treeDigest,
      previewUrl: "https://chapa-preview.vercel.app/",
    },
    obligations: scenarioIds.map((scenarioId) => ({
      scenarioId,
      required: true,
      environment:
        scenarioId === "deployment.production-identity"
          ? "production"
          : scenarioId.includes("studio") || scenarioId.includes("snapshot")
            ? "local-contract"
            : scenarioId.includes("database") || scenarioId.includes("operations")
              ? "ci-build"
              : "preview",
      status: "pending",
    })),
    results: [],
    exceptions: [],
    manualObligations: [],
    exploratoryCharters: [],
    rollbackReference: "release:v1.0.0",
    tagAuthorization: { status: "pending" },
  };
}

describe("mergeReleaseEvidence", () => {
  it("produces pre-merge and final runs that pass the real catalog analyzer", () => {
    const prepared = prepareReleaseRun(
      requiredCatalog,
      {
        baselineTag: "v1.0.0",
        developCommit,
        candidateTree: treeDigest,
        previewUrl: "https://chapa-preview.vercel.app/",
        runId: "release-2026-07-26",
        output:
          "quality/evidence/runs/release-2026-07-26/release-run.json",
      },
      now,
    );
    const automated = requiredCatalog.scenarios
      .flatMap((scenario) =>
        scenario.environments
          .filter((environment) => environment !== "production")
          .map((environment) => {
            const evidence = Object.fromEntries(
              scenario.expectedOracles.map((oracle) => [
                oracle,
                [`${scenario.id}-${environment}.json`],
              ]),
            );
            const scenarioResult = result(
              scenario.id,
              evidence,
              environment,
            );
            if (scenario.safetyClass === "synthetic-local-write") {
              scenarioResult.fixtures = [
                {
                  id: `release-2026-07-26-${scenario.id}`,
                  cleanupStatus: "removed",
                  residueEvidence: `${scenario.id}.json#cleanup`,
                },
              ];
            }
            return scenarioResult;
          }),
      )
      .filter((item) => item.scenarioId !== "release.manual-arcs");
    const manualIds =
      requiredCatalog.scenarios.find(
        (scenario) => scenario.id === "release.manual-arcs",
      )?.manualObligationIds ?? [];
    const merged = mergeReleaseEvidence({
      stage: "pre-merge",
      run: prepared,
      catalog: requiredCatalog,
      fragments: (["ci-build", "local-contract", "preview"] as const).map(
        (environment) => ({
          path: `${environment}-fragment.json`,
          value: fragment(
            environment,
            developCommit,
            automated.filter((item) => item.environment === environment),
          ),
        }),
      ),
      preMergeEvidence: {
        exploratoryCharters: [charter],
        manualObligations: manualIds.map((id) => ({
          id,
          executor: "release operator",
          executedAt: now,
          environment: "preview",
          candidate: developCommit,
          result: `${id} passed`,
          status: "passed",
          evidence: [`manual-arcs.json#${id}`],
        })),
        manualResult: result("release.manual-arcs", {
          ui: ["manual-arcs.json"],
          http: ["manual-arcs.json"],
        }),
      },
      identityEvidence: {
        decision: "pass",
        preview: { commitSha: developCommit },
      },
    });

    expect(
      analyzeReleaseRun(catalogRaw, merged.run, {
        stage: "pre-merge",
        now: new Date(now),
      }),
    ).toEqual(
      expect.objectContaining({
        decision: "pass",
        blockingReasons: [],
      }),
    );

    const finalInput = structuredClone(merged.run);
    finalInput.candidate.productionUrl = "https://chapa.dev/";
    const productionResults = requiredCatalog.scenarios.flatMap(
      (scenario) =>
        scenario.environments
          .filter((environment) => environment === "production")
          .map((environment) =>
            result(
              scenario.id,
              Object.fromEntries(
                scenario.expectedOracles.map((oracle) => [
                  oracle,
                  [`${scenario.id}-production.json`],
                ]),
              ),
              environment,
            ),
          ),
    );
    const final = mergeReleaseEvidence({
      stage: "final",
      run: finalInput,
      catalog: requiredCatalog,
      fragments: [
        {
          path: "production-fragment.json",
          value: fragment("production", mainCommit, productionResults),
        },
      ],
      identityEvidence: {
        decision: "pass",
        mainCommit,
        mainTreeDigest: treeDigest,
        production: { commitSha: mainCommit, environment: "production" },
      },
      rollbackReference: "release:v1.0.0#evidence",
    });
    expect(
      analyzeReleaseRun(catalogRaw, final.run, {
        stage: "final",
        now: new Date(now),
      }),
    ).toEqual(
      expect.objectContaining({
        decision: "pass",
        blockingReasons: [],
      }),
    );
    expect(final.manifest.manualObligations).toEqual(
      merged.manifest.manualObligations,
    );
    expect(final.manifest.exploratoryCharters).toEqual(
      merged.manifest.exploratoryCharters,
    );
  });

  it("assembles pre-merge evidence and normalizes journey fixtures to the release run", () => {
    const merged = mergeReleaseEvidence({
      stage: "pre-merge",
      run: run(),
      catalog: requiredCatalog,
      fragments: [
        {
          path: "lint-and-vercel-config.json",
          value: fragment("ci-build", developCommit, [
            result("operations.vercel-cron-registration", {
              configuration: ["ci.json"],
            }, "ci-build"),
          ]),
        },
        {
          path: "pending-production-migrations.json",
          value: fragment("ci-build", developCommit, [
            result(
              "database.pending-migrations",
              { datastore: ["migration.json"] },
              "ci-build",
            ),
          ]),
        },
        {
          path: "contract-and-local-journey.json",
          value: fragment("local-contract", developCommit, [
            result("studio.config-persistence", {
              http: ["contract.json"],
              datastore: ["contract.json"],
              cleanup: ["contract.json"],
            }, "local-contract"),
            result("profile.snapshot-integrity", {
              http: ["contract.json"],
              datastore: ["contract.json"],
              cleanup: ["contract.json"],
            }, "local-contract"),
          ]),
        },
        {
          path: "preview-fragment.json",
          value: fragment("preview", developCommit, [
            result("deployment.preview-identity", {
              http: ["preview.json"],
              "deployment-identity": ["identity.json"],
            }),
          ]),
        },
      ],
      journeySidecars: [
        {
          path: "raw/chromium/release-evidence.json",
          value: {
            runId: "ci-123-1",
            cleanup: { status: "removed", remainingCount: 0 },
            results: [
              {
                ...result("studio.config-persistence", {
                  ui: ["playwright:journey"],
                  http: ["release-evidence.json"],
                  datastore: ["release-evidence.json"],
                  cleanup: ["release-evidence.json#cleanup"],
                }, "local-contract"),
                runner: "playwright",
                fixtures: [
                  {
                    id: "ci-123-1-chromium-studio",
                    cleanupStatus: "removed",
                    residueEvidence: "release-evidence.json#cleanup",
                  },
                ],
              },
              {
                ...result("profile.snapshot-integrity", {
                  http: ["release-evidence.json"],
                  datastore: ["release-evidence.json"],
                  cleanup: ["release-evidence.json#cleanup"],
                }, "local-contract"),
                runner: "playwright",
                fixtures: [
                  {
                    id: "ci-123-1-chromium-snapshot",
                    cleanupStatus: "removed",
                    residueEvidence: "release-evidence.json#cleanup",
                  },
                ],
              },
            ],
          },
        },
      ],
      preMergeEvidence: {
        exploratoryCharters: [charter],
        manualObligations: [
          {
            id: "release-checklist",
            executor: "release operator",
            executedAt: now,
            environment: "preview",
            candidate: developCommit,
            result: "All authorized manual arcs passed.",
            status: "passed",
            evidence: ["manual-arcs.json"],
          },
        ],
        manualResult: result("release.manual-arcs", {
          ui: ["manual-arcs.json"],
          http: ["manual-arcs.json"],
        }),
      },
      identityEvidence: {
        decision: "pass",
        blockingReasons: [],
        preview: { commitSha: developCommit },
      },
    });

    expect(merged.manifest.stage).toBe("pre-merge");
    expect(merged.run.exploratoryCharters).toEqual([charter]);
    expect(merged.run.results.map((item) => item.scenarioId)).toContain(
      "database.pending-migrations",
    );
    const studio = merged.run.results.find(
      (item) => item.scenarioId === "studio.config-persistence",
    )!;
    expect(studio.evidence.ui).toContain("playwright:journey");
    expect(studio.fixtures[0]).toEqual(
      expect.objectContaining({
        id: "release-2026-07-26-ci-123-1-chromium-studio",
        cleanupStatus: "removed",
      }),
    );
    expect(studio.fixtures[0].residueEvidence).toContain(
      "raw/chromium/release-evidence.json#cleanup",
    );
  });

  it("rejects an exact fragment from another candidate and duplicate scenarios", () => {
    const base = {
      stage: "pre-merge" as const,
      run: run(),
      catalog: requiredCatalog,
      journeySidecars: [],
      preMergeEvidence: {
        exploratoryCharters: [charter],
        manualObligations: [],
        manualResult: result("release.manual-arcs"),
      },
      identityEvidence: {
        decision: "pass",
        preview: { commitSha: developCommit },
      },
    };
    expect(() =>
      mergeReleaseEvidence({
        ...base,
        fragments: [
          {
            path: "wrong.json",
            value: fragment("preview", "d".repeat(40), [
              result("deployment.preview-identity"),
            ]),
          },
        ],
      }),
    ).toThrow("fragment candidate");
    expect(() =>
      mergeReleaseEvidence({
        ...base,
        fragments: [
          {
            path: "one.json",
            value: fragment("preview", developCommit, [
              result("deployment.preview-identity"),
            ]),
          },
          {
            path: "two.json",
            value: fragment("preview", developCommit, [
              result("deployment.preview-identity"),
            ]),
          },
        ],
      }),
    ).toThrow("duplicate scenario fragment deployment.preview-identity");
  });

  it("does not treat absent journey cleanup proof as removed", () => {
    const merged = mergeReleaseEvidence({
      stage: "pre-merge",
      run: run(),
      catalog: requiredCatalog,
      fragments: [
        {
          path: "contract-and-local-journey.json",
          value: fragment("local-contract", developCommit, [
            result("studio.config-persistence", {
              ui: ["contract.json"],
              http: ["contract.json"],
              datastore: ["contract.json"],
              cleanup: ["contract.json"],
            }, "local-contract"),
          ]),
        },
      ],
      journeySidecars: [
        {
          path: "raw/release-evidence.json",
          value: {
            results: [
              {
                ...result("studio.config-persistence", {
                  ui: ["journey.png"],
                  http: ["sidecar.json"],
                  datastore: ["sidecar.json"],
                  cleanup: ["sidecar.json"],
                }, "local-contract"),
                fixtures: [
                  {
                    id: "ci-studio",
                    cleanupStatus: "removed",
                    residueEvidence: "sidecar.json",
                  },
                ],
              },
            ],
          },
        },
      ],
      preMergeEvidence: {
        exploratoryCharters: [charter],
        manualObligations: [],
        manualResult: result("release.manual-arcs"),
      },
      identityEvidence: {
        decision: "pass",
        preview: { commitSha: developCommit },
      },
    });

    expect(
      merged.run.results.find(
        (item) => item.scenarioId === "studio.config-persistence",
      )?.fixtures[0]?.cleanupStatus,
    ).toBe("present");
  });

  it("assembles final identity and production evidence without losing prior evidence", () => {
    const preMerge = run();
    preMerge.candidate.previewIdentity = developCommit;
    preMerge.candidate.productionUrl = "https://chapa.dev/";
    preMerge.exploratoryCharters = [charter];
    preMerge.results = [
      result("release.manual-arcs", {
        ui: ["manual.json"],
        http: ["manual.json"],
      }),
      result("deployment.preview-identity"),
      result("health.core-dependencies"),
      result("profile.public-badge-read"),
      result("profile.public-share-read", {
        http: ["preview-share.json"],
        ui: ["preview-share.json"],
      }),
    ];
    const merged = mergeReleaseEvidence({
      stage: "final",
      run: preMerge,
      catalog: requiredCatalog,
      fragments: [
        {
          path: "production-fragment.json",
          value: fragment("production", mainCommit, [
            result("deployment.production-identity", {
              http: ["production.json"],
              "deployment-identity": ["identity.json"],
            }, "production"),
            result("health.core-dependencies", {
              http: ["production-health.json"],
            }, "production"),
            result("profile.public-badge-read", {
              http: ["production-badge.json"],
            }, "production"),
            result("profile.public-share-read", {
              http: ["production-share.json"],
              ui: ["production-share.json"],
            }, "production"),
            result("profile.share-verification", {
              http: ["production-share-verification.json"],
              ui: ["production-share-verification.json"],
            }, "production"),
            result("locales.en-es", {
              http: ["production-locales.json"],
            }, "production"),
          ]),
        },
      ],
      identityEvidence: {
        decision: "pass",
        mainCommit,
        mainTreeDigest: treeDigest,
        production: { commitSha: mainCommit, environment: "production" },
      },
      rollbackReference: "release:v1.0.0#evidence",
    });

    expect(merged.manifest).toEqual(
      expect.objectContaining({
        stage: "final",
        rollbackReference: "release:v1.0.0#evidence",
      }),
    );
    expect(merged.run.candidate).toEqual(
      expect.objectContaining({
        mainCommit,
        mainTreeDigest: treeDigest,
        productionIdentity: mainCommit,
      }),
    );
    expect(merged.run.results.map((item) => item.scenarioId)).toEqual(
      expect.arrayContaining([
        "release.manual-arcs",
        "deployment.preview-identity",
        "deployment.production-identity",
      ]),
    );
    expect(merged.run.exploratoryCharters).toEqual([charter]);
    expect(
      merged.run.results
        .filter((item) => item.scenarioId === "profile.public-share-read")
        .map((item) => item.environment),
    ).toEqual(["preview", "production"]);
  });
});
