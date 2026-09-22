import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstatSync, existsSync, readFileSync, readdirSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

const SHA = /^[a-f0-9]{40}$/, DIGEST = /^[a-f0-9]{64}$/;
export const REQUIRED_BUILD_ARTIFACTS = ["apps/web/.next/BUILD_ID", "apps/web/.next/build-manifest.json", "apps/web/.next/routes-manifest.json", "apps/web/.next/server/app-paths-manifest.json"] as const;
export interface CandidateArtifactManifest {
  schemaVersion: 1;
  commit: string;
  treeDigest: string;
  builtAt: string;
  artifacts: { path: string; sha256: string }[];
}
function object(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const entries = value as Record<string, unknown>;
  if (Object.keys(entries).some(key => !keys.includes(key))) throw new Error(`${label} contains an unknown field`);
  return entries;
}
export function isAllowedBuildArtifact(path: string): boolean {
  if (path.includes("\\") || /[\x00-\x1f\x7f]/.test(path) || path.split("/").some(part => part === "." || part === ".." || part === "")) return false;
  return (REQUIRED_BUILD_ARTIFACTS as readonly string[]).includes(path)
    || /^apps\/web\/\.next\/(server\/.*\.js|static\/.*\.(js|css))$/.test(path);
}
export function parseCandidateArtifactManifest(raw: unknown): CandidateArtifactManifest {
  const value = object(raw, ["schemaVersion", "commit", "treeDigest", "builtAt", "artifacts"], "build manifest");
  if (value.schemaVersion !== 1 || typeof value.commit !== "string" || !SHA.test(value.commit) || typeof value.treeDigest !== "string" || !SHA.test(value.treeDigest)) throw new Error("Invalid build commit/tree identity");
  if (typeof value.builtAt !== "string" || !Number.isFinite(Date.parse(value.builtAt)) || new Date(value.builtAt).toISOString() !== value.builtAt) throw new Error("Invalid build timestamp");
  if (!Array.isArray(value.artifacts)) throw new Error("Build artifacts must be an array");
  const artifacts = value.artifacts.map(rawEntry => {
    const entry = object(rawEntry, ["path", "sha256"], "build artifact");
    if (typeof entry.path !== "string" || !isAllowedBuildArtifact(entry.path) || typeof entry.sha256 !== "string" || !DIGEST.test(entry.sha256)) throw new Error("Invalid or forbidden build artifact path/digest");
    return { path: entry.path, sha256: entry.sha256 };
  }).sort((a, b) => a.path.localeCompare(b.path));
  if (new Set(artifacts.map(entry => entry.path)).size !== artifacts.length || REQUIRED_BUILD_ARTIFACTS.some(path => !artifacts.some(entry => entry.path === path))) throw new Error("Missing or duplicate required build artifact");
  if (!artifacts.some(entry => /^apps\/web\/\.next\/server\/.*\.js$/.test(entry.path)) || !artifacts.some(entry => /^apps\/web\/\.next\/static\/.*\.js$/.test(entry.path))) throw new Error("Build artifacts must include server and static application code");
  return { schemaVersion: 1, commit: value.commit, treeDigest: value.treeDigest, builtAt: value.builtAt, artifacts };
}
function git(root: string, args: string[]) {
  // Git hooks export repository/index overrides. The explicit root must win,
  // including when qualification helpers are tested from inside a commit hook.
  const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
  return execFileSync("git", args, { cwd: root, env: environment as NodeJS.ProcessEnv, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}
export function readCleanCandidateIdentity(root: string) {
  if (git(root, ["status", "--porcelain", "--untracked-files=all"])) throw new Error("Candidate source tree must be clean (including untracked files)");
  return { commit: git(root, ["rev-parse", "HEAD"]), treeDigest: git(root, ["rev-parse", "HEAD^{tree}"]) };
}
function artifactsOnDisk(root: string) {
  const result: string[] = [];
  function scan(path: string) {
    const stat = lstatSync(join(root, path));
    if (stat.isSymbolicLink()) throw new Error(`Build artifact symlink is forbidden: ${path}`);
    if (stat.isDirectory()) {
      for (const name of readdirSync(join(root, path)).sort()) scan(`${path}/${name}`);
    } else if (stat.isFile() && isAllowedBuildArtifact(path)) result.push(path);
  }
  // Check ancestors too: a symlinked build directory must never escape the candidate.
  for (const path of ["apps", "apps/web", "apps/web/.next"]) if (lstatSync(join(root, path)).isSymbolicLink()) throw new Error(`Build artifact symlink is forbidden: ${path}`);
  // Only visit manifests and compiled code directories; caches/raw prerenders/env files are never read.
  for (const path of REQUIRED_BUILD_ARTIFACTS) {
    if (path.includes("/server/")) continue;
    scan(path);
  }
  for (const path of ["apps/web/.next/server", "apps/web/.next/static"]) {
    try { scan(path); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
  // app-paths-manifest is not compiled code, but is explicitly allowlisted.
  if (!result.includes(REQUIRED_BUILD_ARTIFACTS[3])) scan(REQUIRED_BUILD_ARTIFACTS[3]);
  return result.sort().map(path => ({ path, sha256: createHash("sha256").update(readFileSync(join(root, path))).digest("hex") }));
}
export function captureCandidateArtifactManifest(root: string, expected: { commit: string; treeDigest: string }, builtAt: string): CandidateArtifactManifest {
  const identity = readCleanCandidateIdentity(root);
  if (identity.commit !== expected.commit || identity.treeDigest !== expected.treeDigest) throw new Error("Build/source commit/tree identity changed");
  return parseCandidateArtifactManifest({ schemaVersion: 1, ...identity, builtAt, artifacts: artifactsOnDisk(root) });
}
export function verifyLocalBuildManifest(raw: unknown, root: string): CandidateArtifactManifest {
  const manifest = parseCandidateArtifactManifest(raw);
  const actual = captureCandidateArtifactManifest(root, manifest, manifest.builtAt);
  if (JSON.stringify(actual.artifacts) !== JSON.stringify(manifest.artifacts)) throw new Error("Build artifact digest/set mismatch");
  return manifest;
}
/** Proof output is not another tracked source commit. */
export function assertUntrackedEvidenceOutput(root: string, output: string): void {
  const path = relative(resolve(root), resolve(output));
  if (path === "" || (!path.startsWith(`..${sep}`) && path !== ".." && !path.startsWith(sep))) {
    if (!path || git(root, ["ls-files", "--", path])) throw new Error("Evidence output must be outside the tracked candidate");
    try { git(root, ["check-ignore", "--quiet", "--", path]); }
    catch { throw new Error("Evidence inside the candidate must use a gitignored path"); }
  }
}
const BUILD_PROCESS_KEYS = ["PATH", "HOME", "USER", "LOGNAME", "SHELL", "TMPDIR", "LANG", "LC_ALL", "PNPM_HOME", "COREPACK_HOME"] as const;
export function qualificationBuildEnvironment(environment: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return { ...Object.fromEntries(BUILD_PROCESS_KEYS.flatMap(key => environment[key] === undefined ? [] : [[key, environment[key]]])), NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1" };
}
/** Inspect existence only; never open implicit environment files. */
export function assertNoImplicitBuildEnvironment(root: string): void {
  for (const directory of [root, join(root, "apps/web")]) for (const name of [".env", ".env.local", ".env.production", ".env.production.local"]) {
    if (existsSync(join(directory, name))) throw new Error("Qualification build refuses implicit env files; use a clean isolated checkout");
  }
}
export function runLocalCandidateBuild(root: string, output: string): CandidateArtifactManifest {
  assertUntrackedEvidenceOutput(root, output);
  assertNoImplicitBuildEnvironment(root);
  const identity = readCleanCandidateIdentity(root);
  execFileSync("pnpm", ["run", "build"], { cwd: root, stdio: "inherit", env: qualificationBuildEnvironment(process.env) });
  const result = captureCandidateArtifactManifest(root, identity, new Date().toISOString());
  mkdirSync(dirname(resolve(output)), { recursive: true });
  const temp = `${resolve(output)}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify(result, null, 2)}\n`); renameSync(temp, resolve(output));
  return result;
}
if (typeof require !== "undefined" && typeof module !== "undefined" && require.main === module) {
  try {
    const rootAt = process.argv.indexOf("--root"), outputAt = process.argv.indexOf("--output");
    if (rootAt < 0 || outputAt < 0 || !process.argv[rootAt + 1] || !process.argv[outputAt + 1]) throw new Error("Usage: candidate-artifact-manifest.ts --root ROOT --output MANIFEST");
    runLocalCandidateBuild(resolve(process.argv[rootAt + 1]!), resolve(process.argv[outputAt + 1]!));
  } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
