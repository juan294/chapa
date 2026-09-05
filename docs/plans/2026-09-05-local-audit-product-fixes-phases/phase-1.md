# Phase 1 — Complete eleven product fixes locally

## Studio ownership
apps/web/app/studio page/client/WebMCP modules and tests; narrowly scoped navigation helper/hook and tests; KeyboardShortcutsListener and GlobalCommandBar navigation; terminal autocomplete/output/input text; generating progress text/tests. Issues #1284 #1285 #1286 #1293 #1294.

Tests: failed load vs absent/demo and successful recovery; failed save retains dirty protection; revert-to-persisted clears it; app-owned dirty navigation native confirmation with exclusions; delayed body retains pending and newer edits; unchanged simulation matches computeImpactV6 for non-neutral recency/tiers; text class expectations preserve fills.

## Data ownership
Supplemental route and adjacent unit/contract tests; db/users module and tests/contracts; GitHub OAuth callback and adjacent tests; cli-token module/tests. Issues #1287 #1288 #1290.

Tests: no cache publication before durable completion; DB failure preserves prior hot record; Redis false triggers awaited eviction; double cache failure is explicit; actual local DB commit/read/compose seam; deferred OAuth callback awaits upsert/capture and observes resolved DB error; real users create/update/read; valid ten-day and small drift pass, signed ninety-day and malformed timestamps fail.

## Badge ownership
Badge SVG foreground/background route/tests; share-page SVG producer/cache tests; warming cron/tests; BadgeToolbar and tests; insights-import hook/tests; SettingsClient/tests. Issues #1289 #1291 #1292.

Tests: unknown config fallback remains available without Redis/edge cache publication in every producer; recovery and confirmed absence cache normally; warm hits avoid config reads; localized sharing names distinguish all destinations and preserve URLs; slow loading persists, new result gets fresh identity, repeated same error/dismissal/cleanup, success reload remains 2.5 seconds.

## Terminal condition
Each implementer reports changed files, red/green evidence, known limits and review readiness, then stops without committing or pushing. Root assigns independent cross-review and simplify pass, incorporates necessary fixes, verifies integrated source, creates one local phase commit with existing hooks, and merges into local develop. No retained finding is deferred.
