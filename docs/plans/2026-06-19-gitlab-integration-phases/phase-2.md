# Phase 2 — OAuth helpers + routes

> Parent: [GitLab integration plan](../2026-06-19-gitlab-integration.md) | Issue #855 | Depends on: Phase 1

## Goal

Implement the GitLab OAuth connect/callback/disconnect/status flow by (a) writing `lib/auth/gitlab.ts` (the platform-specific helpers) and (b) adding the thin route wrappers + config that plug into the **unchanged** shared factory `lib/auth/platform-oauth.ts`.

## Changes

### 1. `apps/web/lib/auth/gitlab.ts` (new — mirror `lib/auth/codeberg.ts`)

Reuse `classifyOAuthError` + `TokenRefreshResult` from `./bitbucket`, `buildAuthCookieFlags` from `./cookie-policy`, `getBaseUrl` from `@/lib/env`.

```
// Types
export interface GitlabUser { login: string; full_name: string; avatar_url: string; }
export interface GitlabTokenResponse { access_token: string; token_type: string; expires_in?: number; refresh_token?: string; }

// Constants
const GL_AUTHORIZE_URL = "https://gitlab.com/oauth/authorize";
const GL_TOKEN_URL = "https://gitlab.com/oauth/token";
const GL_API_URL = "https://gitlab.com/api/v4";
const GL_SCOPES = "read_user read_api";
const GL_STATE_COOKIE_NAME = "chapa_gl_oauth_state";
const FETCH_TIMEOUT_MS = 10_000;

// buildGitlabAuthUrl(clientId, redirectUri, state):
//   params = { client_id, redirect_uri, response_type: "code", state, scope: GL_SCOPES }
//   → `${GL_AUTHORIZE_URL}?${params}`        // DELTA vs Codeberg: GitLab supports scopes

// createGitlabStateCookie() / validateGitlabState() / clearGitlabStateCookie()
//   identical to codeberg.ts but with GL_STATE_COOKIE_NAME (randomBytes(16) hex, HttpOnly, SameSite=Lax, Max-Age=600, timingSafeEqual)

// exchangeGitlabCode(code, clientId, clientSecret, redirectUri):
//   POST GL_TOKEN_URL, Content-Type: application/x-www-form-urlencoded   // DELTA: form-encoded, not JSON
//   body = URLSearchParams({ client_id, client_secret, code, grant_type: "authorization_code", redirect_uri })
//   timeout FETCH_TIMEOUT_MS; return null on !ok or missing access_token

// refreshGitlabToken(refreshToken, clientId, clientSecret): TokenRefreshResult<GitlabTokenResponse>
//   POST GL_TOKEN_URL form-encoded { client_id, client_secret, grant_type: "refresh_token", refresh_token }
//   !ok → { ok:false, reason: await classifyOAuthError(res) }; missing token → transient; catch → transient

// fetchGitlabUser(accessToken): GitlabUser | null
//   GET `${GL_API_URL}/user`, Authorization: `Bearer ${accessToken}`   // DELTA: Bearer, not `token`
//   map { login: data.username, full_name: data.name, avatar_url: data.avatar_url }
```

### 2. `apps/web/app/api/auth/gitlab/config.ts` (new — mirror codeberg config)
```
import { isGitlabEnabled } from "@/lib/feature-flags";
import { createGitlabStateCookie, buildGitlabAuthUrl, validateGitlabState, clearGitlabStateCookie, exchangeGitlabCode, fetchGitlabUser } from "@/lib/auth/gitlab";
import type { PlatformOAuthConfig } from "@/lib/auth/platform-oauth";

export const gitlabOAuthConfig: PlatformOAuthConfig = {
  platform: "gitlab",
  rateLimitPrefix: "gl",
  isEnabled: isGitlabEnabled,
  clientIdEnvVar: "GITLAB_CLIENT_ID",
  clientSecretEnvVar: "GITLAB_CLIENT_SECRET",
  createStateCookie: createGitlabStateCookie,
  buildAuthUrl: buildGitlabAuthUrl,
  validateState: validateGitlabState,
  clearStateCookie: clearGitlabStateCookie,
  exchangeCode: exchangeGitlabCode,
  fetchUser: fetchGitlabUser,
};
```

### 3. Route wrappers (new — each 5 lines, mirror codeberg routes)
- `app/api/auth/gitlab/connect/route.ts` → `export const GET = withErrorCapture("/api/auth/gitlab/connect", createConnectHandler(gitlabOAuthConfig));`
- `app/api/auth/gitlab/callback/route.ts` → `createCallbackHandler` (GET)
- `app/api/auth/gitlab/disconnect/route.ts` → `createDisconnectHandler` (**POST**)
- `app/api/auth/gitlab/status/route.ts` → `createStatusHandler` (GET)

## Tests (write first)

Add `GITLAB_*` fixtures to `apps/web/lib/test-helpers/platform-auth-fixtures.ts` (or inline, matching how codeberg route tests do it): `GITLAB_ENV_VARS`, `GITLAB_TOKEN_RESPONSE`, `GITLAB_USER`, `GITLAB_STATE_COOKIE`.

- `apps/web/lib/auth/gitlab.test.ts`:
  - `buildGitlabAuthUrl` includes `scope=read_user+read_api`, `response_type=code`, `state`, encoded `redirect_uri`.
  - state cookie: create→validate round-trips; mismatched/missing → false; length-mismatch → false.
  - `exchangeGitlabCode`: form-encoded body, returns tokens on 200, null on !ok / missing token (mock `fetch`).
  - `refreshGitlabToken`: `invalid_grant` 400 → `{ok:false, reason:"revoked"}`; 500/network → `transient`; success → `{ok:true}`.
  - `fetchGitlabUser`: maps `username`→`login`; uses `Bearer`; null on !ok.
- Route tests (mirror codeberg `route.test.ts` set), each importing the handler + a `NextRequest`:
  - `connect`: 404 when flag off; redirects to `gitlab.com/oauth/authorize` with state cookie when on + session.
  - `callback`: `?error=gitlab_invalid_state` on bad state; calls `dbUpsertLinkedPlatform(handle,"gitlab",...)` + cache invalidation on success; redirects `/u/<handle>?gitlab=linked`.
  - `disconnect`: POST calls `dbDeleteLinkedPlatform(handle,"gitlab")`; returns `{success}`.
  - `status`: `{enabled:false}` when flag off; `{enabled,linked,remoteLogin,connectedAt}` when on.

Mock `@/lib/feature-flags`, `@/lib/db/user-platforms`, `@/lib/auth/session`, `@/lib/cache/redis`, and `fetch` per existing codeberg test patterns.

## Success criteria — ✅ COMPLETE (2026-06-19)

**Automated:**
- [x] `pnpm run test` green — **450 files / 7684 tests passing** (+79 from Phase 2).
- [x] `pnpm run typecheck` green.
- [x] `pnpm run lint` green.
- [x] New auth helper tests + 4 route tests + `GITLAB_*` fixtures.

**Manual:** none (live OAuth requires the user's GitLab app + env, covered in Phase 5 manual check).

Implemented in worktree `gitlab-foundation` (stacked on Phase 1). Plan-compliance review: PASS (11/11). Shared factory `platform-oauth.ts` unchanged. `GitlabUser` carries `id` (numeric) as documented Phase-3 setup. `/simplify`: clean — noted pre-existing CSRF-cookie-helper duplication across bitbucket/codeberg/gitlab as a future cross-platform refactor (out of this diff's scope; not applied).
