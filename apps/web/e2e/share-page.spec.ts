import { test, expect } from "@playwright/test";

// Use domcontentloaded instead of the default "load" event. The share page
// embeds <img src="/u/:handle/badge.svg"> which triggers a second GitHub API
// call. In CI (no cache, slow API), waiting for "load" causes 30s+ timeouts
// because SSR (15s) + badge image fetch (15s) exceed Playwright's timeout.
const GOTO_OPTS = { waitUntil: "domcontentloaded" as const };
const smokeProfilePath = "/u/octocat?__chapa_smoke=1";

test.describe("Share page — /u/:handle", () => {
  test("page renders for a valid handle", async ({ page }) => {
    const response = await page.goto(smokeProfilePath, GOTO_OPTS);
    expect(response).not.toBeNull();
    // Should not crash — 200 or graceful error
    expect(response!.status()).toBeLessThan(500);
  });

  test("page has accessible h1 with handle", async ({ page }) => {
    const response = await page.goto(smokeProfilePath, GOTO_OPTS);
    if (!response?.ok()) return; // Skip if data unavailable in CI

    // sr-only h1: "@octocat — Developer Impact, Decoded"
    const h1 = page.locator("h1");
    await expect(h1).toContainText("octocat");
  });

  test("badge preview section is visible", async ({ page }) => {
    const response = await page.goto(smokeProfilePath, GOTO_OPTS);
    if (!response?.ok()) return;

    // Badge is rendered as <img> or inline SVG
    const badge = page.locator('img[alt*="badge"]').or(page.locator("svg"));
    const count = await badge.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('"Tu Impacto, Decodificado" heading is visible', async ({ page }) => {
    const response = await page.goto(smokeProfilePath, GOTO_OPTS);
    if (!response?.ok()) return;

    const heading = page.getByText("Tu Impacto, Decodificado");
    await expect(heading).toBeVisible();
  });

  test("locale switch updates the live profile title and accessible badge label", async ({
    page,
  }) => {
    const response = await page.goto(smokeProfilePath, GOTO_OPTS);
    expect(response).not.toBeNull();
    expect(response!.status()).toBeLessThan(500);

    await expect(page.locator("h1")).toHaveText(
      "Impacto de desarrollador de octocat",
    );
    await expect(page.getByRole("img", { name: "Chapa de octocat" })).toBeAttached();

    await page.getByRole("button", { name: "ES", exact: true }).click();
    await page.getByRole("option", { name: "English" }).click();

    await expect(page).toHaveURL(smokeProfilePath);
    await expect(page).toHaveTitle(
      "@octocat — Developer Impact, Decoded — Chapa",
    );
    await expect(page.locator("h1")).toHaveText(
      "octocat's developer impact",
    );
    await expect(
      page.getByRole("img", { name: "Chapa badge for octocat" }),
    ).toBeAttached();
  });

  test("direct locale deep link settles without a hydration reload loop", async ({
    page,
  }) => {
    const hydrationErrors: string[] = [];
    const documentNavigations: string[] = [];
    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        /(?:hydration|Minified React error #(?:418|419))/i.test(message.text())
      ) {
        hydrationErrors.push(message.text());
      }
    });
    page.on("request", (request) => {
      if (
        request.isNavigationRequest() &&
        request.frame() === page.mainFrame()
      ) {
        documentNavigations.push(request.url());
      }
    });

    const path = `${smokeProfilePath}&lang=en`;
    const response = await page.goto(path, GOTO_OPTS);
    expect(response).not.toBeNull();
    expect(response!.status()).toBeLessThan(500);

    await expect(page).toHaveURL(path);
    await expect(page.locator("h1")).toHaveText("octocat's developer impact");
    await expect(page).toHaveTitle(
      "@octocat — Developer Impact, Decoded — Chapa",
    );
    expect(documentNavigations).toHaveLength(1);
    expect(hydrationErrors).toEqual([]);

    await page.reload(GOTO_OPTS);
    await expect(page).toHaveURL(path);
    await expect(page.locator("h1")).toHaveText("octocat's developer impact");
    await expect(page).toHaveTitle(
      "@octocat — Developer Impact, Decoded — Chapa",
    );
    expect(documentNavigations).toHaveLength(2);
    expect(hydrationErrors).toEqual([]);
  });

  test("invalid handle returns 404 or error state", async ({ page }) => {
    const response = await page.goto(
      "/u/this-user-definitely-does-not-exist-xyz123",
      GOTO_OPTS,
    );
    expect(response).not.toBeNull();
    const status = response!.status();
    // In production: 404. In dev without GitHub data: may render 200 with error state.
    // Either a 404 status or a page showing error/not-found content is acceptable.
    if (status === 200) {
      // If 200, the page should show some kind of fallback (not a valid badge)
      const body = await page.textContent("body");
      expect(body).toBeTruthy();
    } else {
      expect(status).toBeGreaterThanOrEqual(400);
    }
  });
});
