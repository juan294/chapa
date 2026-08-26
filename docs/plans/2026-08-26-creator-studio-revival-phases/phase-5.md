# Phase 5 — Production flag flip (MANUAL, requires Juan's explicit authorization)

Production-affecting. Nothing here executes without Juan's go in the
session that runs it. No deploy needed (flag is DB-backed, admin PATCH
invalidates cache — `docs/scheduled-agents-admin-panel.md:477-478`).

Precondition: Phases 1-4 merged to develop, full suite green, AND deployed
to production (the fixes must be live before the flag exposes the feature).
Note: chapa deploys production from `main` — so this phase happens after
the next develop→main release, or Juan accepts flipping on the current prod
build (which runs the unfixed load path). Default: wait for the release.

Steps (runner: Claude, after authorization):
1. `PATCH /api/admin/feature-flags` body `{ "key": "studio_enabled",
   "enabled": true }` with admin credentials (same auth path the admin
   panel uses; CLI-first via curl with the admin session/token — do not
   use the dashboard).
2. Retry the flag read for up to about five minutes. PATCH invalidates the
   handling instance, but another instance can retain its in-process value for
   the full 5-minute cache TTL. An early stale flag read is not failure or rollback evidence. Continue only after `GET /api/feature-flags` returns
   `studio_enabled: true`, then verify:
   - Unauthenticated `GET /api/studio/config` → **401** (was 404)
   - `/studio` logged out → redirect to `/api/auth/login` (not `/`)
   - Logged in (Juan): `/studio` renders; UserMenu shows the Studio link;
     `/set bg aurora`, `/save` → success line; reload → config persists
     (exercises the Phase 1 load path live)
3. Rollback: same PATCH with `enabled: false`. Rollback-first: if the retry
   window expires without convergence, or a later check in step 2 fails, flip
   back and then investigate. Do not roll back on one early stale read. The
   disabled value can take the same cache-convergence window to appear on every
   instance.

Record the flip (date, verification results) in the release notes /
CHANGELOG per repo convention.
