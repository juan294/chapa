import { test, expect } from "@playwright/test";

test.describe("Ice badge overlay geometry", () => {
  for (const locale of ["en", "es"]) {
    test(`targets the real SVG after rotation (${locale})`, async ({ page }) => {
      await page.goto(`/?lang=${locale}#badge-preview`);
      // A streamed locale transition can temporarily retain a hidden tree.
      // Measure only the one visible hero, including its own SVG targets.
      const preview = page.locator('#badge-preview:visible');
      await expect(preview).toHaveCount(1);
      const overlay = preview.locator('[data-hotspot="badge-score"]').locator('..');
      await expect(overlay).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await overlay.evaluate(el => {
        el.parentElement!.style.transform = "rotate(-3deg)";
      });
      for (const [hotspot, marker] of [
        ["archetype", "archetype"], ["watchers", "watchers"],
        ["forks", "forks"], ["stars", "stars"],
        ["heatmap", "activity"], ["radar", "dimensions"], ["craft", "craft"],
      ]) {
        const region = preview.locator(`[data-hotspot="badge-${hotspot}"]`);
        const target = preview.locator(`svg [data-element="${marker}"]`);
        await expect.poll(async () => {
          const actual = await region.boundingBox();
          const expected = await target.boundingBox();
          if (!actual || !expected) return Infinity;
          return Math.max(...(["x", "y", "width", "height"] as const).map(key => Math.abs(actual[key] - expected[key])));
        }).toBeLessThan(2);
      }
      await expect(preview.locator('[data-hotspot]')).toHaveCount(11);
      const described = await preview.locator('[data-hotspot]').evaluateAll(elements => elements.every(el => {
        const description = document.getElementById(el.getAttribute('aria-describedby')!);
        return el.tabIndex === -1 && Boolean(description?.textContent?.trim());
      }));
      expect(described).toBe(true);
    });
  }
});
