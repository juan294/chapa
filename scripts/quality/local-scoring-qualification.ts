/** Local-only bootstrap/launcher. No Docker actions, remote deployment or production credentials. */
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { lstatSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { qualificationBuildEnvironment, assertNoImplicitBuildEnvironment, assertUntrackedEvidenceOutput, verifyLocalBuildManifest } from "./candidate-artifact-manifest";

export const QUALIFICATION_SESSION_SECRET = "local-scoring-qualification-session-secret-only-0123456789abcdef";
const SUPABASE_ORIGIN = "http://127.0.0.1:55331";
const REDIS_ORIGIN = "http://127.0.0.1:56380";
function serviceTarget(value: string | undefined, expected: string) {
  if (value !== expected) throw new Error("Qualification target must be the explicitly dedicated loopback disposable service");
  return value;
}
export function qualificationRuntimeEnvironment(root: string, evidenceDir: string, source: Record<string, string | undefined>, port = 3217): NodeJS.ProcessEnv {
  if (source.REDESIGN_DISPOSABLE_PROJECT !== "chapa-redesign") throw new Error("Disposable fixture acknowledgment required");
  const supabase = serviceTarget(source.SUPABASE_URL, SUPABASE_ORIGIN), redis = serviceTarget(source.UPSTASH_REDIS_REST_URL, REDIS_ORIGIN);
  if (!source.SUPABASE_SERVICE_ROLE_KEY?.trim() || !source.UPSTASH_REDIS_REST_TOKEN?.trim()) throw new Error("Dedicated local service credentials required");
  if (!Number.isSafeInteger(port) || port < 1024 || port > 65535 || [55331, 55332, 56379, 56380].includes(port)) throw new Error("Invalid local application port");
  return { ...qualificationBuildEnvironment(source), SUPABASE_URL: supabase, SUPABASE_SERVICE_ROLE_KEY: source.SUPABASE_SERVICE_ROLE_KEY,
    UPSTASH_REDIS_REST_URL: redis, UPSTASH_REDIS_REST_TOKEN: source.UPSTASH_REDIS_REST_TOKEN,
    NEXTAUTH_SECRET: QUALIFICATION_SESSION_SECRET, CHAPA_VERIFICATION_SECRET: "local-scoring-qualification-verification-only-0123456789abcdef",
    GITHUB_CLIENT_ID: "local-scoring-qualification-client", GITHUB_CLIENT_SECRET: "local-scoring-qualification-client-secret",
    ADMIN_HANDLES: ["en", "es"].flatMap(locale => ["light", "dark"].flatMap(theme => ["desktop", "mobile"].map(device => `chapa-redesign-${locale}-${theme}-${device}`))).join(","),
    GITHUB_TOKEN: "redesign-local-fixture", CRON_SECRET: "local-scoring-qualification-cron-only",
    NEXT_PUBLIC_BASE_URL: `http://127.0.0.1:${port}`, REDESIGN_DISPOSABLE_PROJECT: "chapa-redesign",
    REDESIGN_FIXTURE_FILE: join(evidenceDir, "upstream-fixtures.json"), REDESIGN_UPSTREAM_AUDIT: join(evidenceDir, "unexpected-upstream.log"),
    REDESIGN_EVIDENCE_DIR: join(evidenceDir, "browser", "redesign"), E2E_PRO_RUN_ID: "redesign",
    EXPECTED_DEPLOYMENT_ENV: "local", RELEASE_VERIFICATION_MODE: "local-candidate", PLAYWRIGHT_BASE_URL: `http://127.0.0.1:${port}`,
    ...(source.RELEASE_BUILD_MANIFEST ? { RELEASE_BUILD_MANIFEST: resolve(root, source.RELEASE_BUILD_MANIFEST) } : {}),
  };
}
/** NX avoids replacing another fixture run. A partial seed rolls back only its own successful inserts. */
export async function seedQualificationCache(url: string, credential: string, cache: Record<string, string>, send: typeof fetch = fetch) {
  serviceTarget(url, REDIS_ORIGIN);
  if (!credential.trim()) throw new Error("Local cache credential required");
  const keys = Object.keys(cache);
  if (!keys.length || keys.some(key => !key || typeof cache[key] !== "string")) throw new Error("Invalid fixture cache seed");
  const request = async (path: string, command: unknown) => {
    const result = await send(`${url}${path}`, { method: "POST", redirect: "error", headers: { Authorization: `Bearer ${credential}`, "Content-Type": "application/json" }, body: JSON.stringify(command) });
    if (!result.ok) throw new Error(`Local Redis fixture request failed (${result.status})`);
    return result.json() as Promise<unknown>;
  };
  const inserted: string[] = [];
  const cleanup = async () => {
    if (!inserted.length) return;
    const result = await request("", ["del", ...inserted]);
    if (!result || typeof result !== "object" || "error" in result) throw new Error("Local Redis fixture cleanup failed");
    inserted.length = 0;
  };
  let responseKnown = false;
  try {
    const result = await request("/pipeline", keys.map(key => ["set", key, cache[key], "nx", "ex", 86400]));
    if (!Array.isArray(result) || result.length !== keys.length) throw new Error("Invalid local Redis seed response");
    responseKnown = true;
    for (let i = 0; i < keys.length; i++) if (result[i]?.result === "OK") inserted.push(keys[i]!);
    if (inserted.length !== keys.length) throw new Error("Refusing existing or failed local Redis seed keys");
    return cleanup;
  } catch (error) {
    try { await cleanup(); } catch { throw new Error("Local Redis seed and cleanup failed; retain the named disposable service for inspection"); }
    if (!responseKnown) throw new Error("Uncertain Redis seed writes; retain the named disposable service for inspection");
    throw error;
  }
}

/** Keep fixture cleanup after the owned server has fully stopped, including evidence-write failures. */
export async function withQualificationServer(child: { kill(signal: NodeJS.Signals): boolean }, exited: Promise<number | null>, recordLaunch: () => Promise<void>) {
  const stop = () => { child.kill("SIGTERM"); };
  process.once("SIGINT", stop); process.once("SIGTERM", stop);
  // Observe spawn failures immediately even while launch evidence is being written.
  void exited.catch(() => {});
  try {
    await recordLaunch();
    const code = await exited;
    if (code !== 0 && code !== null) throw new Error(`Local fixture server exited ${code}`);
  } catch (error) {
    stop();
    await exited.catch(() => {});
    throw error;
  } finally { process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop); }
}

async function recordRemainingCache(environment: NodeJS.ProcessEnv, evidenceDir: string) {
  const keys = new Set<string>();
  let cursor = "0";
  do {
    const response = await fetch(environment.UPSTASH_REDIS_REST_URL!, { method: "POST", redirect: "error", headers: { Authorization: `Bearer ${environment.UPSTASH_REDIS_REST_TOKEN!}`, "Content-Type": "application/json" }, body: JSON.stringify(["scan", cursor, "count", 1000]) });
    const body = await response.json();
    if (!response.ok || !Array.isArray(body.result) || typeof body.result[0] !== "string" || !Array.isArray(body.result[1]) || body.result[1].some((key: unknown) => typeof key !== "string")) throw new Error("Cannot record remaining local Redis keys; retain disposable service");
    cursor = body.result[0];
    for (const key of body.result[1]) keys.add(key);
  } while (cursor !== "0");
  await writeFile(join(evidenceDir, "remaining-cache-keys.json"), `${JSON.stringify({ service: REDIS_ORIGIN, disposition: "dedicated disposable service retained for owner cleanup", keys: [...keys].sort() }, null, 2)}\n`, { mode: 0o600 });
}

/** A sanitized build can cache absent DB flags. Discard only that mutable
 * fetch data after artifact verification; compiled files remain byte-identical.
 */
export function discardQualificationFetchCache(root: string): void {
  let current = resolve(root);
  for (const segment of ["apps", "web", ".next", "cache", "fetch-cache"]) {
    current = join(current, segment);
    let stat;
    try { stat = lstatSync(current); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
    if (stat.isSymbolicLink()) throw new Error("Qualification fetch cache path must not contain a symlink");
    if (!stat.isDirectory()) throw new Error("Qualification fetch cache path must contain only directories");
  }
  rmSync(current, { recursive: true });
}

export async function launchLocalScoringQualification(root: string, evidenceDir: string, source: Record<string, string | undefined>, port = 3217) {
  root = resolve(root); evidenceDir = resolve(evidenceDir);
  assertUntrackedEvidenceOutput(root, join(evidenceDir, "ready.json"));
  assertNoImplicitBuildEnvironment(root);
  const environment = qualificationRuntimeEnvironment(root, evidenceDir, source, port);
  if (!environment.RELEASE_BUILD_MANIFEST) throw new Error("RELEASE_BUILD_MANIFEST is required before launching a qualified server");
  const manifest = verifyLocalBuildManifest(JSON.parse(await readFile(environment.RELEASE_BUILD_MANIFEST, "utf8")), root);
  discardQualificationFetchCache(root);
  await mkdir(evidenceDir, { recursive: true, mode: 0o700 });
  // Fixture helpers read only this explicitly constructed local environment.
  process.env = environment;
  const { bootstrapRedesignFixtures } = await import("../../apps/web/e2e/helpers/redesign-fixtures");
  const { bootstrapScoringPointFixtures } = await import("../../apps/web/e2e/helpers/scoring-point-fixtures");
  const referenceTime = new Date().toISOString();
  const cleanupTasks: (() => Promise<void>)[] = [];
  const cleanup = async () => {
    const failures: unknown[] = [];
    for (const task of cleanupTasks.reverse()) try { await task(); } catch (error) { failures.push(error); }
    cleanupTasks.length = 0;
    await recordRemainingCache(environment, evidenceDir).catch(error => failures.push(error));
    if (failures.length) throw new Error("Qualification fixture cleanup failed; disposable service retained for inspection");
  };
  try {
    const redesign = await bootstrapRedesignFixtures(environment.REDESIGN_FIXTURE_FILE!);
    cleanupTasks.push(redesign.cleanup);
    const scoring = await bootstrapScoringPointFixtures(redesign.db, { referenceTime });
    cleanupTasks.push(scoring.cleanup);
    const upstream = JSON.parse(await readFile(environment.REDESIGN_FIXTURE_FILE!, "utf8"));
    upstream.qualificationHealth = true;
    // Redis is real. This file contains provider replay only; the legacy in-memory cache branch stays unused.
    const cache = { ...upstream.cache, ...scoring.cache };
    upstream.cache = {};
    // Use the same captured raw ancillary dataset as the scoring stats seed.
    const { buildRedesignGitHubFixture } = await import("../../apps/web/e2e/helpers/redesign-github");
    for (const handle of Object.keys(scoring.publicManifest.owners)) upstream.github[handle] = buildRedesignGitHubFixture(handle, referenceTime).response;
    await writeFile(environment.REDESIGN_FIXTURE_FILE!, JSON.stringify(upstream), { mode: 0o600 });
    cleanupTasks.push(await seedQualificationCache(environment.UPSTASH_REDIS_REST_URL!, environment.UPSTASH_REDIS_REST_TOKEN!, cache));
    const preload = join(root, "apps/web/e2e/helpers/redesign-upstream.mjs");
    const child = spawn(process.execPath, ["--import", preload, join(root, "apps/web/node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", String(port)], { cwd: join(root, "apps/web"), env: environment, stdio: "inherit" });
    const exited = new Promise<number | null>((resolveExit, reject) => { child.once("error", reject); child.once("exit", resolveExit); });
    const ready = { schemaVersion: 1, environment: "local", source: { commit: manifest.commit, treeDigest: manifest.treeDigest },
      baseUrl: environment.PLAYWRIGHT_BASE_URL, services: { supabase: SUPABASE_ORIGIN, redis: REDIS_ORIGIN },
      providerEvidence: "synthetic known fixtures; unexpected external requests denied", fixtures: scoring.publicManifest };
    // A launch manifest is not a claim that health/browser qualification has passed.
    await withQualificationServer(child, exited, async () => {
      await writeFile(join(evidenceDir, "ready.json"), `${JSON.stringify(ready, null, 2)}\n`, { mode: 0o600 });
      console.log(JSON.stringify({ stage: "local-fixture-server-started", baseUrl: environment.PLAYWRIGHT_BASE_URL, manifest: join(evidenceDir, "ready.json") }));
    });
  } finally { await cleanup(); }
}
if (typeof require !== "undefined" && typeof module !== "undefined" && require.main === module) {
  const argument = (key: string) => { const index = process.argv.indexOf(key); return index >= 0 ? process.argv[index + 1] : undefined; };
  const root = argument("--root"), evidenceDir = argument("--evidence-dir");
  if (!root || !evidenceDir) { console.error("Usage: local-scoring-qualification.ts --root ROOT --evidence-dir IGNORED_DIR [--port 3217]"); process.exitCode = 1; }
  else launchLocalScoringQualification(root, evidenceDir, process.env, Number(argument("--port") ?? 3217)).catch(() => {
    console.error("Local scoring qualification launcher failed; inspect local service/test diagnostics (credentials omitted)"); process.exitCode = 1;
  });
}
