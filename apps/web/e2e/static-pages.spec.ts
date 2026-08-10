import { test, expect } from "@playwright/test";

test.describe("Static pages — load and render", () => {
  test("/about loads with heading", async ({ page }) => {
    await page.goto("/about");
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
    await expect(h1).toContainText("Acerca de");
  });

  test("/about/scoring loads with heading", async ({ page }) => {
    await page.goto("/about/scoring");
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
    await expect(h1).toContainText("Metodología");
  });

  test("/privacy loads with heading", async ({ page }) => {
    await page.goto("/privacy");
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
    await expect(h1).toContainText("privacidad");
  });

  test("/terms loads with heading", async ({ page }) => {
    await page.goto("/terms");
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
    await expect(h1).toContainText("Términos");
  });

  test("/verify loads with heading and form input", async ({ page }) => {
    await page.goto("/verify");
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
    await expect(h1).toContainText("Verificar una Chapa");

    // Form with hash input should be present
    const input = page.locator("#hash-input");
    await expect(input).toBeVisible();
  });

  test("/verify explicit locale wins over a conflicting saved locale", async ({
    page,
    baseURL,
  }) => {
    if (!baseURL) throw new Error("Playwright baseURL is required");
    await page.context().addCookies([
      {
        name: "chapa-locale",
        value: "en",
        url: new URL("/", baseURL).origin,
      },
    ]);

    await page.goto("/verify?lang=es");

    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await expect(page.locator("h1")).toContainText("Verificar una Chapa");
    await expect(
      page.getByRole("button", { name: "ES", exact: true }),
    ).toBeVisible();
  });

  test("/verify form validates hex hash input", async ({ page }) => {
    await page.goto("/verify");

    const input = page.locator("#hash-input");
    const submitBtn = page.locator('button:has-text("Verificar")');

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
    await expect(h1).toContainText("Quality Champion");
  });

  test("archetype page has back link to features", async ({ page }) => {
    await page.goto("/archetypes/marathoner");
    const backLink = page.locator('a[href="/#features"]');
    await expect(backLink).toBeVisible();
    await expect(backLink).toContainText("Volver");
  });
});
