# Local end-to-end verification of develop before the post-hackathon release
Date: 2026-09-07. Candidate: local `develop` at `8fcc0371`, working tree clean,
64 commits ahead of `origin/develop` (baseline tag
`v2.29.5`, the production release submitted to the WebMCP hackathon).

## Status

Executed 2026-09-07 13:40–20:15 CEST. Report: `docs/agents/local-e2e-report.md` (gitignored path). Verdict: READY FOR RELEASE PREP; 16 findings fixed across two rounds and committed locally (develop at 04081dfd, 18 commits), 5 items left open by decision (consent latency, share-page 404 status, cold-render SLO, render-registered residue cleanup after the freeze, OG/Studio preview hash minting). Evidence screenshots stay untracked (53 MB); JSON, SVG and text evidence are committed.

## Purpose and scope

Prove, on localhost only, that everything on `develop` works as a user would
experience it: the redesigned site renders correctly on desktop and mobile in
both locales and both themes, no route or link is broken, scores are
computed and displayed consistently, badges generate and customize in Studio,
the v7 cutover path works behind its flag and reverses cleanly, and the
WebMCP and remote MCP surfaces behave as published.

**No push, no PR, no deploy, no production migration** until the hackathon
judging window closes on 2026-09-21. Local commits on `develop` are allowed
for fixes and for the one new spec this plan adds.

## Data decision: localhost runs against production data

Owner decision, 2026-09-07: local development uses the production Supabase
project and the production Upstash Redis, as it did before 2026-09-06. The
local clone was reverted. `apps/web/.env.local` already points at both.
The local Supabase stack (API 54331) stays up only for
`pnpm run test:contract:local`, which reads it through `supabase status`.

Verified read-only on 2026-09-07:
- Production migrations applied through **048**. All twelve `scoring_v7_*`
  tables exist with 0 rows; `metrics_snapshots.headline_score` exists.
  Only `049` (the `scoring_v7_rendering` flag row) is pending, so that
  flag has no row and is decided by the server-only env fallback
  `SCORING_V7_RENDERING_ENABLED`, which lets v7 be turned on locally without
  touching production flags.
- Production flags `studio_enabled`, `studio_demo_enabled`, `webmcp_enabled`,
  `mcp_server_enabled`, `experiments_enabled`, `insights_integration` are all
  true. No flag flip is needed and none is allowed.
- 42 users, 1,968 snapshots, 41 handles snapshotted in the last 30 days, 3
  snapshot rows with a headline score (written by earlier local sessions),
  2 Studio configs, one of them `juan294` at revision 29.
- Cache keys diverge: badge SVG keys carry `BADGE_RENDER_VARIANT`
  (`ice-terminal-v2` on develop, `jade-v1` in production), and develop's
  stats cache is `stats:v3:<handle>` (8fcc0371), which v2.29.5 never reads;
  production still reads `stats:v2:merged:`. Local renders therefore do not
  replace the SVG or the stats production serves. Shared families (avatar, snapshot mirror,
  rate-limit buckets) are structurally unchanged and accepted.

### Production-safety rules for every phase

Never, in any phase:
- `supabase db reset` against anything but the local stack, or any `FLUSHDB`.
- `redesign-surfaces.spec.ts`: its fixtures delete and re-insert `octocat`
  and `juan294` and the helper refuses a non-loopback Supabase anyway. Run
  Playwright without `REDESIGN_DISPOSABLE_PROJECT`, so it self-skips.
- `POST /api/admin/bulk-recalculate`, `GET /api/cron/warm-cache`,
  `GET /api/cron/latency-check` (writes a heartbeat production health reads
  and can email a P2), `sync-audience`, `process-campaigns`, campaign
  send/test, `/api/challenge`, the Resend webhook, `scripts/delete-user.ts`,
  `heal-poisoned-stats`, `migrate-v7.ts --apply`.
- `PATCH /api/admin/feature-flags` with a real key, or applying migration 049.
- Rendering strangers' badges beyond the fixture set below: a render writes
  that handle's snapshot for today.

Allowed writes, all reversed by Phase 8 with a residue query proving it:
- `juan294` (the owner's real account): snapshots, refresh, recalculate,
  Studio config (captured first and restored), v7 consent and receipt rows
  (withdrawn at the end).
- Synthetic test users named `chapa-e2e-<runId>-<role>`, created through the
  service-role client exactly as `journey.spec.ts` does, in `users`,
  `metrics_snapshots`, `studio_configs` and `user_platforms`, and deleted at
  the end. They do not exist on GitHub, so a render of one produces the
  "could not load data" fallback SVG and no live fetch.
- `octocat`, GitHub's own mascot account, for visitor and verification reads
  because the existing specs hardcode `/u/octocat`; the render writes today's
  snapshot row for it, as any README embed would.

Owner rule, 2026-09-07: real data only for `juan294`; any other fixture is
created by this run and deleted by this run.

## Known regressions to watch (found locally on 2026-09-07, fixed in 8fcc0371)

Three symptoms with one cause, reported by the owner and fixed the same day:
the landing page took 31–43 s to render, `/u/<handle>` refetched GitHub on
every render, and one render fetched the same handle twice. Cause: S08
(4072d927) deleted the `stats:v2:merged:` cache without a replacement, so
every render paid a 9–10 s GraphQL query against a 15 s timeout; the
leaderboard materializes candidates serially, multiplying it; and the
inflight map was keyed on an instant-scoped `selectionId`, so it never hit.
The fix stores a grant-bound record under `stats:v3:<handle>` (binding in the
value, day-scoped, 6 h TTL) and revives the inflight map.

This plan pins each symptom so it cannot return unnoticed:
- Phase 3 adds response-time budgets to the crawl on the production build
  (landing cold < 5 s, warm < 2 s; profile warm < 2 s).
- Phase 6.0 checks the `stats:v3` record, single fetch per render, inflight
  dedup under a concurrent burst, binding isolation between visitor and
  owner, invalidation on refresh and Studio save, and zero
  `TimeoutError` / `Unexpected end of JSON input` lines in the dev log.
- Phase 5.2 watches the "BUILDING THE BADGE" placeholder fill in on a cold
  share page, which was timed but not watched during the fix.
- Two items the fix left open are recorded as pre-existing findings in the
  report, not re-diagnosed: a cold badge render still exceeds the 4,100 ms
  cache-miss SLO, and CLAUDE.md still documents the `stats:stale:v2`
  baseline, non-downgrading scope-aware writes and `isDegradedPrFetch` as
  live although S08 removed them (S15 scope).

## Change surface being verified

| Capability | Commits (representative) | Verified in |
|---|---|---|
| Design system: paper/ink/vermilion tokens, `light-dark()` theme layer, JetBrains Mono/Manrope/Barlow | 64320185, 006ca7de, 8a469e33, 3760a35b | Phases 4, 5, 8 |
| Landing developer shell, dock, command registry, archetype/dimension explorers, leaderboard placement | 8409aee0, 548940d3 | Phases 3, 4, 5, 6 |
| Ice Terminal v2 badge renderer, six palettes | b3523b12 | Phases 4, 5 |
| Studio horizontal split, zoom modes, save/reset, error boundary, unload guard | c1ce31cb, ab6e01a6 | Phases 4, 5 |
| Impact v7 engine, evidence ledger, receipts, verification, flag-gated cutover | 349b91e2 … 88891334, 88ae23ce, ffa9d7ba, ac7e3dac | Phase 6 |
| Settings page: connections, insights import, identity, publication consent (v7 only) | #1223, a3960312 | Phases 5, 6 |
| WebMCP page tools (19 registrations) and remote `POST /api/mcp` (9 tools) | `docs/webmcp.md` | Phase 7 |
| Generate retry as server token (#1282/#1283), snapshot headline score (047), v7 flag seed (049) | 1941d681, 095de3f7, ef689436 | Phases 6, 8 |
| Bundle gate against the shipped build, insights-parser exemption | 7116c321, e755b07c | Phase 2 |
| Grant-bound stats cache `stats:v3`, inflight dedup, landing/profile latency | 8fcc0371 | Phases 3, 5, 6 |

## Environment (verified 2026-09-07 10:09 UTC)

- Dev server running on port 3001 (the user's own `pnpm run dev`; Next
  refuses a second dev server for the same directory). `/api/health` on it
  reports `status: ok`, redis/supabase/fonts/rasterizer ok, github `skipped`.
- Playwright 1.62.1, chromium and webkit installed. Projects: `chromium`
  (Desktop Chrome) and `mobile` (Pixel 5, 393×851). 16 spec files.
- `.env.local` also carries `GITHUB_TOKEN`, `NEXTAUTH_SECRET`,
  `CHAPA_VERIFICATION_SECRET`, `ADMIN_HANDLES`, `ADMIN_SECRET`, `CRON_SECRET`,
  the three platform OAuth apps, `RESEND_API_KEY` and PostHog. PostHog
  receives local events; accepted noise. GitHub GraphQL is called for real
  through `GITHUB_TOKEN` (5,000/hour).

## Fixture handles

| Handle | Role |
|---|---|
| `juan294` | owner: real GitHub OAuth login, Studio, settings, admin, v7 consent |
| `octocat` | anonymous visitor profile, verification, MCP calls; snapshot history exists |
| `chapa-e2e-<runId>-board-a`, `-board-b` | synthetic leaderboard places: seeded `users` + today's `metrics_snapshots` row with a `headline_score` (e.g. 91 and 64), deleted at the end |
| `chapa-e2e-<runId>-{craft,plain,linked}` | created and deleted by `journey.spec.ts` itself |
| `this-user-definitely-does-not-exist-xyz123` | 404 page and fallback SVG |

## Assumptions (stated instead of asked)

1. The GitHub OAuth app allows `http://localhost:3001/api/auth/callback`.
2. `ADMIN_HANDLES` includes `juan294`.
3. Synthetic users are seeded and deleted through the service-role client in
   `.env.local`; a residue count of zero at the end is part of the exit criteria.
4. A Studio save from localhost may change the `juan294` production badge
   at its next cache expiry. The config is captured before and restored
   after Phase 5 within the same session, so production is expected to
   re-render to the same configuration it has today.
5. The new link-crawl spec and any fixes are committed locally to `develop`.

## Phases

Phase files live under `2026-09-07-local-e2e-verification-phases/`. Phases 2
and 3 are `[batch-eligible]` (disjoint files, no shared output). Every other
phase is sequential. Stop after each phase and report.

1. **Baseline** — identities, production state read-only, capture the
   owner's Studio config and reference badges, production build in a
   worktree on port 3002.
2. **Deterministic gates** `[batch-eligible]` — typecheck, lint, unit,
   contract (local stack), circular, migrations, write-registration,
   vercel-config, licenses, release docs, build and bundle budget.
3. **Route and link integrity** `[batch-eligible]` — add
   `e2e/link-crawl.spec.ts`; every internal link on both locales resolves
   below 400 with no console errors, desktop and mobile.
4. **Automated browser suite** — the 14 runnable specs on both projects
   against the dev server, then against the production build, including
   the self-cleaning journey spec. Only the redesign-surface spec is
   excluded; its coverage moves to Phase 5.
5. **Manual owner journey** — real OAuth, generate, share page, Studio (all
   seven categories, zoom, save with restore, reset, guard), settings, admin
   read-only, CLI device flow, logout; the full EN/ES × light/dark × 1440/768/
   390/320 matrix that the excluded redesign spec used to produce.
6. **Scoring** — v6 number consistency across badge, share header, API,
   history and leaderboard; recalculate; then v7 via the env fallback:
   consent, receipt issuance, ranged badge, `v7.` verification, offline
   replay, no-op skip, withdrawal, flag off and byte-identical v6 return.
7. **WebMCP and remote MCP** — 9 remote tools through `POST /api/mcp`
   including the rate limit; 19 page registrations executed in real Chrome
   with the WebMCP testing flag, including Studio mutations.
8. **Read-only ops routes, Lighthouse, report, restore** — health, version,
   badge headers, OG image, error pages, Lighthouse mobile on the production
   build, the report, the fix loop, and restoration of every allowed write.

## Success criteria

Automated (must all be green):
- Every Phase 2 command exits 0 (`check:pending-migrations` reports exactly
  `049`); largest chunk under 350 KB with only the insights-parser exemption.
- Playwright: 0 failures on `chromium` and `mobile` against both servers;
  the journey spec reports zero residue and restored flags.
- Link crawl: 0 internal responses ≥ 400, 0 console errors, 0 hydration
  warnings, 0 horizontal overflow at 393 px.
- Lighthouse mobile: accessibility ≥ 0.90 on `/`, `/about`, `/about/scoring`,
  `/u/juan294`, `/studio?demo=1`.
- The number on the badge equals the share header, `displayScore` in
  `/api/profile`, the latest `headline_score`, and the leaderboard place,
  for `juan294`; the two synthetic places rank on their stored headline.
- v7: receipt and verification rows exist after consent; offline replay
  prints `arithmetic_reproduced`; a second refresh issues no new revision;
  with the flag off the badge SVG matches the Phase 6 pre-flag capture
  except timestamps and hash.
- Remote MCP: `tools/list` returns exactly the 9 published names; every
  `tools/call` succeeds for a valid handle and returns a recovery string for
  an invalid one; the 61st request in a minute is 429.

Manual (recorded in the report with screenshots):
- Every Phase 5 screen renders without clipped text, overlapping controls or
  a horizontal scrollbar at 1440, 768, 390 and 320 px, EN and ES, light and dark.
- Touch targets in the navbar, dock, Studio quick controls and share toolbar
  are at least 44 px on the mobile viewport.
- WebMCP tools on each page match `SITE_TOOL_MAP` and unregister on navigation.

## Deliverables

- `docs/agents/local-e2e-report.md` (gitignored path): per-phase results,
  commands, counts, screenshots under
  `docs/plans/2026-09-07-local-e2e-verification-phases/evidence/`, findings
  with severity, fix commits, and the restoration checklist ticked.
- `apps/web/e2e/link-crawl.spec.ts` committed locally.
- GitHub issues are not filed during the freeze; findings live in the report.
