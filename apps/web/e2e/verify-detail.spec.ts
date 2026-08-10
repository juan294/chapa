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
    await expect(page.locator("h1")).toHaveText("octocat's developer impact");

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
