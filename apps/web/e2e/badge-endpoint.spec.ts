import { test, expect } from "@playwright/test";

test.describe("Badge endpoint — /u/:handle/badge.svg", () => {
  const smokeBadgePath = "/u/octocat/badge.svg?__chapa_smoke=1";

  test("valid handle returns SVG content with correct Content-Type", async ({
    request,
  }) => {
    const response = await request.get(smokeBadgePath);

    // Must be 200 — the route always returns a fallback SVG on error paths;
    // a 500 means an unhandled crash leaked through and must be caught.
    expect(response.status()).toBe(200);

    // Content-Type is always image/svg+xml — fallback SVG on every code path.
    const contentType = response.headers()["content-type"] ?? "";
    expect(contentType).toContain("image/svg+xml");

    // Body must start with an SVG root element.
    const body = await response.text();
    expect(body).toMatch(/^<svg /);
  });

  test("cache headers match the badge's scoring state", async ({
    request,
  }) => {
    const response = await request.get(smokeBadgePath);

    // Must be 200 — a 500 means an unhandled crash that bypassed the fallback.
    expect(response.status()).toBe(200);

    // #1191 hotfix (v2.29.2) — the client-facing Cache-Control is now a short,
    // explicit max-age (the long-lived s-maxage policy lives in
    // Vercel-CDN-Cache-Control instead, which Vercel strips before the
    // response leaves the edge — not observable here against the local
    // webServer, and deliberately not asserted in E2E; see phase 1 of the
    // hotfix plan).
    // #1335: only a drawable receipt is publicly cacheable. A subject with no
    // receipt yet (collecting, action needed, or never signed up, which is
    // what `octocat` is outside the seeded fixture stack) is served no-store,
    // so it can never outlive its own state change.
    const cacheControl = response.headers()["cache-control"] ?? "";
    const state = (await response.text()).match(/data-chapa-state="([a-z_]+)"/)?.[1];
    if (state === "rendered") {
      expect(cacheControl).toContain("public");
      expect(cacheControl).toContain("max-age");
    } else {
      expect(["collecting", "action_needed", "unregistered"]).toContain(state);
      expect(cacheControl).toContain("no-store");
    }
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
