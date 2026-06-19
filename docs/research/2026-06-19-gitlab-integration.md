# Research: Adding GitLab as a Connectable Source

> Date: 2026-06-19 | Branch: `develop` | Question: What is the best way to add GitLab as a connectable source/service for developers in Chapa, mirroring the existing Bitbucket and Codeberg integrations?

This document describes **what exists today** so a GitLab integration can mirror it. It is documentary — no critiques or recommendations beyond mapping the existing pattern onto GitLab.

---

## TL;DR — the shape of the work

Chapa already integrates two non-GitHub platforms (Bitbucket, Codeberg) on top of a **shared OAuth factory** and a **single source-of-truth `Platform` union type**. The scoring pipeline, badge SVG renderer, and impact specs are **platform-agnostic** — confirmed three separate times in the docs (`docs/research/multi-platform.md:9`, `docs/research/2026-02-23-bitbucket-integration.md:9-11`, `docs/research/2026-02-26-next-service-integration.md:30-32`). Adding GitLab means **mirroring the per-platform files and registering GitLab in the shared layers** — no scoring/rendering changes.

GitLab is the **explicitly-named, highest-value unbuilt target**: Tier 1, feasibility 5/5 in `docs/research/multi-platform.md:19-34`, and pre-anticipated in the migration SQL comment `platform text NOT NULL -- 'bitbucket' (future: 'gitlab', 'gitea')` (`docs/plans/2026-02-23-bitbucket-integration-phases/phase-1.md:19`).

The minimal GitLab surface:
- **5 new route files** under `apps/web/app/api/auth/gitlab/` (`config.ts` + connect/callback/disconnect/status) — thin wrappers over the shared factory.
- **1 new `apps/web/lib/auth/gitlab.ts`** (OAuth helpers).
- **1 new `apps/web/lib/gitlab/` stats package** (5 files: client/queries/stats/stats-aggregation/types).
- **One-line edit to `packages/shared/src/platforms.ts`** adding `"gitlab"` to the `Platform` union — TypeScript then forces the remaining `Record<Platform, …>` updates.
- Edits to: `env.ts`, `feature-flags.ts`, `feature-flags-sync.ts`, `github/client.ts` (merge wiring), `BadgeBranding.tsx`, `BadgeSvg.tsx`, `demoData.ts`, `UserMenu.tsx`, `ImpactBreakdown.tsx`, `page.tsx`, `layout.tsx`, both i18n dictionaries, `.env.example`, `CLAUDE.md`, plus co-located tests.
- **The shared `lib/auth/platform-oauth.ts` factory needs NO changes** — its `PlatformOAuthConfig` and four `create*Handler` factories already accept any platform string.

---

## 1. Architecture: the shared OAuth factory

Both Bitbucket and Codeberg are built on a single factory at `apps/web/lib/auth/platform-oauth.ts`. The 8 route files (4 per platform) are 1-line wrappers; all platform differences live in (a) a `PlatformOAuthConfig` object and (b) a platform-specific helper module.

**Factory exports** (`platform-oauth.ts`): `createConnectHandler`, `createCallbackHandler`, `createDisconnectHandler`, `createStatusHandler`; types `PlatformOAuthConfig` (`:38-76`), `PlatformUser`, `PlatformTokenResponse`.

**Route wrapper pattern** (Codeberg, `app/api/auth/codeberg/connect/route.ts:1-5`):
```ts
export const GET = withErrorCapture("/api/auth/codeberg/connect", createConnectHandler(codebergOAuthConfig));
```
GitLab mirrors this with `gitlabOAuthConfig`. `disconnect` uses `POST`; the others use `GET`.

**Config object** (Codeberg, `app/api/auth/codeberg/config.ts:12-25`): wires `platform: "codeberg"`, `rateLimitPrefix: "cb"`, env-var getters, and the 6 helper functions from `lib/auth/codeberg.ts`. GitLab needs `gitlabOAuthConfig` with `platform: "gitlab"`, a fresh `rateLimitPrefix` (e.g. `"gl"`), `GITLAB_CLIENT_ID/SECRET`, and `lib/auth/gitlab` functions. Bitbucket's config (`config.ts:12-30`) shows a `fetchUser` adapter that maps the platform's `username` field to the generic `login` — GitLab returns `username`, so it likely needs a similar adapter.

### Connect handler (`platform-oauth.ts:88-128`)
1. Feature-flag check → 404 JSON if disabled.
2. Rate limit 10 req/IP/15min, key `ratelimit:<prefix>:connect:<ip>`.
3. `requireSession(request)` — the GitHub session login becomes the `handle`.
4. Read client-ID env (`.trim()`); missing → redirect `/u/<login>?error=config`.
5. Create CSRF state + cookie; `redirectUri = <baseUrl>/api/auth/<platform>/callback`.
6. Redirect to the platform authorize URL with the state cookie.

### Callback handler (`platform-oauth.ts:137-234`)
Flag check → rate limit → require session → validate `code` (`?error=<platform>_no_code`) → validate CSRF state (`?error=<platform>_invalid_state`) → validate client id+secret (`?error=<platform>_config`) → `config.exchangeCode` (`?error=<platform>_token_exchange`) → `config.fetchUser` (`?error=<platform>_user_fetch`) → `dbUpsertLinkedPlatform(...)` (`?error=<platform>_storage`) → invalidate caches `stats:v2:merged:<lh>` + `stats:v2:<platform>:<lh>` → clear state cookie → redirect `/u/<handle>?<platform>=linked`.

### Disconnect handler (`platform-oauth.ts:242-277`)
POST. Flag check → rate limit → require session → `dbDeleteLinkedPlatform(handle, platform)` → invalidate `stats:v2:merged:<lh>`, `stats:v2:<platform>:<lh>`, **and** `supplemental:<lh>` → `{ success }` JSON.

### Status handler (`platform-oauth.ts:285-317`)
Soft flag check → `{ enabled: false }` if off (this is the server-side enable gate; see §6) → higher rate limit 120 req/IP/15min → `dbGetLinkedPlatforms(session.login)` → `{ enabled, linked, remoteLogin, connectedAt }`.

---

## 2. The per-platform helper module (`lib/auth/<platform>.ts`)

`lib/auth/codeberg.ts` (1-229) provides the 7 functions the config wires in, plus constants and types:
- `buildCodebergAuthUrl` (`:42-54`), `createCodebergStateCookie` (`:72-79`), `validateCodebergState` (`:90-105`), `clearCodebergStateCookie` (`:112-114`), `exchangeCodebergCode` (`:124-153`), `fetchCodebergUser` (`:208-228`), `refreshCodebergToken` (`:166-198`).
- Constants `CB_AUTHORIZE_URL`/`CB_TOKEN_URL`/`CB_API_URL` (`:27-29`); state cookie name `chapa_cb_oauth_state` (`:60`).
- Types `CodebergUser`/`CodebergTokenResponse` (`:10-21`).
- **Reuses** `classifyOAuthError` + `TokenRefreshResult` from `./bitbucket` (`:2`) and `buildAuthCookieFlags` from `./cookie-policy` (`:3`).

**State/CSRF mechanics** (shared shape): cookie generated via `randomBytes(16).toString("hex")`, `HttpOnly; SameSite=Lax; Max-Age=600`; validation uses constant-time `crypto.timingSafeEqual` with a length pre-check; clear returns a `Max-Age=0` cookie.

### GitLab-specific OAuth differences to encode in `lib/auth/gitlab.ts`
GitLab uses standard `https://gitlab.com/oauth/authorize` + `https://gitlab.com/oauth/token` + `https://gitlab.com/api/v4`. Notable deltas vs the two existing platforms (the helper module is where these live):
- **GitLab supports scopes** in the authorize URL (Forgejo/Codeberg does not — `codeberg.ts:41`). GitLab typically needs `read_user` + `read_api`.
- **Token exchange**: Bitbucket uses form-encoded body + HTTP Basic auth (`bitbucket.ts:137-167`); Codeberg uses a JSON body with inline client_id/secret (`codeberg.ts:124-153`). GitLab uses form-encoded params (`grant_type=authorization_code`, `client_id`, `client_secret`, `code`, `redirect_uri`).
- **User-fetch auth header**: Bitbucket uses `Bearer` (`bitbucket.ts:245`); Codeberg uses `token` prefix (`codeberg.ts:213`). GitLab uses `Bearer` (or the `PRIVATE-TOKEN`/`access_token` param).
- **Token expiry**: GitLab tokens expire and rotate like Bitbucket's. Reuse the `TokenRefreshResult<T> = {ok:true;tokens} | {ok:false;reason:"revoked"|"transient"}` pattern (`docs/plans/2026-03-22-bitbucket-token-resilience.md:29-37`). Rule: only unlink on confirmed revocation (`HTTP 400 invalid_grant`); treat network/timeout/5xx as transient and keep the link.

---

## 3. Storage of linked accounts (Supabase, not session/cookie)

**Connection state is persisted in Supabase `user_platforms`**, accessed via `apps/web/lib/db/user-platforms.ts`:
- `dbGetLinkedPlatform(handle, platform)` → `{ remoteLogin, tokens:{accessToken, refreshToken, expiresAt} }`, decrypts tokens (`:42-85`).
- `dbUpsertLinkedPlatform(...)` → upsert on conflict `(handle, platform)`, encrypts tokens (`:91-127`).
- `dbDeleteLinkedPlatform`, `dbUpdatePlatformTokens` (post-refresh), `dbHasLinkedPlatform`, `dbGetLinkedPlatforms(handle)` → `LinkedPlatform[]` ordered by `connected_at`.

Table columns: `handle` (lowercased), `platform`, `remote_login`, `access_token`, `refresh_token`, `token_expires_at`, `connected_at`, `updated_at`, `id`. **Tokens encrypted at rest with AES-256-GCM** (`encryptToken`/`decryptToken` from `lib/auth/github.ts`, keyed by `NEXTAUTH_SECRET`). All ops **fail open** (return null/false/[] when Supabase is unavailable). Schema: `supabase/migrations/010_add_user_platforms.sql`.

**The `user_platforms` table is platform-agnostic** (keyed by `(handle, platform)`), so **no schema migration is required** for GitLab.

**Redis** holds only stats caches (not connection state): `stats:v2:merged:<lh>`, `stats:v2:<platform>:<lh>`, `stats:stale:<lh>`, `supplemental:<lh>`.

**Cookies** hold only the short-lived CSRF state cookies. OAuth tokens are never stored in cookies. The **session cookie carries no platform info** — `app/api/auth/session/route.ts` returns only `{ login, name, avatar_url, isAdmin }`. Connection status is queried separately per-platform via the status route.

---

## 4. How connected-platform data flows into scoring (they ARE scored)

Bitbucket and Codeberg contribute **real commit/PR/review data** that is summed into `StatsData` and drives Impact v6 — they are not display-only. Merge happens in `apps/web/lib/github/client.ts` → `_fetchAndCache` (`:116-219`):
1. Fetch primary GitHub stats (`:128`).
2. Fetch both platforms in parallel: `Promise.allSettled([fetchBitbucketIfLinked(...), fetchCodebergIfLinked(...)])` (`:139-142`) — one failing cannot block the other.
3. `mergeStats(primary, bbStats, { markAsSupplemental: false })` (`:148-150`), then Codeberg (`:153-155`). `markAsSupplemental: false` distinguishes linked-platform data from EMU/CLI supplemental data.
4. Merged `StatsData` is cached and scored.

`mergeStats` (`apps/web/lib/github/merge.ts:25-87`) **sums** `commitsTotal`, `prsMergedCount`, `prsMergedWeight` (capped at `PR_WEIGHT_AGG_CAP=120`), `reviewsSubmittedCount`, `issuesClosedCount`, `linesAdded/Deleted`, `reposContributed`; merges heatmap by date; recomputes `activeDays`; **vanity metrics (stars/forks/watchers) use `Math.max()`** to avoid double-counting.

`fetchBitbucketIfLinked` (`apps/web/lib/bitbucket/client.ts:16-72`): cache check → flag check → `dbGetLinkedPlatform` → **proactive token refresh** if expired (persist via `dbUpdatePlatformTokens`; delete the link only on `reason:"revoked"` or missing refresh token) → `fetchBitbucketStats` → cache.

`buildStatsFromBitbucket` (`apps/web/lib/bitbucket/stats-aggregation.ts:9-94`) builds a heatmap from commit timestamps, counts merged PRs, computes `prsMergedWeight` via the shared `computePrWeight`, counts reviews, `reposContributed` (depth-gated), `topRepoShare`. Bitbucket sets `totalStars/totalWatchers: 0`.

`linkedPlatforms` on `StatsData` is built from **DB link status as the source of truth** (not stats-fetch success), so a platform still shows in "Data Sources" even if its token temporarily fails (`github/client.ts:178-209`, fixes #632). `linkedPlatformLogins` is populated alongside (`:200-202`). Typed at `packages/shared/src/types.ts:39`.

### GitLab data-mapping gotchas (documented)
From `docs/research/multi-platform.md:19-34` and `docs/research/2026-02-26-next-service-integration.md:158-173`:
- **No heatmap/contribution-calendar endpoint** — must reconstruct from the **Events API** (`/users/:id/events`), which is paginated and contains mixed event types. This is the single largest piece of GitLab-specific work.
- **MRs instead of PRs** — map merge requests to the PR fields; different diffstat shape.
- **Some analytics are Premium-gated.**
- **Higher per-user API-call budget** than Bitbucket's ~100-150 calls (a noted risk).

The GitLab stats package (`apps/web/lib/gitlab/`) mirrors `apps/web/lib/codeberg/`: `client.ts` (export `fetchGitlabIfLinked`), `queries.ts`, `stats-aggregation.ts` (the MR→PR + Events→heatmap transform), `stats.ts`, `types.ts` (`GitlabUser`/`GitlabTokenResponse`). Then wire into `github/client.ts` symmetric to the Codeberg lines: import `isGitlabEnabled`/`fetchGitlabIfLinked`, parallel fetch, `mergeStats(..., {markAsSupplemental:false})`, DB-link resolution, `linkedPlatforms.push("gitlab")`, login resolution.

---

## 5. Badge branding / platform logos

`apps/web/lib/render/BadgeBranding.tsx`:
- `PLATFORM_LOGOS: Record<Platform, string>` (`:4-11`) — 24×24 SVG path per platform. Because it's `Record<Platform, …>`, adding `"gitlab"` to the union forces a GitLab entry here (TS error until added).
- `PLATFORM_ORDER: Platform[] = ["github", "bitbucket", "codeberg"]` (`:14`) — append `"gitlab"`.
- `renderBadgeBranding(...)` filters `PLATFORM_ORDER.filter(p => platforms.includes(p))` (`:41`) — only passed-in platforms render, in canonical order.

**The "only connected platforms" decision is the caller's**, `apps/web/lib/render/BadgeSvg.tsx:115-117`:
```ts
const brandingPlatforms: Platform[] = demoMode
  ? ["github", "bitbucket", "codeberg"]            // demo: all logos — append "gitlab"
  : ["github", ...(stats.linkedPlatforms?.filter(p => p !== "github") ?? [])];
```
Personal badges always include `github` plus `stats.linkedPlatforms`; demo badges hardcode the full list (append `"gitlab"`). Branding renders only when the `includeBranding` flag is on (`:118-120`). Demo fixture `apps/web/lib/render/demoData.ts:69-70` sets `linkedPlatforms: ["bitbucket","codeberg"]` and `linkedPlatformLogins` — add a GitLab entry.

Other logo/label touchpoints (each a `Record`/map keyed by platform):
- `apps/web/components/ImpactBreakdown.tsx:81-82` (`PLATFORM_DISPLAY` label) and `:93` (`PLATFORM_URLS` builder `https://gitlab.com/<username>`).
- `apps/web/app/page.tsx:31, 475-476` — landing footer inline icon component (`CodebergIcon`) + footer link → add `GitlabIcon` + footer link.
- `apps/web/components/UserMenu.tsx` — its own inline icon components (`:435-437` Bitbucket, `:628` `CodebergIcon`) → add `GitlabIcon`.

---

## 6. UI: User Menu link/unlink (`apps/web/components/UserMenu.tsx`)

The connect/disconnect UI is entirely in `UserMenu.tsx`. Codeberg touchpoints (mirror for GitLab):
- Module-level status cache fields: `:22, :26, :33`.
- Component state: `:61-66` (`cbStatus`/`setCbStatus`, `showCbUnlinkConfirm`, `cbUnlinkLoading`).
- Fetch helper union: `:186` `fetchPlatformStatus(platform: "bitbucket" | "codeberg", ...)` → add `"gitlab"`.
- Status fetch call: `:204` `fetchPlatformStatus("codeberg", setCbStatus)`.
- Unlink handler: `:225-228` `handleUnlinkCodeberg` → POST `/api/auth/codeberg/disconnect`.
- Rendered block: `:442-472` — linked state (avatar link to `https://codeberg.org/${remoteLogin}`, icon, red unlink button) and unlinked state (`href="/api/auth/codeberg/connect"`, icon, `t('userMenu.linkCodeberg')`).
- Confirm dialog: `:606-612` (`confirmUnlinkCodebergTitle`/`Body`, `onConfirm={handleUnlinkCodeberg}`).
- `CodebergIcon`: `:628`.

**Enable gating is server-side, not via a `NEXT_PUBLIC_*_ENABLED` check in the component.** The block renders whenever `cbStatus` is non-null (`:442` `{cbStatus && (...)}`); the `/api/auth/codeberg/status` route returns `{ enabled: false }` when the flag is off (`platform-oauth.ts:288-289`). GitLab mirrors this: render `{glStatus && (...)}` and let the status route gate it.

UX conventions (from `docs/research/2026-02-24-account-linking-ux-patterns.md:346-375` and `docs/research/2026-02-24-bitbucket-unlink-ux.md`): use "Unlink [Platform]" terminology, a light confirmation dialog with a destructive-styled (`text-terminal-red`) confirm button, status shown in the dropdown, avoid icon-only disconnect.

---

## 7. Feature flags & env vars

**Feature flags** (no central registry — flag keys are bare string literals to `checkFlag()`):
- `apps/web/lib/feature-flags.ts:127-132` — `isCodebergEnabled()` → `checkFlag("codeberg_integration", ...)`. Add `isGitlabEnabled()` → `checkFlag("gitlab_integration", ...)`. (Bitbucket `:114-119`.) Re-exports at `:23, :30`.
- `apps/web/lib/feature-flags-sync.ts:10, 40-42` — `isCodebergEnabledSync()` → `getCodebergEnabledEnv() === "true"`. Add `isGitlabEnabledSync`.
- The Supabase `feature_flags` row `gitlab_integration` is created at runtime/via DB (the DB value overrides the env var — see project memory), not in code.

**Env vars** (`apps/web/lib/env.ts`):
- Codeberg block `:157-172`: `getCodebergClientId` (`:161`), `getCodebergClientSecret` (`:166`), `getCodebergEnabledEnv` (`:171`, reads `NEXT_PUBLIC_CODEBERG_ENABLED`). Add a GitLab block: `getGitlabClientId`/`getGitlabClientSecret` (`GITLAB_CLIENT_ID`/`GITLAB_CLIENT_SECRET`), `getGitlabEnabledEnv` (`NEXT_PUBLIC_GITLAB_ENABLED`). All values `.trim()`ed (per project env-safety rule).
- Documentation: `.env.example:38, 44-46`; `CLAUDE.md:361-363` env block; `CLAUDE.md:136-141` badge-branding logo list (update "GitHub, Bitbucket, Codeberg" → add GitLab).

---

## 8. Types

- `packages/shared/src/platforms.ts:2` — **single source of truth**: `export type Platform = "github" | "bitbucket" | "codeberg";` → add `"gitlab"`. `LinkedPlatform` interface (`:5-9`) is platform-generic (no change).
- `packages/shared/src/types.ts:39` — `linkedPlatforms?: Platform[]`, `linkedPlatformLogins?: Record<string,string>`, and the `platform_linked` event type (no change; they're already generic).
- New per-platform API response types `GitlabUser`/`GitlabTokenResponse` in `lib/auth/gitlab.ts` and `lib/gitlab/types.ts`.
- The shared `PlatformOAuthConfig`/`PlatformTokenResponse`/`PlatformUser` (`platform-oauth.ts:26-76`) need **no changes**.

---

## 9. i18n (parity-enforced)

Add to **both** `apps/web/lib/i18n/dictionaries/en.ts` and `es.ts` at identical key paths (`parity.test.ts` enforces parity; Spanish is the default locale per CLAUDE.md):
- `aria.unlinkGitlab` (mirrors `aria.unlinkCodeberg` en/es `:30`)
- `userMenu.linkGitlab` (`:265`)
- `userMenu.confirmUnlinkGitlabTitle` (`:273`)
- `userMenu.confirmUnlinkGitlabBody` (`:274`)

Optional prose updates that list platforms — `en.ts`/`es.ts` lines ~528, 544, 567, 571, 868 (privacy/terms/verification "GitHub, Bitbucket, Codeberg"). Non-i18n marketing/SEO copy: `apps/web/app/layout.tsx:104` (keywords), `apps/web/app/llms.txt/route.ts:7,33,48`, `apps/web/app/llms-full.txt/route.ts:9,100`.

---

## 10. Tests (TDD, co-located)

Mirror the Codeberg test set for GitLab:
- Route tests: `app/api/auth/gitlab/{connect,callback,disconnect,status}/route.test.ts` (4).
- Auth module: `lib/auth/gitlab.test.ts`.
- Stats package: `lib/gitlab/{client,queries,stats,stats-aggregation}.test.ts`.
- Render: `lib/render/{BadgeBranding,BadgeSvg,demoData}.test.ts(x)` (extend existing).
- Components: `components/{UserMenu,ImpactBreakdown}.test.tsx` + `.render.test.tsx` (extend existing).
- Feature flags: `lib/feature-flags.test.ts` (add GitLab assertions).
- Shared fixtures: `apps/web/lib/test-helpers/platform-auth-fixtures.ts` has `BITBUCKET_*` fixtures (`:65-94`) but no `CODEBERG_*` (those route tests define fixtures inline) — add `GITLAB_*` fixtures or inline ones.
- i18n parity: `apps/web/lib/i18n/dictionaries/parity.test.ts` fails until en/es keys match (no edit; just keep in sync).

---

## 11. CLAUDE.md route documentation

Add a 4-line GitLab block immediately after the Codeberg routes (`CLAUDE.md:63-66`), identical shape:
```
- GET `/api/auth/gitlab/callback` GitLab OAuth callback
- GET `/api/auth/gitlab/connect` GitLab OAuth connect (link account)
- POST `/api/auth/gitlab/disconnect` GitLab account unlink
- GET `/api/auth/gitlab/status` GitLab connection status
```

---

## 12. Prior-art docs (the template is twice-proven)

- `docs/research/multi-platform.md` (#418) — GitLab Tier 1, 5/5, "highest-value target"; proposed `PlatformQuery`/`PlatformAuth` interfaces, cache-key evolution, `instance_url` for self-hosted. Sizes GitLab as "M", "~1-2 weeks", priority #2 after Codeberg/Forgejo.
- `docs/research/2026-02-26-next-service-integration.md` — most current strategic doc. Confirms platform-agnostic claim held for Bitbucket (zero scoring/render changes). **The `PlatformQuery` abstraction was deliberately NOT built** — `:199` recommends building it "when adding the third platform." With GitHub+Bitbucket+Codeberg now shipped, `:231-233` names GitLab as that point. GitLab "Option B" assessment at `:158-173` (Events-API heatmap, MRs, Premium gating, API budget). Anatomy of an integration at `:52-105`.
- `docs/research/2026-02-23-bitbucket-integration.md` — `mergeStats` rules (`:207-263`); the `PlatformQuery` signature already lists `"gitlab"` (`:533`); GitLab comparison row (`:516-521`).
- `docs/plans/2026-02-26-codeberg-integration.md` (+ phases) — the cleanest "add a platform" template: 5 phases (flag+type → OAuth helpers/routes → data fetch/transform → merge → UI), StatsData field-mapping table, env vars, OAuth-app setup.
- `docs/plans/2026-02-23-bitbucket-integration-phases/phase-1.md:12,16,19` — `user_platforms` migration SQL explicitly anticipates GitLab.
- `docs/plans/2026-02-26-badge-branding-v2.md` — multi-platform branding; personal badges show only connected logos, demo shows all.
- `docs/plans/2026-03-22-bitbucket-token-resilience.md` — `TokenRefreshResult` revoked-vs-transient handling that GitLab (expiring tokens) inherits.
- `docs/decisions/` — no ADR on platform integration. `docs/accepted-risks.md` — no constraints on this work. `docs/prs/` — empty.
- Impact specs (`docs/impact-v6.md` etc.) — platform-agnostic; mention supplemental merge only in terms of mechanism, not source. No spec edits implied.

### One open design decision (documented, not yet made)
`docs/research/2026-02-26-next-service-integration.md:231-233` recommends formalizing a `PlatformQuery`/`PlatformAuth` abstraction "at the third platform." That refactor was deferred. **GitLab can be added by direct wiring (the proven Codeberg path) without that abstraction**; whether to do the abstraction refactor first is a planning-phase choice. The self-hosted-GitLab `instance_url` column (`multi-platform.md:208-303`) is also not in the current schema — only relevant if self-hosted GitLab is in scope.

---

## File-by-file checklist (mirror Codeberg → GitLab)

**New files:**
1. `apps/web/app/api/auth/gitlab/config.ts`
2. `apps/web/app/api/auth/gitlab/connect/route.ts` (+ `.test.ts`)
3. `apps/web/app/api/auth/gitlab/callback/route.ts` (+ `.test.ts`)
4. `apps/web/app/api/auth/gitlab/disconnect/route.ts` (+ `.test.ts`)
5. `apps/web/app/api/auth/gitlab/status/route.ts` (+ `.test.ts`)
6. `apps/web/lib/auth/gitlab.ts` (+ `.test.ts`)
7. `apps/web/lib/gitlab/{client,queries,stats,stats-aggregation,types}.ts` (+ `.test.ts` each)

**Edited files:**
8. `packages/shared/src/platforms.ts` (add `"gitlab"` — drives TS errors elsewhere)
9. `apps/web/lib/env.ts` (GitLab env getters)
10. `apps/web/lib/feature-flags.ts` + `feature-flags-sync.ts`
11. `apps/web/lib/github/client.ts` (parallel fetch + merge + linkedPlatforms wiring)
12. `apps/web/lib/render/BadgeBranding.tsx` (logo + order)
13. `apps/web/lib/render/BadgeSvg.tsx` (demo list)
14. `apps/web/lib/render/demoData.ts` (demo linkedPlatforms/logins)
15. `apps/web/components/UserMenu.tsx` (link/unlink row + GitlabIcon)
16. `apps/web/components/ImpactBreakdown.tsx` (label + URL)
17. `apps/web/app/page.tsx` (footer icon/link)
18. `apps/web/app/layout.tsx` (keywords) + `llms.txt`/`llms-full.txt` routes
19. `apps/web/lib/i18n/dictionaries/en.ts` + `es.ts`
20. `.env.example`, `CLAUDE.md`
21. Extend existing tests: `feature-flags.test.ts`, `BadgeBranding/BadgeSvg/demoData` tests, `UserMenu`/`ImpactBreakdown` tests, `platform-auth-fixtures.ts`

**No change:** `apps/web/lib/auth/platform-oauth.ts` (factory), scoring engine (`lib/impact/*`), `mergeStats` (`lib/github/merge.ts`), badge SVG renderer core, impact specs, `user_platforms` schema.
