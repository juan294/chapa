import { expect, type Page } from "@playwright/test";

/**
 * Opens the language listbox and picks `optionName`, then waits for the
 * resulting full-document navigation.
 *
 * `setLocale` swaps the client dictionary before the eventual
 * `window.location.assign` (`apps/web/lib/i18n/provider.tsx:255-257,290`),
 * so a locale-derived assertion can pass against the old document. Worse,
 * a second click issued right after the first navigation lands on the new
 * server-rendered document before hydration attaches `onClick`
 * (`apps/web/components/LanguageSwitcher.tsx:102-110`) — the listbox stays
 * `pointer-events-none` until then (`:136-140`), so that click waits out
 * the whole test timeout. `switchLocale` retries the trigger click until
 * `aria-expanded="true"` is observed, which only happens once the
 * component's own click handler has run, then waits for the navigation to
 * actually land on `targetUrl`.
 */
export async function switchLocale(
  page: Page,
  fromLabel: "EN" | "ES",
  optionName: string,
  targetUrl: string | RegExp,
): Promise<void> {
  const trigger = page.getByRole("button", { name: fromLabel, exact: true });
  await expect(async () => {
    await trigger.click({ timeout: 2_000 });
    await expect(trigger).toHaveAttribute("aria-expanded", "true", {
      timeout: 1_000,
    });
  }).toPass({ timeout: 15_000 });
  await page.getByRole("option", { name: optionName }).click({ timeout: 5_000 });
  await page.waitForURL(targetUrl, { waitUntil: "load" });
}
