import { test, expect, type Page } from "@playwright/test";
import { switchLocale } from "./helpers/locale-switch";

async function expectLandingLocale(page: Page, locale: "en" | "es") {
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
  // Streaming navigation may temporarily retain the outgoing hidden page.
  const hero = page.locator("main #hero:visible");
  await expect(hero).toHaveCount(1);
  const heading = hero.getByRole("heading", { level: 1 });
  await expect(heading).toHaveCount(1);
  await expect(heading).toBeVisible();
  await expect(heading).toContainText(locale === "en" ? "GOOD WORK" : "EL BUEN TRABAJO");
  const cta = hero.getByRole("link", { name: locale === "en" ? "Open the Creator Studio ↗" : "Abre el Estudio de Creación ↗", exact: true });
  await expect(cta).toHaveCount(1);
  await expect(cta).toBeVisible();
  await expect(cta).toHaveAttribute("href", "/studio");
}

test.describe("Landing page — sections and content", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("hero section renders with h1 heading", async ({ page }) => {
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
    await expect(h1).toContainText("EL BUEN TRABAJO");
  });

  test("hero has CTA linking to Creator Studio", async ({ page }) => {
    // The main/hero area has the primary badge CTA (not the nav login).
    const cta = page.locator('main a[href="/studio"]').first();
    await expect(cta).toBeVisible();
    await expect(cta).toContainText("Abre el Estudio de Creación");
  });

  test("explorer exposes all seven archetypes with one selected tab", async ({ page }) => {
    const features = page.locator("#features");
    await expect(features.getByRole("tab")).toHaveCount(7);
    await expect(features.getByRole("tab", { selected: true })).toHaveCount(1);
    await expect(features.getByRole("tabpanel")).toBeAttached();
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
    await switchLocale(page, "ES", "English", "/");
    await expectLandingLocale(page, "en");

    await switchLocale(page, "EN", "Español", "/");
    await expectLandingLocale(page, "es");
  });

  test("switching from a directly visited locale route returns to the canonical URL", async ({
    page,
  }) => {
    await page.goto("/es");
    await expectLandingLocale(page, "es");

    await switchLocale(page, "ES", "English", "/");
    await expectLandingLocale(page, "en");
  });
});
