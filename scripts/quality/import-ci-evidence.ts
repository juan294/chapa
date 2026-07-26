import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

export type ArtifactContract = {
  schemaVersion: 1;
  ciArtifacts: Array<{
    slug: string;
    basename: string;
    required: boolean;
    protectedJob: string | null;
    mergeFragment: boolean;
  }>;
  journeySidecarBasename: string;
  buildArtifactSlug: string;
};

type ImportOptions = {
  source: Record<string, unknown>;
  jobs: Array<Record<string, unknown>>;
  inventory: Array<Record<string, unknown>>;
  contract: ArtifactContract;
  artifactsRoot: string;
  runId: string;
  runAttempt: string;
  developCommit: string;
  repository: string;
};

function json(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function files(root: string): string[] {
  try {
    return readdirSync(root, { recursive: true })
      .map((file) => join(root, String(file)))
      .filter((file) => statSync(file).isFile())
      .sort();
  } catch {
    return [];
  }
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function parseArtifactContract(value: unknown): ArtifactContract {
  const raw = record(value);
  if (raw.schemaVersion !== 1 || !Array.isArray(raw.ciArtifacts)) {
    throw new Error("artifact contract: unsupported or malformed contract");
  }
  const ciArtifacts = raw.ciArtifacts.map((value, index) => {
    const artifact = record(value);
    if (
      typeof artifact.slug !== "string" ||
      !artifact.slug ||
      typeof artifact.basename !== "string" ||
      !artifact.basename ||
      typeof artifact.required !== "boolean" ||
      !(
        artifact.protectedJob === null ||
        (typeof artifact.protectedJob === "string" && artifact.protectedJob)
      ) ||
      typeof artifact.mergeFragment !== "boolean"
    ) {
      throw new Error(`artifact contract: ciArtifacts[${index}] is malformed`);
    }
    return {
      slug: artifact.slug,
      basename: artifact.basename,
      required: artifact.required,
      protectedJob: artifact.protectedJob as string | null,
      mergeFragment: artifact.mergeFragment,
    };
  });
  const slugs = ciArtifacts.map((artifact) => artifact.slug);
  const basenames = ciArtifacts.map((artifact) => artifact.basename);
  if (new Set(slugs).size !== slugs.length) {
    throw new Error("artifact contract: duplicate artifact slug");
  }
  if (new Set(basenames).size !== basenames.length) {
    throw new Error("artifact contract: duplicate artifact basename");
  }
  if (
    typeof raw.journeySidecarBasename !== "string" ||
    !raw.journeySidecarBasename ||
    typeof raw.buildArtifactSlug !== "string" ||
    !raw.buildArtifactSlug
  ) {
    throw new Error("artifact contract: sidecar or build artifact name is missing");
  }
  return {
    schemaVersion: 1,
    ciArtifacts,
    journeySidecarBasename: raw.journeySidecarBasename,
    buildArtifactSlug: raw.buildArtifactSlug,
  };
}

export function validateCiEvidenceImport(options: ImportOptions) {
  const blockers: string[] = [];
  const requiredJobs = options.contract.ciArtifacts
    .map((artifact) => artifact.protectedJob)
    .filter((name): name is string => Boolean(name));
  const selectedJobs = requiredJobs.map((name) => {
    const job = options.jobs.find((candidate) => candidate.name === name);
    const conclusion = String(job?.conclusion ?? "missing");
    if (conclusion !== "success") blockers.push(`job ${name}: ${conclusion}`);
    return {
      name,
      databaseId: job?.id ?? null,
      conclusion,
      htmlUrl: job?.html_url ?? null,
      startedAt: job?.started_at ?? null,
      completedAt: job?.completed_at ?? null,
    };
  });

  const imported = options.contract.ciArtifacts.map((artifactContract) => {
    const artifactName =
      `release-evidence-${options.runId}-${options.runAttempt}-` +
      artifactContract.slug;
    const matchingMetadata = options.inventory.filter(
      (artifact) => artifact.name === artifactName,
    );
    const metadata =
      matchingMetadata.length === 1 ? matchingMetadata[0] : undefined;
    const directory = join(options.artifactsRoot, artifactContract.slug);
    const jsonFiles = files(directory).filter((file) => file.endsWith(".json"));
    const matchingFiles = jsonFiles.filter(
      (file) => basename(file) === artifactContract.basename,
    );
    let status = "missing";
    let reason = metadata
      ? `artifact must contain exactly one ${artifactContract.basename}`
      : matchingMetadata.length > 1
        ? "artifact metadata is duplicated"
        : "artifact is absent";
    let candidateIdentity: unknown = null;
    if (metadata?.expired) {
      status = "failed";
      reason = "artifact is expired";
    } else if (metadata && matchingFiles.length === 1) {
      const fragment = record(json(matchingFiles[0]!));
      const source = record(fragment.source);
      candidateIdentity = fragment.candidateIdentity ?? source.commitSha ?? null;
      const fragmentRunId = fragment.runId ?? source.workflowRunId ?? null;
      const fragmentAttempt =
        source.workflowRunAttempt ?? options.runAttempt;
      const results = Array.isArray(fragment.results)
        ? fragment.results.map(record)
        : [];
      const statuses = results.length
        ? results.map((result) => result.status)
        : [fragment.status];
      status =
        statuses.length > 0 && statuses.every((value) => value === "passed")
          ? "passed"
          : statuses.includes("skipped")
            ? "skipped"
            : "failed";
      reason = `normalized fragment status is ${status}`;
      if (String(fragmentRunId) !== options.runId) {
        status = "failed";
        reason = `fragment run ${fragmentRunId} does not match ${options.runId}`;
      } else if (String(fragmentAttempt) !== options.runAttempt) {
        status = "failed";
        reason =
          `fragment attempt ${fragmentAttempt} does not match ` +
          options.runAttempt;
      } else if (candidateIdentity !== options.developCommit) {
        status = "failed";
        reason =
          `fragment candidate ${candidateIdentity} does not match ` +
          options.developCommit;
      }
    }
    if (artifactContract.required && status !== "passed") {
      blockers.push(`artifact ${artifactName}: ${reason}`);
    }
    return {
      slug: artifactContract.slug,
      name: artifactName,
      artifactId: metadata?.id ?? null,
      digest: metadata?.digest ?? null,
      archiveDownloadUrl: metadata?.archive_download_url ?? null,
      expired: metadata?.expired ?? null,
      required: artifactContract.required,
      status,
      reason,
      candidateIdentity,
      files: jsonFiles,
      selectedFile: matchingFiles.length === 1 ? matchingFiles[0] : null,
    };
  });

  const expectedBuildArtifactName =
    `${options.contract.buildArtifactSlug}-${options.runId}-` +
    options.runAttempt;
  const matchingBuildArtifacts = options.inventory.filter(
    (artifact) => artifact.name === expectedBuildArtifactName,
  );
  const buildArtifact =
    matchingBuildArtifacts.length === 1 ? matchingBuildArtifacts[0]! : null;
  if (matchingBuildArtifacts.length === 0) {
    blockers.push(`build artifact ${expectedBuildArtifactName} is missing`);
  } else if (matchingBuildArtifacts.length > 1) {
    blockers.push(`build artifact ${expectedBuildArtifactName} is duplicated`);
  } else if (buildArtifact?.expired) {
    blockers.push(`build artifact ${expectedBuildArtifactName} is expired`);
  }
  if (options.source.head_sha !== options.developCommit) {
    blockers.push(
      `CI run SHA ${options.source.head_sha} does not match ${options.developCommit}`,
    );
  }
  if (String(options.source.id) !== options.runId) {
    blockers.push(`CI source run ${options.source.id} does not match selected run`);
  }
  if (String(options.source.run_attempt) !== options.runAttempt) {
    blockers.push(
      `CI source attempt ${options.source.run_attempt} does not match selected attempt`,
    );
  }

  return {
    schemaVersion: 1,
    repository: options.repository,
    developCommit: options.developCommit,
    workflowRunId: options.runId,
    workflowRunAttempt: options.runAttempt,
    workflowConclusion: options.source.conclusion,
    jobs: selectedJobs,
    artifacts: imported,
    buildArtifact: buildArtifact
      ? {
          artifactId: buildArtifact.id,
          name: buildArtifact.name,
          digest: buildArtifact.digest ?? null,
          archiveDownloadUrl: buildArtifact.archive_download_url,
          expired: buildArtifact.expired,
          createdAt: buildArtifact.created_at,
          expiresAt: buildArtifact.expires_at,
        }
      : null,
    decision: blockers.length ? "blocked" : "pass",
    blockingReasons: blockers,
    generatedAt: new Date().toISOString(),
  };
}

function argument(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error(`missing required argument ${name}`);
  return value;
}

function main(): void {
  const source = record(json(argument("--source")));
  const jobsRaw = record(json(argument("--jobs")));
  const inventoryRaw = record(json(argument("--inventory")));
  const contract = parseArtifactContract(json(argument("--contract")));
  const summary = validateCiEvidenceImport({
    source,
    jobs: Array.isArray(jobsRaw.jobs) ? jobsRaw.jobs.map(record) : [],
    inventory: Array.isArray(inventoryRaw.artifacts)
      ? inventoryRaw.artifacts.map(record)
      : [],
    contract,
    artifactsRoot: argument("--artifacts-root"),
    runId: argument("--run-id"),
    runAttempt: argument("--run-attempt"),
    developCommit: argument("--develop-commit"),
    repository: argument("--repository"),
  });
  writeFileSync(
    argument("--output"),
    `${JSON.stringify(summary, null, 2)}\n`,
  );
  if (summary.decision !== "pass") {
    throw new Error(summary.blockingReasons.join("\n"));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
