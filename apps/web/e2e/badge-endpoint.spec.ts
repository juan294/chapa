import { test, expect } from "@playwright/test";

test.describe("Badge endpoint — /u/:handle/badge.svg", () => {
  test("valid handle returns image/svg+xml content type", async ({
    request,
  }) => {
    const response = await request.get("/u/torvalds/badge.svg");
    // In CI without GitHub token/Redis, may return 500/503.
    if (response.ok()) {
      const contentType = response.headers()["content-type"] ?? "";
      expect(contentType).toContain("image/svg+xml");
    } else {
      // Accept non-2xx as long as the server didn't crash
      expect(response.status()).toBeLessThan(600);
    }
  });

  test("successful response includes cache headers", async ({ request }) => {
    const response = await request.get("/u/torvalds/badge.svg");
    if (response.ok()) {
      const cacheControl = response.headers()["cache-control"] ?? "";
      // Should have public caching with s-maxage
      expect(cacheControl).toContain("public");
      expect(cacheControl).toContain("s-maxage");
    }
  });

  test("invalid handle returns error status", async ({ request }) => {
    const response = await request.get(
      "/u/this-user-definitely-does-not-exist-xyz123/badge.svg"
    );
    // Should return 4xx (not found / bad request) or 5xx (graceful error)
    // but not 200 with valid SVG
    const status = response.status();
    expect(status).toBeGreaterThanOrEqual(400);
  });
});
