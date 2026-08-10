import { describe, expect, it, vi } from "vitest";

describe("Vercel protection storage", () => {
  it("accepts only cookies scoped to the exact preview host", async () => {
    vi.stubEnv("E2E_PRO_RUN_ID", "release-test");
    vi.resetModules();
    const {
      isCookieScopedToPreview,
      vercelBypassStorageStatePath,
    } = await import("./vercel-protection");

    expect(
      isCookieScopedToPreview(
        { domain: "preview.example.com", path: "/" },
        "https://preview.example.com/",
      ),
    ).toBe(true);
    expect(
      isCookieScopedToPreview(
        { domain: ".example.com", path: "/" },
        "https://preview.example.com/",
      ),
    ).toBe(false);
    expect(
      isCookieScopedToPreview(
        { domain: "analytics.example.com", path: "/" },
        "https://preview.example.com/",
      ),
    ).toBe(false);
    expect(
      isCookieScopedToPreview(
        { domain: "preview.example.com", path: "/api/version" },
        "https://preview.example.com/",
      ),
    ).toBe(false);
    expect(vercelBypassStorageStatePath).toContain("release-test");
    vi.unstubAllEnvs();
  });
});
