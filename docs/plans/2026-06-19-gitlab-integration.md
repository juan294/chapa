# Plan: Add GitLab as a Connectable Source

> Date: 2026-06-19 | Issue: [#855](https://github.com/juan294/chapa/issues/855) | Branch base: `develop`
> Research: `docs/research/2026-06-19-gitlab-integration.md`

## Objective

Add **GitLab (gitlab.com)** as a 4th connectable developer source, mirroring the existing Codeberg integration. GitLab commit/MR/review data merges into `StatsData` and drives Impact v6 scoring; users link/unlink from the User Menu; the GitLab logo appears in badge branding for connected users.

## Decisions (locked)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Architecture | **Direct wiring** (mirror Codeberg) | The deferred `PlatformQuery`/`PlatformAuth` abstraction is NOT built. Two platforms already use direct wiring; a third follows the same proven path. |
| Scope | **gitlab.com only** | No self-hosted; no `instance_url` column; **no schema change** (the `user_platforms` table is platform-agnostic, keyed by `(handle, platform)`). |
| MR line fidelity | **Per-MR diffstat, capped at MAX_PRS** | Matches Codeberg/GitHub `prsMergedWeight` fidelity. Accepts extra API calls under a hard cap + timeout. |
| Reviews source | **MR approvals endpoint with graceful 403 fallback** | GitLab approval analytics can be Premium-gated; a 403/404 yields `0` reviews rather than failing the whole fetch (documented default; see Phase 3). |
| Shared factory | **No change to `lib/auth/platform-oauth.ts`** | Its `PlatformOAuthConfig` + 4 `create*Handler` factories already accept any platform string. |

## GitLab API reference (gitlab.com, API v4)

| Concern | Endpoint / detail |
|---------|-------------------|
| Authorize URL | `https://gitlab.com/oauth/authorize` (scopes `read_user read_api`) |
| Token URL | `https://gitlab.com/oauth/token` (form-encoded; `grant_type=authorization_code` / `refresh_token`) |
| API base | `https://gitlab.com/api/v4` |
| Auth header | `Authorization: Bearer <token>` |
| User | `GET /user` → `{ id, username, name, avatar_url }` |
| Heatmap | **No calendar endpoint** — reconstruct from `GET /users/:id/events?after=YYYY-MM-DD&per_page=100` (paginated); bucket by `created_at` date, counting `push_data.commit_count` for push events + 1 per other contribution event |
| Merged MRs | `GET /merge_requests?author_username=<u>&state=merged&scope=all&per_page=100` (global scope — avoids per-project iteration) |
| MR diffstat | `GET /projects/:id/merge_requests/:iid/changes` per MR (capped at MAX_PRS) for additions/deletions/changed_files |
| Reviews (approvals given) | `GET /merge_requests?reviewer_username=<u>&scope=all` then per-MR `GET /projects/:id/merge_requests/:iid/approvals` → count where user in `approved_by`; 403/404 → 0 (Premium fallback) |
| Closed issues | `GET /issues?author_username=<u>&state=closed&scope=all` |
| Projects (social) | `GET /users/:id/projects` → `star_count`, `forks_count` (GitLab has stars; no watchers → `totalWatchers: 0`) |
| Token expiry | GitLab access tokens expire (~2h) and rotate; refresh tokens present → reuse `TokenRefreshResult` revoked-vs-transient handling |

## Phase overview

| Phase | Title | Depends on | Batch |
|-------|-------|-----------|-------|
| 1 ✅ | Foundation: Platform type, env, flags, logos/labels | — | — |
| 2 ✅ | OAuth helpers + routes | 1 | — |
| 3 ✅ | Stats package (queries, aggregation, orchestrator, client) | 1, 2 | — |
| 4 ✅ | Merge wiring + demo data | 3 | — |
| 5 ✅ | UI: UserMenu link/unlink + footer + i18n | 2 | `[batch-eligible]` with 6 |
| 6 ✅ | Docs: CLAUDE.md, .env.example, layout, llms.txt | 1 | `[batch-eligible]` with 5 |

Phases 5 and 6 touch disjoint files and only depend on earlier phases, so `/batch` may run them in parallel after Phase 4. Phases 1–4 are sequential.

**Key invariant:** every phase ends with `pnpm run test && pnpm run typecheck && pnpm run lint` green. Phase 1 deliberately bundles the `Platform` union change with all exhaustive `Record<Platform, …>` updates so typecheck never breaks mid-stream.

## TDD discipline

Every phase: write failing tests first (Red), minimum implementation (Green), refactor. Bug fixes need a regression test. Co-locate tests next to source (`gitlab.ts` → `gitlab.test.ts`).

## Files touched (summary)

**New (15 source + co-located tests):**
- `apps/web/lib/auth/gitlab.ts`
- `apps/web/app/api/auth/gitlab/config.ts`
- `apps/web/app/api/auth/gitlab/{connect,callback,disconnect,status}/route.ts`
- `apps/web/lib/gitlab/{types,queries,stats-aggregation,stats,client}.ts`

**Edited:**
- `packages/shared/src/platforms.ts`, `apps/web/lib/env.ts`, `apps/web/lib/feature-flags.ts`, `apps/web/lib/feature-flags-sync.ts`
- `apps/web/lib/github/client.ts`, `apps/web/lib/render/{BadgeBranding,BadgeSvg,demoData}.tsx/ts`
- `apps/web/components/{UserMenu,ImpactBreakdown}.tsx`, `apps/web/app/page.tsx`, `apps/web/app/layout.tsx`
- `apps/web/app/llms.txt/route.ts`, `apps/web/app/llms-full.txt/route.ts`
- `apps/web/lib/i18n/dictionaries/{en,es}.ts`, `apps/web/lib/test-helpers/platform-auth-fixtures.ts`
- `.env.example`, `CLAUDE.md`

**No change:** `lib/auth/platform-oauth.ts`, `lib/impact/*` (scoring), `lib/github/merge.ts`, badge SVG core, impact specs, `user_platforms` schema.

## Phase files

- [Phase 1 — Foundation](2026-06-19-gitlab-integration-phases/phase-1.md)
- [Phase 2 — OAuth helpers + routes](2026-06-19-gitlab-integration-phases/phase-2.md)
- [Phase 3 — Stats package](2026-06-19-gitlab-integration-phases/phase-3.md)
- [Phase 4 — Merge wiring + demo data](2026-06-19-gitlab-integration-phases/phase-4.md)
- [Phase 5 — UI: UserMenu + footer + i18n](2026-06-19-gitlab-integration-phases/phase-5.md)
- [Phase 6 — Docs](2026-06-19-gitlab-integration-phases/phase-6.md)

## Manual setup (user — not agent-doable)

1. **Create a GitLab OAuth application** at gitlab.com → User Settings → Applications: redirect URI `https://chapa.thecreativetoken.com/api/auth/gitlab/callback` (and a local `http://localhost:3001/...` for dev), scopes `read_user` + `read_api`, confidential.
2. **Set env vars** (`.env.local` for dev; Vercel for deploy — user-controlled): `GITLAB_CLIENT_ID`, `GITLAB_CLIENT_SECRET`, `NEXT_PUBLIC_GITLAB_ENABLED=true`.
3. **Enable the flag**: set the `gitlab_integration` row in the Supabase `feature_flags` table (DB value overrides env).

## Global success criteria

**Automated:**
- `pnpm run test && pnpm run typecheck && pnpm run lint` green after every phase.
- i18n parity test passes (en/es keys identical).
- New unit tests cover: OAuth URL build, state CSRF, token exchange/refresh (revoked vs transient), user fetch, Events→heatmap reconstruction, MR→PR mapping with capped diffstat, approvals→reviews with 403 fallback, `fetchGitlabIfLinked` cache/refresh, 3-way merge in `github/client.ts`, BadgeBranding gitlab logo, UserMenu link/unlink render.

**Manual:**
- With env + flag on, linking GitLab from the User Menu completes OAuth and shows the connected handle.
- A connected user's badge shows the GitLab logo; GitLab MR/commit data raises the relevant dimensions.
- Unlinking removes the GitLab row and the logo.
- Transient GitLab API failure keeps the link; only confirmed revocation unlinks.
