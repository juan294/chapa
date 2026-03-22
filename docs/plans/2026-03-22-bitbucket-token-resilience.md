# Plan: Bitbucket Token Refresh Resilience

> **Created:** 2026-03-22
> **Status:** Complete
> **Issue:** Bitbucket disconnects on every login due to aggressive auto-unlinking on transient refresh failures

## Problem

Bitbucket access tokens expire every 2 hours. When the badge route or stats fetch runs, `_fetchBitbucketIfLinked()` (`client.ts:173`) checks token expiry and attempts a refresh. **If the refresh fails for any reason — network timeout, Bitbucket API downtime, rate limit — the code permanently deletes the user's Bitbucket link** via `dbDeleteLinkedPlatform()`.

The root cause: `refreshBitbucketToken()` returns `null` for both "token was revoked by user" and "transient network error." The caller treats all `null` results as revocation and auto-unlinks.

GitHub doesn't have this problem because its token lives in the session cookie with no refresh/unlink logic. Codeberg has the same vulnerability.

## Solution

Distinguish between **revoked** (user explicitly revoked access) and **transient** (network error, timeout, server error) refresh failures. Only unlink on confirmed revocation.

### Revocation signal

Per OAuth 2.0 spec and Bitbucket's behavior:
- `HTTP 400` with `error: "invalid_grant"` → **revoked** (refresh token expired or user revoked app access)
- Everything else (network error, timeout, 5xx, other 4xx) → **transient** (retry later)

This is deliberately conservative: we only unlink when the OAuth provider explicitly tells us the grant is dead.

## Architecture

### New type: `TokenRefreshResult<T>`

```typescript
export type TokenRefreshResult<T> =
  | { ok: true; tokens: T }
  | { ok: false; reason: "revoked" | "transient" };
```

Defined in `bitbucket.ts` (already the shared auth utility — exports `isTokenExpired` and `computeTokenExpiry` used by both platforms).

### Changed behavior in `_fetchBitbucketIfLinked` / `_fetchCodebergIfLinked`

| Refresh result | Current behavior | New behavior |
|---------------|-----------------|-------------|
| Success | Update tokens, fetch stats | Same |
| Revoked | Delete link | Same |
| Transient | Delete link | **Return null stats, keep link** |
| No refresh token + expired | Delete link | Same |

## Files changed

| File | Change |
|------|--------|
| `apps/web/lib/auth/bitbucket.ts` | Add `TokenRefreshResult<T>` type. Update `refreshBitbucketToken` return type and logic. |
| `apps/web/lib/auth/bitbucket.test.ts` | Update tests for new return type. Add transient vs revoked test cases. |
| `apps/web/lib/auth/codeberg.ts` | Update `refreshCodebergToken` to return `TokenRefreshResult<CodebergTokenResponse>`. |
| `apps/web/lib/auth/codeberg.test.ts` | Update tests for new return type. Add transient vs revoked test cases. |
| `apps/web/lib/github/client.ts` | Update `_fetchBitbucketIfLinked` and `_fetchCodebergIfLinked` to handle `reason: "transient"` without unlinking. |
| `apps/web/lib/github/client.test.ts` | Add test cases: transient failure keeps link, revoked failure unlinks. |

## Phases

### Phase 1: Update refresh functions to return `TokenRefreshResult`

**Files:** `bitbucket.ts`, `bitbucket.test.ts`, `codeberg.ts`, `codeberg.test.ts`

Add the discriminated union return type to both refresh functions. Parse HTTP status and response body to distinguish revoked from transient.

**Details:** [phase-1.md](2026-03-22-bitbucket-token-resilience-phases/phase-1.md)

### Phase 2: Update client.ts callers to handle new result type

**Files:** `client.ts`, `client.test.ts`

Update `_fetchBitbucketIfLinked` and `_fetchCodebergIfLinked` to only unlink on `reason: "revoked"`, skip stats silently on `reason: "transient"`.

**Details:** [phase-2.md](2026-03-22-bitbucket-token-resilience-phases/phase-2.md)

## Verification

```bash
pnpm run test -- --run apps/web/lib/auth/bitbucket.test.ts
pnpm run test -- --run apps/web/lib/auth/codeberg.test.ts
pnpm run test -- --run apps/web/lib/github/client.test.ts
pnpm run typecheck
pnpm run lint
```

## Risk assessment

- **Low risk:** Changes are internal to the token refresh pipeline. No API contract changes. No UI changes.
- **Backward compatible:** The only behavioral change is "stop deleting links on transient failures." Users who were affected will simply find their Bitbucket stays connected.
- **Conservative default:** Unknown errors default to "transient" (keep link) rather than "revoked" (delete link). Worst case: a truly revoked token persists until the next refresh attempt confirms revocation.
