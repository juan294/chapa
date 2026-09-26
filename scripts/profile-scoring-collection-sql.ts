#!/usr/bin/env tsx
/**
 * Profile the current SQL finish stages against a synthetic, staged local job.
 * Each EXPLAIN ANALYZE runs in its own transaction. PostgreSQL rolls that
 * transaction back even when a statement timeout terminates psql early.
 *
 * Usage:
 *   pnpm exec tsx scripts/profile-scoring-collection-sql.ts --metadata /absolute/path/to/count-N-profile.json --output /absolute/path/to/evidence/phase-1/count-N-sql-profile.json
 *
 * The metadata file is the benchmark's count-N-profile.json artifact.
 * It must describe a staged job owned by a contract-volume-N handle in the separate
 * chapa-volume-20260926 local Supabase project. Do not run this against a
 * shared stack while another process is staging or finishing the same job.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const projectId = "chapa-volume-20260926";
const container = `supabase_db_${projectId}`;
const jobIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const parityTimeout = "8s";
const setupTimeout = "120s";
const evidenceDir = resolve(root, "docs/plans/2026-09-26-high-volume-badge-collection-phases/evidence/phase-1");

type JsonObject = Record<string, unknown>;
type Metadata = {
  count: number;
  seed: number;
  owner: string;
  jobId: string;
  source: JsonObject;
  requested: JsonObject;
  scope: JsonObject;
  window: JsonObject;
  coverage: JsonObject;
  accessContextId: string;
};

export function object(value: unknown, name: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${name} must be a JSON object`);
  return value as JsonObject;
}

export function string(value: unknown, name: string): string {
  if (typeof value !== "string" || !value) throw new Error(`${name} must be a nonempty string`);
  return value;
}

export function parseArgs(args: string[]): { metadataPath: string; outputPath: string | null } | null {
  if (args.length === 1 && (args[0] === "--help" || args[0] === "-h")) return null;
  if (![2, 4].includes(args.length) || args[0] !== "--metadata" || !args[1] || !isAbsolute(args[1])
    || (args.length === 4 && (args[2] !== "--output" || !args[3] || !isAbsolute(args[3])))) {
    throw new Error("Usage: pnpm exec tsx scripts/profile-scoring-collection-sql.ts --metadata /absolute/path/to/count-N-profile.json [--output /absolute/path/to/evidence/phase-1/count-N-sql-profile.json]");
  }
  const outputPath = args[3] ? resolve(args[3]) : null;
  if (outputPath && (dirname(outputPath) !== evidenceDir || !outputPath.endsWith(".json"))) {
    throw new Error(`Profile output must be a JSON file directly under ${evidenceDir}`);
  }
  return { metadataPath: args[1], outputPath };
}

export function parseMetadata(path: string): Metadata {
  const value = object(JSON.parse(readFileSync(path, "utf8")), "metadata");
  const keys = Object.keys(value).sort();
  if (JSON.stringify(keys) !== JSON.stringify(["accessContextId", "count", "coverage", "jobId", "owner", "requested", "scope", "seed", "source", "window"])) {
    throw new Error("Metadata must be an unmodified count-N-profile.json benchmark artifact");
  }
  const count = Number(value.count);
  const seed = Number(value.seed);
  if (!Number.isSafeInteger(count) || count < 1 || count > 100_000 || !Number.isSafeInteger(seed) || seed < 0) {
    throw new Error("Metadata count/seed are invalid");
  }
  const owner = string(value.owner, "owner");
  if (owner !== `contract-volume-${count}`) throw new Error("Only synthetic contract-volume-N owners are accepted");
  const jobId = string(value.jobId, "jobId");
  if (!jobIdPattern.test(jobId)) throw new Error("jobId must be a UUID");
  const source = object(value.source, "source");
  const requested = object(value.requested, "requested");
  const scope = object(value.scope, "scope");
  const window = object(value.window, "window");
  const coverage = object(value.coverage, "coverage");
  const accessContextId = string(value.accessContextId, "accessContextId");
  if (!/^[a-f0-9]{64}$/.test(accessContextId)) throw new Error("accessContextId must be a synthetic 64-character lowercase hex value");
  if (typeof source.provider !== "string" || typeof source.host !== "string" || typeof source.subjectId !== "string") {
    throw new Error("source must have provider, host, subjectId");
  }
  if (requested.provider !== source.provider || requested.host !== source.host || requested.login !== owner) {
    throw new Error("requested identity must match source provider/host and synthetic owner");
  }
  if (typeof window.referenceTime !== "string" || typeof window.startInclusive !== "string" || typeof window.endExclusive !== "string") {
    throw new Error("window must have referenceTime, startInclusive, endExclusive");
  }
  if (JSON.stringify(coverage.source) !== JSON.stringify(source) || JSON.stringify(coverage.window) !== JSON.stringify(window)) {
    throw new Error("coverage must contain the same source and window as metadata");
  }
  return { count, seed, owner, jobId, source, requested, scope, window, coverage, accessContextId };
}

export function configValue(config: string, section: string, key: string): string | null {
  const part = config.split(/(?=^\[)/m).find(block => block.split("\n", 1)[0] === `[${section}]`);
  return part?.match(new RegExp(`^${key}\\s*=\\s*(.+)$`, "m"))?.[1]?.trim() ?? null;
}

function assertLocalTarget(): void {
  const config = readFileSync(resolve(root, "supabase/config.toml"), "utf8");
  if (!/^project_id\s*=\s*"chapa-volume-20260926"\s*$/m.test(config.split(/^\[/m)[0] ?? "")
    || configValue(config, "api", "port") !== "55431"
    || configValue(config, "db", "port") !== "55432") {
    throw new Error("Refusing SQL profile: expected disposable Supabase project and loopback ports 55431/55432");
  }
  // All SQL below is sent by `docker exec` to this exact disposable container.
  // Its identity and published local database port are the authority here;
  // `supabase status` can reject a live container while a 2-second health
  // probe is briefly delayed by other local Docker workloads.
  const result = spawnSync("docker", ["ps", "--filter", `name=^/${container}$`, "--format", "{{.Names}}"], { encoding: "utf8", timeout: 20_000 });
  if (result.status !== 0 || result.stdout.trim() !== container) throw new Error(`Refusing SQL profile: ${container} is not the sole configured local database container`);
  const published = spawnSync("docker", ["port", container, "5432/tcp"], { encoding: "utf8", timeout: 20_000 });
  if (published.status !== 0 || !published.stdout.split("\n").some(line => /:55432$/.test(line.trim()))) {
    throw new Error("Refusing SQL profile: configured database container does not publish port 55432");
  }
}

export function sqlLiteral(value: unknown): string {
  return `'${(typeof value === "string" ? value : JSON.stringify(value)).replaceAll("'", "''")}'`;
}

function psql(sql: string): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-f", "-"], {
    input: sql,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    timeout: 180_000,
  });
  if (result.error) throw result.error;
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function inspectJob(metadata: Metadata): { owner: string; count: number } {
  const query = `SELECT json_build_object(
    'owner', j.owner_handle, 'provider', j.provider,
    'referenceTime', j.reference_time,
    'stagedCount', (SELECT count(*) FROM public.scoring_collection_staged_events e WHERE e.job_id=j.id),
    'authenticatorTimeout', (SELECT split_part(setting,'=',2) FROM pg_roles r,
      unnest(r.rolconfig) setting WHERE r.rolname='authenticator' AND setting LIKE 'statement_timeout=%')
  ) FROM public.scoring_collection_jobs j WHERE j.id=${sqlLiteral(metadata.jobId)}::uuid;`;
  const result = psql(query);
  if (result.status !== 0) throw new Error(`Local job inspection failed: ${result.stderr.trim()}`);
  const row = object(JSON.parse(result.stdout.trim()), "job");
  const owner = string(row.owner, "job owner");
  if (owner !== metadata.owner || row.provider !== metadata.source.provider
    || new Date(string(row.referenceTime, "job reference time")).getTime() !== new Date(string(metadata.window.referenceTime, "window reference time")).getTime()) {
    throw new Error("Job must match synthetic metadata owner/provider/reference time");
  }
  if (row.authenticatorTimeout !== parityTimeout) throw new Error(`Expected local PostgREST authenticator timeout ${parityTimeout}; found ${String(row.authenticatorTimeout)}`);
  const count = Number(row.stagedCount);
  if (!Number.isSafeInteger(count) || count < 1) throw new Error("Synthetic job has no staged events");
  return { owner, count };
}

export function payloadSetup(jobId: string): string {
  return `SET LOCAL statement_timeout = '${setupTimeout}';
CREATE TEMP TABLE benchmark_payload ON COMMIT DROP AS
SELECT coalesce(jsonb_agg(event ORDER BY event_key), '[]'::jsonb) AS events
FROM public.scoring_collection_staged_events WHERE job_id=${sqlLiteral(jobId)}::uuid;`;
}

export function checkpointBatchSetup(jobId: string, batchSize: number): string {
  // Clone bodies from the already synthetic job and give them new keys. This
  // models the next checkpoint batch without provider data or external input.
  // The staged-event key is indexed; no synthetic key survives ROLLBACK.
  return `SET LOCAL statement_timeout = '${setupTimeout}';
CREATE TEMP TABLE benchmark_checkpoint_batch ON COMMIT DROP AS
SELECT array_agg(event_key || ':sql-profile-${jobId}' ORDER BY event_key) AS keys,
       array_agg(event ORDER BY event_key) AS events
FROM (
  SELECT event_key, event FROM public.scoring_collection_staged_events
  WHERE job_id=${sqlLiteral(jobId)}::uuid ORDER BY event_key LIMIT ${batchSize}
) existing_batch;`;
}

type StageResult = { status: "ok"; executionMs: number } | { status: "timeout" };

function profile(name: string, setup: string, statement: string): StageResult {
  const sql = `BEGIN;
${setup}
SET LOCAL statement_timeout = '${parityTimeout}';
SELECT 'PROFILE_BEGIN';
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${statement};
SELECT 'PROFILE_END';
ROLLBACK;`;
  const result = psql(sql);
  if (result.status !== 0) {
    if (/canceling statement due to statement timeout/i.test(result.stderr)) {
      console.log(`${name}: TIMEOUT at ${parityTimeout}; transaction rolled back`);
      return { status: "timeout" };
    }
    throw new Error(`${name} failed; transaction rolled back: ${result.stderr.trim()}`);
  }
  const match = result.stdout.match(/PROFILE_BEGIN\s*([\s\S]*?)\s*PROFILE_END/);
  if (!match) throw new Error(`${name}: missing EXPLAIN output`);
  const explain = JSON.parse(match[1]!) as [{ "Execution Time": number }];
  const executionMs = explain[0]?.["Execution Time"];
  if (!Number.isFinite(executionMs)) throw new Error(`${name}: invalid EXPLAIN execution time`);
  console.log(`${name}: ${executionMs} ms`);
  return { status: "ok", executionMs };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (!args) {
    console.log("Usage: pnpm exec tsx scripts/profile-scoring-collection-sql.ts --metadata /absolute/path/to/count-N-profile.json [--output /absolute/path/to/evidence/phase-1/count-N-sql-profile.json]");
    console.log("Metadata: benchmark count-N-profile.json with contract-volume-N owner; disposable local project only.");
    return;
  }
  const metadata = parseMetadata(args.metadataPath);
  assertLocalTarget();
  const job = inspectJob(metadata);
  const id = sqlLiteral(metadata.jobId);
  const source = `${sqlLiteral(metadata.source)}::jsonb`;
  const scope = `${sqlLiteral(metadata.scope)}::jsonb`;
  const window = `${sqlLiteral(metadata.window)}::jsonb`;
  const coverage = `${sqlLiteral(metadata.coverage)}::jsonb`;
  const owner = sqlLiteral(job.owner);
  console.log(`Local SQL profile: ${metadata.jobId}; staged events=${job.count}; parity timeout=${parityTimeout}`);
  console.log("Each stage uses EXPLAIN ANALYZE in an independent rollback transaction. These standalone timings are not additive shares of either RPC.");
  console.log("Payload and modeled checkpoint batch setup are excluded from measured statement timing.");
  const stages: Record<string, StageResult> = {};
  let timedOut = false;
  const record = (name: string, setup: string, statement: string): void => {
    const result = profile(name, setup, statement);
    stages[name] = result;
    if (result.status === "timeout") timedOut = true;
  };
  const batchSize = Math.min(2_000, job.count);
  const batchSetup = checkpointBatchSetup(metadata.jobId, batchSize);
  const modeledInsert = `INSERT INTO public.scoring_collection_staged_events(job_id,event_key,event)
SELECT ${id}::uuid, incoming.event_key, incoming.event
FROM benchmark_checkpoint_batch b
CROSS JOIN LATERAL unnest(b.keys,b.events) AS incoming(event_key,event)
WHERE true
ON CONFLICT (job_id,event_key) DO NOTHING`;
  console.log(`Checkpoint model: ${batchSize} new keys with bodies cloned from existing synthetic staged rows.`);
  record("checkpoint_duplicate_join_new_keys", batchSetup,
    `SELECT EXISTS (
      SELECT 1 FROM benchmark_checkpoint_batch b
      CROSS JOIN LATERAL unnest(b.keys,b.events) AS incoming(event_key,event)
      JOIN public.scoring_collection_staged_events existing
        ON existing.job_id=${id}::uuid AND existing.event_key=incoming.event_key
      WHERE existing.event IS DISTINCT FROM incoming.event
    )`);
  record("checkpoint_insert_modeled_batch", batchSetup, modeledInsert);
  record("checkpoint_count_after_modeled_insert", `${batchSetup}\n${modeledInsert};`,
    `SELECT count(*) FROM public.scoring_collection_staged_events WHERE job_id=${id}::uuid`);
  record("finish_count", "", `SELECT count(*) FROM public.scoring_collection_staged_events WHERE job_id=${id}::uuid`);
  record("finish_ordered_jsonb_agg", "", `SELECT jsonb_agg(event ORDER BY event_key) FROM public.scoring_collection_staged_events WHERE job_id=${id}::uuid`);
  record("source_value_validation", payloadSetup(metadata.jobId),
    `SELECT public.scoring_v7_validate_source_value(${source},${scope},${window},${coverage},jsonb_build_object('events',p.events)) FROM benchmark_payload p`);
  const sourceSetup = `${payloadSetup(metadata.jobId)}
INSERT INTO public.scoring_v7_sources(owner_handle,provider,host,subject_id,access_context_id,declared_scope)
VALUES (${owner},${sqlLiteral(metadata.source.provider)},${sqlLiteral(metadata.source.host)},${sqlLiteral(metadata.source.subjectId)},${sqlLiteral(metadata.accessContextId)},${scope})
ON CONFLICT(owner_handle,provider,host,subject_id,access_context_id) DO NOTHING;`;
  record("observation_insert", sourceSetup,
    `INSERT INTO public.scoring_v7_source_observations(id,source_id,owner_handle,reference_time,window_start,window_end,data_through,coverage,payload)
SELECT gen_random_uuid(),s.id,${owner},(${window}->>'referenceTime')::timestamptz,
  (${window}->>'startInclusive')::timestamptz,(${window}->>'endExclusive')::timestamptz,
  (${coverage}->>'dataThrough')::timestamptz,${coverage},jsonb_build_object('events',p.events)
FROM public.scoring_v7_sources s CROSS JOIN benchmark_payload p
WHERE s.owner_handle=${owner} AND s.provider=${sqlLiteral(metadata.source.provider)}
  AND s.host=${sqlLiteral(metadata.source.host)} AND s.subject_id=${sqlLiteral(metadata.source.subjectId)}
  AND s.access_context_id=${sqlLiteral(metadata.accessContextId)} AND s.declared_scope=${scope}`);
  record("staged_delete", "", `DELETE FROM public.scoring_collection_staged_events WHERE job_id=${id}::uuid`);
  if (args.outputPath) {
    mkdirSync(evidenceDir, { recursive: true });
    writeFileSync(args.outputPath, `${JSON.stringify({
      schemaVersion: 1,
      jobId: metadata.jobId,
      stagedCount: job.count,
      modeledNextBatchCount: batchSize,
      parityTimeoutMs: 8_000,
      standaloneTimings: true,
      stages,
    }, null, 2)}\n`, { mode: 0o600 });
    console.log(`Wrote SQL profile: ${args.outputPath}`);
  }
  if (timedOut) process.exitCode = 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error((error as Error).message); process.exitCode = 1; }
}
