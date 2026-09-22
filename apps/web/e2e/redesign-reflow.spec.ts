import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const evidence = resolve(process.env.REDESIGN_EVIDENCE_DIR ?? resolve(__dirname, "../../../logs/v7-point/browser/redesign"), "reflow");
for (const locale of ['en', 'es']) for (const theme of ['light', 'dark'] as const) {
  test(`${locale}/${theme}: landing reflows at tablet and 320px with keyboard access`, async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.addInitScript(t => localStorage.setItem('theme', t), theme);
    await page.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
    for (const width of [768, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`/?lang=${locale}`, { waitUntil: 'networkidle' });
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect(page.locator('[data-theme-mode]')).toHaveAttribute('data-theme-mode', theme);
      await expect(page.locator('h1')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      const input = page.locator('#terminal-command-input');
      await expect(async () => {
        await page.locator('h1').click();
        await page.keyboard.press('ControlOrMeta+k');
        await expect(input).toBeFocused({ timeout: 500 });
      }).toPass();
      const bounds = await input.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      const tab = page.getByRole('tab').first();
      await tab.focus(); await tab.press('End');
      await expect(page.getByRole('tab').last()).toBeFocused();
      await page.evaluate(async () => { await document.fonts.ready; scrollTo({ top: 0, behavior: 'instant' }); });
      await mkdir(evidence, { recursive: true });
      await page.screenshot({ path: `${evidence}/${locale}-${theme}-${width}-${testInfo.project.name}.png`, fullPage: true });
    }
    // CSS zoom exercises enlarged layout/text; 320px above separately checks reflow.
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
    expect(await page.evaluate(() => document.documentElement.getBoundingClientRect().width)).toBeLessThanOrEqual(1440);
    await expect(page.locator('#terminal-command-input')).toBeVisible();
  });
}

test('language changes preserve relevant search and hash in both directions', async ({ page }) => {
  await page.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
  await page.goto('/?lang=en&source=redesign#features', { waitUntil: 'networkidle' });
  for (const [current, next, option] of [['EN', 'es', 'Español'], ['ES', 'en', 'English']] as const) {
    await page.getByRole('button', { name: current, exact: true }).click();
    await page.getByRole('option', { name: option, exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', next);
    const url = new URL(page.url());
    expect(url.pathname).toBe('/');
    expect(url.searchParams.get('source')).toBe('redesign');
    expect(url.hash).toBe('#features');
  }
});
