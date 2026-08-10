import { afterEach, describe, expect, it, vi } from "vitest";
import { join } from "node:path";
import { tmpdir } from "node:os";

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

  it("uses an ephemeral preview-scoped cookie without context-wide headers", async () => {
    vi.stubEnv("E2E_PRO_RUN_ID", "release-test");
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "https://preview.example.com");
    vi.stubEnv("VERCEL_AUTOMATION_BYPASS_SECRET", "test-secret");
    vi.resetModules();

    const config = (await import("./playwright.config")).default;

    expect(config.globalSetup).toBe(
      "./e2e/helpers/vercel-protection-global-setup.ts",
    );
    expect(config.use?.trace).toBe("off");
    expect(config.use?.storageState).toBe(
      join(tmpdir(), "chapa-playwright-vercel-bypass-release-test.json"),
    );
    expect(config.use?.extraHTTPHeaders).toBeUndefined();
  });

  it("keeps ordinary local runs independent from Vercel protection", async () => {
    vi.stubEnv("VERCEL_AUTOMATION_BYPASS_SECRET", "");
    vi.resetModules();

    const config = (await import("./playwright.config")).default;

    expect(config.globalSetup).toBeUndefined();
    expect(config.use?.trace).toBe("on-first-retry");
    expect(config.use?.storageState).toBeUndefined();
    expect(config.use?.extraHTTPHeaders).toBeUndefined();
  });
});
