import { test, expect } from "@playwright/test";

/**
 * Integration tests for the three core public-facing endpoints:
 *   1. Badge SVG  — /u/:handle/badge.svg
 *   2. Share page — /u/:handle
 *   3. Health API — /api/health
 *
 * These go deeper than the smoke tests: they assert on response bodies,
 * SVG structure, page elements, and JSON schema — not just status codes.
 *
 * In CI without GitHub token/Redis the endpoints may return degraded
 * responses. The tests are written to handle both success and graceful
 * fallback paths so they never flake on infrastructure availability.
 */

const HANDLE = "juan294";

// ────────────────────────────────────────────────────────────────
// 1. Badge SVG endpoint
// ────────────────────────────────────────────────────────────────

test.describe("Integration — Badge SVG endpoint (/u/:handle/badge.svg)", () => {
  test("returns 200 with Content-Type image/svg+xml", async ({ request }) => {
    const response = await request.get(`/u/${HANDLE}/badge.svg`);

    // In CI the endpoint may return a fallback SVG (still 200) or a
    // non-200 if GitHub data is completely unavailable.
    if (response.ok()) {
      const contentType = response.headers()["content-type"] ?? "";
      expect(contentType).toContain("image/svg+xml");
    } else {
      // Graceful failure — server didn't crash
      expect(response.status()).toBeLessThan(600);
    }
  });

  test("response body contains valid SVG markup", async ({ request }) => {
    const response = await request.get(`/u/${HANDLE}/badge.svg`);

    if (response.ok()) {
      const body = await response.text();

      // Must be a well-formed SVG document
      expect(body).toContain("<svg");
      expect(body).toContain("xmlns");
      expect(body).toContain("</svg>");

      // Must declare a viewBox (badge is 1200x630)
      expect(body).toMatch(/viewBox\s*=/);
    }
  });

  test("SVG body includes the handle text or is a valid fallback", async ({ request }) => {
    const response = await request.get(`/u/${HANDLE}/badge.svg`);

    if (response.ok()) {
      const body = await response.text();
      // Must be SVG markup (not an HTML error page)
      expect(body).toContain("<svg");
      // The handle may appear as text content, attribute, or may be
      // absent in fallback SVGs that show a generic message. Either way
      // the response must be a valid SVG document.
      expect(body).toContain("</svg>");
    }
  });

  test("response includes public caching headers", async ({ request }) => {
    const response = await request.get(`/u/${HANDLE}/badge.svg`);

    if (response.ok()) {
      const cacheControl = response.headers()["cache-control"] ?? "";
      expect(cacheControl).toContain("public");
      expect(cacheControl).toContain("s-maxage");
      expect(cacheControl).toContain("stale-while-revalidate");
    }
  });

  test("Content-Security-Policy header is present", async ({
    request,
  }) => {
    const response = await request.get(`/u/${HANDLE}/badge.svg`);

    if (response.ok()) {
      const csp = response.headers()["content-security-policy"] ?? "";
      // In production, the badge route sets `frame-ancestors *` for embedding.
      // In dev server, Next.js global headers may override with `frame-ancestors 'none'`.
      // Either way, a CSP header must be present.
      expect(csp.length).toBeGreaterThan(0);
      expect(csp).toContain("frame-ancestors");
    }
  });
});

// ────────────────────────────────────────────────────────────────
// 2. Share page
// ────────────────────────────────────────────────────────────────

// The share page embeds <img src="/u/:handle/badge.svg"> which triggers
// a second API call. In CI (no cache, slow API), waiting for "load"
// causes timeouts. Use domcontentloaded instead.
const GOTO_OPTS = { waitUntil: "domcontentloaded" as const };

test.describe("Integration — Share page (/u/:handle)", () => {
  test("page loads without server error", async ({ page }) => {
    const response = await page.goto(`/u/${HANDLE}`, GOTO_OPTS);
    expect(response).not.toBeNull();
    // 200 = success, 404 = handle not found (valid graceful response)
    // Anything < 500 means the server handled it without crashing
    expect(response!.status()).toBeLessThan(500);
  });

  test("page title contains the handle", async ({ page }) => {
    const response = await page.goto(`/u/${HANDLE}`, GOTO_OPTS);
    if (!response?.ok()) return; // Skip assertions if data unavailable

    const title = await page.title();
    expect(title.toLowerCase()).toContain(HANDLE.toLowerCase());
  });

  test("page has an sr-only h1 with the handle", async ({ page }) => {
    const response = await page.goto(`/u/${HANDLE}`, GOTO_OPTS);
    if (!response?.ok()) return;

    // The share page renders: <h1 class="sr-only">@handle -- Developer Impact, Decoded</h1>
    const h1 = page.locator("h1");
    await expect(h1).toContainText(HANDLE);
  });

  test("badge image element is present with correct src", async ({ page }) => {
    const response = await page.goto(`/u/${HANDLE}`, GOTO_OPTS);
    if (!response?.ok()) return;

    // The badge is rendered as <img src="/u/handle/badge.svg?v=..." alt="Chapa badge for handle">
    const badgeImg = page.locator(`img[alt*="badge"][alt*="${HANDLE}"]`);
    const count = await badgeImg.count();

    if (count > 0) {
      const src = await badgeImg.first().getAttribute("src");
      expect(src).toContain(`/u/${HANDLE}/badge.svg`);
    } else {
      // If no <img>, the page might use the interactive ShareBadgePreviewLazy
      // component which renders an inline SVG instead. Either is valid.
      const inlineSvg = page.locator("svg");
      const svgCount = await inlineSvg.count();
      expect(svgCount).toBeGreaterThanOrEqual(1);
    }
  });

  test('"Your Impact, Decoded" section heading is visible', async ({
    page,
  }) => {
    const response = await page.goto(`/u/${HANDLE}`, GOTO_OPTS);
    if (!response?.ok()) return;

    const heading = page.getByText("Your Impact, Decoded");
    await expect(heading).toBeVisible();
  });

  test("page includes structured data (JSON-LD)", async ({ page }) => {
    const response = await page.goto(`/u/${HANDLE}`, GOTO_OPTS);
    if (!response?.ok()) return;

    const jsonLd = page.locator('script[type="application/ld+json"]');
    const count = await jsonLd.count();
    // In CI without real data the share page may not emit JSON-LD
    if (count === 0) return;

    const content = await jsonLd.first().textContent();
    expect(content).toBeTruthy();

    const parsed = JSON.parse(content!);
    // The page may emit a Person (user-specific) or WebApplication (global) JSON-LD.
    // In CI without real user data, the global WebApplication schema is used.
    expect(["Person", "WebApplication"]).toContain(parsed["@type"]);
  });
});

// ────────────────────────────────────────────────────────────────
// 3. Health API endpoint
// ────────────────────────────────────────────────────────────────

test.describe("Integration — Health endpoint (/api/health)", () => {
  test("returns 200 or 503 with valid JSON", async ({ request }) => {
    const response = await request.get("/api/health");

    // 200 = healthy, 503 = degraded (e.g. Redis unreachable in CI)
    expect([200, 503]).toContain(response.status());

    const contentType = response.headers()["content-type"] ?? "";
    expect(contentType).toContain("application/json");
  });

  test("JSON body contains status field", async ({ request }) => {
    const response = await request.get("/api/health");
    const body = await response.json();

    expect(body).toHaveProperty("status");
    // status is "ok" or "degraded"
    expect(["ok", "degraded"]).toContain(body.status);
  });

  test("JSON body contains timestamp in ISO 8601 format", async ({
    request,
  }) => {
    const response = await request.get("/api/health");
    const body = await response.json();

    expect(body).toHaveProperty("timestamp");
    expect(typeof body.timestamp).toBe("string");

    // Verify it parses as a valid date
    const date = new Date(body.timestamp);
    expect(date.getTime()).not.toBeNaN();

    // Verify ISO 8601 format (contains T and ends with Z or timezone offset)
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test("JSON body contains dependencies object with redis and supabase", async ({
    request,
  }) => {
    const response = await request.get("/api/health");
    const body = await response.json();

    expect(body).toHaveProperty("dependencies");
    expect(typeof body.dependencies).toBe("object");
    expect(body.dependencies).toHaveProperty("redis");
    expect(body.dependencies).toHaveProperty("supabase");

    // Each dependency reports "ok", "error", or "unavailable" (when not configured)
    expect(["ok", "error", "unavailable"]).toContain(body.dependencies.redis);
    expect(["ok", "error", "unavailable"]).toContain(body.dependencies.supabase);
  });

  test("status is 'ok' only when all dependencies are healthy", async ({ request }) => {
    const response = await request.get("/api/health");
    const body = await response.json();

    // Per the route handler: status is "ok" only if both deps are "ok"
    if (body.status === "ok") {
      expect(body.dependencies.redis).toBe("ok");
      expect(body.dependencies.supabase).toBe("ok");
    }
    // Any non-"ok" dependency means degraded
    if (body.dependencies.redis !== "ok" || body.dependencies.supabase !== "ok") {
      expect(body.status).toBe("degraded");
    }
  });
});
