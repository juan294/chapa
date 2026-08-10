import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  analyzeReleaseRun,
  parseReleaseRun,
  parseRequiredCatalog,
  type AnalysisResult,
  type ReleaseRun,
  type RequiredCatalog,
} from "./contracts";

function cell(value: unknown): string {
  return String(value ?? "—").replaceAll("|", "\\|").replaceAll("\n", " ");
}

export function renderReleaseReport(
  catalog: RequiredCatalog,
  run: ReleaseRun,
  analysis: AnalysisResult,
): string {
  const catalogById = new Map(
    catalog.scenarios.map((scenario) => [scenario.id, scenario]),
  );
  const resultRows = run.results
    .filter(
      (result) =>
        analysis.stage === "final" || result.environment !== "production",
    )
    .map((result) => {
      const scenario = catalogById.get(result.scenarioId);
      const references = Object.entries(result.evidence)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([oracle, paths]) => `${oracle}: ${paths.join(", ")}`)
        .join("; ");
      return `| ${cell(result.scenarioId)} | ${result.environment} | ${scenario?.required ? "yes" : "no"} | ${result.status} | ${cell(references)} |`;
    })
    .join("\n");
  const charterRows =
    run.exploratoryCharters
      .map(
        (charter) =>
          `| ${cell(charter.id)} | ${cell(charter.changedCapability)} | ${charter.environment} | ${charter.timeboxMinutes} minutes | ${charter.safetyClass} | ${cell(charter.riskHypothesis)} | ${charter.decision} | ${charter.maneuvers.length}/8 | ${charter.findings.length} | ${charter.skippedHighRiskAreas.length} | ${cell(charter.candidateRecord)} |`,
      )
      .join("\n") || "| — | — | — | — | — | — | — | — | — | — | — |";
  const fixtureRows =
    run.results
      .flatMap((result) => result.fixtures)
      .concat(run.exploratoryCharters.flatMap((charter) => charter.fixtures))
      .map(
        (fixture) =>
          `| ${cell(fixture.id)} | ${fixture.cleanupStatus} | ${cell(fixture.residueEvidence)} |`,
      )
      .join("\n") || "| — | — | — |";
  const exceptionRows =
    run.exceptions
      .map(
        (exception) =>
          `| ${cell(exception.scenarioId)} | ${cell(exception.reason)} | ${exception.risk} | ${cell(exception.approvedBy)} | ${cell(exception.expiresAt)} | ${cell(exception.followUp)} |`,
      )
      .join("\n") || "| — | — | — | — | — | — |";
  const manualRows =
    run.manualObligations
      .map(
        (obligation) =>
          `| ${cell(obligation.id)} | ${cell(obligation.executor)} | ${cell(obligation.executedAt)} | ${obligation.environment} | ${cell(obligation.candidate)} | ${obligation.status} | ${cell(obligation.result)} | ${cell(obligation.evidence.join(", "))} |`,
      )
      .join("\n") || "| — | — | — | — | — | — | — | — |";
  const reasons =
    analysis.blockingReasons.map((reason) => `- ${reason}`).join("\n") ||
    "- None";
  return `# Release Evidence — ${run.runId}

## Decision

${analysis.decision.toUpperCase()}

- Stage: ${analysis.stage}
- Generated at: ${run.generatedAt}
- Passed: ${analysis.counts.passed}
- Failed: ${analysis.counts.failed}
- Skipped: ${analysis.counts.skipped}
- Missing: ${analysis.counts.missing}

## Candidate

- Baseline: ${run.baselineTag}
- Develop commit: ${run.candidate.developCommit}
- Candidate tree: ${run.candidate.candidateTreeDigest}
- Preview URL: ${run.candidate.previewUrl}
- Preview identity: ${run.candidate.previewIdentity ?? "pending"}
- Main commit: ${run.candidate.mainCommit ?? "pending"}
- Main tree: ${run.candidate.mainTreeDigest ?? "pending"}
- Production URL: ${run.candidate.productionUrl ?? "pending"}
- Production identity: ${run.candidate.productionIdentity ?? "pending"}

## Blocking reasons

${reasons}

## Scenario results

| Scenario | Environment | Required | Status | Evidence references |
| --- | --- | --- | --- | --- |
${resultRows || "| — | — | — | — | — |"}

## Exploratory charters

| Charter | Changed capability | Environment | Timebox | Safety | Risk hypothesis | Decision | Maneuvers | Findings | Skipped high-risk areas | Candidate record |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${charterRows}

## Manual obligations

| Obligation | Executor | Executed at | Environment | Candidate | Status | Result | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
${manualRows}

## Fixtures

| Fixture | Cleanup | Zero-residue evidence |
| --- | --- | --- |
${fixtureRows}

## Exceptions

| Scenario | Reason | Risk | Approved by | Expires | Follow-up |
| --- | --- | --- | --- | --- | --- |
${exceptionRows}

## Rollback

- Reference: ${run.rollbackReference}

## Tag authorization

- Status: ${run.tagAuthorization.status}
- Authorized by: ${run.tagAuthorization.authorizedBy ?? "pending"}
- Authorized at: ${run.tagAuthorization.authorizedAt ?? "pending"}
`;
}

function option(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const runPath = option(argv, "--run");
  const catalogPath =
    option(argv, "--catalog") ?? "quality/release-required.json";
  const output = option(argv, "--output");
  const stage = option(argv, "--stage") ?? "final";
  if (!runPath) throw new Error("--run is required");
  if (stage !== "pre-merge" && stage !== "final") {
    throw new Error("--stage must be pre-merge or final");
  }
  const catalogResult = parseRequiredCatalog(
    JSON.parse(await readFile(catalogPath, "utf8")) as unknown,
  );
  const runResult = parseReleaseRun(
    JSON.parse(await readFile(runPath, "utf8")) as unknown,
  );
  if (!catalogResult.ok) throw new Error(catalogResult.errors.join("\n"));
  if (!runResult.ok) throw new Error(runResult.errors.join("\n"));
  const report = renderReleaseReport(
    catalogResult.value,
    runResult.value,
    analyzeReleaseRun(catalogResult.value, runResult.value, { stage }),
  );
  if (output) {
    await writeFile(output, report, "utf8");
    console.log(`Rendered release evidence report: ${output}`);
  } else {
    process.stdout.write(report);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
