import { verifyServedCandidateArtifact } from "./helpers/local-candidate-artifact";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { verifyLocalBuildManifest } from "../../../scripts/quality/candidate-artifact-manifest";
import { assertLocalCandidateRuntime, localCandidateTarget } from "./helpers/local-candidate";
import { expect, test } from "@playwright/test";
import {
  assertBadgeSvg,
  assertCoreDependencies,
  assertGitHubLoginRedirect,
  assertLocales,
  assertRollbackReadiness,
  assertSharePage,
  assertShareVerification,
} from "./helpers/deployment-probes";
import {
  parseReleaseVerificationMode,
  releaseRequiredScenarioIds,
} from "./helpers/release-required-environments";

const expectedCommit = process.env.EXPECTED_DEPLOYMENT_COMMIT?.trim();
const expectedEnvironment = process.env.EXPECTED_DEPLOYMENT_ENV?.trim();
const verificationMode = parseReleaseVerificationMode(
  process.env.RELEASE_VERIFICATION_MODE?.trim() || undefined,
);
const selectedScenarioIds = releaseRequiredScenarioIds(
  expectedEnvironment,
  verificationMode,
);

function requireIdentityInputs(environment: "preview" | "production"): string {
  expect(
    expectedCommit,
    `EXPECTED_DEPLOYMENT_COMMIT is required for ${environment} identity evidence`,
  ).toMatch(/^[0-9a-f]{40}$/);
  expect(expectedEnvironment).toBe(environment);
  return expectedCommit!;
}

test.describe("release-required read-only probes", () => {
  if (selectedScenarioIds.has("deployment.local-candidate-identity")) {
    test("@release-required deployment.local-candidate-identity", async ({ request, baseURL }) => {
      expect(localCandidateTarget(expectedEnvironment, verificationMode, baseURL ?? "", process.env.VERCEL_AUTOMATION_BYPASS_SECRET)).toBe(true);
      const manifestPath = process.env.RELEASE_BUILD_MANIFEST?.trim();
      expect(manifestPath, "RELEASE_BUILD_MANIFEST is required").toBeTruthy();
      const repoRoot = resolve(import.meta.dirname, "../../..");
      const manifest = verifyLocalBuildManifest(JSON.parse(readFileSync(manifestPath!, "utf8")), repoRoot);
      const buildId = readFileSync(resolve(repoRoot, "apps/web/.next/BUILD_ID"), "utf8").trim();
      expect(buildId).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(manifest.artifacts.some(artifact => artifact.path === `apps/web/.next/static/${buildId}/_buildManifest.js`), "Build-ID-scoped static manifest is required to bind the running server").toBe(true);
      expect(expectedCommit).toMatch(/^[0-9a-f]{40}$/);
      expect(process.env.EXPECTED_CANDIDATE_TREE_DIGEST).toMatch(/^[0-9a-f]{40}$/);
      expect(manifest.commit).toBe(expectedCommit);
      expect(manifest.treeDigest).toBe(process.env.EXPECTED_CANDIDATE_TREE_DIGEST);
      const response = await request.get("/api/version", { maxRedirects: 0 });
      expect(response.status()).toBe(200);
      expect(response.headers()["cache-control"]).toContain("no-store");
      assertLocalCandidateRuntime(await response.json());
      await verifyServedCandidateArtifact(manifest.artifacts, (path, options) => request.get(path, options));
    });
  }

  if (selectedScenarioIds.has("deployment.production-identity")) {
    test("@release-required deployment.production-identity", async ({ request }) => {
      const commit = requireIdentityInputs("production");
      const response = await request.get("/api/version");
      expect(response.status()).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        commitSha: commit,
        environment: "production",
      });
    });
  }

  if (selectedScenarioIds.has("deployment.preview-identity")) {
    test("@release-required deployment.preview-identity", async ({ request }) => {
      const commit = requireIdentityInputs("preview");
      const response = await request.get("/api/version");
      expect(response.status()).toBe(200);
      expect(response.headers()["cache-control"]).toContain("no-store");
      await expect(response.json()).resolves.toMatchObject({
        commitSha: commit,
        environment: "preview",
      });
    });
  }

  if (selectedScenarioIds.has("health.core-dependencies")) {
    test("@release-required health.core-dependencies", async ({ request }) => {
      await assertCoreDependencies(request);
    });
  }

  if (selectedScenarioIds.has("profile.public-badge-read")) {
    test("@release-required profile.public-badge-read", async ({ request }) => {
      await assertBadgeSvg(request);
    });
  }

  if (selectedScenarioIds.has("profile.public-share-read")) {
    test("@release-required profile.public-share-read", async ({ page }) => {
      await assertSharePage(page);
    });
  }

  if (selectedScenarioIds.has("auth.github-login-redirect")) {
    test("@release-required auth.github-login-redirect", async ({ request }) => {
      await assertGitHubLoginRedirect(request);
    });
  }

  if (selectedScenarioIds.has("auth.protected-write-denied")) {
    test("@release-required auth.protected-write-denied", async ({ request }) => {
      const response = await request.post("/api/generate", {
        data: { handle: "release-probe-must-not-write" },
      });
      const body = await response.json();
      expect(response.status()).toBe(401);
      expect(body).toMatchObject({ error: expect.any(String) });
      expect(body).not.toHaveProperty("success", true);
    });
  }

  if (selectedScenarioIds.has("profile.share-verification")) {
    test("@release-required profile.share-verification", async ({ request }) => {
      await assertShareVerification(request);
    });
  }

  if (selectedScenarioIds.has("locales.en-es")) {
    test("@release-required locales.en-es", async ({ request }) => {
      await assertLocales(request);
    });
  }

  if (selectedScenarioIds.has("rollback.readiness")) {
    test("@release-required rollback.readiness", async ({ request }) => {
      await assertRollbackReadiness(request);
    });
  }
});
