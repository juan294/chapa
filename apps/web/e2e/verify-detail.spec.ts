import { test, expect } from "@playwright/test";

test.describe("Verification detail — /verify/:hash", () => {
  test("query locale keeps the server body and shared navbar coherent", async ({
    page,
  }) => {
    const englishResponse = await page.goto(
      "/u/octocat?__chapa_smoke=1&lang=en",
      { waitUntil: "domcontentloaded" },
    );
    expect(englishResponse).not.toBeNull();
    expect(englishResponse!.status()).toBeLessThan(500);
    // #1217 made the h1 the profile identity, which is the same in both
    // locales. The badge's accessible label is what proves the English deep
    // link rendered in English.
    await expect(page.locator("h1")).toHaveText("octocat");
    await expect(
      page.getByRole("img", { name: "Chapa badge for octocat" }),
    ).toBeAttached();

    const response = await page.goto("/verify/not-valid!?lang=es", {
      waitUntil: "domcontentloaded",
    });
    expect(response).not.toBeNull();
    expect(response!.status()).toBeLessThan(500);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Hash inválido",
    );
    await expect(
      page.getByRole("button", { name: "ES", exact: true }),
    ).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
  });
});
