# Phase 3 — Normalize refresh/supplemental cache invalidation `[batch-eligible]`

> Files: `apps/web/app/api/refresh/route.ts`, `apps/web/app/api/supplemental/route.ts`,
> and their `.test.ts` siblings.
> No file overlap with phases 1, 2, 4.

## 1. Why

Two write endpoints invalidate the same read models by different means, with no
recorded reason (research §7, open question 3):

| | `/api/refresh` | `/api/supplemental` |
|---|---|---|
| composed stats key | `cacheDel` inline (`refresh/route.ts:60`) | via `invalidateProfileReadModels({stats: true})` (`supplemental/route.ts:120-125`) |
| badgeSvg / snapshot / history | via `invalidateProfileReadModels` (`refresh/route.ts:103-107`, no `stats` flag) | same call |
| ordering | delete stats → fetch → persist → invalidate rest | write → invalidate all → mark dirty |

The inline `cacheDel` duplicates a key literal that `post-write-invalidation.ts:29-31`
already owns. `refresh/route.ts:58-59` carries a comment warning that the literal must
be kept in sync with `client.ts` by hand — the exact drift risk phase 1's key rename
would otherwise trigger.

## 2. Changes

**2.1** — In `/api/refresh`, replace the inline `cacheDel` at `route.ts:60` with
`invalidateProfileReadModels(handle, { stats: true })`, keeping it in the same
position (before the fetch, so `getStats` misses and refetches). Delete the
now-obsolete sync-warning comment at `:58-59`.

**2.2** — Leave the post-persist `invalidateProfileReadModels(handle, { badgeSvg,
snapshot, history })` call at `route.ts:103-107` as-is. Two calls at different points
is correct here: the pre-fetch one forces a refetch, the post-persist one clears
artifacts derived from the newly written snapshot. Add a one-line comment at each
stating which of the two roles it serves, so the split reads as deliberate.

**2.3** — No change to `/api/supplemental`'s flags. Add a comment at
`supplemental/route.ts:120` noting that `stats: true` is what forces the next
`getStats` to recompose with the new record, so the flag is not dropped by a future
edit.

**2.4** — Confirm no behavioural change to key naming: after phase 1, `stats: true`
resolves to `stats:v2:merged:<handle>` only. Neither endpoint should invalidate
`stats:stale:v2:` — that is the protected baseline, and deleting it would discard the
scope protection that #1050 established.

## 3. Tests

In `apps/web/app/api/refresh/route.test.ts`:
- asserts on the inline `cacheDel` call must move to asserting
  `invalidateProfileReadModels` was called with `{ stats: true }` before the
  materialize call. Verify ordering with `mock.invocationCallOrder`.
- new: the refresh path never deletes `stats:stale:v2:<handle>` — assert `cacheDel` is
  not called with that key across the whole handler.

In `apps/web/app/api/supplemental/route.test.ts`:
- new: the supplemental path never deletes `stats:stale:v2:<handle>`.
- existing invalidation-flag assertions unchanged.

## 4. Success criteria

**Automated**
- `pnpm run test -- refresh supplemental` green.
- `pnpm run typecheck`, `pnpm run lint` clean.
- `pnpm run check:write-registration` still passes (neither endpoint's registration
  changes).
- Grep check: no `stats:v2:merged` string literal remains outside
  `apps/web/lib/github/client.ts`, `apps/web/lib/profile/post-write-invalidation.ts`,
  `apps/web/lib/auth/platform-oauth.ts` and `scripts/heal-poisoned-stats.ts`.

**Manual**
- None. Fully covered by automated assertions.
