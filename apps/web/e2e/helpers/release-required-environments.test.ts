import { describe, expect, it } from "vitest";
import {
  parseReleaseVerificationMode,
  releaseRequiredScenarioIds,
} from "./release-required-environments";

describe("releaseRequiredScenarioIds", () => {
  it("selects the four default production probes", () => {
    expect([...releaseRequiredScenarioIds("production", "default")]).toEqual([
      "deployment.production-identity",
      "health.core-dependencies",
      "profile.public-badge-read",
      "profile.public-share-read",
    ]);
  });

  it("selects the five default preview probes, including rollback readiness", () => {
    expect([...releaseRequiredScenarioIds("preview", "default")]).toEqual([
      "deployment.preview-identity",
      "health.core-dependencies",
      "profile.public-badge-read",
      "profile.public-share-read",
      "rollback.readiness",
    ]);
  });

  it("adds the deep production probes on top of the default set", () => {
    expect([...releaseRequiredScenarioIds("production", "deep")]).toEqual([
      "deployment.production-identity",
      "health.core-dependencies",
      "profile.public-badge-read",
      "profile.public-share-read",
      "profile.share-verification",
      "locales.en-es",
    ]);
  });

  it("adds the deep preview probes on top of the default set", () => {
    expect([...releaseRequiredScenarioIds("preview", "deep")]).toEqual([
      "deployment.preview-identity",
      "health.core-dependencies",
      "profile.public-badge-read",
      "profile.public-share-read",
      "rollback.readiness",
      "profile.share-verification",
      "locales.en-es",
      "auth.github-login-redirect",
      "auth.protected-write-denied",
    ]);
  });

  it("defaults to the default mode when mode is omitted", () => {
    expect([...releaseRequiredScenarioIds("production")]).toEqual([
      "deployment.production-identity",
      "health.core-dependencies",
      "profile.public-badge-read",
      "profile.public-share-read",
    ]);
  });

  it("throws a clear error for an unknown environment", () => {
    expect(() => releaseRequiredScenarioIds("staging", "default")).toThrow(
      /unknown deployment environment/i,
    );
  });

  it("throws a clear error for an unknown mode", () => {
    expect(() => releaseRequiredScenarioIds("preview", "exhaustive")).toThrow(
      /unknown release verification mode/i,
    );
  });
});

describe("parseReleaseVerificationMode", () => {
  it("defaults to 'default' when the value is absent", () => {
    expect(parseReleaseVerificationMode(undefined)).toBe("default");
  });

  it("accepts 'default'", () => {
    expect(parseReleaseVerificationMode("default")).toBe("default");
  });

  it("accepts 'deep'", () => {
    expect(parseReleaseVerificationMode("deep")).toBe("deep");
  });

  it("throws a clear error for any other value", () => {
    expect(() => parseReleaseVerificationMode("exhaustive")).toThrow(
      /unknown release verification mode/i,
    );
  });
});
