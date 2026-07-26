import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./journey.spec.ts", import.meta.url), "utf8");

describe("journey release evidence lifecycle", () => {
  it("places every fixture mutation inside the cleanup boundary", () => {
    const tryIndex = source.indexOf("try {");
    expect(tryIndex).toBeGreaterThan(-1);
    expect(source.indexOf("await seedFeatureFlags(db);")).toBeGreaterThan(tryIndex);
    expect(source.indexOf("await resetShapes(db, shapes);")).toBeGreaterThan(tryIndex);
    expect(source.indexOf("await seedShapes(db, shapes);")).toBeGreaterThan(tryIndex);
    expect(source.indexOf("} finally {")).toBeGreaterThan(tryIndex);
  });

  it("restores shared flags and attaches machine-readable cleanup evidence", () => {
    expect(source).toContain("await restoreFeatureFlags(db, originalFeatureFlags)");
    expect(source).toContain('testInfo.attach("release-evidence"');
    expect(source).toContain("featureFlagsRestored");
    expect(source).toContain("remainingCount");
  });

  it("keeps actual handles synthetic and evidence fixtures scoped to the full run id", () => {
    expect(source).toContain("chapa-e2e-${runId}");
    expect(source).toContain("${evidenceRunId}-${projectName}-studio");
    expect(source).toContain("${evidenceRunId}-${projectName}-snapshot");
  });
});
