#!/usr/bin/env tsx
/** Run the large-source contract benchmark against a disposable local Supabase stack. */
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const config = readFileSync("supabase/config.toml", "utf8");
const project = config.match(/^project_id = "([^"]+)"$/m)?.[1];
const apiPort = config.match(/^\[api\][\s\S]*?^port = (\d+)$/m)?.[1];
if (!project?.startsWith("chapa-volume-") || !apiPort || apiPort === "54331") {
  throw new Error("Benchmark requires a task-owned chapa-volume-* Supabase project on a distinct API port");
}

const status = spawnSync("supabase", ["status", "--output", "json"], { encoding: "utf8", timeout: 30_000 });
if (status.status !== 0 || !status.stdout) throw new Error("Task-owned local Supabase is not running");
const endpoint = new URL((JSON.parse(status.stdout) as { API_URL: string }).API_URL);
if (endpoint.protocol !== "http:" || endpoint.hostname !== "127.0.0.1" || endpoint.port !== apiPort) {
  throw new Error("Local Supabase API does not match the task-owned config");
}

const counts = process.env.SCORING_BENCHMARK_COUNTS ?? "100,17572,50000,100000";
if (!/^\d+(,\d+)*$/.test(counts)) throw new Error("SCORING_BENCHMARK_COUNTS must be comma-separated integers");
const evidenceDir = resolve(process.env.SCORING_BENCHMARK_EVIDENCE_DIR
  ?? "docs/plans/2026-09-26-high-volume-badge-collection-phases/evidence/phase-1");
mkdirSync(evidenceDir, { recursive: true });

console.log(`Benchmarking ${counts} synthetic events against disposable ${project} (${endpoint.origin})`);
const result = spawnSync("pnpm", ["exec", "tsx", "scripts/test-contract-local.ts", "apps/web/lib/db/collection-benchmark.contract.test.ts"], {
  stdio: "inherit",
  env: { ...process.env, SCORING_BENCHMARK_COUNTS: counts, SCORING_BENCHMARK_EVIDENCE_DIR: evidenceDir },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
