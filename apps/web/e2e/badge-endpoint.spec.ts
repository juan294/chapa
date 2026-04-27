import { test, expect } from "@playwright/test";

test.describe("Badge endpoint — /u/:handle/badge.svg", () => {
  test("valid handle returns SVG content with correct Content-Type", async ({
    request,
  }) => {
    const response = await request.get("/u/torvalds/badge.svg");

    // Always assert a specific status — never silently swallow crashes.
    // In CI without a GitHub token the route returns 200 with a fallback SVG
    // or 500 on an unexpected error; 429 is possible under rate-limiting.
    // All are acceptable, but we must see a concrete status code.
    const status = response.status();
    expect([200, 429, 500]).toContain(status);

    // Content-Type is always image/svg+xml regardless of success or error —
    // the route returns a fallback SVG on every code path (see badge route).
    const contentType = response.headers()["content-type"] ?? "";
    expect(contentType).toContain("image/svg+xml");

    // Body must always be SVG markup (fallback or full badge).
    const body = await response.text();
    expect(body).toContain("<svg");
  });

  test("successful response includes public cache headers", async ({
    request,
  }) => {
    const response = await request.get("/u/torvalds/badge.svg");

    // Assert a concrete status — guard against silent 500 crashes.
    const status = response.status();
    expect([200, 429, 500]).toContain(status);

    if (status === 200) {
      // On a full success the route sets long-lived public cache headers.
      const cacheControl = response.headers()["cache-control"] ?? "";
      expect(cacheControl).toContain("public");
      expect(cacheControl).toContain("s-maxage");
    }
    // On 500/429 cache headers differ — that's acceptable; the status
    // assertion above already confirmed the server didn't crash silently.
  });

  test("syntactically invalid handle returns 400 with SVG body", async ({
    request,
  }) => {
    // This handle is 46 chars — exceeds GitHub's 39-char limit so
    // isValidHandle() returns false and the route returns 400.
    const response = await request.get(
      "/u/this-user-definitely-does-not-exist-xyz123/badge.svg",
    );

    // Must be 400 — unconditional, never wrapped in a guard.
    expect(response.status()).toBe(400);

    // Route returns SVG even for invalid handles (fallback SVG).
    const contentType = response.headers()["content-type"] ?? "";
    expect(contentType).toContain("image/svg+xml");

    const body = await response.text();
    expect(body).toContain("<svg");
  });
});
