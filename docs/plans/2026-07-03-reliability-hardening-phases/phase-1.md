# Phase 1 — Real-DB CI foundation + payload-matrix harness (POC on 2 routes)

**Depends on:** nothing (foundational). **Batch:** no.
**Goal:** stand up a real Supabase stack + Redis fake in CI, build the reusable
payload-matrix harness, and prove it on two routes — one `graceful`
(`/api/insights`, fixing bug A) and one `loud` (`/api/supplemental`, exercising the
persistence re-read red→green).

Definition of done: hundreds of payloads fired at two real handlers against a real
DB in CI, zero 5xx, insights persist-failure now observable, supplemental
persistence asserted, harness reusable.

---

## 1.1 Stand up the Supabase local stack in CI

**New file `.github/workflows/ci.yml` job `contract`** (add alongside existing jobs;
`needs:` only its own checkout/install — NOT `test`, so a unit failure can't skip it):

```yaml
contract:
  name: Contract (real DB)
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v6
    - uses: pnpm/action-setup@v5
    - uses: actions/setup-node@v6 { node-version: 20, cache: pnpm }
    - run: pnpm install --frozen-lockfile
    - uses: supabase/setup-cli@v1 { version: latest }
    - run: supabase start                      # boots Postgres + PostgREST + GoTrue
    - run: supabase db reset                    # applies supabase/migrations/*.sql
    - name: Contract tests
      run: pnpm run test:contract
      env:
        # EXACT vars the routes read — parity is the #1 trap (playbook §8)
        SUPABASE_URL: http://127.0.0.1:54321
        SUPABASE_SERVICE_ROLE_KEY: <from `supabase status -o env`>
        CHAPA_VERIFICATION_SECRET: test-verification-secret
        CRON_SECRET: test-cron-secret
        ADMIN_SECRET: test-admin-secret
        # UPSTASH_* intentionally UNSET — the Redis fake replaces it
```

- Resolve the service-role key + URL from `supabase status -o env` in a prior step
  and pass via `$GITHUB_ENV` (don't hardcode).
- Verify `supabase/migrations/` is the real migration source the CLI applies (the
  repo has 27 migration files per the investigation; `validate:migrations` already
  guards them).

**Manual check:** `supabase start && supabase db reset` locally applies all
migrations without error.

## 1.2 Separate contract Vitest project

**New `vitest.config.contract.ts`:**

```
include: ["apps/web/**/*.contract.test.ts"]
setupFiles: ["./vitest.contract-setup.ts"]
testTimeout: 30000
coverage: disabled          # branches here must not perturb the global ratchet
resolve.alias: same as vitest.config.ts (@/, @chapa/shared) — but NOT the
  server-only stub if the real client needs it; reuse the existing stub.
```

**New `vitest.contract-setup.ts`:**

```
- assert required env present (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ...) →
  throw loudly if missing (env-parity guard).
- beforeAll: _resetClient() from lib/db/supabase to pick up test env.
- mock next/server after() → run callback inline & awaited (pattern from
  insights/route.test.ts:77-83).
- install the Redis fake (§1.3) via vi.mock("@/lib/cache/redis", ...).
- mock external network only: GitHub API (lib/github/*), Resend, PostHog.
```

**`package.json`:** add `"test:contract": "vitest run -c vitest.config.contract.ts"`.

**`knip` ignore:** add `apps/web/test/contract/**` and `*.contract.test.ts`.

## 1.3 In-memory Redis fake

**New `apps/web/test/contract/redis-fake.ts`** — implements the exact exported
surface of `lib/cache/redis.ts` over a `Map`, preserving semantics:

```
Map<string, {value, expiresAt?}>
cacheGet<T>(k)            -> deserialize (Upstash auto-deserializes objects/numbers)
cacheSet(k,v,{ex})       -> store, honor TTL
cacheDel(k)              -> delete
cacheSetNxStatus(k,v,ex) -> if absent: set + return {status:"acquired"}; else {status:"exists"}
                            (mirror the real "OK"/null SET-return detection — never read-back)
rateLimit / rateLimitStrict -> incr-based; default ALLOW (neutralized for the matrix)
cacheIncr / cacheReserveQuota / trackBadgeGenerated -> numeric incr
pingRedis()             -> "ok"
```

**New `apps/web/test/contract/redis-fake.contract.test.ts`** — fidelity test pinning
the fake to documented Upstash behavior: `cacheSetNxStatus` returns
acquired-then-exists across two calls; `incr` returns a `number`; a stored `1`
round-trips as `number 1` (the v2.9.0 OAuth-break lesson); TTL expiry.

**Automated success:** fidelity test green.

## 1.4 The payload-matrix harness

**New `apps/web/test/contract/payload-matrix.ts`** (~250 lines, dependency-free):

```
export const ABSENT = Symbol("ABSENT")   // distinct from null

export function declareField(name, {
  candidates: unknown[], includeAbsent?, includeNull?, typical?
}): FieldSpec

export function generatePayloads({ fields, randomCount = 300, seed }): Payload[]
  // order: (a) baseline optional-absent+required-typical
  //        (b) each nullable=null (others typical)
  //        (c) all typical
  //        (d) one-field sweeps × TWO backgrounds (all-typical AND all-absent)
  //        (e) randomCount seeded combos (mulberry32(seed))
  // dedupe by stable key = JSON of sorted [k,tag(v)] where tag distinguishes ABSENT|null|value
  // ABSENT key => OMIT the key from the built object; null => include as null.

export async function runMatrix(payloads, invoke, {
  allowedStatuses?,            // 4xx set that's acceptable
  assertPersisted?,            // async (payload, response) => void | throw   (loud routes)
  assertObservable?,          // async (payload, response) => void | throw   (graceful routes)
}): { total, statusCounts }
  // for each payload: res = await invoke(payload)
  //   if res.status >= 500 -> ALWAYS a violation (record status+body+payload)
  //   if 2xx and assertPersisted -> run it; on throw record persistence violation
  //   if 2xx and assertObservable -> run it; on throw record observability violation
  // collect ALL violations; throw ONCE with per-violation {status, body, payload JSON, kind}
```

Design notes carried from the playbook: `ABSENT != null != boundary`; two
backgrounds per sweep; `runMatrix`'s no-5xx rule is the universal invariant;
`assertPersisted`/`assertObservable` is the Chapa addition (D1).

**New `apps/web/test/contract/invoke.ts`** — helpers to build the real-handler
invoker: `invokeJson(handler, {method, path, body, session?|bearer?})` returns a
`NextRequest` driver; a `seedUser(handle)` / `cleanupUser(handle)` pair using the
service-role client (bounded-retry, best-effort cleanup).

## 1.5 POC route 1 — `/api/insights` (graceful) + bug A fix

**Fix bug A (`apps/web/app/api/insights/route.ts:87-105`)** — per D1 `graceful`:

```
const stored = await dbUpsertToolInsights(auth.handle, data, scores)
if (stored == null) {
  log("error", "[insights] durable persist returned null", {route:"/api/insights", handle})
  captureServerError(...)                          // make it observable
}
return NextResponse.json({
  success: true,
  persisted: stored != null,                       // NEW: never silent
  craftScore: stored ?? scores,
})
```

**Fix bug C (`apps/web/lib/db/tool-insights.ts:96`)** — `.single()` → `.maybeSingle()`
+ explicit null handling, so a 0-row upsert no longer throws into the null path.

**Update existing unit test** `insights/route.test.ts` — the "graceful degradation"
test (line 286) now also asserts `body.persisted === false` and that a capture
fired. (This is the unit-level companion; the real regression is the contract test.)

**New `apps/web/app/api/insights/route.contract.test.ts`:**

```
beforeAll: seed user "juan294" via service-role client
fields = declareField for each InsightsUpload leaf (tool, reportPeriod.start/end,
         volume.*, nested objects...) with candidates incl. ABSENT/null/typical/boundary
matrix = generatePayloads({fields, seed: 0xC0FFEE})
assert matrix INCLUDES the known-killer payload (upsert-returns-0-rows shape)  // anti-refactor guard
await runMatrix(matrix, p => invokeJson(POST, {path:"/api/insights", bearer:testToken, body:p}), {
  allowedStatuses: [400, 403, 413, 429],
  assertObservable: async (p, res) => {
    // for the forced-null-persist payload: response.persisted === false AND capture spy fired
  },
})
afterAll: cleanupUser
```

## 1.6 POC route 2 — `/api/supplemental` (loud) — persistence re-read

**New `apps/web/app/api/supplemental/route.contract.test.ts`:**

```
beforeAll: seed target user + valid bearer/ownership
fields = declareField for the supplemental payload (handle, emuHandle, stats shape)
runMatrix(payloads, invoke, {
  allowedStatuses: [400, 401, 403, 413, 429],
  assertPersisted: async (p, res) => {
    if (res.ok) {
      const row = await serviceClient.from("supplemental_stats")
                    .select("*").eq("target_handle", p.handle).maybeSingle()
      expect(row).not.toBeNull()
      expect(row.stats).toMatchObject(expectedFrom(p))   // no silent column drop
    }
  },
})
```

This is where the persistence assertion earns its keep: a payload the route accepts
but that fails to persist (e.g. a NOT-NULL/overflow edge) goes **red** here where a
status-only matrix would pass.

---

## Success criteria

**Automated:**
- [ ] `contract` CI job boots `supabase start`, applies migrations, runs
      `pnpm run test:contract` green on every PR.
- [ ] `redis-fake.contract.test.ts` green (fidelity pinned).
- [ ] `insights/route.contract.test.ts`: full payload space, **zero 5xx**,
      observability signal asserted; matrix provably contains the killer payload.
- [ ] `supplemental/route.contract.test.ts`: **zero 5xx** + persistence re-read green.
- [ ] `pnpm run test` (unit) still green and fast; updated insights unit test asserts
      `persisted:false` + capture.
- [ ] `pnpm run typecheck ; pnpm run lint` clean; knip ignore added.

**Manual:**
- [ ] Locally force `dbUpsertToolInsights` → null against the real stack; confirm the
      response now carries `persisted:false` and a capture event (previously silent 200).
- [ ] Revert bug A fix on a scratch branch; confirm the insights contract test's
      observability assertion goes **red** (proves it tests the real thing).

## Files touched

- new: `.github/workflows/ci.yml` (job `contract`), `vitest.config.contract.ts`,
  `vitest.contract-setup.ts`, `apps/web/test/contract/{payload-matrix,invoke,redis-fake}.ts`,
  `apps/web/test/contract/redis-fake.contract.test.ts`,
  `apps/web/app/api/insights/route.contract.test.ts`,
  `apps/web/app/api/supplemental/route.contract.test.ts`
- edit: `package.json` (`test:contract`), knip config,
  `apps/web/app/api/insights/route.ts` (bug A), `apps/web/lib/db/tool-insights.ts`
  (bug C), `apps/web/app/api/insights/route.test.ts` (unit companion)

## GitHub issues to file first

Bug A (`type: bug, priority: high, area: scoring`), Bug C
(`type: bug, priority: medium, area: scoring`). Reference both in commits (`Fixes #N`).
