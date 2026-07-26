import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, isAbsolute, posix } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseReleaseRun,
  parseRequiredCatalog,
  type ReleaseRun,
  type RequiredCatalog,
} from "./contracts";

export interface PrepareOptions {
  baselineTag: string;
  developCommit: string;
  candidateTree: string;
  previewUrl: string;
  runId: string;
  output: string;
  resume?: boolean;
}

const IMMUTABLE_REF = /^(?:v?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?|[0-9a-f]{40})$/;
const DIGEST = /^[0-9a-f]{40}$/;
const RUN_ID = /^[0-9A-Za-z][0-9A-Za-z._-]*$/;

export function validatePrepareOptions(
  raw: Record<string, unknown>,
): string[] {
  const errors: string[] = [];
  if (
    typeof raw.baselineTag !== "string" ||
    !IMMUTABLE_REF.test(raw.baselineTag)
  ) {
    errors.push("baselineTag: expected an immutable semantic-version tag or 40-character commit");
  }
  if (
    typeof raw.developCommit !== "string" ||
    !DIGEST.test(raw.developCommit)
  ) {
    errors.push("developCommit: expected a lowercase 40-character commit");
  }
  if (
    typeof raw.candidateTree !== "string" ||
    !DIGEST.test(raw.candidateTree)
  ) {
    errors.push("candidateTree: expected a lowercase 40-character tree digest");
  }
  if (typeof raw.runId !== "string" || !RUN_ID.test(raw.runId)) {
    errors.push("runId: expected a stable path-safe identifier");
  }
  if (typeof raw.previewUrl !== "string") {
    errors.push("previewUrl: expected a URL");
  } else {
    try {
      const url = new URL(raw.previewUrl);
      const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
      if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
        errors.push("previewUrl: HTTPS is required outside localhost");
      }
    } catch {
      errors.push("previewUrl: expected a valid URL");
    }
  }
  if (typeof raw.output !== "string" || isAbsolute(String(raw.output))) {
    errors.push("output: expected a repository-relative evidence-run path");
  } else {
    const normalized = posix.normalize(raw.output.replaceAll("\\", "/"));
    if (
      normalized !== raw.output ||
      !normalized.startsWith("quality/evidence/runs/") ||
      normalized === "quality/evidence/runs/"
    ) {
      errors.push("output: must remain under quality/evidence/runs/");
    }
  }
  return errors;
}

export function prepareReleaseRun(
  catalog: RequiredCatalog,
  options: Omit<PrepareOptions, "resume">,
  generatedAt = new Date().toISOString(),
): ReleaseRun {
  const errors = validatePrepareOptions(options);
  if (errors.length) {
    throw new Error(errors.join("\n"));
  }
  return {
    schemaVersion: 1,
    runId: options.runId,
    generatedAt,
    baselineTag: options.baselineTag,
    candidate: {
      developCommit: options.developCommit,
      candidateTreeDigest: options.candidateTree,
      previewUrl: new URL(options.previewUrl).toString(),
    },
    obligations: catalog.scenarios.flatMap((scenario) =>
      scenario.environments.map((environment) => ({
        scenarioId: scenario.id,
        required: scenario.required,
        environment,
        status: "pending" as const,
      })),
    ),
    results: [],
    exceptions: [],
    manualObligations: [],
    exploratoryCharters: [],
    rollbackReference: "docs/runbooks/rollback.md",
    tagAuthorization: { status: "pending" },
  };
}

function parseArgs(argv: string[]): PrepareOptions {
  const values: Record<string, string | boolean> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]!;
    if (argument === "--") {
      continue;
    }
    if (argument === "--resume") {
      values.resume = true;
      continue;
    }
    if (!argument.startsWith("--") || !argv[index + 1]) {
      throw new Error(`invalid argument: ${argument}`);
    }
    values[argument.slice(2)] = argv[index + 1]!;
    index += 1;
  }
  return {
    baselineTag: String(values["baseline-tag"] ?? ""),
    developCommit: String(values["develop-commit"] ?? ""),
    candidateTree: String(values["candidate-tree"] ?? ""),
    previewUrl: String(values["preview-url"] ?? ""),
    runId: String(values["run-id"] ?? ""),
    output: String(values.output ?? ""),
    resume: values.resume === true,
  };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const errors = validatePrepareOptions(options);
  if (errors.length) throw new Error(errors.join("\n"));
  const catalogRaw = JSON.parse(
    await readFile("quality/release-required.json", "utf8"),
  ) as unknown;
  const parsedCatalog = parseRequiredCatalog(catalogRaw);
  if (!parsedCatalog.ok) throw new Error(parsedCatalog.errors.join("\n"));

  const run = prepareReleaseRun(parsedCatalog.value, options);
  if (existsSync(options.output)) {
    if (!options.resume) {
      throw new Error(`${options.output}: run already exists; use --resume`);
    }
    const existingRaw = JSON.parse(await readFile(options.output, "utf8")) as unknown;
    const existing = parseReleaseRun(existingRaw);
    if (
      !existing.ok ||
      existing.value.runId !== run.runId ||
      existing.value.candidate.developCommit !== run.candidate.developCommit ||
      existing.value.candidate.candidateTreeDigest !==
        run.candidate.candidateTreeDigest
    ) {
      throw new Error(`${options.output}: cannot resume a different candidate`);
    }
    console.log(`Resuming release evidence run: ${options.output}`);
    return;
  }
  if (existsSync(dirname(options.output))) {
    throw new Error(
      `${dirname(options.output)}: run directory already exists without a resumable manifest`,
    );
  }
  await mkdir(dirname(options.output), { recursive: true });
  await writeFile(options.output, `${JSON.stringify(run, null, 2)}\n`, "utf8");
  console.log(`Prepared release evidence run: ${options.output}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
