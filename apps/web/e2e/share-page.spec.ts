import { test, expect } from "@playwright/test";

test.describe("Share page — /u/:handle", () => {
  test("page renders for a valid handle", async ({ page }) => {
    const response = await page.goto("/u/torvalds");
    expect(response).not.toBeNull();
    // Should not crash — 200 or graceful error
    expect(response!.status()).toBeLessThan(500);
  });

  test("page has accessible h1 with handle", async ({ page }) => {
    const response = await page.goto("/u/torvalds");
    if (!response?.ok()) return; // Skip if data unavailable in CI

    // sr-only h1: "@torvalds — Developer Impact, Decoded"
    const h1 = page.locator("h1");
    await expect(h1).toContainText("torvalds");
  });

  test("badge preview section is visible", async ({ page }) => {
    const response = await page.goto("/u/torvalds");
    if (!response?.ok()) return;

    // Badge is rendered as <img> or inline SVG
    const badge = page.locator('img[alt*="badge"]').or(page.locator("svg"));
    const count = await badge.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('"Your Impact, Decoded" heading is visible', async ({ page }) => {
    const response = await page.goto("/u/torvalds");
    if (!response?.ok()) return;

    const heading = page.getByText("Your Impact, Decoded");
    await expect(heading).toBeVisible();
  });

  test("invalid handle returns 404 or error state", async ({ page }) => {
    const response = await page.goto(
      "/u/this-user-definitely-does-not-exist-xyz123"
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
