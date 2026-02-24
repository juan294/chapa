# Phase 2: Bitbucket OAuth — Connect, Disconnect, Refresh

## Goal

Implement the Bitbucket OAuth 2.0 linking flow. Users can connect their Bitbucket Cloud account, the tokens are stored encrypted in Supabase, and expired tokens are transparently refreshed.

## Bitbucket OAuth 2.0 Flow

```
User clicks "Link Bitbucket" in User Menu
  → GET /api/auth/bitbucket/connect
    → Generate CSRF state, store in cookie
    → Redirect to bitbucket.org/site/oauth2/authorize
  → Bitbucket redirects to /api/auth/bitbucket/callback?code=XXX&state=YYY
    → Validate CSRF state
    → Exchange code for access_token + refresh_token
    → Fetch Bitbucket user profile (/user)
    → Store encrypted tokens in user_platforms table
    → Invalidate stats cache (force re-merge on next badge request)
    → Redirect to /u/{handle}?bitbucket=linked
```

## New Files

### 1. `apps/web/lib/auth/bitbucket.ts`

Bitbucket OAuth helpers (mirrors `github.ts` structure):

```typescript
const BB_AUTHORIZE_URL = "https://bitbucket.org/site/oauth2/authorize";
const BB_TOKEN_URL = "https://bitbucket.org/site/oauth2/access_token";
const BB_API_URL = "https://api.bitbucket.org/2.0";

interface BitbucketUser {
  username: string;
  display_name: string;
  links: { avatar: { href: string } };
}

interface BitbucketTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;        // seconds (typically 7200 = 2 hours)
  token_type: "bearer";
  scopes: string;
}

/** Build Bitbucket OAuth authorize URL */
export function buildBitbucketAuthUrl(
  clientId: string,
  redirectUri: string,
  state: string,
): string
// Params: client_id, redirect_uri, state, response_type=code
// Scopes are configured on the OAuth consumer in Bitbucket settings (not in URL)

/** Exchange authorization code for tokens */
export async function exchangeBitbucketCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<BitbucketTokenResponse | null>
// POST to BB_TOKEN_URL with grant_type=authorization_code
// Content-Type: application/x-www-form-urlencoded
// Note: Bitbucket uses form encoding, not JSON (unlike GitHub)

/** Refresh an expired access token */
export async function refreshBitbucketToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<BitbucketTokenResponse | null>
// POST to BB_TOKEN_URL with grant_type=refresh_token

/** Fetch authenticated Bitbucket user profile */
export async function fetchBitbucketUser(
  accessToken: string,
): Promise<BitbucketUser | null>
// GET BB_API_URL/user with Bearer token

/** CSRF state cookie helpers (same pattern as github.ts) */
const BB_STATE_COOKIE_NAME = "chapa_bb_oauth_state";
export function createBitbucketStateCookie(): { state: string; cookie: string }
export function validateBitbucketState(cookieHeader: string | null, queryState: string | null): boolean
export function clearBitbucketStateCookie(): string

/** Compute token expiry from expires_in seconds */
export function computeTokenExpiry(expiresIn: number): Date
// new Date(Date.now() + expiresIn * 1000)

/** Check if a token is expired (with 5-minute buffer) */
export function isTokenExpired(expiresAt: Date | null): boolean
// Returns true if expiresAt is null (unknown) or within 5 minutes of now
```

### 2. `apps/web/lib/auth/bitbucket.test.ts`

```
describe("buildBitbucketAuthUrl")
  - includes client_id and redirect_uri in URL
  - includes state parameter
  - targets bitbucket.org/site/oauth2/authorize

describe("exchangeBitbucketCode")
  - sends form-encoded body (not JSON)
  - returns tokens on success
  - returns null on error response
  - returns null on network error

describe("refreshBitbucketToken")
  - sends grant_type=refresh_token
  - returns new tokens on success
  - returns null on error (e.g. refresh token revoked)

describe("fetchBitbucketUser")
  - returns { username, display_name, links } on success
  - returns null on 401 (invalid token)

describe("CSRF state helpers")
  - createBitbucketStateCookie generates random state
  - validateBitbucketState uses timing-safe comparison
  - validates correctly with matching state
  - rejects mismatched state

describe("isTokenExpired")
  - returns true when expiresAt is null
  - returns true when within 5-minute buffer
  - returns false when token is fresh
```

### 3. `apps/web/app/api/auth/bitbucket/connect/route.ts`

```typescript
import { requireSession } from "@/lib/auth/require-session";
import { isBitbucketEnabled } from "@/lib/feature-flags";

export async function GET(request: NextRequest) {
  // 1. Feature flag check
  if (!(await isBitbucketEnabled())) return notFound();

  // 2. Require authenticated session (must be logged in with GitHub first)
  const { session, error } = requireSession(request);
  if (error) return error;

  // 3. Validate env vars
  const clientId = process.env.BITBUCKET_CLIENT_ID?.trim();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (!clientId || !baseUrl) {
    return NextResponse.redirect(new URL("/?error=config", request.url));
  }

  // 4. Generate CSRF state + cookie
  const { state, cookie } = createBitbucketStateCookie();
  const redirectUri = `${baseUrl}/api/auth/bitbucket/callback`;
  const authUrl = buildBitbucketAuthUrl(clientId, redirectUri, state);

  // 5. Redirect to Bitbucket
  const response = NextResponse.redirect(authUrl);
  response.headers.append("Set-Cookie", cookie);
  return response;
}
```

### 4. `apps/web/app/api/auth/bitbucket/callback/route.ts`

```typescript
export async function GET(request: NextRequest) {
  // 1. Feature flag check
  // 2. Require authenticated session
  // 3. Validate CSRF state
  // 4. Exchange code for tokens
  // 5. Fetch Bitbucket user profile
  // 6. Store encrypted tokens in user_platforms
  //    dbUpsertLinkedPlatform(session.login, "bitbucket", bbUser.username, ...)
  // 7. Invalidate stats cache: cacheDel(`stats:v2:${session.login.toLowerCase()}`)
  // 8. Clear state cookie
  // 9. Redirect to /u/{session.login}?bitbucket=linked
  //
  // Error handling: redirect to /u/{session.login}?error=bitbucket_{reason}
  // Errors: no_code, invalid_state, config, token_exchange, user_fetch, storage
}
```

### 5. `apps/web/app/api/auth/bitbucket/disconnect/route.ts`

```typescript
export async function POST(request: NextRequest) {
  // 1. Feature flag check
  // 2. Require authenticated session
  // 3. Delete linked platform: dbDeleteLinkedPlatform(session.login, "bitbucket")
  // 4. Invalidate stats cache: cacheDel(`stats:v2:${session.login.toLowerCase()}`)
  // 5. Return { success: true }
}
```

### 6. Tests for routes

`apps/web/app/api/auth/bitbucket/connect/route.test.ts`
`apps/web/app/api/auth/bitbucket/callback/route.test.ts`
`apps/web/app/api/auth/bitbucket/disconnect/route.test.ts`

Each test file mocks:
- `requireSession` → returns mock session
- `isBitbucketEnabled` → returns true/false
- `dbUpsertLinkedPlatform` / `dbDeleteLinkedPlatform` → mock DB operations
- `exchangeBitbucketCode` / `fetchBitbucketUser` → mock API calls
- `cacheDel` → verify cache invalidation

## Modified Files

### 1. `.env.example`

Already updated in Phase 1.

## Token Refresh Strategy

Bitbucket access tokens expire in ~2 hours. The refresh happens lazily:

```
When Bitbucket stats are needed (Phase 4):
  1. Read tokens from user_platforms
  2. Check isTokenExpired(expiresAt)
  3. If expired:
     a. Call refreshBitbucketToken(refreshToken, clientId, clientSecret)
     b. If refresh succeeds: dbUpdatePlatformTokens() with new tokens
     c. If refresh fails (revoked): delete linked platform, skip Bitbucket data
  4. Use (possibly refreshed) access token for API calls
```

This is implemented in Phase 4 when the Bitbucket client is wired into the stats pipeline.

## Automated Verification

```bash
pnpm run typecheck 2>&1; pnpm run test -- --run apps/web/lib/auth/bitbucket.test.ts apps/web/app/api/auth/bitbucket/ 2>&1; pnpm run lint 2>&1
```

## Success Criteria

- [x] `GET /api/auth/bitbucket/connect` redirects to bitbucket.org with CSRF state
- [x] `GET /api/auth/bitbucket/callback` exchanges code, stores tokens, invalidates cache
- [x] `POST /api/auth/bitbucket/disconnect` removes platform link, invalidates cache
- [x] CSRF state is validated with timing-safe comparison
- [x] Tokens are encrypted before DB storage (reuses AES-256-GCM from github.ts)
- [x] Routes return 404 when feature flag is disabled
- [x] Routes return 401 when not authenticated
- [x] All tests pass, typecheck clean
