import { describe, expect, it } from "vitest";
import { releaseRequiredScenarioIds } from "./release-required-environments";

describe("releaseRequiredScenarioIds", () => {
  it("selects exactly the four production-safe obligations", () => {
    expect([...releaseRequiredScenarioIds("production")]).toEqual([
      "deployment.production-identity",
      "health.core-dependencies",
      "profile.public-badge-read",
      "profile.public-share-read",
    ]);
  });

  it("retains the preview identity and auth probes for preview", () => {
    expect([...releaseRequiredScenarioIds("preview")]).toEqual([
      "deployment.preview-identity",
      "health.core-dependencies",
      "profile.public-badge-read",
      "profile.public-share-read",
      "auth.github-login-redirect",
      "auth.protected-write-denied",
    ]);
  });
});
