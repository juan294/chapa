# Phase 3 — Route and link integrity `[batch-eligible]`

Goal: no broken link and no broken route on either locale, on desktop and
mobile. There is no link checker in the repo today (no linkinator, no
`check:links`), so this phase adds one as a permanent Playwright spec.
Independent of Phase 2; runs against the dev server on 3001, which reads
production data. The crawl only follows links to the fixture handles' pages
(`/u/…` links to other users found on the leaderboard are recorded but not
followed), so no stranger's snapshot is written.

## 3.1 New spec: `apps/web/e2e/link-crawl.spec.ts`

Test first: write the spec, watch it discover the seed set, then fix
whatever it reports. Shape (pseudocode; follow `landing-shell.spec.ts` for
style and `redesign-reflow.spec.ts` for the overflow assertion):

```
seeds = [
  every URL from GET /sitemap.xml (both locales are served at the same canonical path),
  "/", "/about", "/about/scoring", "/about/verification", "/about/leaderboard",
  "/privacy", "/terms", "/verify", "/studio?demo=1",
  "/u/octocat", "/u/juan294", "/u/chapa-e2e-<runId>-board-a", "/generating/octocat", "/coming-soon",   # fixture handles only
  "/archetypes/{builder,guardian,marathoner,polymath,artificer,balanced,emerging}",
  "/experiments/{3d-tilt,aurora,confetti,glassmorphism,gradient-border,heatmap-wave,hexmap,holographic,metallic-shimmer,number-counters,particles,text-effects,tier-visuals}",
]
for locale in ["en", "es"]:
  set cookie chapa-locale=locale
  BFS from seeds, depth <= 3, same-origin <a href> only, dedupe by pathname+search
  for each page:
    collect console errors/warnings matching /hydration|Minified React error|Failed to load|404/
    goto → expect status < 400 (page.goto returns null for hash-only; skip)
    expect document.documentElement.scrollWidth <= viewport width   # mobile project catches overflow
    expect no <a href> whose pathname starts with "/en/" or "/es/"   # proxy rewrite must never leak
    expect no <img> with naturalWidth === 0 after load (broken assets)
    record response.timing(): time to first byte per page (8fcc0371 regression guard)
  when baseURL is the production build (PLAYWRIGHT_BASE_URL set):
    expect "/" first visit  < 5000 ms and second visit < 2000 ms
    expect "/u/juan294" and "/u/octocat" second visit < 2000 ms
    (dev-server runs record timings but do not assert them: compilation noise)
  for each external href: HEAD once, record status, do not fail (external is informational)
non-HTML checks via request fixture, status + content-type:
  /robots.txt, /sitemap.xml, /llms.txt, /llms-full.txt, /site.webmanifest,
  /.well-known/security.txt, /.well-known/mcp.json, /.well-known/glama.json,
  /og-image (image/png), /u/octocat/og-image (image/png),
  /u/octocat/badge.svg (image/svg+xml), /u/octocat/badge.svg?lang=es,
  /u/bad handle → 400 SVG, /u/this-user-definitely-does-not-exist-xyz123 → 404 page,
  /api/profile/octocat, /api/history/octocat, /api/insights/octocat, /api/feature-flags, /api/version
  /api/mcp GET → 405 with Allow: POST
```

Attach the crawl list (URL, status, locale, project, console-error count) as
a JSON artifact so the report can quote counts. Keep the whole spec under
30 s per project by capping the BFS at 3 and running the two locales in
`test.describe.parallel`.

## 3.2 Run it, dev server then production build

```bash
cd /Users/juan/code/chapa/apps/web
pnpm exec playwright test e2e/link-crawl.spec.ts --project=chromium --project=mobile --reporter=list
PLAYWRIGHT_BASE_URL=http://localhost:3002 \
pnpm exec playwright test e2e/link-crawl.spec.ts --project=chromium --project=mobile --reporter=list
```

The second run is the one that asserts the latency budgets.

Copy `test-results/**/crawl.json` to `evidence/phase3/`.

## 3.3 Classify every failure

Each URL ≥ 400, each console error, each overflow and each `/en/`/`/es/`
leak is a finding with the page it came from. A dead external link is
recorded but not a blocker.

## 3.4 Commit locally

`test(e2e): crawl every internal link on both locales and both viewports`
on `develop`, after `pnpm run lint` and `pnpm run typecheck` pass. Not pushed.

## Exit criteria

- 0 internal responses ≥ 400, 0 console errors, 0 locale-prefixed hrefs,
  0 overflow on the mobile project, 0 broken images, all non-HTML checks
  green, on both locales; latency budgets met on the production build.
- Spec committed locally; crawl JSON under `evidence/phase3/`.
