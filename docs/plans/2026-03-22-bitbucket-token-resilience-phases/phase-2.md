# Phase 2: Update client.ts callers to handle new result type

## Scope

Update `_fetchBitbucketIfLinked` and `_fetchCodebergIfLinked` in `client.ts` to use the new `TokenRefreshResult` discriminated union. Only unlink on confirmed revocation, not transient failures.

## Changes

### 1. `apps/web/lib/github/client.ts`

**Update `_fetchBitbucketIfLinked`** (lines 194-219):

```typescript
// Current (aggressive):
const refreshed = await refreshBitbucketToken(refreshToken, clientId, clientSecret);
if (!refreshed) {
  void dbDeleteLinkedPlatform(handle, "bitbucket");
  return null;
}

// New (resilient):
const result = await refreshBitbucketToken(refreshToken, clientId, clientSecret);
if (!result.ok) {
  if (result.reason === "revoked") {
    void dbDeleteLinkedPlatform(handle, "bitbucket");
  }
  // Transient: keep the link, skip stats this time
  return null;
}
accessToken = result.tokens.access_token;
void dbUpdatePlatformTokens(
  handle,
  "bitbucket",
  result.tokens.access_token,
  result.tokens.refresh_token,
  new Date(Date.now() + result.tokens.expires_in * 1000),
);
```

**Update `_fetchCodebergIfLinked`** (lines 267-289):

Same pattern — replace `if (!refreshed)` with discriminated union check.

### 2. `apps/web/lib/github/client.test.ts`

**Update existing test** "unlinks platform when refresh fails (token revoked)":
- Update mock: `mockRefreshBitbucketToken.mockResolvedValue({ ok: false, reason: "revoked" })`
- Keep assertion: `expect(mockDbDeleteLinkedPlatform).toHaveBeenCalledWith("test-user", "bitbucket")`

**Update existing test** "refreshes expired token before fetching":
- Update mock: `mockRefreshBitbucketToken.mockResolvedValue({ ok: true, tokens: { ... } })`

**Add new test** "keeps link on transient refresh failure":
- Mock: `mockRefreshBitbucketToken.mockResolvedValue({ ok: false, reason: "transient" })`
- Assert: `expect(mockDbDeleteLinkedPlatform).not.toHaveBeenCalled()`
- Assert: result is GitHub-only stats (Bitbucket stats skipped)

**Mirror for Codeberg** if Codeberg tests exist in client.test.ts:
- Same pattern: transient keeps link, revoked unlinks.

## Success criteria (automated)

```bash
pnpm run test -- --run apps/web/lib/github/client.test.ts  # All pass
pnpm run typecheck                                          # No errors
pnpm run lint                                               # No errors
pnpm run test                                               # Full suite green
```
