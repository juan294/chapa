import { test, expect } from "@playwright/test";

test.describe("Theme toggle — light/dark switching", () => {
  test("theme toggle cycles system, light and dark", async ({ page }) => {
    await page.goto("/");

    const toggle = page.locator('button[aria-label*="Cambiar"]');
    // #1211 made this a three-mode cycle, so a single click no longer has to
    // change data-theme: system -> light leaves a light-resolved page light.
    // The control reports the mode it is in, which is what to assert.
    const seen: (string | null)[] = [];
    for (let i = 0; i < 4; i++) {
      seen.push(await toggle.getAttribute("data-theme-mode"));
      await toggle.click();
    }

    expect(new Set(seen)).toEqual(new Set(["system", "light", "dark"]));
    // Four clicks from any start returns to where it began.
    expect(seen[3]).toBe(seen[0]);
  });

  test("forcing a mode sets data-theme on the document", async ({ page }) => {
    await page.goto("/");

    const html = page.locator("html");
    const toggle = page.locator('button[aria-label*="Cambiar"]');

    // Click until the cycle reaches dark, then light: both are explicit
    // choices, so each must be reflected on the document.
    for (let i = 0; i < 3; i++) {
      if ((await toggle.getAttribute("data-theme-mode")) === "dark") break;
      await toggle.click();
    }
    await expect(html).toHaveAttribute("data-theme", "dark");

    await toggle.click(); // dark -> system
    await toggle.click(); // system -> light
    await expect(html).toHaveAttribute("data-theme", "light");
  });

  test("toggle aria-label updates to reflect available action", async ({
    page,
  }) => {
    await page.goto("/");

    const toggle = page.locator('button[aria-label*="Cambiar"]');
    const initialLabel = await toggle.getAttribute("aria-label");

    await toggle.click();

    const newLabel = await toggle.getAttribute("aria-label");
    expect(newLabel).not.toBe(initialLabel);

    // Both labels should be one of the valid values. #1211 added the third
    // mode, so the label can also name the system option.
    const validLabels = [
      "Cambiar a tema claro",
      "Cambiar a tema oscuro",
      "Cambiar al tema del sistema",
    ];
    expect(validLabels).toContain(initialLabel);
    expect(validLabels).toContain(newLabel);
  });

  test("theme persists after page reload", async ({ page }) => {
    await page.goto("/");

    const html = page.locator("html");
    const toggle = page.locator('button[aria-label*="Cambiar"]');

    // Switch theme
    await toggle.click();
    const themeAfterToggle = await html.getAttribute("data-theme");

    // Reload page
    await page.reload();

    // Wait for hydration (theme toggle re-renders after hydration)
    await page.locator('button[aria-label*="Cambiar"]').waitFor();

    const themeAfterReload = await html.getAttribute("data-theme");
    expect(themeAfterReload).toBe(themeAfterToggle);
  });
});
