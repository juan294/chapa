import { test, expect, type Page } from "@playwright/test";

async function command(page: Page, text: string) {
  const input = page.locator("#terminal-command-input");
  await input.fill(text);
  await input.press("Enter");
}

test.describe("Landing developer shell", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/?lang=en");
    await page.locator("#terminal-command-input").waitFor();
  });

  test("shows one simulated Elite fixture in the hero and real static README image", async ({ page }) => {
    await expect(page.getByText("Turn your development activity across platforms into a profile and badge you can share.", { exact: true })).toBeVisible();
    await expect(page.getByText("Your work is more than a commit count.", { exact: true })).toBeAttached();
    const hero = page.locator('#badge-preview svg[data-badge-design="ice-terminal-v2"]');
    await expect(hero.locator('[data-element="score"]')).toHaveText("92");
    await expect(hero.locator('[data-element="tier"]')).toHaveText("Elite");
    const readme = page.locator('#how-it-works img[src^="data:image/svg+xml"]');
    await expect(readme).toHaveCount(1);
    const svg = decodeURIComponent((await readme.getAttribute('src'))!.split(',').slice(1).join(','));
    expect(svg).toMatch(/data-element="score"[^>]*>92<\/text>/);
    expect(svg).toContain("Simulated metrics");
    expect(svg).not.toContain('class="badge-score-pulse"');
    await expect.poll(() => readme.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth === 1200)).toBe(true);
  });

  test("focus, completion, history and clear use the same input", async ({ page }) => {
    const input = page.locator("#terminal-command-input");
    await page.locator('h1').click();
    await page.keyboard.press("/");
    await expect(input).toBeFocused();
    await input.fill('/dim');
    await input.press('Tab');
    await expect(input).toHaveValue('/dimensions ');
    await command(page, '/dimensions craft');
    await expect(page.locator('#dimension-craft')).toHaveAttribute('open', '');
    await command(page, '/whoami');
    await input.press('ArrowUp');
    await expect(input).toHaveValue('/whoami');
    await input.press('Escape');
    await expect(input).toHaveValue('');
    await command(page, '/clear');
    await expect(input).toHaveValue('');
    await input.press('ArrowUp');
    await expect(input).toHaveValue('/clear');
    await page.locator('h1').click();
    await page.keyboard.press('ControlOrMeta+k');
    await expect(input).toBeFocused();
  });

  test("composed help and scoped commands reach real sections and all seven tabs", async ({ page }) => {
    await command(page, '/help');
    const output = page.getByRole('log');
    for (const name of ['/archetypes', '/dimensions', '/theme', '/verify', '/artificer']) await expect(output).toContainText(name);
    for (const id of ['builder', 'guardian', 'marathoner', 'polymath', 'artificer', 'balanced', 'emerging']) {
      await command(page, `/archetypes ${id}`);
      await expect(page.locator('#features [role="tabpanel"] a')).toHaveAttribute('href', `/archetypes/${id}`);
    }
    await command(page, '/section nonexistent');
    await expect(output).toContainText('Usage:');
    await command(page, '/mcp');
    await expect(page.locator('#agent-tools h2')).toBeInViewport();
    const headingTop = (await page.locator('#agent-tools h2').boundingBox())!.y;
    const navBottom = await page.locator('nav').evaluate(el => el.getBoundingClientRect().bottom);
    expect(headingTop).toBeGreaterThanOrEqual(navBottom);
    const first = page.getByRole('tab').first();
    await first.focus();
    await first.press('End');
    await expect(page.getByRole('tab').last()).toBeFocused();
    await page.getByRole('tab').last().press('ArrowRight');
    await expect(first).toBeFocused();
  });

  test("theme command agrees with picker and system preference without changing the badge", async ({ page }) => {
    const badge = page.locator('#badge-preview svg[data-badge-design]');
    const original = await badge.innerHTML();
    await command(page, '/theme dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('[data-theme-mode]')).toHaveAttribute('data-theme-mode', 'dark');
    await command(page, '/theme invalid');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await expect(page.locator('[data-theme-mode]')).toHaveAttribute('data-theme-mode', 'dark');
    await command(page, '/theme system');
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    expect(await badge.innerHTML()).toBe(original);
  });

  for (const succeeds of [true, false]) {
    test(`pointer and command copy show ${succeeds ? 'success' : 'failure'}`, async ({ page }) => {
      await page.evaluate(ok => {
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => {
          if (!ok) throw new Error('Clipboard denied for test');
          document.documentElement.dataset.copiedEmbed = text;
        } } });
      }, succeeds);
      await page.locator('#how-it-works').getByRole('button', { name: 'Copy embed snippet' }).click();
      await expect(page.locator('#how-it-works [role="status"]')).toContainText(succeeds ? 'Copied' : 'Failed');
      await command(page, '/copy');
      await expect(page.getByRole('log')).toContainText(succeeds ? 'copied' : 'Copy failed');
      if (succeeds) expect(await page.locator('html').getAttribute('data-copied-embed')).toContain('/u/developer/badge.svg');
    });
  }

  test("reduced motion shows the complete badge without waiting for its reveal", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const badge = page.locator('#hero:visible #badge-preview svg[data-badge-design]');
    await expect(badge).toHaveCount(1);
    await expect(badge).toBeVisible();
    await badge.evaluate((svg: SVGSVGElement) => {
      svg.pauseAnimations();
      svg.setCurrentTime(0);
    });
    // Emulating the preference can precede the next computed-style update.
    // Keep the timeline paused at zero while waiting for the actual CSS rule,
    // so an ordinary reveal animation cannot satisfy the complete-state check.
    await expect.poll(() => badge.evaluate((svg: SVGSVGElement) => {
      const cells = [...svg.querySelectorAll('[data-element="activity"] rect')];
      const arc = svg.querySelector('circle[stroke-dashoffset]')!;
      return { reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches, cells: cells.length, visible: cells.every(cell => getComputedStyle(cell).opacity === '1'), ringAnimation: getComputedStyle(arc).animationName };
    })).toEqual({ reducedMotion: true, cells: 91, visible: true, ringAnimation: 'none' });
  });

  test("footer clears the dock and closing focus uses its paired foreground", async ({ page }) => {
    await command(page, '/theme light');
    const cta = page.locator('#closing a[href="/api/auth/login"]');
    await cta.focus();
    await expect.poll(() => cta.evaluate(el => getComputedStyle(el).outlineColor)).toBe('rgb(27, 27, 25)');
    await page.evaluate(() => window.scrollTo({top: document.documentElement.scrollHeight, behavior: 'instant'}));
    const clearance = await page.locator('#terminal-command-input').evaluate(input => {
      let parent = input.parentElement;
      while (parent && getComputedStyle(parent).position !== 'fixed') parent = parent.parentElement;
      return parent!.getBoundingClientRect().top - document.querySelector('footer')!.getBoundingClientRect().bottom;
    });
    expect(clearance).toBeGreaterThanOrEqual(0);
  });

  test("slash guard leaves another editable field alone", async ({ page }) => {
    await page.evaluate(() => { const input = document.createElement('input'); input.id = 'guard-probe'; document.querySelector('main')!.prepend(input); input.focus(); });
    await page.keyboard.press('/');
    await expect(page.locator('#guard-probe')).toHaveValue('/');
    await expect(page.locator('#guard-probe')).toBeFocused();
  });
});
