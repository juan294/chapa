# Phase 6: Deterministic e2e checks

[batch-eligible] Depends on: none. Issue: #1351 (findings 4 and 5).
Branch: `test/1351-e2e-stability`.

No new gate, no new budget, and no retries added to the config.

## A. `share-page.spec.ts:133` locale switch

### Why

`setLocale` swaps the client dictionary before `window.location.assign`
(`apps/web/lib/i18n/provider.tsx:255-257,290`). So the Spanish image name can
appear on the old document, and `toHaveURL` passes as soon as the new URL
commits. The next click on the `ES` button can then land on the new
server-rendered document before hydration attaches `onClick`
(`apps/web/components/LanguageSwitcher.tsx:102-110`). The listbox stays
`pointer-events-none` (`:136-140`), and the option click waits out the 30 s
test timeout. This is INFERRED from reading the code; the recorded failure
(`locator.click: Test timeout of 30000ms exceeded`) matches it.

### Change

New helper in `apps/web/e2e/helpers/locale-switch.ts`:

```ts
// Opens the language listbox and picks `optionName`. Retries the trigger
// click until the listbox is open, because a click before hydration has no
// handler. Then waits for the full-document navigation to the target URL.
export async function switchLocale(page, fromLabel: "EN" | "ES", optionName: string, targetUrl: string | RegExp) {
  const trigger = page.getByRole("button", { name: fromLabel, exact: true });
  await expect(async () => {
    await trigger.click({ timeout: 2_000 });
    await expect(trigger).toHaveAttribute("aria-expanded", "true", { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  await page.getByRole("option", { name: optionName }).click({ timeout: 5_000 });
  await page.waitForURL(targetUrl, { waitUntil: "load" });
}
```

Use it in `share-page.spec.ts` at both switches of the test at :133, and at
:63-74, and in `landing.spec.ts:96-123`. Keep the existing assertions after
each switch (image name, `html[lang]`, title). Add `html[lang]` to the test
at :133 after each switch, so it proves the new document, not the old one.

The trigger sets `aria-expanded={isExpanded}` (`LanguageSwitcher.tsx:106`),
so the helper's readiness check reads real component state.

`redesign-reflow.spec.ts:53-70` already uses a readiness gate. Leave it
unless it uses the same two clicks without a gate.

### Proof

```bash
pnpm --filter @chapa/web exec playwright test e2e/share-page.spec.ts e2e/landing.spec.ts --repeat-each=5 --retries=0
```

in local-candidate mode (`next start`). Also run it once while the rest of
the suite runs (`fullyParallel`), since the failure appeared under load.

## B. `link-crawl.spec.ts` warm budgets

### Why

"Warm" is one visit per URL after the whole crawl (`link-crawl.spec.ts:238-242`),
measured as wall-clock time to `load` (`:127-129`). One slow sample at load
average 14 to 16 failed the 2,000 ms budget (3,806 and 3,529 ms). The design
evidence shows 419 to 1,479 ms. One sample measures the machine as much as
the page.

### Change

```
+ const WARM_SAMPLES = 3;
+ async function warmMs(page, origin, path) {
+   const samples = [];
+   for (let i = 0; i < WARM_SAMPLES; i++) samples.push((await visit(page, origin, path, "warm", 0)).ms);
+   return { best: Math.min(...samples), samples };
+ }
~ landingWarmMs = (await warmMs(page, origin, "/")).best
~ profileWarmMs[handle] = (await warmMs(page, origin, `/u/${handle}`)).best
+ report.warmSamples = { "/": [...], "/u/juan294": [...], "/u/octocat": [...] }
```

The budgets at :271-277 stay the same. The best of 3 answers the question the
budget asks ("can a warm render finish within 2 s"). The report keeps every
sample, so a slow machine stays visible in the attachment.

Add `os.loadavg()` to the JSON report (`loadAverage`), so a future failure
records the machine load. This is an attachment field only, never an assertion.

### Proof

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3002 pnpm --filter @chapa/web exec playwright test e2e/link-crawl.spec.ts --repeat-each=3 --retries=0
```

against a local production build (as in
`docs/plans/2026-09-07-local-e2e-verification-phases/phase-3.md`).

## Documentation

- `docs/runbooks/deployment-smoke.md`: one line saying that warm timing is
  the best of 3 samples, and that the JSON attachment has every sample and
  the load average.
- `CHANGELOG.md`: no entry (test-only change).

## Success criteria

### Automated
- Both proof commands pass with no retries.
- `pnpm run lint && pnpm run typecheck` (the e2e folder is type-checked).

### Manual
- None.
