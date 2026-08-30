import { test, expect } from "@playwright/test";

test.describe("Landing page — sections and content", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("hero section renders with h1 heading", async ({ page }) => {
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
    await expect(h1).toContainText("Impacto de desarrollador");
  });

  test("hero has CTA linking to GitHub login", async ({ page }) => {
    // The main/hero area has the primary badge CTA (not the nav login).
    const cta = page.locator('main a[href="/api/auth/login"]').first();
    await expect(cta).toBeVisible();
    await expect(cta).toContainText("Consigue tu Chapa");
  });

  test("feature cards render (all 5 features)", async ({ page }) => {
    const features = page.locator("#features");
    await expect(features).toBeAttached();

    // Check for known feature titles (exact match to avoid ambiguity)
    await expect(
      page.getByText("MULTIDIMENSIONAL", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText("ARQUETIPO DE DESARROLLADOR", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText("MÉTRICAS VERIFICADAS", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText("EMBEBIDO EN UN CLIC", { exact: true })
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

  test("hero shows the key numbers", async ({ page }) => {
    // #1215 moved the standalone #stats section into the hero, where the three
    // numbers sit in a <dl> beside the CTAs.
    const stats = page.locator("main dl").first();
    await expect(stats).toBeAttached();

    await expect(stats.getByText("7", { exact: true })).toBeVisible();
    await expect(stats.getByText("arquetipos")).toBeVisible();
    await expect(stats.getByText("5", { exact: true })).toBeVisible();
    await expect(stats.getByText("dimensiones")).toBeVisible();
    await expect(stats.getByText("365", { exact: true })).toBeVisible();
  });

  test("layout fits the device width without forcing a wider viewport", async ({
    page,
  }) => {
    // #1224: an `overflow-x-auto` flex item without `min-w-0` kept its full
    // content width, so the page shrink-to-fit into a layout viewport wider
    // than the screen and the navbar controls landed off-screen - unclickable
    // on a real phone. Assert the page lays out at the device width.
    const { innerWidth, scrollWidth } = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    const viewport = page.viewportSize();
    expect(innerWidth).toBeLessThanOrEqual(viewport!.width + 1);
    expect(scrollWidth).toBeLessThanOrEqual(viewport!.width + 1);
  });

  test("embed snippet section has copy button", async ({ page }) => {
    // The embed snippet section on the landing page
    const copyButton = page.locator("button").filter({ hasText: /copy|copied|copiar|copiado/i });
    // At least one copy button should exist (embed snippet area)
    const count = await copyButton.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("Verify a Badge link points to /verify", async ({ page }) => {
    const verifyLink = page.locator('a[href="/verify"]').first();
    await expect(verifyLink).toBeVisible();
    await expect(verifyLink).toContainText("Verificar una Chapa");
  });

  test("locale switch reloads all landing copy through the canonical URL", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "ES", exact: true }).click();
    await page.getByRole("option", { name: "English" }).click();

    await expect(page).toHaveURL("/");
    await expect(page.locator("h1")).toContainText("Developer impact");
    await expect(
      page.locator('main a[href="/api/auth/login"]').first()
    ).toContainText("Get your badge");

    await page.getByRole("button", { name: "EN", exact: true }).click();
    await page.getByRole("option", { name: "Español" }).click();

    await expect(page).toHaveURL("/");
    await expect(page.locator("h1")).toContainText("Impacto de desarrollador");
    await expect(
      page.locator('main a[href="/api/auth/login"]').first()
    ).toContainText("Consigue tu Chapa");
  });

  test("switching from a directly visited locale route returns to the canonical URL", async ({
    page,
  }) => {
    await page.goto("/es");
    await expect(page.locator("h1")).toContainText("Impacto de desarrollador");

    await page.getByRole("button", { name: "ES", exact: true }).click();
    await page.getByRole("option", { name: "English" }).click();

    await expect(page).toHaveURL("/");
    await expect(page.locator("h1")).toContainText("Developer impact");
  });
});
