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
2. Verify within ~1 min (flag cache TTL 5 min in-process, PATCH revalidates):
   - `GET /api/feature-flags` → `studio_enabled: true`
   - Unauthenticated `GET /api/studio/config` → **401** (was 404)
   - `/studio` logged out → redirect to `/api/auth/login` (not `/`)
   - Logged in (Juan): `/studio` renders; UserMenu shows the Studio link;
     `/set bg aurora`, `/save` → success line; reload → config persists
     (exercises the Phase 1 load path live)
3. Rollback: same PATCH with `enabled: false` — restores 404/hidden state
   immediately. Rollback-first: if anything in step 2 fails, flip back,
   then investigate.

Record the flip (date, verification results) in the release notes /
CHANGELOG per repo convention.
