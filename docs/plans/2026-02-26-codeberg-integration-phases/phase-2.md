# Phase 2: OAuth Helpers + Routes

> Parent: [Codeberg Integration Plan](../2026-02-26-codeberg-integration.md)
> Depends on: Phase 1
> Estimated new files: 6
> Estimated modified files: 0

## Goal

Implement the full Codeberg OAuth2 flow: connect, callback, disconnect, and status endpoints. Mirror the Bitbucket OAuth module structure exactly.

## Key Differences from Bitbucket

| Aspect | Bitbucket | Codeberg |
|--------|-----------|----------|
| Authorize URL | `https://bitbucket.org/site/oauth2/authorize` | `https://codeberg.org/login/oauth/authorize` |
| Token URL | `https://bitbucket.org/site/oauth2/access_token` | `https://codeberg.org/login/oauth/access_token` |
| Token exchange body | `application/x-www-form-urlencoded` + Basic auth header | `application/json` body with `client_id`, `client_secret`, `code`, `grant_type`, `redirect_uri` |
| Token response | Always has `expires_in` (7200s) + `refresh_token` | May or may not include `expires_in` + `refresh_token` |
| User profile endpoint | `GET /2.0/user` → `{username, display_name, links.avatar.href}` | `GET /api/v1/user` → `{login, full_name, avatar_url}` |
| Auth header for API | `Bearer <token>` | `token <token>` (canonical) or `Bearer <token>` |
| Scopes | Configured on OAuth consumer | Not implemented (full user permissions) |

## New Files

### 1. `apps/web/lib/auth/codeberg.ts` (~180 lines)

OAuth2 helpers for Codeberg. Same structure as `apps/web/lib/auth/bitbucket.ts`.

```typescript
// Types
export interface CodebergUser {
  login: string;
  full_name: string;
  avatar_url: string;
}

export interface CodebergTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;      // May be absent — handle both cases
  refresh_token?: string;   // May be absent
}

// Constants
const CB_AUTHORIZE_URL = "https://codeberg.org/login/oauth/authorize";
const CB_TOKEN_URL = "https://codeberg.org/login/oauth/access_token";
const CB_API_URL = "https://codeberg.org/api/v1";
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;

// --- OAuth URL ---
export function buildCodebergAuthUrl(
  clientId: string,
  redirectUri: string,
  state: string,
): string {
  // Params: client_id, redirect_uri, response_type=code, state
  // Returns: `${CB_AUTHORIZE_URL}?${params}`
}

// --- CSRF state cookie ---
const CB_STATE_COOKIE_NAME = "chapa_cb_oauth_state";

export function createCodebergStateCookie(): { state: string; cookie: string } {
  // Same pattern as Bitbucket: randomBytes(16).toString("hex")
  // Max-Age=600 (10 minutes), HttpOnly, SameSite=Lax, conditional Secure
}

export function validateCodebergState(
  cookieHeader: string | null,
  queryState: string | null,
): boolean {
  // Timing-safe comparison using timingSafeEqual
}

export function clearCodebergStateCookie(): string {
  // Max-Age=0 to clear
}

// --- Token exchange ---
export async function exchangeCodebergCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<CodebergTokenResponse | null> {
  // POST to CB_TOKEN_URL with JSON body (NOT form-encoded):
  // {
  //   client_id: clientId,
  //   client_secret: clientSecret,
  //   code,
  //   grant_type: "authorization_code",
  //   redirect_uri: redirectUri,
  // }
  // Content-Type: application/json
  // Returns parsed response or null on error
}

// --- Token refresh ---
export async function refreshCodebergToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<CodebergTokenResponse | null> {
  // POST to CB_TOKEN_URL with JSON body:
  // {
  //   client_id: clientId,
  //   client_secret: clientSecret,
  //   grant_type: "refresh_token",
  //   refresh_token: refreshToken,
  // }
  // Returns null if no refresh_token support or on error
}

// --- Fetch authenticated user ---
export async function fetchCodebergUser(
  accessToken: string,
): Promise<CodebergUser | null> {
  // GET CB_API_URL/user
  // Headers: { Authorization: `token ${accessToken}` }
  // Returns { login, full_name, avatar_url } or null on error
}

// --- Token expiry helpers ---
// Reuse computeTokenExpiry() and isTokenExpired() from bitbucket.ts
// OR export shared helpers. Since they're identical, re-export from bitbucket.
// Decision: import { computeTokenExpiry, isTokenExpired } from "./bitbucket"
```

### 2. `apps/web/lib/auth/codeberg.test.ts` (~350 lines)

Mirror `bitbucket.test.ts` test structure:

```
describe("buildCodebergAuthUrl")
  - returns Codeberg OAuth URL with correct client_id
  - includes redirect_uri
  - includes state parameter
  - includes response_type=code

describe("exchangeCodebergCode")
  - sends JSON body (not form-encoded) to Codeberg token endpoint
  - returns tokens on success
  - returns null on error response
  - returns null on network error
  - includes client_id and client_secret in JSON body (not Basic auth)

describe("refreshCodebergToken")
  - sends grant_type=refresh_token
  - returns new tokens on success
  - returns null on error
  - returns null on network error

describe("fetchCodebergUser")
  - returns { login, full_name, avatar_url } on success
  - sends 'token' prefix in Authorization header
  - returns null on 401
  - returns null on network error

describe("createCodebergStateCookie")
  - returns state value and Set-Cookie header string
  - generates unique state values each call

describe("validateCodebergState")
  - returns true when cookie matches query state
  - returns false on mismatch
  - returns false when cookie is null
  - returns false when state is null
  - uses timing-safe comparison

describe("clearCodebergStateCookie")
  - returns cookie with Max-Age=0

describe("Codeberg cookie Secure flag")
  - includes Secure when base URL is HTTPS
  - omits Secure when base URL is HTTP
```

### 3. `apps/web/app/api/auth/codeberg/connect/route.ts` (~37 lines)

Mirror `apps/web/app/api/auth/bitbucket/connect/route.ts`:

```typescript
export async function GET(request: NextRequest) {
  // 1. Feature flag: if (!(await isCodebergEnabled())) → 404
  // 2. requireSession(request)
  // 3. Validate CODEBERG_CLIENT_ID + NEXT_PUBLIC_BASE_URL
  // 4. createCodebergStateCookie()
  // 5. buildCodebergAuthUrl(clientId, redirectUri, state)
  // 6. Redirect to Codeberg with state cookie
}
```

### 4. `apps/web/app/api/auth/codeberg/callback/route.ts` (~100 lines)

Mirror `apps/web/app/api/auth/bitbucket/callback/route.ts`:

```typescript
export async function GET(request: NextRequest) {
  // 1. Feature flag check
  // 2. requireSession(request)
  // 3. Validate authorization code from query
  // 4. Validate CSRF state (timing-safe)
  // 5. Validate CODEBERG_CLIENT_ID + CODEBERG_CLIENT_SECRET + BASE_URL
  // 6. exchangeCodebergCode(code, clientId, clientSecret, redirectUri)
  // 7. fetchCodebergUser(tokens.access_token)
  // 8. Compute expiry: tokens.expires_in ? computeTokenExpiry(tokens.expires_in) : null
  // 9. dbUpsertLinkedPlatform(handle, "codeberg", cbUser.login, ...)
  // 10. Invalidate cache: stats:v2:merged:{handle}, stats:v2:codeberg:{handle}
  // 11. Clear state cookie, redirect to /u/{handle}?codeberg=linked
}
```

### 5. `apps/web/app/api/auth/codeberg/disconnect/route.ts` (~30 lines)

Mirror `apps/web/app/api/auth/bitbucket/disconnect/route.ts`:

```typescript
export async function POST(request: NextRequest) {
  // 1. Feature flag check
  // 2. requireSession(request)
  // 3. dbDeleteLinkedPlatform(handle, "codeberg")
  // 4. Invalidate cache: stats:v2:merged:{handle}, stats:v2:codeberg:{handle}
  // 5. Return { success: boolean }
}
```

### 6. `apps/web/app/api/auth/codeberg/status/route.ts` (~27 lines)

Mirror `apps/web/app/api/auth/bitbucket/status/route.ts`:

```typescript
export async function GET(request: NextRequest) {
  // 1. Feature flag check (soft: return { enabled: false })
  // 2. requireSession(request)
  // 3. dbGetLinkedPlatforms(session.login)
  // 4. Find codeberg entry
  // 5. Return { enabled: true, linked: boolean, remoteLogin, connectedAt }
}
```

## Success Criteria

### Automated
- [x] `pnpm run typecheck` passes
- [x] `pnpm run test -- codeberg` passes (all OAuth helper tests)
- [x] `pnpm run lint` passes

### Manual
- [ ] With `CODEBERG_CLIENT_ID` set and `NEXT_PUBLIC_CODEBERG_ENABLED=true`:
  - Navigate to `/api/auth/codeberg/connect` → redirects to Codeberg OAuth consent
  - After consent → callback stores tokens and redirects to share page with `?codeberg=linked`
  - `/api/auth/codeberg/status` → returns `{ enabled: true, linked: true, remoteLogin: "..." }`
  - POST `/api/auth/codeberg/disconnect` → unlinks successfully
