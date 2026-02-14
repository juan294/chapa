import { test, expect } from "@playwright/test";

test.describe("Static pages — load and render", () => {
  test("/about loads with heading", async ({ page }) => {
    await page.goto("/about");
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
    await expect(h1).toContainText("About");
  });

  test("/about/scoring loads with heading", async ({ page }) => {
    await page.goto("/about/scoring");
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
    await expect(h1).toContainText("Scoring Methodology");
  });

  test("/privacy loads with heading", async ({ page }) => {
    await page.goto("/privacy");
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
    await expect(h1).toContainText("Privacy");
  });

  test("/terms loads with heading", async ({ page }) => {
    await page.goto("/terms");
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
    await expect(h1).toContainText("Terms");
  });

  test("/verify loads with heading and form input", async ({ page }) => {
    await page.goto("/verify");
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
    await expect(h1).toContainText("Verify");

    // Form with hash input should be present
    const input = page.locator("#hash-input");
    await expect(input).toBeVisible();
  });

  test("/verify form validates hex hash input", async ({ page }) => {
    await page.goto("/verify");

    const input = page.locator("#hash-input");
    const submitBtn = page.locator('button:has-text("Verify")');

    // Submit with invalid input
    await input.fill("not-a-hex");
    await submitBtn.click();

    // Should show error (stay on /verify, not navigate)
    await expect(page).toHaveURL(/\/verify$/);
  });

  test("archetype page /archetypes/builder loads", async ({ page }) => {
    await page.goto("/archetypes/builder");
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
    await expect(h1).toContainText("Builder");
  });

  test("archetype page /archetypes/guardian loads", async ({ page }) => {
    await page.goto("/archetypes/guardian");
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
    await expect(h1).toContainText("Guardian");
  });

  test("archetype page has back link to features", async ({ page }) => {
    await page.goto("/archetypes/marathoner");
    const backLink = page.locator('a[href="/#features"]');
    await expect(backLink).toBeVisible();
    await expect(backLink).toContainText("Back to features");
  });
});
