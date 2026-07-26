import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  parseArtifactContract,
  validateCiEvidenceImport,
  type ArtifactContract,
} from "./import-ci-evidence";

const roots: string[] = [];
const commit = "a".repeat(40);
const runId = "101";
const runAttempt = "2";
const artifactName = `release-evidence-${runId}-${runAttempt}-contract`;
const buildName = `nextjs-build-${runId}-${runAttempt}`;
const contract: ArtifactContract = {
  schemaVersion: 1,
  ciArtifacts: [
    {
      slug: "contract",
      basename: "contract.json",
      required: true,
      protectedJob: "Contract",
      mergeFragment: true,
    },
  ],
  journeySidecarBasename: "release-evidence.json",
  buildArtifactSlug: "nextjs-build",
};

function fixtureRoot(
  status: "passed" | "failed" | "skipped" = "passed",
  duplicateFile = false,
): string {
  const root = mkdtempSync(join(tmpdir(), "chapa-ci-import-"));
  roots.push(root);
  const directory = join(root, "contract");
  mkdirSync(directory);
  const fragment = {
    runId,
    candidateIdentity: commit,
    source: { workflowRunAttempt: runAttempt },
    results: [{ status }],
  };
  writeFileSync(join(directory, "contract.json"), JSON.stringify(fragment));
  if (duplicateFile) {
    const nested = join(directory, "nested");
    mkdirSync(nested);
    writeFileSync(join(nested, "contract.json"), JSON.stringify(fragment));
  }
  return root;
}

function inventory(extra: Record<string, unknown>[] = []) {
  return [
    {
      id: 1,
      name: artifactName,
      expired: false,
      digest: "sha256:evidence",
      archive_download_url: "https://example.test/evidence",
    },
    {
      id: 2,
      name: buildName,
      expired: false,
      digest: "sha256:build",
      archive_download_url: "https://example.test/build",
    },
    ...extra,
  ];
}

function validate(
  artifactsRoot: string,
  artifactInventory = inventory(),
) {
  return validateCiEvidenceImport({
    source: {
      id: Number(runId),
      run_attempt: Number(runAttempt),
      head_sha: commit,
      conclusion: "success",
    },
    jobs: [{ id: 9, name: "Contract", conclusion: "success" }],
    inventory: artifactInventory,
    contract,
    artifactsRoot,
    runId,
    runAttempt,
    developCommit: commit,
    repository: "owner/chapa",
  });
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("validateCiEvidenceImport", () => {
  it("accepts one exact-attempt artifact and its exact build", () => {
    const result = validate(fixtureRoot());

    expect(result.decision).toBe("pass");
    expect(result.blockingReasons).toEqual([]);
    expect(result.artifacts[0]).toMatchObject({
      name: artifactName,
      status: "passed",
      candidateIdentity: commit,
    });
    expect(result.buildArtifact).toMatchObject({ name: buildName });
  });

  it("blocks skipped evidence, duplicate metadata, and duplicate basenames", () => {
    const skipped = validate(fixtureRoot("skipped"));
    expect(skipped.decision).toBe("blocked");
    expect(skipped.blockingReasons.join("\n")).toContain(
      "normalized fragment status is skipped",
    );

    const duplicateMetadata = validate(fixtureRoot(), [
      ...inventory(),
      { id: 3, name: artifactName, expired: false },
    ]);
    expect(duplicateMetadata.blockingReasons.join("\n")).toContain(
      "artifact metadata is duplicated",
    );

    const duplicateFiles = validate(fixtureRoot("passed", true));
    expect(duplicateFiles.blockingReasons.join("\n")).toContain(
      "must contain exactly one contract.json",
    );
  });

  it("blocks exact-run, exact-attempt, candidate, and build mismatches", () => {
    const root = fixtureRoot();
    const result = validateCiEvidenceImport({
      source: {
        id: 999,
        run_attempt: 3,
        head_sha: "b".repeat(40),
        conclusion: "success",
      },
      jobs: [{ name: "Contract", conclusion: "failure" }],
      inventory: inventory().filter((artifact) => artifact.name !== buildName),
      contract,
      artifactsRoot: root,
      runId,
      runAttempt,
      developCommit: commit,
      repository: "owner/chapa",
    });

    expect(result.decision).toBe("blocked");
    expect(result.blockingReasons.join("\n")).toContain("job Contract: failure");
    expect(result.blockingReasons.join("\n")).toContain(
      `build artifact ${buildName} is missing`,
    );
    expect(result.blockingReasons.join("\n")).toContain(
      "does not match selected run",
    );
    expect(result.blockingReasons.join("\n")).toContain(
      "does not match selected attempt",
    );
  });
});

describe("parseArtifactContract", () => {
  it("rejects malformed and duplicate contracts", () => {
    expect(() => parseArtifactContract({ schemaVersion: 2 })).toThrow(
      "unsupported or malformed",
    );
    expect(() =>
      parseArtifactContract({
        ...contract,
        ciArtifacts: [...contract.ciArtifacts, ...contract.ciArtifacts],
      }),
    ).toThrow("duplicate artifact slug");
  });
});
