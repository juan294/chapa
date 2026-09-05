import { test, expect } from "@playwright/test";

test.describe("Ice badge overlay geometry", () => {
  for (const locale of ["en", "es"]) {
    test(`targets the real SVG after rotation (${locale})`, async ({ page }) => {
      await page.goto(`/?lang=${locale}#badge-preview`);
      const overlay = page.locator('[data-hotspot="badge-score"]').locator('..');
      await overlay.waitFor();
      await page.evaluate(() => document.fonts.ready);
      await overlay.evaluate(el => {
        el.parentElement!.style.transform = "rotate(-3deg)";
      });
      for (const [hotspot, marker] of [
        ["archetype", "archetype"], ["watchers", "watchers"],
        ["forks", "forks"], ["stars", "stars"],
        ["heatmap", "activity"], ["radar", "dimensions"], ["craft", "craft"],
      ]) {
        const region = page.locator(`[data-hotspot="badge-${hotspot}"]`);
        const target = page.locator(`svg [data-element="${marker}"]`).first();
        await expect.poll(async () => {
          const actual = await region.boundingBox();
          const expected = await target.boundingBox();
          if (!actual || !expected) return Infinity;
          return Math.max(...(["x", "y", "width", "height"] as const).map(key => Math.abs(actual[key] - expected[key])));
        }).toBeLessThan(2);
      }
      await expect(page.locator('[data-hotspot]')).toHaveCount(11);
      const described = await page.locator('[data-hotspot]').evaluateAll(elements => elements.every(el => {
        const description = document.getElementById(el.getAttribute('aria-describedby')!);
        return el.tabIndex === -1 && Boolean(description?.textContent?.trim());
      }));
      expect(described).toBe(true);
    });
  }
});
