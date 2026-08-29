import { existsSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildFinalResult,
  buildPreviewResult,
  parseFinalResult,
  parsePreviewResult,
  writeResult,
} from "./release-result";

const COMMIT_A = "a".repeat(40);
const COMMIT_B = "b".repeat(40);
const TREE_A = "c".repeat(40);
const TREE_B = "d".repeat(40);

function validCandidate(overrides: Record<string, unknown> = {}) {
  return {
    baselineTag: "v2.24.1",
    rollbackReference: "v2.24.1",
    developCommit: COMMIT_A,
    candidateTreeDigest: TREE_A,
    previewUrl: "https://chapa-preview.vercel.app",
    ...overrides,
  };
}

function validSource(overrides: Record<string, unknown> = {}) {
  return {
    repository: "juangonzalez/chapa",
    workflowRunId: "123456",
    workflowRunAttempt: "1",
    headSha: COMMIT_A,
    ...overrides,
  };
}

function passedPreviewChecks() {
  return {
    sourceIdentity: "passed",
    previewIdentity: "passed",
    previewProbes: "passed",
    rollbackReadiness: "passed",
  };
}

function validPreviewInput(overrides: Record<string, unknown> = {}) {
  return {
    mode: "default" as const,
    candidate: validCandidate(),
    source: validSource(),
    checks: passedPreviewChecks(),
    generatedAt: "2026-08-29T12:00:00.000Z",
    ...overrides,
  };
}

function validPreviewResult(overrides: Record<string, unknown> = {}) {
  return buildPreviewResult(validPreviewInput(overrides));
}

function validFinalInput(overrides: Record<string, unknown> = {}) {
  return {
    preview: validPreviewResult(),
    mainCommit: COMMIT_B,
    mainTreeDigest: TREE_A,
    productionUrl: "https://chapa.thecreativetoken.com",
    checks: {
      productionIdentity: "passed",
      productionProbes: "passed",
    },
    tag: { name: "v2.25.0", target: COMMIT_B },
    release: { tag: "v2.25.0", target: "v2.25.0" },
    readback: {
      tagVerifiedAt: "2026-08-29T12:05:00.000Z",
      releaseVerifiedAt: "2026-08-29T12:06:00.000Z",
    },
    generatedAt: "2026-08-29T12:07:00.000Z",
    ...overrides,
  };
}

describe("buildPreviewResult", () => {
  it("builds a valid passed preview result", () => {
    const result = validPreviewResult();
    expect(result.schemaVersion).toBe(1);
    expect(result.stage).toBe("preview");
    expect(result.status).toBe("passed");
    expect(result.mode).toBe("default");
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("builds a valid failed preview result with one failed direct check", () => {
    const result = validPreviewResult({
      checks: { ...passedPreviewChecks(), previewProbes: "failed" },
    });
    expect(result.status).toBe("failed");
    expect(result.checks.previewProbes).toBe("failed");
  });

  it("rejects a malformed 40-hex commit identity", () => {
    expect(() =>
      validPreviewResult({
        candidate: validCandidate({ developCommit: "not-a-sha" }),
      }),
    ).toThrow(/developCommit/);
  });

  it("rejects a malformed 40-hex tree identity", () => {
    expect(() =>
      validPreviewResult({
        candidate: validCandidate({ candidateTreeDigest: "short" }),
      }),
    ).toThrow(/candidateTreeDigest/);
  });

  it("rejects a malformed annotated release tag", () => {
    expect(() =>
      validPreviewResult({
        candidate: validCandidate({ baselineTag: "latest" }),
      }),
    ).toThrow(/baselineTag/);
  });

  it("rejects a non-HTTPS preview URL", () => {
    expect(() =>
      validPreviewResult({
        candidate: validCandidate({ previewUrl: "http://insecure-preview.example" }),
      }),
    ).toThrow(/previewUrl/i);
  });

  it("rejects a candidate/source SHA mismatch", () => {
    expect(() =>
      validPreviewResult({ source: validSource({ headSha: COMMIT_B }) }),
    ).toThrow(/mismatch/i);
  });

  it("rejects a missing direct check", () => {
    const checks = passedPreviewChecks() as Record<string, string>;
    delete checks.rollbackReadiness;
    expect(() => validPreviewResult({ checks })).toThrow(/rollbackReadiness/);
  });

  it("rejects an unknown check id", () => {
    expect(() =>
      validPreviewResult({
        checks: { ...passedPreviewChecks(), extraCheck: "passed" },
      }),
    ).toThrow(/extraCheck/);
  });

  it("rejects a malformed workflow run ID", () => {
    expect(() =>
      validPreviewResult({ source: validSource({ workflowRunId: "" }) }),
    ).toThrow(/workflowRunId/);
  });

  it("rejects a malformed workflow run attempt", () => {
    expect(() =>
      validPreviewResult({ source: validSource({ workflowRunAttempt: "one" }) }),
    ).toThrow(/workflowRunAttempt/);
  });

  it("rejects an invalid ISO timestamp", () => {
    expect(() =>
      validPreviewResult({ generatedAt: "not-a-timestamp" }),
    ).toThrow(/generatedAt/);
  });

  it("rejects unknown top-level fields", () => {
    expect(() => validPreviewResult({ unexpectedField: true })).toThrow(
      /unexpectedField/,
    );
  });

  it("rejects unknown nested fields", () => {
    expect(() =>
      validPreviewResult({
        candidate: validCandidate({ extraNested: "value" }),
      }),
    ).toThrow(/extraNested/);
  });

  it.each(["authorization", "cookie", "secret", "token", "Authorization", "API_TOKEN"])(
    "recursively rejects a field name containing %s",
    (fieldName) => {
      expect(() =>
        validPreviewResult({ source: validSource({ [fieldName]: "x" }) }),
      ).toThrow(/secret-bearing|forbidden/i);
    },
  );
});

describe("parsePreviewResult", () => {
  it("rejects a passed overall result containing a failed check", () => {
    const result = validPreviewResult();
    const tampered = {
      ...result,
      checks: { ...result.checks, previewProbes: "failed" },
      status: "passed",
    };
    expect(() => parsePreviewResult(tampered)).toThrow(/status/i);
  });

  it("accepts a previously-built valid result unchanged", () => {
    const result = validPreviewResult();
    expect(parsePreviewResult(result)).toEqual(result);
  });
});

describe("buildFinalResult", () => {
  it("builds a valid final result referencing preview source, main tree, production, tag, and release readback", () => {
    const result = buildFinalResult(validFinalInput());
    expect(result.stage).toBe("final");
    expect(result.status).toBe("passed");
    expect(result.source).toEqual(validPreviewResult().source);
    expect(result.mainCommit).toBe(COMMIT_B);
    expect(result.mainTreeDigest).toBe(TREE_A);
    expect(result.tag).toEqual({ name: "v2.25.0", target: COMMIT_B });
    expect(result.release).toEqual({ tag: "v2.25.0", target: "v2.25.0" });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("rejects a main/candidate tree mismatch in a passed final result", () => {
    expect(() =>
      buildFinalResult(validFinalInput({ mainTreeDigest: TREE_B })),
    ).toThrow(/tree/i);
  });

  it("rejects a tag target that does not equal the main commit", () => {
    expect(() =>
      buildFinalResult(
        validFinalInput({ tag: { name: "v2.25.0", target: COMMIT_A } }),
      ),
    ).toThrow(/tag target/i);
  });

  it("rejects a release target that does not equal the tag", () => {
    expect(() =>
      buildFinalResult(
        validFinalInput({
          release: { tag: "v2.25.0", target: "v9.9.9" },
        }),
      ),
    ).toThrow(/release target/i);
  });

  it("rejects an unknown production check id", () => {
    expect(() =>
      buildFinalResult(
        validFinalInput({
          checks: { productionIdentity: "passed", productionProbes: "passed", extra: "passed" },
        }),
      ),
    ).toThrow(/extra/);
  });

  it("rejects a missing production check", () => {
    expect(() =>
      buildFinalResult(
        validFinalInput({ checks: { productionIdentity: "passed" } }),
      ),
    ).toThrow(/productionProbes/);
  });

  it("derives failed overall status from a failed production probe", () => {
    const result = buildFinalResult(
      validFinalInput({
        checks: { productionIdentity: "passed", productionProbes: "failed" },
      }),
    );
    expect(result.status).toBe("failed");
  });

  it("rejects an invalid embedded preview result", () => {
    expect(() =>
      buildFinalResult(
        validFinalInput({
          preview: { ...validPreviewResult(), stage: "not-preview" },
        }),
      ),
    ).toThrow();
  });
});

describe("parseFinalResult", () => {
  it("rejects a field name containing secret anywhere in the tree", () => {
    const result = buildFinalResult(validFinalInput());
    const tampered = { ...result, readback: { ...result.readback, secretToken: "x" } };
    expect(() => parseFinalResult(tampered)).toThrow(/secret-bearing|forbidden/i);
  });
});

describe("writeResult", () => {
  it("writes deterministic JSON via an atomic sibling-temp-file replace", () => {
    const dir = mkdtempSync(join(tmpdir(), "release-result-"));
    const outputPath = join(dir, "release-result.json");
    const result = validPreviewResult();

    writeResult(outputPath, result);

    expect(existsSync(outputPath)).toBe(true);
    const siblingFiles = readdirSync(dir);
    expect(siblingFiles).toEqual(["release-result.json"]);

    const firstWrite = readFileSync(outputPath, "utf8");
    writeResult(outputPath, result);
    const secondWrite = readFileSync(outputPath, "utf8");
    expect(secondWrite).toBe(firstWrite);
    expect(JSON.parse(firstWrite)).toEqual(result);
  });

  it("writes a failed result the same way as a passed one", () => {
    const dir = mkdtempSync(join(tmpdir(), "release-result-"));
    const outputPath = join(dir, "release-result.json");
    const result = validPreviewResult({
      checks: { ...passedPreviewChecks(), previewProbes: "failed" },
    });

    writeResult(outputPath, result);

    const written = JSON.parse(readFileSync(outputPath, "utf8"));
    expect(written.status).toBe("failed");
  });
});
