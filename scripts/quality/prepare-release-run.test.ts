import { describe, expect, it } from "vitest";
import { prepareReleaseRun, validatePrepareOptions } from "./prepare-release-run";
import type { RequiredCatalog } from "./contracts";

const SHA = "a".repeat(40);
const TREE = "b".repeat(40);
const catalog: RequiredCatalog = {
  schemaVersion: 1,
  scenarios: [
    {
      id: "deployment.preview-identity",
      owner: "release-operator",
      runner: "playwright",
      selector: "@release-required deployment.preview-identity",
      environments: ["preview", "production"],
      safetyClass: "read-only",
      required: true,
      expectedOracles: ["http", "deployment-identity"],
      evidenceRetentionDays: 90,
    },
  ],
};

function options(overrides: Record<string, unknown> = {}) {
  return {
    baselineTag: "v2.19.0",
    developCommit: SHA,
    candidateTree: TREE,
    previewUrl: "https://candidate.example.test",
    runId: "release-20260726-001",
    output: "quality/evidence/runs/release-20260726-001/release-run.json",
    ...overrides,
  };
}

describe("validatePrepareOptions", () => {
  it.each([
    ["mutable baseline", { baselineTag: "develop" }],
    ["short commit", { developCommit: "abc123" }],
    ["short tree", { candidateTree: "abc123" }],
    ["non-HTTPS preview", { previewUrl: "http://candidate.example.test" }],
    ["outside output", { output: "tmp/release-run.json" }],
    ["traversal output", {
      output: "quality/evidence/runs/../../release-run.json",
    }],
  ])("rejects %s", (_name, override) => {
    expect(validatePrepareOptions(options(override))).not.toEqual([]);
  });

  it("allows an HTTP localhost preview fixture", () => {
    expect(
      validatePrepareOptions(options({ previewUrl: "http://localhost:3001" })),
    ).toEqual([]);
  });
});

describe("prepareReleaseRun", () => {
  it("copies the catalog into pending obligations and records identity", () => {
    const run = prepareReleaseRun(catalog, options(), "2026-07-26T12:00:00.000Z");

    expect(run.candidate).toEqual({
      developCommit: SHA,
      candidateTreeDigest: TREE,
      previewUrl: "https://candidate.example.test/",
    });
    expect(run.obligations).toEqual([
      {
        scenarioId: "deployment.preview-identity",
        required: true,
        environment: "preview",
        status: "pending",
      },
      {
        scenarioId: "deployment.preview-identity",
        required: true,
        environment: "production",
        status: "pending",
      },
    ]);
    expect(run.results).toEqual([]);
    expect(run.manualObligations).toEqual([]);
    expect(run.tagAuthorization).toEqual({ status: "pending" });
  });
});
