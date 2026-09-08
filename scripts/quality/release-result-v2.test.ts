import { describe, expect, it } from "vitest";
import { buildLocalCandidateResult, parseLocalCandidateResult, buildFinalResultV2, parseFinalResultV2, LOCAL_GATE_KEYS, LOCAL_REQUIRED_SCENARIOS } from "./release-result";
const commit = "a".repeat(40), tree = "b".repeat(40), main = "c".repeat(40), digest = "d".repeat(64);
const at = "2026-09-08T10:00:00.000Z";
export function localInput() {
  return { schemaVersion: 2, mode: "local-candidate", environment: "local",
    candidate: { baselineTag: "v2.29.0", rollbackReference: "v2.29.0", developCommit: commit, candidateTreeDigest: tree, localUrl: "http://127.0.0.1:3000" },
    build: { schemaVersion: 1, commit, treeDigest: tree, builtAt: at,
      artifacts: ["apps/web/.next/BUILD_ID", "apps/web/.next/build-manifest.json", "apps/web/.next/routes-manifest.json", "apps/web/.next/server/app-paths-manifest.json", "apps/web/.next/static/chunks/app.js", "apps/web/.next/server/app.js"].map(path => ({ path, sha256: digest })) },
    checks: Object.fromEntries(LOCAL_GATE_KEYS.map(key => [key, "passed"])),
    localProbes: { discovered: 40, executed: 40, skipped: 0, failed: 0, required: Object.fromEntries(LOCAL_REQUIRED_SCENARIOS.map(id => [id, "passed"])) },
    pendingProduction: { migrationAdmission: "pending", productionIdentity: "pending", productionProbes: "pending", publicationReadback: "pending", rollbackReadiness: "pending" },
    generatedAt: at };
}
function finalInput() {
  return { schemaVersion: 2, localCandidate: buildLocalCandidateResult(localInput()), mainCommit: main, mainTreeDigest: tree,
    deployment: { environment: "production", id: "dpl_actual", url: "https://chapa.example", commit: main, treeDigest: tree },
    checks: { migrationAdmission: "passed", productionIdentity: "passed", productionProbes: "passed", publicationReadback: "passed", rollbackReadiness: "passed" },
    tag: { name: "v2.30.0", target: main }, release: { tag: "v2.30.0", target: "v2.30.0" },
    readback: { tagVerifiedAt: at, releaseVerifiedAt: at }, generatedAt: at };
}
describe("schema2 local qualification", () => {
  it("binds exact local source/build and records production checks pending", () => {
    const result = buildLocalCandidateResult(localInput());
    expect(result).toMatchObject({ schemaVersion: 2, stage: "local-candidate", status: "passed", environment: "local", pendingProduction: { productionIdentity: "pending" } });
    expect(parseLocalCandidateResult(result)).toEqual(result);
  });
  it.each(["https://remote.example", "http://127.0.0.1.evil.test", "http://localhost@remote.test", "http://127.0.0.1:3000/?secret=x", "http://127.1:3000", "http://2130706433:3000"])("rejects unsafe or ambiguous local target%s", localUrl => {
    const input = localInput(); input.candidate.localUrl = localUrl;
    expect(() => buildLocalCandidateResult(input)).toThrow(/local|loopback|target/);
  });
  it.each(["candidate", "build"])("rejects source identity mismatch in%s", side => {
    const input = localInput();
    if (side === "candidate") input.candidate.developCommit = main; else input.build.treeDigest = main;
    expect(() => buildLocalCandidateResult(input)).toThrow(/identity|tree|commit/);
  });
  it.each(LOCAL_GATE_KEYS)("requires named gate%s", key => {
    const input = localInput(); delete input.checks[key];
    expect(() => buildLocalCandidateResult(input)).toThrow(key);
  });
  it("never upgrades failed/skipped checks or omitted browser scenarios into passes", () => {
    const input = localInput(); input.checks.coverage = "failed";
    expect(buildLocalCandidateResult(input).status).toBe("failed");
    expect(() => parseLocalCandidateResult({ ...buildLocalCandidateResult(input), status: "passed" })).toThrow(/status/);
    input.checks.coverage = "skipped";
    expect(() => buildLocalCandidateResult(input)).toThrow(/coverage/);
    input.checks.coverage = "passed"; input.localProbes.skipped = 1; input.localProbes.executed = 39;
    expect(() => buildLocalCandidateResult(input)).toThrow(/skip|probe/);
    input.localProbes.skipped = 0; input.localProbes.executed = 40; delete input.localProbes.required[LOCAL_REQUIRED_SCENARIOS[0]];
    expect(() => buildLocalCandidateResult(input)).toThrow(/deployment.local/);
  });
  it.each([".env.local", "apps/web/.next/cache/data.json", "apps/web/.next/server/app/report.html", "apps/web/.next/server/../.env"])("rejects forbidden artifact path%s", path => {
    const input = localInput(); input.build.artifacts.push({ path, sha256: digest });
    expect(() => buildLocalCandidateResult(input)).toThrow(/artifact|path/);
  });
  it("rejects hidden credential fields and fake production passes", () => {
    expect(() => buildLocalCandidateResult({ ...localInput(), authorization: "x" })).toThrow(/forbidden/);
    const input = localInput(); input.pendingProduction.productionIdentity = "passed";
    expect(() => buildLocalCandidateResult(input)).toThrow(/pending/);
  });
});
describe("schema2 production completion", () => {
  it("binds exact qualified tree to actual deployment and publication readback", () => {
    const result = buildFinalResultV2(finalInput());
    expect(result).toMatchObject({ schemaVersion: 2, stage: "final", status: "passed", deployment: { commit: main, treeDigest: tree } });
    expect(parseFinalResultV2(result)).toEqual(result);
  });
  it("rejects post-qualification tree drift and dishonest publication status", () => {
    const input = finalInput(); input.mainTreeDigest = commit;
    expect(() => buildFinalResultV2(input)).toThrow(/tree/);
    const failed = finalInput(); failed.checks.publicationReadback = "failed";
    expect(buildFinalResultV2(failed).status).toBe("failed");
    expect(() => parseFinalResultV2({ ...buildFinalResultV2(failed), status: "passed" })).toThrow(/status/);
  });
  it("rejects mismatched deployment, release tags, or modified embedded proof", () => {
    const wrong = finalInput(); wrong.deployment.commit = commit;
    expect(() => buildFinalResultV2(wrong)).toThrow(/commit|identity/);
    const tag = finalInput(); tag.release.tag = "v9.9.9";
    expect(() => buildFinalResultV2(tag)).toThrow(/release|tag/);
    const proof = buildFinalResultV2(finalInput());
    expect(() => parseFinalResultV2({ ...proof, localCandidateDigest: "e".repeat(64) })).toThrow(/digest/);
  });
});

it("requires served static code in the build identity", () => {
  const input = localInput(); input.build.artifacts = input.build.artifacts.filter(entry => !entry.path.includes("/static/"));
  expect(() => buildLocalCandidateResult(input)).toThrow(/static|artifact/);
});

it("records a failed applicable browser test even when seven release scenarios passed", () => {
  const input = localInput(); input.localProbes.failed = 1; input.checks.localProbes = "failed";
  expect(buildLocalCandidateResult(input).status).toBe("failed");
  input.checks.localProbes = "passed";
  expect(() => buildLocalCandidateResult(input)).toThrow(/localProbes|status/);
});
it("requires an actual production origin rather than a path", () => {
  const input = finalInput(); input.deployment.url = "https://chapa.example/unrelated";
  expect(() => buildFinalResultV2(input)).toThrow(/origin/);
});
