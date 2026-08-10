import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  parseEvidenceFragment,
  parseRequiredCatalog,
  parseScenarioResult,
  SUPPORTED_ENVIRONMENTS,
  type EvidenceFragment,
  type ReleaseEnvironment,
  type RequiredCatalog,
  type ScenarioResult,
} from "./contracts";
import { mergeScenarioResults } from "./merge-scenario-results";

type PlaywrightResult = {
  status?: string;
  startTime?: string;
  duration?: number;
  attachments?: Array<{ name?: string; path?: string }>;
};

type PlaywrightSpec = {
  title?: string;
  tests?: Array<{ results?: PlaywrightResult[] }>;
};

type PlaywrightSuite = {
  specs?: PlaywrightSpec[];
  suites?: PlaywrightSuite[];
};

type NormalizedStatus = "passed" | "failed" | "skipped";

type SidecarResult = ScenarioResult;

function flattenSpecs(suites: PlaywrightSuite[]): PlaywrightSpec[] {
  return suites.flatMap((suite) => [
    ...(suite.specs ?? []),
    ...flattenSpecs(suite.suites ?? []),
  ]);
}

function normalizeStatus(status: string | undefined): NormalizedStatus {
  if (status === "passed") return "passed";
  if (status === "skipped") return "skipped";
  return "failed";
}

export function collectPlaywrightEvidence(
  rawReport: unknown,
  catalog: RequiredCatalog,
  environment: ReleaseEnvironment,
  rawEvidencePath: string,
  runId = "test-run",
  candidateIdentity = "0".repeat(40),
  loadAttachment: (path: string) => unknown = () => undefined,
  selectedScenarioIds?: string[],
): EvidenceFragment {
  const parsedCatalog = parseRequiredCatalog(catalog);
  if (!parsedCatalog.ok) throw new Error(parsedCatalog.errors.join("\n"));
  catalog = parsedCatalog.value;
  if (!SUPPORTED_ENVIRONMENTS.includes(environment)) {
    throw new Error(`collector.environment: unsupported environment ${environment}`);
  }
  if (!/^[0-9a-f]{40}$/.test(candidateIdentity)) {
    throw new Error(
      "collector.candidateIdentity: expected a lowercase 40-character candidate identity",
    );
  }
  if (!rawReport || typeof rawReport !== "object") {
    throw new Error("Playwright report must be an object");
  }
  const suites = (rawReport as { suites?: PlaywrightSuite[] }).suites;
  if (!Array.isArray(suites)) {
    throw new Error("Playwright report is missing suites");
  }

  const catalogById = new Map(catalog.scenarios.map((scenario) => [scenario.id, scenario]));
  const selected = selectedScenarioIds
    ? selectedScenarioIds.map((scenarioId) => {
        const scenario = catalogById.get(scenarioId);
        if (!scenario || scenario.runner !== "playwright") {
          throw new Error(`unknown selected Playwright scenario ${scenarioId}`);
        }
        return scenario;
      })
    : catalog.scenarios.filter(
        (scenario) =>
          scenario.runner === "playwright" &&
          scenario.environments.includes(environment),
      );
  const observed = new Map<string, PlaywrightSpec>();
  const sidecarResults = new Map<string, SidecarResult[]>();

  for (const spec of flattenSpecs(suites)) {
    for (const attempt of (spec.tests ?? []).flatMap(
      (testCase) => testCase.results ?? [],
    )) {
      for (const attachment of attempt.attachments ?? []) {
        if (attachment.name !== "release-evidence" || !attachment.path) continue;
        const sidecar = loadAttachment(attachment.path) as
          | { results?: SidecarResult[] }
          | undefined;
        if (!sidecar || !Array.isArray(sidecar.results)) {
          throw new Error(`invalid Playwright evidence sidecar ${attachment.path}`);
        }
        const attachmentScenarioIds = new Set<string>();
        for (const [index, rawResult] of sidecar.results.entries()) {
          const parsed = parseScenarioResult(
            rawResult,
            `${attachment.path}.results[${index}]`,
          );
          if (!parsed.ok) throw new Error(parsed.errors.join("\n"));
          const result = parsed.value;
          if (!catalogById.has(result.scenarioId)) {
            throw new Error(`unknown Playwright scenario ${result.scenarioId}`);
          }
          if (attachmentScenarioIds.has(result.scenarioId)) {
            throw new Error(
              `duplicate Playwright sidecar scenario ${result.scenarioId}`,
            );
          }
          attachmentScenarioIds.add(result.scenarioId);
          const entries = sidecarResults.get(result.scenarioId) ?? [];
          entries.push(result);
          sidecarResults.set(result.scenarioId, entries);
        }
      }
    }

    const match = spec.title?.match(/@release-required\s+([a-z0-9.-]+)/i);
    if (!match) continue;
    const scenarioId = match[1];
    if (!catalogById.has(scenarioId)) {
      throw new Error(`unknown Playwright scenario ${scenarioId}`);
    }
    if (observed.has(scenarioId)) {
      throw new Error(`duplicate Playwright scenario ${scenarioId}`);
    }
    observed.set(scenarioId, spec);
  }

  for (const scenario of selected) {
    if (!observed.has(scenario.id) && !sidecarResults.has(scenario.id)) {
      throw new Error(`missing selected Playwright scenario ${scenario.id}`);
    }
  }

  const results = selected.map((scenario) => {
    const sidecars = sidecarResults.get(scenario.id);
    if (sidecars?.length) {
      return mergeSidecarResults(sidecars);
    }
    const spec = observed.get(scenario.id)!;
    const attempts = (spec.tests ?? []).flatMap((testCase) => testCase.results ?? []);
    const lastAttempt = attempts.at(-1);
    const evidencePaths = [
      rawEvidencePath,
      ...attempts.flatMap((attempt) =>
        (attempt.attachments ?? [])
          .map((attachment) => attachment.path)
          .filter((path): path is string => Boolean(path)),
      ),
    ];
    const startedAt = lastAttempt?.startTime ?? new Date().toISOString();
    const finishedAt = new Date(
      new Date(startedAt).getTime() + (lastAttempt?.duration ?? 0),
    ).toISOString();
    return {
      scenarioId: scenario.id,
      environment,
      status: normalizeStatus(lastAttempt?.status),
      startedAt,
      finishedAt,
      runner: "playwright" as const,
      evidence: Object.fromEntries(
        scenario.expectedOracles.map((oracle) => [
          oracle,
          [...new Set(evidencePaths)],
        ]),
      ),
      fixtures: [],
    };
  });

  const fragment: EvidenceFragment = {
    schemaVersion: 1,
    runId,
    environment,
    candidateIdentity,
    results,
  };
  const parsedFragment = parseEvidenceFragment(fragment);
  if (!parsedFragment.ok) throw new Error(parsedFragment.errors.join("\n"));
  return parsedFragment.value;
}

function mergeSidecarResults(results: SidecarResult[]): SidecarResult {
  return mergeScenarioResults(results);
}

function argument(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error(`missing required argument ${name}`);
  return value;
}

export function main(): void {
  const resultsPath = argument("--results");
  const catalogPath = argument("--catalog");
  const environment = argument("--environment");
  const runId = argument("--run-id");
  const candidateIdentity = argument("--candidate-identity");
  const scenarioIdsIndex = process.argv.indexOf("--scenario-ids");
  const selectedScenarioIds =
    scenarioIdsIndex >= 0 && process.argv[scenarioIdsIndex + 1]
      ? process.argv[scenarioIdsIndex + 1]!.split(",").filter(Boolean)
      : undefined;
  const outputPath = argument("--output");
  const report = JSON.parse(readFileSync(resultsPath, "utf8")) as unknown;
  const parsedCatalog = parseRequiredCatalog(
    JSON.parse(readFileSync(catalogPath, "utf8")) as unknown,
  );
  if (!parsedCatalog.ok) throw new Error(parsedCatalog.errors.join("\n"));
  if (
    !SUPPORTED_ENVIRONMENTS.includes(environment as ReleaseEnvironment)
  ) {
    throw new Error(`collector.environment: unsupported environment ${environment}`);
  }
  const fragment = collectPlaywrightEvidence(
    report,
    parsedCatalog.value,
    environment as ReleaseEnvironment,
    resultsPath,
    runId,
    candidateIdentity,
    (path) => JSON.parse(readFileSync(path, "utf8")) as unknown,
    selectedScenarioIds,
  );
  const validatedFragment = parseEvidenceFragment(fragment);
  if (!validatedFragment.ok) {
    throw new Error(validatedFragment.errors.join("\n"));
  }
  writeFileSync(
    outputPath,
    `${JSON.stringify(validatedFragment.value, null, 2)}\n`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
