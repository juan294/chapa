# ADR: Refresh claim recovery — release non-ambiguous outcomes, bound the ambiguous case (#1332)

**Date:** 2026-09-23
**Status:** Accepted
**Supersedes (narrowly):** the "No timeout takeover exists" statement in
`supabase/migrations/046_platform_token_refresh_attempts.sql`.

## Context

`supabase/migrations/046_platform_token_refresh_attempts.sql` introduced a
durable per-link claim barrier around a linked-source (Bitbucket, GitLab,
Codeberg) token refresh: `claimPlatformTokenRefresh` inserts a row before the
provider request, and only `finishPlatformTokenRefresh` (on success) or an
explicit disconnect/reconnect (`platform_token_refresh_release`, clearing
*superseded* attempts only) could ever remove it. 046 documented this as
deliberate: "No timeout takeover exists," because a rotating refresh token
consumed by a lost request cannot be safely retried blind.

That reasoning is correct for what it covers — a genuinely ambiguous outcome
(no HTTP response was ever observed). It turned out to also cover two cases
that are not ambiguous at all
(`apps/web/lib/platform/source-refresh.ts:refreshSourceLink`):

1. The post-claim consent/linkage recheck fails **before** any provider
   request is sent.
2. The provider returns a definitive HTTP response with no new tokens (a
   non-`invalid_grant` error, or an ok response with no `access_token`).

Both are fully known outcomes with nothing left "in flight," yet the old code
mapped every non-success path to the same permanent `unavailable`/barrier-kept
result. Production evidence: `juan294`'s Bitbucket link reached an ambiguous
claim once, and from then on every refresh attempt returned `busy` forever —
the connection, and the whole profile's live scoring, stayed degraded until a
manual disconnect/reconnect
(`docs/logs/2026-09-22-badge-load-error-linked-source-refresh.md`). The
service role had (and still has) no grant to touch
`platform_token_refresh_attempts` outside the existing RPCs, so no code path
could recover it.

## Decision

1. **Split "failure" into `definitive` and `ambiguous` at the provider-client
   layer.** `TokenRefreshResult<T>` in `apps/web/lib/auth/{bitbucket,gitlab,
   codeberg}.ts` now distinguishes `{ ok: false, outcome: "definitive", reason:
   "revoked" | "transient" }` (an HTTP response was received) from
   `{ ok: false, outcome: "ambiguous" }` (the `fetch()` call itself failed —
   network error, abort, timeout). Only the `fetch()` call is ambiguous on
   failure; once any response exists, the outcome is always definitive, even
   if its body could not be parsed.

2. **Release a definitive outcome in the same call.** Migration
   `053_platform_token_refresh_claim_recovery.sql` adds
   `platform_token_refresh_release_attempt`, a SECURITY DEFINER RPC that
   deletes the exact attempt the caller just claimed (or took over) and,
   optionally in the same statement, sets a new `user_platforms.needs_reconnect`
   boolean. `refreshSourceLink` calls it for: no request sent, a definitive
   response without tokens, and — for consistency — a linkage change observed
   after a request that we know completed (success or definitive failure).
   `needs_reconnect` is only set for a definitive `revoked` outcome; an
   ordinary definitive transient failure (e.g. a 5xx with a body) just frees
   the barrier so the next call retries normally.

3. **Allow exactly one bounded takeover of a genuinely ambiguous attempt.**
   The same migration adds `platform_token_refresh_takeover`. It is called
   only after an ordinary claim comes back `busy`, and it is safe to call
   unconditionally at that point: it re-checks staleness itself, under the
   same row lock it mutates under (same subject → link → attempt lock order
   as `platform_token_refresh_claim`), so it is a no-op whenever a takeover
   isn't warranted yet. It requires the existing attempt to be older than
   `REFRESH_CLAIM_TAKEOVER_THRESHOLD_SECONDS`
   (`apps/web/lib/db/platform-token-refresh.ts`) — see "Threshold" below —
   and it records `takeover_used = true` on the row it takes over (a new
   column on `platform_token_refresh_attempts`), so a second ambiguous
   outcome on the SAME row can never be taken over again. If that retried
   request is itself ambiguous, `markPlatformNeedsReconnect` sets
   `needs_reconnect` directly (a plain, version-guarded table write, not
   another RPC — it changes no consent-gated capability) **without**
   releasing the barrier, since the outcome genuinely remains unknown and no
   further automatic recovery is possible. If the retried request gets a
   definitive revoke, it releases via `platform_token_refresh_release_attempt`
   exactly like a first-attempt revoke would.

4. **Surface `needs_reconnect` to the owner — on `/settings` and on the
   owner's own share page, never in `UserMenu`.** `dbGetLinkedPlatforms` and
   `createStatusHandler` (`/api/auth/{provider}/status`) report
   `needsReconnect: boolean` per connection — never an attempt id or token
   material. `/settings` shows a reconnect prompt and CTA (reusing the
   existing `/api/auth/:platform/connect` OAuth flow — no new write endpoint)
   alongside the existing unlink control. An earlier revision of this change
   also added a `usePlatformConnections()` call and a small indicator to
   `UserMenu`; that was reverted after review, because #1238 deliberately
   removed per-page connection-status fetches from that menu (up to 3
   `fetch()` calls to `/api/auth/*/status` on every authenticated page load),
   and reintroducing even a read-only one regresses that decision. Instead,
   `/u/[handle]/page.tsx` reads `dbGetLinkedPlatforms(handle)` directly —
   server-side, gated strictly to `isOwner`, so it is a single indexed
   `user_platforms` SELECT that never runs for a visitor and adds no new
   client request — and threads a filtered `reconnectNeeded` list down to
   `SharePageOwnerContent`, which renders the same reconnect CTAs `/settings`
   uses (`userMenu.reconnectBitbucket`/`Codeberg`/`Gitlab`) and gates its own
   render on `isOwner` again as defense in depth. This was deliberately NOT
   threaded through `StatsData`/the scoring composition pipeline
   (`getStats`/`_compose` in `apps/web/lib/github/client.ts`) even though that
   pipeline already computes something adjacent (`linkedPlatforms`,
   `linkedPlatformLogins`) — that pipeline carries its own cache-binding and
   scoring-integrity invariants (see CLAUDE.md's "stats cache" section) that a
   cosmetic UI flag has no reason to touch, and reaching into it would have
   been a much larger, riskier change than a second small owner-gated read. A
   fresh OAuth grant (`dbUpsertLinkedPlatform`'s upsert) always clears
   `needs_reconnect`, so a successful reconnect resolves the prompt on both
   surfaces.

5. **046 and 048 are unmodified.** This migration adds new functions and new
   columns only; the historical claim/finish/release behavior described there
   is untouched. Their "No timeout takeover exists" comment is now narrowly
   corrected by this ADR and by 053's own comments — future readers land here.

6. **Every durable write this change adds is observable, not just
   error-swallowed.** `releasePlatformTokenRefreshAttempt`,
   `takeoverPlatformTokenRefresh` and `markPlatformNeedsReconnect`
   (`apps/web/lib/db/platform-token-refresh.ts`) each call `captureServerError`
   on every failure path — no Supabase client, an RPC/update `{ error }`
   result, a malformed reply, or a thrown exception — before returning or
   rethrowing. This matters specifically because `refreshSourceLink` wraps
   its entire body in one top-level `try { } catch { return { status:
   "unavailable" }; }`: without an explicit capture inside these functions, a
   broken release or takeover path (e.g. a bad grant on the new RPCs) would
   have been entirely silent, which is exactly the observability gap
   CLAUDE.md's "a durable write that fails but reports success is always a
   bug" rule exists to close. `markPlatformNeedsReconnect` additionally
   treats a zero-row version-guard match (the link changed concurrently) as
   observable rather than a quiet no-op, since the owner never got the flag
   that call intended to set.

## Threshold

`REFRESH_CLAIM_TAKEOVER_THRESHOLD_SECONDS = 360` (300 + 60), derived from:

- **300s** — the largest function duration any route that can reach
  `refreshSourceLink` (via `getStats` → the platform source-collection path)
  can actually run for. `apps/web/vercel.json`'s `functions` block declares
  `maxDuration: 300` for `warm-cache`, `sync-audience` and `process-campaigns`;
  `app/api/admin/bulk-recalculate/route.ts` also declares
  `export const maxDuration = 300`. The badge route itself declares only 35s
  (`app/u/[handle]/badge.svg/route.ts`), so it is not the binding constraint.
  **Verified, not just inferred, for the remaining reachable routes with no
  explicit `maxDuration`** (`/api/refresh`, `/api/generate`,
  `/api/recalculate`, `/studio`, `/u/[handle]` SSR): a read-only query against
  the live Vercel project on 2026-09-23 —

  ```
  vercel api "/v9/projects/prj_hht2ez82Ucm4wAiKlGmBj4WOi2bV?teamId=team_eJRc3uJPBTvXknc9WbVr4nlh"
  -> defaultResourceConfig.functionDefaultTimeout: 300
  -> resourceConfig.fluid: true                          (Fluid Compute active)
  vercel api /v2/teams
  -> billing.plan: "pro"
  ```

  confirms the project's own configured default for a route with no explicit
  `maxDuration` is the SAME 300s, not the higher ceiling Fluid Compute on Pro
  would *allow* configuring (up to 800s) — that ceiling was never actually
  set. So every route that can reach the claim, labeled or not, shares one
  300s ceiling today. Once a function's timeout has elapsed, the platform has
  torn it down — nothing it started can still be "in flight" from the
  platform's point of view, so a response for the original provider request
  can no longer arrive through that process. Re-verify this figure (same
  `vercel api` query, read-only) if the project's default timeout, its Fluid
  Compute setting, or any reachable route's explicit `maxDuration` ever
  changes.
- **+60s margin** — absorbs clock skew between Postgres's own
  `clock_timestamp()` (used for both `started_at` and the staleness
  comparison — the comparison never depends on the calling process's clock)
  and the platform's kill, plus outbound TCP/TLS teardown time after the
  function is torn down.

The fetch layer's own `AbortSignal.timeout(FETCH_TIMEOUT_MS)` (10s in each
provider client) governs how long a *single* provider fetch waits before
rejecting as ambiguous; it does not bound how long the claiming *function*
might still be running afterward doing other work, which is what the takeover
threshold has to bound instead.

## Why this is safe

- **The worst case is unchanged.** If the ambiguous provider request is still
  genuinely in flight when a takeover fires (i.e., the threshold is somehow
  wrong), the takeover's own request either succeeds, gets a definitive
  failure, or is itself ambiguous. Only the last of those leaves anything
  outstanding, and it converges immediately to `needs_reconnect` — the same
  "please reconnect" outcome the connection was already stuck in before this
  change, just reached one round sooner and now visibly, instead of silently
  forever.
- **No stacked risk.** A rotating refresh token can be consumed at most
  twice by this design (the original claim's request, and the one takeover
  retry) before the barrier permanently requires a human reconnect — never an
  unbounded retry loop.
- **Atomicity holds under concurrency.** The takeover's staleness check and
  its mutation happen under the same `SELECT ... FOR UPDATE` row lock,
  established after the same subject → link lock order the claim RPC uses.
  A concurrent retry that makes the row fresh again (successfully finishes,
  or is independently claimed after a version change) is serialized before or
  after this transaction, never interleaved with it — the takeover can only
  ever see the row it locked, so it can never take over anything fresher than
  what it observed.

## Rejected alternatives

| Alternative | Reason rejected |
|---|---|
| Delete the claim on any timeout, no bound on retries | Original 046 reasoning: a rotating refresh token may already be consumed; retrying an unknown outcome without limit risks repeatedly corrupting the grant, and never converges to an owner-visible state if the provider is persistently unreachable. |
| Treat the post-claim/pending-request `!res.ok` as ambiguous too | Contradicts the acceptance criteria's own framing and the provider clients' existing behavior: an HTTP response is direct proof of the provider's decision. Treating a known "no" as unknown would leave a barrier in place for a definitively resolved question. |
| Expose attempt ids/ages to the client instead of returning `busy`/`claimed` from a single atomic takeover RPC | Multi-round-trip check-then-act from application code is exactly the race the SQL-level `FOR UPDATE` locking exists to prevent, and it would leak internal claim state (attempt ids) further than necessary — the acceptance criteria explicitly asks for the owner-facing surface to expose neither. |
| A second, unlimited takeover chain | Directly reintroduces the corrupted-grant risk 046 was written to prevent; `takeover_used` bounding it to exactly one retry is the whole point of "narrowly" reversing 046's decision. |
