# Phase 2 — The Studio save awaits the invalidation, reports it, and the copy says so

Parent plan: `../2026-09-01-studio-save-badge-hotfix.md`. Depends on phase 1 (`BadgeInvalidationResult`). Not batch-eligible.

## Goal

A `/save` response is only sent once both cache layers are cleared, the client learns whether that worked, the success line stops claiming the badge is unchanged, and an E2E test proves the SVG changes after a save.

## Files

| file | change |
|---|---|
| `apps/web/app/api/studio/config/route.ts` | await the invalidation; return `badgeRefreshed` |
| `apps/web/app/api/studio/config/route.test.ts` | mock + assert ordering and payload |
| `apps/web/app/api/studio/config/route.contract.test.ts` | accept the new field if it asserts exact shape |
| `apps/web/lib/i18n/dictionaries/en.ts`, `es.ts` | reword `studio.save.success`; add `studio.save.successDeferred` |
| `apps/web/app/studio/StudioClient.tsx` | pick the line from `badgeRefreshed` |
| `apps/web/app/studio/StudioClient.render.test.tsx` | update `:1187`, `:1217`; add the deferred case |
| `apps/web/e2e/journey.spec.ts` | fetch the badge **after** the save and assert config markers |
| `docs/user-manual.md` | `:274`, `:679` |

## Steps

### 2.1 `app/api/studio/config/route.ts`

Replace `:147-156` with:

```ts
// #1191 / hotfix v2.29.2 — the badge cache key carries handle/variant/date/
// locale but nothing about the config, so a save has to clear the rendered
// badge explicitly, in BOTH layers (Redis at the origin, the Vercel edge by
// tag). Awaited, like every sibling write path: launched with fireAndForget
// it ran after the response, which on Vercel means "maybe". The save itself
// is never failed over it — the client is told instead.
let badgeRefreshed = false;
try {
  const invalidation = await invalidateBadgeSvgCacheForHandle(normalizedLogin, toDateString(new Date()));
  badgeRefreshed = invalidation.redis && invalidation.edge !== "failed";
} catch (error) {
  console.error("[studio] badge invalidation threw:", error);
}
return NextResponse.json({ success: true, badgeRefreshed });
```

Remove the `fireAndForget` import if nothing else in the file uses it. `edge === "skipped"` (local/CI) counts as refreshed: there is no edge there.

Tests (`route.test.ts`). Add `vi.mock("@/lib/render/badge-svg-cache", () => ({ invalidateBadgeSvgCacheForHandle: mockInvalidate }))` beside the existing mocks (`:26-51`). Assertions on the successful PUT path:
- called once with `(login.toLowerCase(), toDateString(new Date()))` — use `vi.useFakeTimers` / a fixed system time so the date is deterministic;
- **ordering**: give the mock a deferred promise; `await` the route call with a microtask flush and assert it has not resolved; resolve the deferred; assert the response arrives. Also assert `dbUpsertStudioConfig` was called before the invalidation (mock call order);
- `{ redis: true, edge: "purged" }` ⇒ body `{ success: true, badgeRefreshed: true }`; `edge: "skipped"` ⇒ `true`; `edge: "failed"` ⇒ `false`; `redis: false` ⇒ `false`;
- mock rejects ⇒ status 200, `badgeRefreshed: false`;
- a 400/429/503 path never calls the invalidation.

`route.contract.test.ts` and `pnpm run check:write-registration`: if either asserts the exact success body, extend it with `badgeRefreshed: expect.any(Boolean)`.

### 2.2 Dictionaries

`en.ts:1122` →
```
success: 'Configuration saved. Your public badge and share page now show it.',
successDeferred: 'Configuration saved. Your public badge may take a few hours to update.',
```
`es.ts:1111` →
```
success: 'Configuración guardada. Tu Chapa pública y tu página compartida ya la muestran.',
successDeferred: 'Configuración guardada. Tu Chapa pública puede tardar unas horas en actualizarse.',
```
`dictionaries/parity.test.ts` enforces the key parity.

### 2.3 `app/studio/StudioClient.tsx` (`handleSave`, `:371-395`)

```ts
if (res.ok) {
  const payload = await res.json().catch(() => ({}));
  const badgeRefreshed = payload?.badgeRefreshed !== false;   // absent → true (older server)
  ...
  const key = hasNewerChanges ? "studio.save.changedDuringSave"
            : badgeRefreshed   ? "studio.save.success"
            :                    "studio.save.successDeferred";
  const tone = hasNewerChanges || !badgeRefreshed ? "warning" : "success";
  setLines(prev => [...prev, makeLine(tone, translation(t, key))]);
}
```

`saveState` stays `"saved"` in the deferred case — the config *is* saved.

Tests (`StudioClient.render.test.tsx`): update the two literals at `:1187` and `:1217` to the new success text; the existing tests resolve `new Response("{}", { status: 200 })`, which has no field and therefore reads as refreshed. Add one test resolving `{"success":true,"badgeRefreshed":false}` and asserting the deferred line renders with the warning tone (the same `makeLine` type the `changedDuringSave` test checks).

### 2.4 `e2e/journey.spec.ts`

The fixture (`:37-44`) saves `background: "aurora"`, `cardStyle: "frost"`, `scoreEffect: "chrome"`. Those emit, respectively, `id="badge-bg-aurora"`, `id="badge-card-sheen"`, `id="badge-score-paint"` (`lib/render/badge-effects.ts:97,281,153`). Extend the loop:

- Before the save (`:92-97`, existing fetch): additionally `expect(svg).not.toContain('id="badge-bg-aurora"')` and the same for the other two — the seeded shapes have no Studio config.
- After `saveResult.status === 200` (`:100-101`): 
  ```ts
  const after = await page.request.get(`/u/${shape.handle}/badge.svg?after-save=${Date.now()}`);
  expect(after.status()).toBe(200);
  const afterSvg = await after.text();
  for (const id of ["badge-bg-aurora", "badge-card-sheen", "badge-score-paint"]) {
    expect(afterSvg).toContain(`id="${id}"`);
  }
  ```
  The query string keeps any local proxy cache out of the way; the origin path is what is under test.

Run it with local Supabase: `supabase start` then `pnpm run test:e2e -- --grep "full impact journey"` (the spec skips itself without the service-role env, `:46`).

### 2.5 `docs/user-manual.md`

- `:274` → "Persists your badge configuration server-side and refreshes your public SVG badge and share page. The saved configuration is restored when you return to Creator Studio."
- `:679` → `- [ ] Type \`/save\` — see "Saving..." then "Configuration saved. Your public badge and share page now show it."`

## Verification

```
pnpm run test
pnpm run typecheck
pnpm run lint
pnpm run check:write-registration
pnpm run test:e2e -- --grep "full impact journey"     # local Supabase running
```

Then, on the branch's preview deployment — this is the check that proves the whole chain:

1. Sign in, open `/studio`, change the palette (or any category), `/save`. The log line must read the new success text, not the deferred one.
2. `curl -sI https://<preview>/u/<your handle>/badge.svg` → `x-vercel-cache: MISS`; `curl -s … | grep -c '9BAAFF'` (or the marker of the option you chose) > 0.
3. Repeat the `curl -sI` → `HIT`, same body.
4. Change again, save again, repeat 2–3.

If step 2 shows `HIT` with the old body, or the log line is the deferred one, `dangerouslyDeleteByTag` did not purge from inside the function. Fall back per the plan's risk register: `POST https://api.vercel.com/v1/edge-cache/dangerously-delete-by-tags?projectIdOrName=chapa&teamId=<team>` with `{ "tags": [tag], "target": "production" }`, bearer `VERCEL_API_TOKEN` read through `lib/env.ts`, in `purgeEdgeCacheTag`.

## Done when

- All automated checks green, journey spec green.
- Preview steps 1–4 pass twice in a row.
- Commit message: `fix(studio): a save now waits for the badge to be invalidated and says what happened`, `Refs #1191` plus the incident issue.
