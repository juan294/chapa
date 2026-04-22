# Phase 6 — Auth details

**Source findings:** B5, B6, B18
**Depends on:** none
**Batch:** [batch-eligible]

## Goal

Three small auth hardenings: OAuth state server-side consume (prevent replay within cookie TTL), bearer-token `.trim()` per project-wide env-var rule, and a boot-time length assertion on `NEXTAUTH_SECRET`.

## Files touched

- `apps/web/lib/auth/resolve-request-auth.ts`
- `apps/web/app/api/auth/callback/route.ts`
- `apps/web/lib/auth/session.ts`
- `apps/web/lib/auth/oauth-state.ts` (NEW — server-side nonce store)
- Tests: `resolve-request-auth.test.ts`, `callback/route.test.ts`, `session.test.ts`, `oauth-state.test.ts`

## TDD — Red tests first

```ts
// resolve-request-auth.test.ts
describe("bearer token trim (B6)", () => {
  it("trims whitespace/newlines from Authorization header", async () => {
    const req = mockReqWithHeader("Authorization", "Bearer \tabc123\n ");
    const spy = vi.spyOn(cli, "verifyCliToken");
    await resolveRequestAuth(req);
    expect(spy).toHaveBeenCalledWith("abc123", expect.any(String));
  });
});

// callback/route.test.ts
describe("GET /api/auth/callback — OAuth state replay (B5)", () => {
  it("consumes the state value server-side (SETNX+DEL pattern)", async () => {
    const state = "state-abc";
    // First callback: success
    const r1 = await GET(mockReq({state, code: "ok"}));
    expect(r1.status).toBe(302);
    // Second callback with same state: rejected
    const r2 = await GET(mockReq({state, code: "ok"}));
    expect(r2.status).toBe(400);
  });
});

// session.test.ts / oauth-state.test.ts
describe("getSessionKey — NEXTAUTH_SECRET length assert (B18)", () => {
  it("throws at boot when NEXTAUTH_SECRET length < 32", () => {
    process.env.NEXTAUTH_SECRET = "short";
    expect(() => getSessionKey()).toThrow(/at least 32 chars/);
  });
});

describe("oauth-state store", () => {
  it("consume() returns true on first call, false on subsequent", async () => {
    await issueOauthState("s1");
    expect(await consumeOauthState("s1")).toBe(true);
    expect(await consumeOauthState("s1")).toBe(false);
  });
  it("expires after 10 minutes", async () => {
    await issueOauthState("s2");
    vi.advanceTimersByTime(11 * 60 * 1000);
    expect(await consumeOauthState("s2")).toBe(false);
  });
});
```

## Green — implementation pseudocode

```ts
// lib/auth/oauth-state.ts (NEW)
const TTL_SECONDS = 600;
export async function issueOauthState(state: string): Promise<void> {
  await cacheSet(`oauth-state:${state}`, "1", TTL_SECONDS);
}
// SETNX+GETDEL pattern — atomic consume
export async function consumeOauthState(state: string): Promise<boolean> {
  const existed = await cacheGetDel(`oauth-state:${state}`);  // returns prior value, deletes key
  return existed === "1";
}
```

```ts
// callback/route.ts — wire consumeOauthState into the existing flow
const stateCookie = cookies().get("oauth_state")?.value;
if (!stateCookie || stateCookie !== state) return badRequest();
const consumed = await consumeOauthState(state);
if (!consumed) return NextResponse.json({error: "state_already_used"}, {status: 400});
// ... existing exchange-code flow ...
```

```ts
// login/route.ts — on state issuance
const state = randomUUID();
await issueOauthState(state);
cookies().set("oauth_state", state, { httpOnly: true, maxAge: 600, secure: isProd });
```

```ts
// resolve-request-auth.ts — trim bearer
if (authHeader?.startsWith("Bearer ")) {
  const token = authHeader.slice(7).trim();   // was: .slice(7)
  return resolveHandle(token, secret);
}
```

```ts
// session.ts — boot-time assert
export function getSessionKey(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("NEXTAUTH_SECRET must be set and at least 32 chars");
  }
  return Buffer.from(secret, "utf8");
}
```

## Automated success criteria

- All new tests green.
- Existing OAuth tests remain green (the callback tests must now issue state via the new `issueOauthState` helper — tests updated in this phase).
- `pnpm run typecheck` clean.

## Manual success criteria

- Fresh login from `/` works end-to-end in a preview deploy.
- Manually re-submit a recently-used OAuth callback URL (copy from network tab, replay) → 400 `state_already_used`.
- Set `NEXTAUTH_SECRET=short` locally → app refuses to start with the new error.
- CLI token with trailing newline (common copy-paste hazard) now authenticates.

## Notes

- `cacheGetDel` is a single Upstash Redis round-trip (`GETDEL`). If the project uses an older Upstash SDK without `GETDEL`, fall back to a MULTI `GET` + `DEL` pipeline — note in the implementation PR which path was taken.
- The `NEXTAUTH_SECRET` length choice (32) matches industry norm for HS256/HMAC keys.
