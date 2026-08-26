# Phase 1 — Config persistence hardening

Fixes research §5.1 (initial load bypasses Supabase) and §5.2 (blunt-500 on
PUT). Same files, one phase.

## 1A. Shared load helper — Redis → Supabase → null

New export in `apps/web/lib/db/studio.ts` (colocated with the DB layer it
wraps; the Redis dep is imported, mirroring how `route.ts` mixes them today):

```
// lib/db/studio.ts
+ import { cacheGet, cacheSet } from "../cache/redis";
+ export const STUDIO_CONFIG_TTL = 31536000;           // moves from route.ts:14
+ export async function loadStudioConfig(login: string): Promise<unknown | null> {
+   const cacheKey = `config:${login}`;
+   const cached = await cacheGet<unknown>(cacheKey);
+   if (cached !== null) return cached;
+   const dbConfig = await dbGetStudioConfig(login);
+   if (dbConfig !== null) {
+     cacheSet(cacheKey, dbConfig, STUDIO_CONFIG_TTL).catch(warn-best-effort); // route.ts:48-50 semantics
+     return dbConfig;
+   }
+   return null;
+ }
```

Consumers:

```
// app/studio/page.tsx:81-84
- const [stats, savedConfig] = await Promise.all([
-   getStats(session.login, token),
-   cacheGet<BadgeConfig>(`config:${session.login}`),
- ]);
+ const [stats, savedConfig] = await Promise.all([
+   getStats(session.login, token),
+   loadStudioConfig(session.login) as Promise<BadgeConfig | null>,
+ ]);
  (drop the now-unused cacheGet import)

// app/api/studio/config/route.ts GET :38-54 — replace the inline
// Redis→Supabase→rehydrate block with `const config = await
// loadStudioConfig(session.login); return NextResponse.json({ config });`
```

RED first (extend `apps/web/app/studio/page.render.test.tsx`): mock Redis
miss + `dbGetStudioConfig` returning a saved config → assert `StudioClient`
receives it as `initialConfig` (today it receives `DEFAULT_BADGE_CONFIG` —
that's the bug). Keep/port the equivalent GET-route tests in
`route.test.ts` onto the helper path; add unit tests for `loadStudioConfig`
in `lib/db/studio.test.ts` (hit, miss→db-hit(+rehydrate fire-and-forget),
miss→miss, rehydrate-failure-swallowed).

## 1B. PUT seam — discriminate DB failures (playbook :322-327, inline, no
shared classifier)

```
// lib/db/studio.ts — dbUpsertStudioConfig return type changes
- Promise<boolean>
+ Promise<{ ok: true } | { ok: false; reason: "unavailable" | "constraint" | "error"; code?: string }>
  · getSupabase() null            → { ok:false, reason:"unavailable" }
  · error.code === "23505"        → { ok:true }        // idempotent duplicate
  · code in 23502|22P02|22003     → { ok:false, reason:"constraint", code }
  · anything else                 → { ok:false, reason:"error", code? }

// route.ts PUT :96-108
  const [, dbResult] = await Promise.all([...cacheSet best-effort..., dbUpsertStudioConfig(...)]);
- if (!dbOk) → flat 500
+ if (!dbResult.ok) {
+   reason "constraint"  → 400 { success:false, error:"Invalid badge config" }
+   reason "unavailable" → 503 { success:false, error:"Storage temporarily unavailable" }, Retry-After: 30
+   reason "error"       → 500 (current message)
+ }
```

Note: `onConflict: "handle"` upsert makes 23505 unexpected here — the
23505→ok arm is the playbook's idempotency contract, cheap to honor.

RED first: extend `lib/db/studio.test.ts` with per-code cases; extend
`route.test.ts` asserting 400/503/500 mapping (and that 503 carries
Retry-After). Check `route.contract.test.ts` + the write-registration gate
(`pnpm run check:write-registration`, --max-unregistered=0) still pass —
the success path's `{ success: true }` shape is unchanged.

## Verification
Automated: full `typecheck`/`lint`/`test` + `pnpm run test:coverage` +
`pnpm run check:write-registration` + `pnpm run test:contract:local` (needs
`supabase start` once; the script fails loudly if the local stack is down and
never falls back to hosted credentials). No manual steps.
