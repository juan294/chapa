import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  parseEvidenceFragment,
  parseReleaseRun,
  parseRequiredCatalog,
  parseScenarioResult,
  type EvidenceFragment,
  type EvidenceManifest,
  type ExploratoryCharter,
  type ManualObligation,
  type RequiredCatalog,
  type ReleaseRun,
  type ScenarioResult,
} from "./contracts";
import { mergeScenarioResults } from "./merge-scenario-results";

type PreMergeEvidence = {
  exploratoryCharters: ExploratoryCharter[];
  manualObligations: ManualObligation[];
  manualResult: ScenarioResult;
};

type IdentityEvidence = {
  decision?: string;
  blockingReasons?: string[];
  preview?: { commitSha?: string | null };
  mainCommit?: string;
  mainTreeDigest?: string;
  production?: { commitSha?: string | null; environment?: string | null };
};

type JourneySidecar = {
  runId?: string;
  results?: ScenarioResult[];
  cleanup?: { status?: string; remainingCount?: number };
};

export type MergeOptions = {
  stage: "pre-merge" | "final";
  run: ReleaseRun;
  catalog: RequiredCatalog;
  fragments: Array<{ path: string; value: EvidenceFragment }>;
  journeySidecars?: Array<{ path: string; value: JourneySidecar }>;
  preMergeEvidence?: PreMergeEvidence;
  identityEvidence: IdentityEvidence;
  rollbackReference?: string;
};

function normalizeSidecars(
  sidecars: Array<{ path: string; value: JourneySidecar }>,
  runId: string,
): Map<string, ScenarioResult> {
  const grouped = new Map<string, ScenarioResult[]>();
  for (const sidecar of [...sidecars].sort((a, b) =>
    a.path.localeCompare(b.path),
  )) {
    if (!Array.isArray(sidecar.value.results)) {
      throw new Error(`${sidecar.path}: journey sidecar has no results`);
    }
    sidecar.value.results.forEach((result, index) => {
      const parsed = parseScenarioResult(
        result,
        `${sidecar.path}.results[${index}]`,
      );
      if (!parsed.ok) throw new Error(parsed.errors.join("\n"));
      result = parsed.value;
      const evidence = Object.fromEntries(
        Object.entries(result.evidence).map(([oracle, paths]) => [
          oracle,
          [...new Set([...paths, `${sidecar.path}#${oracle}`])],
        ]),
      );
      const cleanupRemoved =
        sidecar.value.cleanup?.status === "removed" &&
        sidecar.value.cleanup.remainingCount === 0;
      const fixtures = result.fixtures.map((fixture) => ({
        ...fixture,
        id: fixture.id.startsWith(`${runId}-`)
          ? fixture.id
          : `${runId}-${fixture.id}`,
        cleanupStatus:
          cleanupRemoved && fixture.cleanupStatus === "removed"
            ? ("removed" as const)
            : ("present" as const),
        residueEvidence:
          `${sidecar.path}#cleanup` +
          (sidecar.value.cleanup?.remainingCount === undefined
            ? ""
            : `;remainingCount=${sidecar.value.cleanup.remainingCount}`),
      }));
      const normalized = { ...result, evidence, fixtures };
      const resultKey = `${result.scenarioId}\u0000${result.environment}`;
      grouped.set(resultKey, [
        ...(grouped.get(resultKey) ?? []),
        normalized,
      ]);
    });
  }

  return new Map(
    [...grouped].map(([resultKey, results]) => {
      return [resultKey, mergeScenarioResults(results)];
    }),
  );
}

function mergeUniqueResults(
  existing: ScenarioResult[],
  additions: ScenarioResult[],
): ScenarioResult[] {
  const key = (result: ScenarioResult) =>
    `${result.scenarioId}\u0000${result.environment}`;
  const merged = new Map(existing.map((result) => [key(result), result]));
  for (const result of additions) {
    const resultKey = key(result);
    if (merged.has(resultKey)) {
      throw new Error(
        `duplicate scenario fragment ${result.scenarioId}/${result.environment}`,
      );
    }
    merged.set(resultKey, result);
  }
  return [...merged.values()].sort((a, b) => {
    const left = `${a.scenarioId}/${a.environment}`;
    const right = `${b.scenarioId}/${b.environment}`;
    return left.localeCompare(right);
  });
}

function mergeProductionObservations(
  existing: ScenarioResult[],
  production: ScenarioResult[],
  catalog: RequiredCatalog,
): ScenarioResult[] {
  const requiredProductionScenarios = catalog.scenarios.filter(
    (scenario) =>
      scenario.required && scenario.environments.includes("production"),
  );
  for (const scenario of requiredProductionScenarios) {
    if (
      !production.some(
        (result) =>
          result.scenarioId === scenario.id &&
          result.environment === "production",
      )
    ) {
      throw new Error(`production fragment is missing ${scenario.id}`);
    }
  }
  return mergeUniqueResults(existing, production);
}

export function mergeReleaseEvidence(options: MergeOptions): {
  run: ReleaseRun;
  manifest: EvidenceManifest;
} {
  const parsedRun = parseReleaseRun(options.run);
  if (!parsedRun.ok) throw new Error(parsedRun.errors.join("\n"));
  const parsedCatalog = parseRequiredCatalog(options.catalog);
  if (!parsedCatalog.ok) throw new Error(parsedCatalog.errors.join("\n"));
  const run = structuredClone(parsedRun.value);
  const expectedIdentity =
    options.stage === "final"
      ? options.identityEvidence.mainCommit
      : run.candidate.developCommit;
  if (!expectedIdentity) {
    throw new Error(`${options.stage}: expected candidate identity is missing`);
  }
  if (options.identityEvidence.decision !== "pass") {
    throw new Error(
      `deployment identity blocked: ${
        options.identityEvidence.blockingReasons?.join("; ") ?? "missing PASS decision"
      }`,
    );
  }

  let additions: ScenarioResult[] = [];
  for (const fragmentInput of options.fragments) {
    const { path } = fragmentInput;
    const parsedFragment = parseEvidenceFragment(fragmentInput.value, path);
    if (!parsedFragment.ok) throw new Error(parsedFragment.errors.join("\n"));
    const value = parsedFragment.value;
    if (
      (options.stage === "pre-merge" && value.environment === "production") ||
      (options.stage === "final" && value.environment !== "production")
    ) {
      throw new Error(`${path}: environment is invalid for ${options.stage}`);
    }
    if (value.candidateIdentity !== expectedIdentity) {
      throw new Error(
        `${path}: fragment candidate ${value.candidateIdentity} does not match ${expectedIdentity}`,
      );
    }
    additions = mergeUniqueResults(additions, value.results);
  }

  if (options.stage === "pre-merge") {
    if (!options.preMergeEvidence) {
      throw new Error("pre-merge evidence input is required");
    }
    if (
      options.preMergeEvidence.manualResult.scenarioId !==
        "release.manual-arcs" ||
      options.preMergeEvidence.manualResult.environment !== "preview"
    ) {
      throw new Error(
        "preMergeEvidence.manualResult must be release.manual-arcs/preview",
      );
    }
    const normalizedSidecars = normalizeSidecars(
      options.journeySidecars ?? [],
      run.runId,
    );
    additions = additions.map(
      (result) =>
        normalizedSidecars.get(
          `${result.scenarioId}\u0000${result.environment}`,
        ) ?? result,
    );
    for (const [resultKey, result] of normalizedSidecars) {
      if (
        !additions.some(
          (candidate) =>
            `${candidate.scenarioId}\u0000${candidate.environment}` ===
            resultKey,
        )
      ) {
        additions.push(result);
      }
    }
    additions = mergeUniqueResults(additions, [
      options.preMergeEvidence.manualResult,
    ]);
    run.results = additions;
    run.exploratoryCharters = options.preMergeEvidence.exploratoryCharters;
    run.manualObligations = options.preMergeEvidence.manualObligations;
    const previewIdentity = options.identityEvidence.preview?.commitSha;
    if (previewIdentity !== run.candidate.developCommit) {
      throw new Error(
        `preview identity ${previewIdentity ?? "missing"} does not match develop commit`,
      );
    }
    run.candidate.previewIdentity = previewIdentity;
  } else {
    const mainCommit = options.identityEvidence.mainCommit;
    const mainTreeDigest = options.identityEvidence.mainTreeDigest;
    const production = options.identityEvidence.production;
    if (!mainCommit || !mainTreeDigest || !production?.commitSha) {
      throw new Error("final identity evidence is incomplete");
    }
    if (production.environment !== "production") {
      throw new Error("final identity evidence is not for production");
    }
    run.candidate.mainCommit = mainCommit;
    run.candidate.mainTreeDigest = mainTreeDigest;
    run.candidate.productionIdentity = production.commitSha;
    run.candidate.productionUrl =
      run.candidate.productionUrl ??
      (() => {
        throw new Error("final run candidate is missing productionUrl");
      })();
    run.rollbackReference = options.rollbackReference ?? run.rollbackReference;
    run.results = mergeProductionObservations(
      run.results,
      additions,
      parsedCatalog.value,
    );
  }

  run.obligations = run.obligations.map((obligation) => ({
    ...obligation,
    status:
      run.results.find(
        (result) =>
          result.scenarioId === obligation.scenarioId &&
          result.environment === obligation.environment,
      )
        ?.status ?? "pending",
  }));
  const validated = parseReleaseRun(run);
  if (!validated.ok) throw new Error(validated.errors.join("\n"));
  const manifest: EvidenceManifest = {
    schemaVersion: 1,
    runId: run.runId,
    stage: options.stage,
    candidate: run.candidate,
    results: run.results,
    exploratoryCharters: run.exploratoryCharters,
    manualObligations: run.manualObligations,
    exceptions: run.exceptions,
    rollbackReference: run.rollbackReference,
    tagAuthorization: run.tagAuthorization,
  };
  return { run, manifest };
}

type CliValues = {
  stage: "pre-merge" | "final";
  run: string;
  catalog: string;
  fragments: string[];
  journeySidecars: string[];
  preMergeEvidence?: string;
  identityEvidence: string;
  output: string;
  manifestOutput: string;
  productionUrl?: string;
  rollbackReference?: string;
};

function parseArgs(argv: string[]): CliValues {
  const values = new Map<string, string[]>();
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--") continue;
    const name = argv[index];
    const value = argv[index + 1];
    if (!name?.startsWith("--") || !value) {
      throw new Error(`invalid argument: ${name ?? ""}`);
    }
    values.set(name, [...(values.get(name) ?? []), value]);
    index += 1;
  }
  const one = (name: string, required = true) => {
    const value = values.get(name)?.at(-1);
    if (required && !value) throw new Error(`missing required argument ${name}`);
    return value;
  };
  const stage = one("--stage");
  if (stage !== "pre-merge" && stage !== "final") {
    throw new Error("--stage must be pre-merge or final");
  }
  return {
    stage,
    run: one("--run")!,
    catalog: one("--catalog", false) ?? "quality/release-required.json",
    fragments: values.get("--fragment") ?? [],
    journeySidecars: values.get("--journey-sidecar") ?? [],
    preMergeEvidence: one("--pre-merge-evidence", false),
    identityEvidence: one("--identity-evidence")!,
    output: one("--output")!,
    manifestOutput: one("--manifest-output")!,
    productionUrl: one("--production-url", false),
    rollbackReference: one("--rollback-reference", false),
  };
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

export function main(): void {
  const cli = parseArgs(process.argv.slice(2));
  const parsedRun = parseReleaseRun(readJson(cli.run));
  if (!parsedRun.ok) throw new Error(parsedRun.errors.join("\n"));
  const run = parsedRun.value;
  if (cli.productionUrl) run.candidate.productionUrl = cli.productionUrl;
  const parsedCatalog = parseRequiredCatalog(readJson(cli.catalog));
  if (!parsedCatalog.ok) throw new Error(parsedCatalog.errors.join("\n"));
  const fragments = cli.fragments.map((path) => {
    const parsed = parseEvidenceFragment(readJson(path), path);
    if (!parsed.ok) throw new Error(parsed.errors.join("\n"));
    return { path, value: parsed.value };
  });
  const merged = mergeReleaseEvidence({
    stage: cli.stage,
    run,
    catalog: parsedCatalog.value,
    fragments,
    journeySidecars: cli.journeySidecars.map((path) => ({
      path,
      value: readJson(path) as JourneySidecar,
    })),
    preMergeEvidence: cli.preMergeEvidence
      ? (readJson(cli.preMergeEvidence) as PreMergeEvidence)
      : undefined,
    identityEvidence: readJson(cli.identityEvidence) as IdentityEvidence,
    rollbackReference: cli.rollbackReference,
  });
  writeFileSync(cli.output, `${JSON.stringify(merged.run, null, 2)}\n`);
  writeFileSync(
    cli.manifestOutput,
    `${JSON.stringify(merged.manifest, null, 2)}\n`,
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
