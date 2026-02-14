import { test, expect } from "@playwright/test";

test.describe("Navigation — navbar and footer", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("navbar is visible with Chapa_ logo", async ({ page }) => {
    const nav = page.locator("nav");
    await expect(nav).toBeVisible();

    const logo = nav.locator('a[href="/"]');
    await expect(logo).toBeVisible();
    await expect(logo).toContainText("Chapa");
  });

  test("logo links to home page", async ({ page }) => {
    const logo = page.locator('nav a[href="/"]');
    await logo.click();
    await expect(page).toHaveURL("/");
  });

  test("login link is visible when unauthenticated", async ({ page }) => {
    const loginLink = page.locator('nav a[href="/api/auth/login"]');
    await expect(loginLink).toBeVisible();
    await expect(loginLink).toContainText("login");
  });

  test("theme toggle button is present in navbar", async ({ page }) => {
    const toggle = page.locator('nav button[aria-label*="Switch to"]');
    await expect(toggle).toBeVisible();
  });

  test("nav links are visible on desktop", async ({ page }) => {
    // Nav links are hidden on mobile (hidden md:flex)
    await page.setViewportSize({ width: 1280, height: 720 });

    const nav = page.locator("nav");
    await expect(nav.locator('a[href="#features"]')).toBeVisible();
    await expect(nav.locator('a[href="#how-it-works"]')).toBeVisible();
    await expect(nav.locator('a[href="#stats"]')).toBeVisible();
  });

  test("footer renders with links to About, Terms, Privacy", async ({
    page,
  }) => {
    const footer = page.locator("footer");
    await expect(footer).toBeVisible();

    await expect(footer.locator('a[href="/about"]')).toBeVisible();
    await expect(footer.locator('a[href="/terms"]')).toBeVisible();
    await expect(footer.locator('a[href="/privacy"]')).toBeVisible();
  });

  test("footer shows copyright and GitHub branding", async ({ page }) => {
    const footer = page.locator("footer");
    await expect(footer).toContainText("Chapa");
    await expect(footer).toContainText("Powered by GitHub");
  });
});
