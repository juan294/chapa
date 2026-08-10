import { test, expect } from "@playwright/test";

test.describe("Generation locale — /generating/:handle", () => {
  test("English deep link keeps signed-out error and retry state coherent", async ({
    page,
  }) => {
    const path = "/generating/chapa-e2e-release-locale?lang=en";
    const response = await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(response).not.toBeNull();
    expect(response!.status()).toBeLessThan(500);

    await expect(page).toHaveTitle(
      "Generating badge — @chapa-e2e-release-locale — Chapa",
    );
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Generating badge for",
    );
    await expect(page.locator("main").getByRole("alert")).toContainText(
      "Something went wrong generating your badge.",
    );
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("link", { name: "Try again" })).toHaveAttribute(
      "href",
      path,
    );
  });
});
