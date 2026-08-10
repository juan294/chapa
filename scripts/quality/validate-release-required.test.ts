import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseRequiredCatalog } from "./contracts";

function scenario(overrides: Record<string, unknown> = {}) {
  return {
    id: "deployment.preview-identity",
    owner: "release-operator",
    runner: "playwright",
    selector: "@release-required deployment.preview-identity",
    environments: ["preview"],
    safetyClass: "read-only",
    required: true,
    expectedOracles: ["http", "deployment-identity"],
    evidenceRetentionDays: 90,
    ...overrides,
  };
}

describe("parseRequiredCatalog", () => {
  it("accepts a complete catalog", () => {
    const result = parseRequiredCatalog({ schemaVersion: 1, scenarios: [scenario()] });

    expect(result.ok).toBe(true);
  });

  it.each([
    "local-contract",
    "ci-build",
    "preview",
    "production",
  ])("accepts the locked %s environment", (environment) => {
    expect(
      parseRequiredCatalog({
        schemaVersion: 1,
        scenarios: [scenario({ environments: [environment] })],
      }).ok,
    ).toBe(true);
  });

  it.each([
    "read-only",
    "synthetic-local-write",
    "authorized-preview-interaction",
    "production-operation",
    "outward-effect",
  ])("accepts the locked %s safety class", (safetyClass) => {
    expect(
      parseRequiredCatalog({
        schemaVersion: 1,
        scenarios: [scenario({ safetyClass })],
      }).ok,
    ).toBe(true);
  });

  it.each([
    ["unknown schema", { schemaVersion: 2, scenarios: [scenario()] }],
    ["missing owner", { schemaVersion: 1, scenarios: [scenario({ owner: "" })] }],
    ["empty selector", { schemaVersion: 1, scenarios: [scenario({ selector: " " })] }],
    ["unsupported environment", {
      schemaVersion: 1,
      scenarios: [scenario({ environments: ["staging"] })],
    }],
    ["superseded combined environment", {
      schemaVersion: 1,
      scenarios: [scenario({ environments: ["preview-and-production"] })],
    }],
    ["empty environments", {
      schemaVersion: 1,
      scenarios: [scenario({ environments: [] })],
    }],
    ["duplicate environments", {
      schemaVersion: 1,
      scenarios: [scenario({ environments: ["preview", "preview"] })],
    }],
    ["unsupported safety class", {
      schemaVersion: 1,
      scenarios: [scenario({ safetyClass: "live-write" })],
    }],
    ["superseded safety class", {
      schemaVersion: 1,
      scenarios: [scenario({ safetyClass: "synthetic-write" })],
    }],
    ["unsupported oracle", {
      schemaVersion: 1,
      scenarios: [scenario({ expectedOracles: ["static"] })],
    }],
    ["missing oracle", {
      schemaVersion: 1,
      scenarios: [scenario({ expectedOracles: [] })],
    }],
  ])("rejects %s", (_name, raw) => {
    const result = parseRequiredCatalog(raw);

    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("rejects duplicate stable IDs", () => {
    const result = parseRequiredCatalog({
      schemaVersion: 1,
      scenarios: [scenario(), scenario()],
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      "scenarios: duplicate scenario id deployment.preview-identity",
    );
  });

  it("enforces schema field, ID, and oracle uniqueness contracts", () => {
    const topLevelExtra = parseRequiredCatalog({
      schemaVersion: 1,
      scenarios: [scenario()],
      unexpected: true,
    });
    expect(topLevelExtra).toMatchObject({
      ok: false,
      errors: expect.arrayContaining(["catalog.unexpected: unsupported field"]),
    });

    const malformedScenario = parseRequiredCatalog({
      schemaVersion: 1,
      scenarios: [
        scenario({
          id: "INVALID",
          expectedOracles: ["http", "http"],
          unexpected: true,
        }),
      ],
    });
    expect(malformedScenario).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([
        "scenarios[0].id: expected a stable dotted scenario ID",
        "scenarios[0].expectedOracles: duplicate oracle",
        "scenarios[0].unexpected: unsupported field",
      ]),
    });
  });
});

describe("release evidence schemas", () => {
  it("tracks the comprehensive final manifest separately from collector fragments", () => {
    const manifest = JSON.parse(
      readFileSync("quality/schemas/evidence-manifest.schema.json", "utf8"),
    ) as { required: string[]; properties: Record<string, unknown> };
    const fragment = JSON.parse(
      readFileSync("quality/schemas/evidence-fragment.schema.json", "utf8"),
    ) as { required: string[]; properties: Record<string, unknown> };

    expect(manifest.required).toEqual([
      "schemaVersion",
      "runId",
      "stage",
      "candidate",
      "results",
      "exploratoryCharters",
      "manualObligations",
      "exceptions",
      "rollbackReference",
      "tagAuthorization",
    ]);
    expect(Object.keys(manifest.properties)).toEqual(
      expect.arrayContaining(["stage", "candidate", "exploratoryCharters"]),
    );
    expect(fragment.required).toEqual([
      "schemaVersion",
      "runId",
      "environment",
      "candidateIdentity",
      "results",
    ]);
  });
});
