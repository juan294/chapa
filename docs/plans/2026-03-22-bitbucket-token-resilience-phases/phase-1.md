# Phase 1: Update refresh functions to return `TokenRefreshResult`

## Scope

Add a discriminated union return type to `refreshBitbucketToken` and `refreshCodebergToken` that distinguishes revoked tokens from transient failures.

## Changes

### 1. `apps/web/lib/auth/bitbucket.ts`

**Add type** (after existing types, ~line 20):

```typescript
/**
 * Discriminated result for token refresh attempts.
 * - `ok: true` — refresh succeeded, new tokens available
 * - `ok: false, reason: "revoked"` — grant is dead (user revoked, token expired server-side)
 * - `ok: false, reason: "transient"` — temporary failure (network, timeout, server error)
 */
export type TokenRefreshResult<T> =
  | { ok: true; tokens: T }
  | { ok: false; reason: "revoked" | "transient" };
```

**Update `refreshBitbucketToken`** (lines 170-198):

```typescript
export async function refreshBitbucketToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<TokenRefreshResult<BitbucketTokenResponse>> {
  try {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });

    const res = await fetch(BB_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!res.ok) {
      // HTTP 400 with "invalid_grant" = token revoked or expired server-side
      if (res.status === 400) {
        try {
          const errBody = await res.json();
          if (errBody.error === "invalid_grant") {
            return { ok: false, reason: "revoked" };
          }
        } catch {
          // Can't parse body — treat as transient
        }
      }
      return { ok: false, reason: "transient" };
    }

    const data = await res.json();
    if (!data.access_token) {
      return { ok: false, reason: "transient" };
    }
    return { ok: true, tokens: data as BitbucketTokenResponse };
  } catch {
    // Network error, timeout, AbortError — all transient
    return { ok: false, reason: "transient" };
  }
}
```

### 2. `apps/web/lib/auth/codeberg.ts`

**Import and use `TokenRefreshResult`** from bitbucket.ts (codeberg.ts already imports `isTokenExpired` and `computeTokenExpiry` from there):

```typescript
import { computeTokenExpiry, isTokenExpired, type TokenRefreshResult } from "./bitbucket";
```

**Update `refreshCodebergToken`** to return `TokenRefreshResult<CodebergTokenResponse>`:

Same pattern as Bitbucket — check for `400 + invalid_grant` as revocation signal, everything else is transient.

### 3. `apps/web/lib/auth/bitbucket.test.ts`

**Update existing tests** for new return shape:

- "returns tokens on success" → assert `{ ok: true, tokens: { access_token: ... } }`
- "returns null on error (revoked)" → becomes "returns revoked when 400 + invalid_grant"
  - Mock: `{ ok: false, status: 400, json: () => ({ error: "invalid_grant" }) }`
  - Assert: `{ ok: false, reason: "revoked" }`
- "returns null on network error" → becomes "returns transient on network error"
  - Assert: `{ ok: false, reason: "transient" }`

**Add new test cases:**

- "returns transient on 500 server error"
  - Mock: `{ ok: false, status: 500 }`
  - Assert: `{ ok: false, reason: "transient" }`
- "returns transient on 400 without invalid_grant"
  - Mock: `{ ok: false, status: 400, json: () => ({ error: "invalid_request" }) }`
  - Assert: `{ ok: false, reason: "transient" }`
- "returns transient on 400 with unparseable body"
  - Mock: `{ ok: false, status: 400, json: () => { throw new Error("bad json"); } }`
  - Assert: `{ ok: false, reason: "transient" }`
- "returns transient on timeout (AbortError)"
  - Assert: `{ ok: false, reason: "transient" }`

### 4. `apps/web/lib/auth/codeberg.test.ts`

Mirror the same test updates for `refreshCodebergToken`.

## Success criteria (automated)

```bash
pnpm run test -- --run apps/web/lib/auth/bitbucket.test.ts   # All pass
pnpm run test -- --run apps/web/lib/auth/codeberg.test.ts    # All pass
pnpm run typecheck                                            # No errors
```
