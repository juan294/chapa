import { afterEach, describe, expect, it, vi } from "vitest";

async function loadConfig(environment = "") {
  vi.stubEnv("EXPECTED_DEPLOYMENT_ENV", environment);
  vi.resetModules();
  return (await import("./playwright.config")).default;
}

describe("Playwright test discovery", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("excludes Vitest and release-verification specs from ordinary CI", async () => {
    const config = await loadConfig();
    expect(config.testIgnore).toEqual([
      "**/*.test.ts",
      "**/release-required.spec.ts",
    ]);
  });

  it.each(["preview", "production"])(
    "includes release-verification specs for %s evidence",
    async (environment) => {
      const config = await loadConfig(environment);
      expect(config.testIgnore).toEqual(["**/*.test.ts"]);
    },
  );

  it("does not enable release-verification specs for an unknown environment", async () => {
    const config = await loadConfig("staging");
    expect(config.testIgnore).toContain("**/release-required.spec.ts");
  });
});
