import { describe, expect, it } from "vitest";
import { releaseRequiredScenarioIds } from "./release-required-environments";

describe("releaseRequiredScenarioIds", () => {
  it("selects exactly the production-safe obligations", () => {
    expect([...releaseRequiredScenarioIds("production")]).toEqual([
      "deployment.production-identity",
      "health.core-dependencies",
      "profile.public-badge-read",
      "profile.public-share-read",
      "profile.share-verification",
      "locales.en-es",
    ]);
  });

  it("retains the preview identity, auth, and rollback-readiness probes for preview", () => {
    expect([...releaseRequiredScenarioIds("preview")]).toEqual([
      "deployment.preview-identity",
      "health.core-dependencies",
      "profile.public-badge-read",
      "profile.public-share-read",
      "profile.share-verification",
      "locales.en-es",
      "auth.github-login-redirect",
      "auth.protected-write-denied",
      "rollback.readiness",
    ]);
  });
});
