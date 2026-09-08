import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { captureCandidateArtifactManifest, verifyLocalBuildManifest, qualificationBuildEnvironment, assertNoImplicitBuildEnvironment } from "./candidate-artifact-manifest";
const roots: string[] = [];
afterEach(() => { vi.unstubAllEnvs(); roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })); });
function fixture(seed = 1) {
  const root = mkdtempSync(join(tmpdir(), "candidate-artifacts-")); roots.push(root);
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, env: Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_"))), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git("init", "--quiet"); git("config", "user.email", "local@example.test"); git("config", "user.name", "Local Fixture");
  writeFileSync(join(root, ".gitignore"), "apps/web/.next/\nlogs/\n"); writeFileSync(join(root, "source.ts"), `export const value = ${seed};\n`);
  git("add", "."); git("commit", "--quiet", "-m", "fixture");
  mkdirSync(join(root, "apps/web/.next/server"), { recursive: true });
  for (const name of ["BUILD_ID", "build-manifest.json", "routes-manifest.json", "server/app-paths-manifest.json"]) writeFileSync(join(root, "apps/web/.next", name), "{}");
  writeFileSync(join(root, "apps/web/.next/server/app.js"), "compiled-server");
  mkdirSync(join(root, "apps/web/.next/static/chunks"), { recursive: true });
  writeFileSync(join(root, "apps/web/.next/static/chunks/app.js"), "compiled-code");
  return { root, identity: { commit: git("rev-parse", "HEAD"), treeDigest: git("rev-parse", "HEAD^{tree}") } };
}
it("hashes only allowlisted artifacts and verifies exact clean source identity", () => {
  const { root, identity } = fixture();
  writeFileSync(join(root, "apps/web/.next/.env.local"), "DO_NOT_READ=secret");
  const manifest = captureCandidateArtifactManifest(root, identity, "2026-09-08T10:00:00.000Z");
  expect(manifest.artifacts).toHaveLength(6);
  expect(verifyLocalBuildManifest(manifest, root)).toEqual(manifest);
  writeFileSync(join(root, "apps/web/.next/BUILD_ID"), "changed");
  expect(() => verifyLocalBuildManifest(manifest, root)).toThrow(/artifact|digest/);
});
it("rejects tracked or untracked source drift and mismatched build identity", () => {
  const { root, identity } = fixture();
  expect(() => captureCandidateArtifactManifest(root, { ...identity, commit: "a".repeat(40) }, "2026-09-08T10:00:00.000Z")).toThrow(/identity|commit/);
  writeFileSync(join(root, "new.ts"), "untracked");
  expect(() => captureCandidateArtifactManifest(root, identity, "2026-09-08T10:00:00.000Z")).toThrow(/clean|untracked/);
  rmSync(join(root, "new.ts")); writeFileSync(join(root, "source.ts"), "changed");
  expect(() => captureCandidateArtifactManifest(root, identity, "2026-09-08T10:00:00.000Z")).toThrow(/clean|tracked/);
});
it("rejects artifact symlinks before reading their targets", () => {
  const { root, identity } = fixture();
  rmSync(join(root, "apps/web/.next/BUILD_ID")); symlinkSync(join(root, "source.ts"), join(root, "apps/web/.next/BUILD_ID"));
  expect(() => captureCandidateArtifactManifest(root, identity, "2026-09-08T10:00:00.000Z")).toThrow(/symlink/);
});

it("qualification build inherits only process plumbing and rejects implicit env files", () => {
  expect(qualificationBuildEnvironment({ PATH: "/bin", HOME: "/fixture", DATABASE_URL: "private", NEXT_PUBLIC_SUPABASE_URL: "remote", VERCEL_ENV: "production" })).toEqual({ PATH: "/bin", HOME: "/fixture", NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1" });
  const { root } = fixture();
  writeFileSync(join(root, "apps/web/.env.local"), "fixture-placeholder");
  expect(() => assertNoImplicitBuildEnvironment(root)).toThrow(/env/);
});
it("rejects JSON-only builds with no server or browser code", () => {
  const { root, identity } = fixture();
  rmSync(join(root, "apps/web/.next/server/app.js"));
  expect(() => captureCandidateArtifactManifest(root, identity, "2026-09-08T10:00:00.000Z")).toThrow(/code|artifact/);
});

it("isolates fixture and explicit-root Git operations from parent commit-hook variables", () => {
  const parent = fixture();
  vi.stubEnv("GIT_DIR", join(parent.root, ".git"));
  vi.stubEnv("GIT_WORK_TREE", parent.root);
  vi.stubEnv("GIT_INDEX_FILE", join(parent.root, ".git/index"));
  const child = fixture(2);
  expect(child.identity.commit).not.toBe(parent.identity.commit);
  expect(captureCandidateArtifactManifest(child.root, child.identity, "2026-09-08T10:00:00.000Z").commit).toBe(child.identity.commit);
  expect(captureCandidateArtifactManifest(parent.root, parent.identity, "2026-09-08T10:00:00.000Z").commit).toBe(parent.identity.commit);
});
