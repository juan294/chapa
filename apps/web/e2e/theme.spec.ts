import { test, expect } from "@playwright/test";

test.describe("Theme toggle — light/dark switching", () => {
  test("clicking theme toggle switches data-theme attribute", async ({
    page,
  }) => {
    await page.goto("/");

    const html = page.locator("html");
    const toggle = page.locator('button[aria-label*="Switch to"]');

    // Get initial theme
    const initialTheme = await html.getAttribute("data-theme");

    // Click toggle
    await toggle.click();

    // Theme should change
    const newTheme = await html.getAttribute("data-theme");
    expect(newTheme).not.toBe(initialTheme);
  });

  test("toggle aria-label updates to reflect available action", async ({
    page,
  }) => {
    await page.goto("/");

    const toggle = page.locator('button[aria-label*="Switch to"]');
    const initialLabel = await toggle.getAttribute("aria-label");

    await toggle.click();

    const newLabel = await toggle.getAttribute("aria-label");
    expect(newLabel).not.toBe(initialLabel);

    // Both labels should be one of the valid values
    const validLabels = ["Switch to light theme", "Switch to dark theme"];
    expect(validLabels).toContain(initialLabel);
    expect(validLabels).toContain(newLabel);
  });

  test("theme persists after page reload", async ({ page }) => {
    await page.goto("/");

    const html = page.locator("html");
    const toggle = page.locator('button[aria-label*="Switch to"]');

    // Switch theme
    await toggle.click();
    const themeAfterToggle = await html.getAttribute("data-theme");

    // Reload page
    await page.reload();

    // Wait for hydration (theme toggle re-renders after hydration)
    await page.locator('button[aria-label*="Switch to"]').waitFor();

    const themeAfterReload = await html.getAttribute("data-theme");
    expect(themeAfterReload).toBe(themeAfterToggle);
  });
});
