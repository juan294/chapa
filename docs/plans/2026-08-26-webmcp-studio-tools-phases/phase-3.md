# Phase 3 — Judge demo mode `/studio?demo=1` (after Phase 2 — same files)

Server gate (`app/studio/page.tsx`): when `searchParams.demo === "1"` AND
`await isStudioDemoEnabled()`:
- skip session/token gates and profile materialization entirely
- props: `stats = DEMO_STATS`, `impact = DEMO_IMPACT`
  (`lib/render/demoData.ts:50,73` — existing fixtures), `handle =
  DEMO_STATS.handle`, `verification = null`, `initialConfig =
  DEFAULT_BADGE_CONFIG`, `demo = true` (new StudioClient prop)
- `robots: { index: false, follow: false }` for the demo variant (pattern:
  `app/experiments/layout.tsx:9-14`)
- when the flag is off, `?demo=1` falls through to the normal gates
  (logged-out → login redirect) — no information leak

Client (`StudioClient`): `demo?: boolean` prop —
- `handleSave` in demo: no fetch; success line `studio.save.demoNotPersisted`
  ("(demo) configuration not persisted") after the SAME confirm gate — judges
  exercise the full human-gated flow with zero writes
- `trackEvent` calls gain `{demo: true}` property
- a small persistent "DEMO" marker near the preview (i18n'd)

WebMCP tools: identical surface (that's the point — judges test everything);
`save_badge_config` arms the same gate; confirm produces the demo success
line. Real `/api/studio/config` is never called (assert in tests).

Files: `app/studio/page.tsx`, `StudioClient.tsx`, i18n en+es. RED first:
page.render.test — demo+flag renders with fixtures and no session; demo
without flag redirects; StudioClient test — demo save makes zero fetches.

Verification: full gates; `check:write-registration` unchanged (no new
routes).
