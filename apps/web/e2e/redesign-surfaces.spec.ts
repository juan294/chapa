import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { badgeTheme } from '../lib/render/theme';
import { DEFAULT_BADGE_CONFIG } from '@chapa/shared';
import { REDESIGN_VALID_HASH, setRedesignSession, redesignFixtureClient } from './helpers/redesign-fixtures';

// These checks require the explicit disposable bootstrap and server-only replay.
// The final local gate enables them; ordinary unseeded CI does not claim them.
test.skip(process.env.REDESIGN_DISPOSABLE_PROJECT !== 'chapa-redesign', 'requires disposable local redesign fixtures');
const evidence = resolve(__dirname, '../../../docs/plans/2026-09-05-chapa-redesign-phases/evidence/phase4/surfaces');
async function command(page: Page, text: string) {
  const input = page.locator('#terminal-command-input');
  await input.fill(text); await input.press('Enter');
}
async function capture(page: Page, name: string) {
  if (await page.locator('nav').count()) {
    await expect(page.locator('[data-theme-mode]')).toBeVisible();
    await expect(page.getByTestId('navbar-auth-placeholder')).toHaveCount(0);
  }
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(img => img.decode().catch(() => undefined))); });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await mkdir(evidence, { recursive: true });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: `${evidence}/${name}-viewport.png` });
  await page.screenshot({ path: `${evidence}/${name}.png`, fullPage: true });
}

for (const locale of ['en', 'es']) for (const theme of ['light', 'dark'] as const) {
  test(`${locale}/${theme}: owner Studio, visitor share and authenticated product surfaces`, async ({ page, context, baseURL }, testInfo) => {
    test.setTimeout(120_000);
    const width = testInfo.project.name === 'mobile' ? 390 : 1440;
    const owner = `chapa-redesign-${locale}-${theme}-${width === 390 ? 'mobile' : 'desktop'}`;
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await context.addCookies([{ name: 'chapa-locale', value: locale, url: baseURL! }]);
    await page.addInitScript(t => localStorage.setItem('theme', t), theme);
    await page.route('**/*', route => {
      const host = new URL(route.request().url()).hostname;
      return ['localhost', '127.0.0.1', '[::1]'].includes(host) ? route.continue() : route.abort();
    });
    await setRedesignSession(context, baseURL!, owner);
    await page.goto(`/studio?lang=${locale}`, { waitUntil: 'networkidle' });
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.locator('#terminal-command-input')).toBeVisible();
    await expect(page.getByTestId('badge-preview').locator('svg')).toHaveCount(1);
    await expect(page.getByTestId('badge-preview').locator('svg')).toBeVisible();
    await expect(page.getByTestId('studio-root')).toBeVisible();
    expect(await page.getByTestId('studio-stage').evaluate(e => e.getBoundingClientRect().top)).toBeGreaterThanOrEqual(69);
    await command(page, '/reset');
    await page.getByTestId('studio-save').click();
    await expect(page.locator('[data-save-state="saved"]')).toBeVisible();
    await capture(page, `studio-${locale}-${theme}-${width}`);
    for (const zoom of ['half', 'full', 'fit']) {
      await page.getByTestId(`studio-zoom-${zoom}`).click();
      await expect(page.getByTestId(`studio-zoom-${zoom}`)).toHaveAttribute('aria-pressed', 'true');
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
    }
    await command(page, '/set bg aurora');
    await command(page, '/set palette jade');
    for (const change of ['/set card frost', '/set border gradient-rotating', '/set score chrome', '/set heatmap ripple', '/set tier enhanced']) await command(page, change);
    await expect(page.locator('[data-save-state="dirty"]')).toBeVisible();
    await expect(page.getByTestId('badge-preview').locator('[data-element=archetype] rect')).toHaveAttribute('fill', badgeTheme('jade').bg);
    expect(await page.getByTestId('badge-preview').locator('svg').evaluate((e: SVGSVGElement) => e.animationsPaused())).toBe(true);
    await page.route('**/api/studio/config', route => route.request().method() === 'PUT' ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Local test failure' }) }) : route.continue());
    await page.getByTestId('studio-save').click();
    await expect(page.locator('[data-save-state="error"]')).toBeVisible();
    await capture(page, `studio-error-${locale}-${theme}-${width}`);
    await page.unroute('**/api/studio/config');
    const save = page.waitForResponse(r => r.url().includes('/api/studio/config') && r.request().method() === 'PUT');
    await page.getByTestId('studio-save').click();
    const response = await save;
    expect(response.status()).toBe(200);
    const serialized = response.request().postDataJSON();
    expect(Object.keys(serialized).sort()).toEqual(Object.keys(DEFAULT_BADGE_CONFIG).sort());
    expect(serialized.colorPalette).toBe('jade');
    await expect(page.locator('[data-save-state="saved"]')).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('badge-preview').locator('[data-element=archetype] rect')).toHaveAttribute('fill', badgeTheme('jade').bg);
    // Hold the real save response after the local DB write, then edit again.
    // The in-flight snapshot is persisted; the later preview must remain dirty.
    let releaseSave!: () => void;
    let saveEntered!: () => void;
    const release = new Promise<void>(resolve => { releaseSave = resolve; });
    const entered = new Promise<void>(resolve => { saveEntered = resolve; });
    await page.route('**/api/studio/config', async route => {
      if (route.request().method() !== 'PUT') return route.continue();
      const persistedResponse = await route.fetch();
      saveEntered(); await release;
      await route.fulfill({ response: persistedResponse });
    });
    await command(page, '/set bg particles');
    await page.getByTestId('studio-save').click();
    await entered;
    await command(page, '/set bg solid');
    releaseSave();
    await expect(page.locator('[data-save-state="dirty"]')).toBeVisible();
    await page.unroute('**/api/studio/config');
    const persisted = await page.request.get('/api/studio/config');
    expect(await persisted.json()).toMatchObject({ config: { background: 'particles' } });
    await capture(page, `studio-save-race-${locale}-${theme}-${width}`);
    await page.getByTestId('studio-save').click();
    await expect(page.locator('[data-save-state="saved"]')).toBeVisible();

    await command(page, '/reset'); await page.getByTestId('studio-save').click();
    await expect(page.locator('[data-save-state="saved"]')).toBeVisible();
    for (const route of ['settings', 'admin', 'cli/authorize?session=local-redesign-device']) {
      await page.goto(`/${route}${route.includes('?') ? '&' : '?'}lang=${locale}`);
      await expect(page.locator('h1').first()).toBeVisible();
      if (route === 'settings') { await expect(page.getByTestId('settings-identity')).toContainText(owner); await expect(page.getByTestId('settings-connection-bitbucket')).toBeVisible(); await expect(page.getByTestId('settings-insights')).toBeVisible(); }
      if (route === 'admin') { await expect(page.getByRole('tab', { name: 'Users', exact: true })).toBeVisible(); await expect(page.locator(`tbody a[href="/u/${owner}"]`)).toBeVisible(); }
      await capture(page, `${route.split('/')[0]}-${locale}-${theme}-${width}`);
    }
    const db = redesignFixtureClient();
    const invalid = await db.from('studio_configs').update({ config: { ...DEFAULT_BADGE_CONFIG, colorPalette: 'invalid-local-fixture' } }).eq('handle', owner);
    expect(invalid.error).toBeNull();
    try {
      await page.goto(`/studio?lang=${locale}`, { waitUntil: 'networkidle' });
      const retry = page.getByRole('button', { name: locale === 'en' ? 'Try again' : 'Intentar de nuevo', exact: true });
      await expect(retry).toBeVisible();
      await expect(page.getByTestId('studio-root')).toHaveCount(0);
      await capture(page, `studio-route-error-${locale}-${theme}-${width}`);
    } finally {
      const restored = await db.from('studio_configs').update({ config: DEFAULT_BADGE_CONFIG }).eq('handle', owner);
      expect(restored.error).toBeNull();
    }
    await context.clearCookies({ name: 'chapa_session' });
    await page.goto(`/u/octocat?lang=${locale}`);
    await expect(page.locator('h1')).toHaveText('octocat');
    await expect(page.locator('svg[data-badge-design]')).toBeVisible();
    await expect(page.locator('svg[data-badge-design] [data-element=archetype] rect')).toHaveAttribute('fill', badgeTheme('jade').bg);
    await expect(page.getByText(locale === 'en' ? 'Embed this badge' : 'Incrustar esta Chapa', { exact: false })).toBeVisible();
    const profile = await page.request.get('/api/profile/octocat');
    expect(profile.ok()).toBe(true);
    expect(await profile.text()).not.toMatch(/"confidence(?:Penalties)?"/);
    await capture(page, `share-${locale}-${theme}-${width}`);
    await page.goto(`/verify/${REDESIGN_VALID_HASH}?lang=${locale}`);
    await expect(page.locator('h1')).toHaveText(locale === 'en' ? 'Badge verified' : 'Chapa verificada');
    await expect(page.getByText('@chapa-redesign-owner')).toBeVisible();
    await capture(page, `verify-${locale}-${theme}-${width}`);
    await page.goto(`/studio?demo=1&lang=${locale}`);
    await expect(page.getByTestId('studio-demo-marker')).toBeVisible();
    await expect(page.getByTestId('badge-preview').locator('[data-element=score]')).toHaveText('82');
    await capture(page, `studio-demo-${locale}-${theme}-${width}`);
    const controls = page.getByRole('button', { name: locale === 'en' ? 'Quick Controls' : 'Controles rápidos', exact: true });
    await controls.click();
    await expect(controls).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('studio-save')).toBeVisible();
    await expect(page.getByTestId('studio-reset')).toBeVisible();
    await capture(page, `studio-demo-collapsed-${locale}-${theme}-${width}`);

  });
}

test('the accessible activity table does not add blank space below the profile footer', async ({ page }) => {
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/u/octocat?lang=en', { waitUntil: 'networkidle' });
  await expect(page.getByText('Embed this badge', { exact: false })).toBeVisible();
  await expect(page.locator('table.sr-only, .sr-only table')).toHaveCount(1);
  expect(await page.locator('table.sr-only tbody tr, .sr-only table tbody tr').count()).toBe(91);
  const extra = await page.evaluate(() => document.documentElement.scrollHeight - (document.querySelector('footer')!.getBoundingClientRect().bottom + scrollY));
  expect(extra).toBeLessThanOrEqual(128);
});
