import { test, expect } from "@playwright/test";

test.describe("Landing page — sections and content", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("hero section renders with h1 heading", async ({ page }) => {
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
    await expect(h1).toContainText("Developer Impact");
  });

  test("hero has CTA linking to GitHub login", async ({ page }) => {
    // The main/hero area has the "Get Your Badge" button (not the nav login)
    const cta = page.locator('main a[href="/api/auth/login"]').first();
    await expect(cta).toBeVisible();
    await expect(cta).toContainText("Get Your Badge");
  });

  test("feature cards render (all 5 features)", async ({ page }) => {
    const features = page.locator("#features");
    await expect(features).toBeAttached();

    // Check for known feature titles (exact match to avoid ambiguity)
    await expect(
      page.getByText("FOUR DIMENSIONS", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText("DEVELOPER ARCHETYPE", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText("CONFIDENCE RATING", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText("VERIFIED METRICS", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText("ONE-CLICK EMBED", { exact: true })
    ).toBeVisible();
  });

  test('"How it Works" section shows 3 steps', async ({ page }) => {
    const section = page.locator("#how-it-works");
    await expect(section).toBeAttached();

    // The 3 step numbers (scoped to the section to avoid false matches)
    await expect(section.getByText("01", { exact: true })).toBeVisible();
    await expect(section.getByText("02", { exact: true })).toBeVisible();
    await expect(section.getByText("03", { exact: true })).toBeVisible();
  });

  test("stats section shows key numbers", async ({ page }) => {
    const section = page.locator("#stats");
    await expect(section).toBeAttached();

    // Scope to #stats to avoid matching unrelated content
    await expect(section.getByText("6", { exact: true })).toBeVisible();
    await expect(section.getByText("archetypes")).toBeVisible();
    await expect(section.getByText("4", { exact: true })).toBeVisible();
    await expect(section.getByText("dimensions")).toBeVisible();
    await expect(section.getByText("365", { exact: true })).toBeVisible();
  });

  test("embed snippet section has copy button", async ({ page }) => {
    // The embed snippet section on the landing page
    const copyButton = page.locator("button").filter({ hasText: /copy|copied/i });
    // At least one copy button should exist (embed snippet area)
    const count = await copyButton.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("Verify a Badge link points to /verify", async ({ page }) => {
    const verifyLink = page.locator('a[href="/verify"]').first();
    await expect(verifyLink).toBeVisible();
    await expect(verifyLink).toContainText("Verify a Badge");
  });
});
