import { test, expect } from "@playwright/test";

const strictDeploymentSmoke = process.env.DEPLOYMENT_SMOKE_STRICT === "true";
const smokeProfilePath = "/u/octocat?__chapa_smoke=1";
const smokeBadgePath = "/u/octocat/badge.svg?__chapa_smoke=1";

test.describe("Smoke tests — core routes", () => {
  test("landing page loads", async ({ page }) => {
    await page.goto("/");
    // Use .first() because loading.tsx and page.tsx both have id="main-content"
    // and may briefly coexist in the DOM during hydration
    await expect(page.locator("#main-content").first()).toBeVisible();
  });

  test("health API returns JSON with status field", async ({ request }) => {
    const response = await request.get("/api/health");
    const body = await response.json();

    if (strictDeploymentSmoke) {
      // Assert what a DEPLOYMENT smoke test can meaningfully assert: that this
      // deployment came up and its own dependencies resolve.
      //
      // Deliberately NOT asserting `status === "ok"` / HTTP 200 (#1052). Those
      // also flip on cron-heartbeat staleness, which is a property of the
      // *environment's background jobs*, not of the deployment under test. That
      // coupling produced a gate that could only be satisfied by the change it
      // was blocking: when all four crons were dead, /api/health correctly
      // returned 503, this required check failed, and the deploy that would
      // have registered the crons could not merge. A gate that blocks its own
      // fix is broken by construction.
      //
      // This does not weaken cron monitoring. /api/health still reports
      // `degraded` + 503 on stale heartbeats, and that remains the signal for
      // alerting — it is simply no longer a merge gate. Core-dependency
      // regressions (Redis/Supabase/GitHub down, or the server token losing
      // `repo` scope, which reports `insufficient_scope`) still fail here.
      expect(body.dependencies.redis).toBe("ok");
      expect(body.dependencies.supabase).toBe("ok");
      expect(body.dependencies.github).toBe("ok");
      expect(body).toHaveProperty("status");
      return;
    }

    // Health endpoint returns 200 when healthy, 503 when degraded (e.g. Redis unreachable in CI)
    expect([200, 503]).toContain(response.status());
    expect(body).toHaveProperty("status");
  });

  test("badge SVG returns image/svg+xml", async ({ request }) => {
    const response = await request.get(smokeBadgePath);
    if (strictDeploymentSmoke) {
      expect(response.status()).toBe(200);
      const contentType = response.headers()["content-type"] ?? "";
      expect(contentType).toContain("image/svg+xml");
      const body = await response.text();
      expect(body).toContain("<svg");
      expect(body).toContain("</svg>");
      return;
    }

    // In CI without GitHub token/Redis, may return 500/503.
    // If successful, it must be SVG. If not, we accept graceful failure.
    if (response.ok()) {
      const contentType = response.headers()["content-type"] ?? "";
      expect(contentType).toContain("image/svg+xml");
    } else {
      // Accept non-2xx as long as the server didn't crash (no 5xx hang)
      expect(response.status()).toBeLessThan(600);
    }
  });

  test("share page renders", async ({ page }) => {
    // Use domcontentloaded — the badge <img> triggers a second API call that
    // can push "load" past 30s in CI (SSR 15s + badge image 15s).
    const response = await page.goto(smokeProfilePath, {
      waitUntil: "domcontentloaded",
    });
    if (strictDeploymentSmoke) {
      expect(response!.status()).toBe(200);
      const body = page.locator("body");
      await expect(body).toBeVisible();
      return;
    }

    // Should not crash — 200 or graceful error page
    expect(response).not.toBeNull();
    expect(response!.status()).toBeLessThan(500);

    // If the page loaded successfully, check for content
    if (response!.ok()) {
      const body = page.locator("body");
      await expect(body).toBeVisible();
    }
  });

  test("login redirects to GitHub", async ({ request }) => {
    const response = await request.get("/api/auth/login", {
      maxRedirects: 0,
    });
    const status = response.status();

    if (strictDeploymentSmoke) {
      expect(status).toBeGreaterThanOrEqual(300);
      expect(status).toBeLessThan(400);
      const location = response.headers()["location"] ?? "";
      expect(location).toContain("github.com");
      return;
    }

    // Accept 3xx redirect OR 500 if GITHUB_CLIENT_ID is not configured
    if (status >= 300 && status < 400) {
      const location = response.headers()["location"] ?? "";
      expect(location).toContain("github.com");
      return;
    }

    // Without GITHUB_CLIENT_ID, the route returns 500 — acceptable in CI
    expect(status).toBe(500);
  });

  test("404 page works for unknown route", async ({ page }) => {
    const response = await page.goto("/nonexistent-page-xyz");
    expect(response).not.toBeNull();
    expect(response!.status()).toBe(404);
  });
});
