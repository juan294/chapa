import { describe, expect, it } from "vitest";
import { collectPlaywrightEvidence } from "./collect-playwright-evidence";
import {
  parseEvidenceFragment,
  type ReleaseEnvironment,
  type RequiredCatalog,
} from "./contracts";

const catalog: RequiredCatalog = {
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
      id: "deployment.production-identity",
      owner: "release-operator",
      runner: "playwright",
      selector: "@release-required deployment.production-identity",
      environments: ["production"],
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
      id: "health.core-dependencies",
      owner: "platform",
      runner: "playwright",
      selector: "@release-required health.core-dependencies",
      environments: ["production"],
      safetyClass: "read-only",
      required: true,
      expectedOracles: ["http"],
      evidenceRetentionDays: 90,
    },
  ],
};

function report(
  title: string,
  status: "passed" | "failed" | "skipped" | "timedOut" = "passed",
) {
  return {
    suites: [
      {
        title: "release-required",
        specs: [
          {
            title,
            tests: [
              {
                projectName: "chromium",
                results: [
                  {
                    status,
                    retry: 0,
                    duration: 25,
                    attachments: [{ name: "trace", path: "trace.zip" }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

describe("collectPlaywrightEvidence", () => {
  it("maps a selected stable scenario without changing requiredness", () => {
    const fragment = collectPlaywrightEvidence(
      report("@release-required deployment.preview-identity"),
      catalog,
      "preview",
      "playwright.json",
    );
    expect(fragment.results).toEqual([
      expect.objectContaining({
        scenarioId: "deployment.preview-identity",
        status: "passed",
        runner: "playwright",
        fixtures: [],
      }),
    ]);
    expect(fragment.results[0].evidence.http).toContain("playwright.json");
    expect(fragment.results[0].evidence["deployment-identity"]).toContain("trace.zip");
    expect(parseEvidenceFragment(fragment).ok).toBe(true);
  });

  it("rejects invalid environment, identity, and catalog inputs", () => {
    expect(() =>
      collectPlaywrightEvidence(
        report("@release-required deployment.preview-identity"),
        catalog,
        "banana" as ReleaseEnvironment,
        "playwright.json",
      ),
    ).toThrow("unsupported environment");

    expect(() =>
      collectPlaywrightEvidence(
        report("@release-required deployment.preview-identity"),
        catalog,
        "preview",
        "playwright.json",
        "test-run",
        "bad",
      ),
    ).toThrow("candidate identity");

    expect(() =>
      collectPlaywrightEvidence(
        report("@release-required deployment.preview-identity"),
        {
          ...catalog,
          scenarios: [
            {
              ...catalog.scenarios[0]!,
              expectedOracles: ["http", "http"],
            },
          ],
        } as unknown as RequiredCatalog,
        "preview",
        "playwright.json",
      ),
    ).toThrow("duplicate oracle");
  });

  it("preserves skipped and failed results as non-passes", () => {
    expect(
      collectPlaywrightEvidence(
        report("@release-required deployment.preview-identity", "skipped"),
        catalog,
        "preview",
        "playwright.json",
      ).results[0].status,
    ).toBe("skipped");
    expect(
      collectPlaywrightEvidence(
        report("@release-required deployment.preview-identity", "timedOut"),
        catalog,
        "preview",
        "playwright.json",
      ).results[0].status,
    ).toBe("failed");
  });

  it("rejects missing, duplicate, and unknown selected IDs", () => {
    expect(() =>
      collectPlaywrightEvidence({ suites: [] }, catalog, "preview", "playwright.json"),
    ).toThrow("missing selected Playwright scenario deployment.preview-identity");

    const duplicate = report("@release-required deployment.preview-identity");
    duplicate.suites[0].specs.push(
      report("@release-required deployment.preview-identity").suites[0].specs[0],
    );
    expect(() =>
      collectPlaywrightEvidence(duplicate, catalog, "preview", "playwright.json"),
    ).toThrow("duplicate Playwright scenario deployment.preview-identity");

    expect(() =>
      collectPlaywrightEvidence(
        report("@release-required unknown.scenario"),
        catalog,
        "preview",
        "playwright.json",
      ),
    ).toThrow("unknown Playwright scenario unknown.scenario");
  });

  it("normalizes attached journey sidecars into local scenario evidence", () => {
    const sidecarResult = {
      scenarioId: "studio.config-persistence",
      environment: "local-contract",
      status: "passed" as const,
      startedAt: "2026-07-26T10:00:00.000Z",
      finishedAt: "2026-07-26T10:01:00.000Z",
      runner: "playwright" as const,
      evidence: {
        ui: ["journey.png"],
        http: ["release-evidence.json"],
        datastore: ["release-evidence.json"],
        cleanup: ["release-evidence.json#cleanup"],
      },
      fixtures: [
        {
          id: "chapa-e2e-test-run-studio",
          cleanupStatus: "removed" as const,
          residueEvidence: "release-evidence.json#cleanup",
        },
      ],
    };
    const journeyReport = {
      suites: [
        {
          specs: [
            {
              title: "full impact journey",
              tests: [
                {
                  results: [
                    {
                      status: "passed",
                      attachments: [
                        { name: "release-evidence", path: "sidecar.json" },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const fragment = collectPlaywrightEvidence(
      journeyReport,
      catalog,
      "local-contract",
      "playwright.json",
      "test-run",
      "a".repeat(40),
      () => ({ results: [sidecarResult] }),
    );

    expect(fragment.results).toEqual([sidecarResult]);
  });

  it("supports an explicit production-safe scenario selection", () => {
    const productionReport = report(
      "@release-required deployment.production-identity",
    );
    productionReport.suites[0].specs.push(
      report("@release-required health.core-dependencies").suites[0].specs[0],
    );

    const fragment = collectPlaywrightEvidence(
      productionReport,
      catalog,
      "production",
      "playwright.json",
      "test-run",
      "b".repeat(40),
      () => undefined,
      ["deployment.production-identity", "health.core-dependencies"],
    );

    expect(fragment.results.map((result) => result.scenarioId)).toEqual([
      "deployment.production-identity",
      "health.core-dependencies",
    ]);
  });

  it("rejects duplicate stable IDs inside one attached sidecar", () => {
    const sidecarResult = {
      scenarioId: "studio.config-persistence",
      environment: "local-contract",
      status: "passed" as const,
      startedAt: "2026-07-26T10:00:00.000Z",
      finishedAt: "2026-07-26T10:01:00.000Z",
      runner: "playwright" as const,
      evidence: { ui: ["journey.png"] },
      fixtures: [],
    };
    const journeyReport = {
      suites: [
        {
          specs: [
            {
              title: "journey",
              tests: [
                {
                  results: [
                    {
                      attachments: [
                        { name: "release-evidence", path: "sidecar.json" },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(() =>
      collectPlaywrightEvidence(
        journeyReport,
        catalog,
        "local-contract",
        "playwright.json",
        "test-run",
        "a".repeat(40),
        () => ({ results: [sidecarResult, sidecarResult] }),
      ),
    ).toThrow(
      "duplicate Playwright sidecar scenario studio.config-persistence",
    );
  });

  it("conservatively fails mixed passed and skipped sidecars", () => {
    const base = {
      scenarioId: "studio.config-persistence",
      environment: "local-contract",
      status: "passed" as const,
      startedAt: "2026-07-26T10:00:00.000Z",
      finishedAt: "2026-07-26T10:01:00.000Z",
      runner: "playwright" as const,
      evidence: { ui: ["passed.png"] },
      fixtures: [],
    };
    const journeyReport = {
      suites: [{
        specs: [{
          title: "journey",
          tests: [{
            results: [{
              attachments: [
                { name: "release-evidence", path: "passed.json" },
                { name: "release-evidence", path: "skipped.json" },
              ],
            }],
          }],
        }],
      }],
    };
    const fragment = collectPlaywrightEvidence(
      journeyReport,
      catalog,
      "local-contract",
      "playwright.json",
      "test-run",
      "a".repeat(40),
      (path) => ({
        results: [
          path === "passed.json"
            ? base
            : {
                ...base,
                status: "skipped",
                evidence: { ui: ["skipped.png"] },
              },
        ],
      }),
    );

    expect(fragment.results[0]).toMatchObject({
      status: "failed",
      evidence: { ui: ["passed.png", "skipped.png"] },
    });
  });
});
