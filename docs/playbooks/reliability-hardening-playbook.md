# Chapa Reliability-Hardening Playbook — Catching Seam Bugs Before Real Users Do

> **Status: Implemented.** All five phases below have shipped — this doc now
> serves as the reference for how the payload-matrix harness, write-registration
> gate, cron heartbeats, and client-error canaries work, not a pending proposal.

> A Chapa-specific plan for making an app that "passes all its tests" actually
> stop shipping user-facing 5xx **and silent data loss**. Adapted from a portable
> reliability playbook written after a real incident cluster on a Next.js +
> Postgres app, then rewritten against Chapa's actual stack, routes, and
> constraints (see the investigation notes in §2). Nothing here is exotic — it's a
> disciplined application of "test the seams with the real stack, and make silence
> impossible."

---

## 0. TL;DR — what you're building

Five phases, roughly in dependency order. You can stop after any phase and still
have shipped value; Phases 1–2 give the biggest ROI.

| Phase | One line | Primary artifact |
| ----- | -------- | ---------------- |
| **1. Payload-matrix harness** | Fire the whole legal payload space of one write endpoint at the **real handler → real Supabase + real Redis** and assert *no payload ever returns 5xx or silently fails to persist*. | A generic test helper + one proof-of-concept test, running against `supabase start` + a local Redis in CI |
| **2. Roll it across every write endpoint** | Do Phase 1 for *all* ~30 write routes; make "new write endpoint must be registered" a CI gate. | A registration-checker script (mirrors the repo's existing "adoption ratchet" scripts) wired into CI |
| **3. Real-journey E2E with device + data variety** | One end-to-end test that drives a *complete* journey (login → generate → badge → refresh) on a **phone profile**, toggling offline/online, and **re-reads Supabase** to prove the snapshot/config persisted. | A journey spec + a mobile Playwright project + a DB re-read assertion |
| **4. Silent-failure canaries** | Make the failure modes that hide (stalled crons, un-alerted client errors, un-probed prod) *loud* — building on the alert path Chapa already has. | Health-gate promotion (cron heartbeat + real metrics), client-error capture, a nightly prod probe |
| **5. Process guarantees** | Write the lessons into the RPI / triage / agent workflow so the bug *class* can't recur. | Edits to `/remediate`, `/triage`, `/pre-launch`, and this repo's agent rules |

**Two sentences to tattoo on the wall** — Chapa needs both, because its fail-open
design converts many would-be 5xx into silence:

> **1. A 500 on user input is always a bug.** Any route that can return 5xx for a
> payload the client can legally emit is defective — the validation, the write
> path, or the error mapping is wrong.
>
> **2. A write that fails but reports success is also always a bug.** Chapa's DB
> layer deliberately swallows errors into `false`/`null` and degrades gracefully.
> That is correct for *reads* and *caches*. For a *durable user write*, a swallowed
> failure returned to the client as `{ success: true }` is silent data loss — the
> most expensive bug to find, because nothing is red anywhere.

---

## 1. Why this exists — the seam-bug diagnosis, Chapa edition

### 1.1 The failure pattern

Chapa is a mature app: 55 route test files, ~global 75% coverage, a pre-launch
audit team, a post-deploy smoke suite, seven scheduled agents. And **every one of
those gates mocks the layer below it.** Every `route.test.ts` imports the real
handler and then `vi.mock`s auth, Redis, and Supabase; `lib/db/supabase.test.ts`
mocks `@supabase/supabase-js` at the driver level. **No test in the repo runs a
real client payload through real Postgres.** That is exactly the blind spot where
seam bugs live.

The investigation for this playbook already found **three shipped seam bugs** that
every existing gate passed (see §7 for the full taxonomy):

- **`POST /api/insights` reports success on a failed write.**
  `apps/web/app/api/insights/route.ts:87,104` — `stored = await dbUpsertToolInsights(...)`
  is never checked; on a persist failure `stored` is `null` and the route still
  returns **HTTP 200 `{ success: true, craftScore: stored ?? scores }`**. A legal
  CLI upload that fails to persist tells the CLI it worked. **No test writes an
  insight and reads it back**, so this is invisible.
- **Snapshot NOT-NULL numerics forwarded with no fallback.**
  `apps/web/lib/db/snapshots.ts:113-137` — 20+ `NOT NULL` numeric columns are
  written as `commits_total: s.commitsTotal` with no `?? 0`. If any field is
  `undefined` at runtime, supabase-js omits the key, Postgres raises `23502
  not_null_violation`, the DB layer catches it and returns `false`, and because
  this runs inside `after()` the `false` is unchecked → **the lifetime snapshot is
  silently dropped, no error anywhere.**
- **The one non-`maybeSingle()` write.** `apps/web/lib/db/tool-insights.ts:96`
  uses `.upsert(...).select().single()`; `.single()` throws if the upsert returns
  ≠1 row, feeding the 200-on-failure path above.

The common thread, exactly as the source playbook predicted: **the bug is in the
contract between layers, and every layer's test mocks the layer below, so no test
ever runs the real payload through the real database.**

### 1.2 Why mocks can't catch these

A unit test that mocks Supabase asserts *"given this input, my code calls
`.upsert()` with these args."* It cannot assert *"Postgres actually accepts those
args against the real NOT-NULL / UNIQUE constraints."* When your assumption about
the contract *is* the bug, the mock encodes the bug and passes.

**Corollary:** the fix for a seam bug is not "add a unit test." It's "add a test
that exercises the real stack across the seam" — real supabase-js against
`supabase start`, real Redis, real handler. A unit-mock reproduction of a seam bug
is not a valid regression test; it passes whether or not the bug is fixed.

### 1.3 Chapa's specific bias: silence over 5xx

The source app's failures were mostly 5xx. **Chapa's will mostly be silent**,
because of a deliberate, documented design choice: every `lib/db/*` function is
fail-open (catch → log → return `false`/`null`/`[]`), `lib/env.ts` never throws on
missing config, and `rateLimit()` fails open. This is *good* for availability —
an embedded badge must not 500 because Redis blinked. But it means the dominant
seam-bug shape in Chapa is **write silently didn't happen**, and the harness below
must assert **persistence**, not just **status < 500**. That is the single biggest
adaptation from the source playbook.

---

## 2. Prerequisites & how Chapa maps to the source stack

The source plan ran on Next.js + Postgres (Supabase) + a job queue + Sentry +
Playwright + GitHub Actions. Here's the honest mapping to Chapa as it exists today.

| Source assumed | Chapa reality | Gap to close for Phase 1 |
| -------------- | ------------- | ------------------------ |
| Directly-importable route handlers | **YES** — `export async function POST/PUT/...` in `apps/web/app/api/**/route.ts`, already imported and driven with real `NextRequest` in 55 tests | none |
| A real DB you can boot in CI | **NO** — no CI job boots Supabase or Redis. `supabase start` isn't used anywhere; every test mocks the DB | **Stand up `supabase start` + a local Redis in a new CI job** (the hard requirement) |
| RPC functions + CHECK constraints | **PARTIAL** — Chapa uses supabase-js `.insert`/`.upsert` with the **service-role key** (RLS bypassed); **no CHECK constraints, no PG enums.** Constraint surface is **UNIQUE + NOT NULL** only | Matrix must assert on UNIQUE (`23505`) + NOT NULL (`23502`) + numeric overflow (`22003`), not CHECK |
| Zod validation | **PARTIAL** — only **2 routes** use Zod (`admin/campaigns` POST, `admin/feature-flags` PATCH); everything else is hand-rolled `isValid*` guards in `lib/validation` | Harness must handle hand-rolled validation (it does — it fuzzes payloads, not schemas) |
| A background job queue | **NO** — the analog is **`after()`-deferred side-effects** (`badge.svg/route.ts:257`, `u/[handle]/page.tsx:169`) and **three Vercel crons** (warm-cache, sync-audience, process-campaigns) | Treat the deferred snapshot write as the "queue"; §6 hardens cron freshness |
| Sentry + alert rules | **YES** — already has a central path: `withErrorCapture()` → `captureServerError()` → PostHog `server_error` + `captureOperationalAlert()` webhook (`lib/analytics/server-errors.ts`). No Sentry | Reuse it; don't build a tracker. §6 extends it to client errors + cron heartbeat |
| Playwright with device + offline | **PARTIAL** — Playwright exists (`apps/web/playwright.config.ts`) but **Chromium-only, one viewport, no offline, no DB re-read** | §5 adds a phone project, offline toggle, and a Supabase re-read |
| Env parity local vs CI | **PARTIAL** — `lib/env.ts` never throws; CI `build`/`e2e` run on **dummy env**; local dev has real env | §8: the new real-DB job must export the exact env the routes read |

**The one hard requirement, restated for Chapa:** a test must be able to call a
real route handler with (a) a real supabase-js client pointed at `supabase start`,
(b) a real (or faithfully local) Redis, and (c) a real authenticated session for a
seeded test user. Chapa satisfies (a) and (c) trivially once the CI DB exists;
(b) needs either a local Redis with the Upstash REST shim or a thin in-memory
fake that honors the exact `lib/cache/redis.ts` semantics (esp. `cacheSetNxStatus`
returning `"OK"`/`null`).

---

## 3. Phase 1 — The payload-matrix contract harness

**Goal:** a reusable helper that, given a write endpoint, generates its entire
*legal payload space* and fires each payload at the **real handler against real
Supabase + real Redis** with a **real authenticated session**, asserting for every
payload:

1. **response status < 500** (4xx is fine — correct rejection); and
2. **for payloads the route accepts (2xx): the row is actually in Supabase with the
   expected values** (Chapa's silent-data-loss guard — this is the part the source
   didn't need and Chapa does).

### 3.1 The design (three functions)

A small, dependency-free module (~250 lines). Put it at
`apps/web/test/contract/payload-matrix.ts` and add it to the knip/dead-export
ignore list (§8 — it's test-only and will get flagged).

```text
ABSENT: a unique sentinel distinct from `null`.
  Omitting a key entirely ≠ sending the key with JSON null. Both are legal client
  inputs. Chapa's hand-rolled isValid* guards and its `?? null` / `?? undefined`
  forwarding (see auth/callback, platform-oauth) make this distinction the single
  richest seam-bug source. Test all three (ABSENT / null / value) per optional field.

declareField(name, { candidates, includeAbsent?, includeNull?, typical? }) -> FieldSpec

generatePayloads({ fields, randomCount = 300, seed }) -> Payload[]
  Deterministic order: (a) baseline optional-absent, (b) each nullable=null,
  (c) all typical, (d) one-field sweeps against TWO backgrounds (all-typical AND
  all-absent), (e) seeded-random combos (mulberry32). Deduped by stable key so
  ABSENT vs null stay distinct.

runMatrix(payloads, invoke, { allowedStatuses?, assertPersisted? }) -> { total, statusCounts }
  Fires each payload through invoke(payload) -> Response.
  ANY status >= 500 is ALWAYS a failure.
  When assertPersisted is provided, for each 2xx response it runs a caller-supplied
  DB re-read (admin client) and fails if the row is missing or fields mismatch.
  Collects ALL violations, throws once with status + body + exact payload JSON
  (+ which persistence assertion failed).
```

**Design choices that matter for Chapa:**

- **`assertPersisted` is the Chapa addition.** Without it, the insights
  200-on-failure bug (§1.1) passes the matrix — status is 200. The re-read is what
  makes silence loud. Every write route whose success implies a durable row must
  supply a re-read.
- **`ABSENT` ≠ `null` ≠ boundary** — most seam bugs live in exactly this
  distinction. Chapa's `dbUpsertUser({ email: email ?? undefined, displayName:
  user.name ?? null })` (`auth/callback/route.ts:163`) and the shared OAuth
  `refresh_token ?? null` / `expiresAt` forwarding (`lib/auth/platform-oauth.ts:257`)
  are the concrete targets.
- **Two backgrounds per sweep** — a bad value might only fail when *other* fields
  are absent. Cheap interaction coverage.
- **`runMatrix` is the invariant, not per-payload assertions.** One universal rule
  (no 5xx + persisted) is what makes it cheap to apply to 30 routes.

### 3.2 The invocation recipe (the tricky part for Chapa)

Mock **only the ambient seams**, never the logic under test:

- **Supabase client:** point `getSupabase()` / `createClient` at `supabase start`
  (local, service-role key) seeded with a test user. The handler runs its real
  validation, real `.upsert()`, real NOT-NULL/UNIQUE constraints, real error
  swallowing. **Never mock `lib/db/*` — those are what you're testing.**
- **Redis:** run a real local Redis behind the Upstash REST shim, or a faithful
  in-memory fake in `lib/cache/redis.ts` that preserves exact semantics —
  especially `cacheSetNxStatus` detecting newness via the SET return
  (`"OK"`/`null`), `rateLimit()` behavior, and auto-deserialization. **Neutralize
  the rate limiter** (always-allow) — the matrix fires hundreds of requests and the
  real limiter would mask the write path behind 429s.
- **Auth:** hand the handler a session for a seeded test user (Chapa auth is
  session-cookie or bearer; see the auth-helper table in §4). For bearer routes,
  inject a valid `ADMIN_SECRET`/`CRON_SECRET` test value.
- **`after()`:** Chapa defers durable writes inside `after()`
  (`badge.svg/route.ts:257`, `page.tsx:169`, `insights/route.ts:90`). In a bare
  test runtime `after()` throws "called outside a request scope." **Mock it to run
  the callback inline (await it)** so the matrix actually exercises the deferred
  snapshot write and its persistence can be re-read. *(This bit the source team in
  CI — see §8.)*
- **External network only** (GitHub API, Resend email, PostHog): mock at the
  library boundary so tests are deterministic and keyless. **Never mock your own
  DB, Redis, or validation.**

Seed data (a user row, a linked platform, a campaign draft, whatever the route
needs) via the service-role client in `beforeAll`; clean up in `afterAll`. Make
seed/cleanup **retry-safe and best-effort** (warn, don't throw) — CI reruns, and a
leaked row in an ephemeral DB is harmless (§8).

Everything else is real: real `NextRequest`/`Response`, real hand-rolled
`isValid*` guards, real Postgres error codes, real UNIQUE/NOT-NULL constraints.

### 3.3 First target & where it runs

Pick the route that **would have caught our worst silent bug**: `POST /api/insights`
(`apps/web/app/api/insights/route.ts`). Reproduce a payload whose upsert returns 0
rows (or force a transient DB error), watch the matrix's `assertPersisted` go red
on the current 200-on-failure code, then green after the route checks `stored` and
returns 500 on persist failure. Runner-up target: `POST /api/supplemental` (durable
EMU stats, explicit 500 mapping, hand-rolled validation, feeds scoring).

Wire the harness into a **new CI job** that runs `supabase start` + local Redis
(there is no existing real-DB job to reuse — this is the infra you must add).
Assert loudly in the test that the matrix actually generated the known killer
payload, so a future refactor can't silently stop testing it.

**Definition of done for Phase 1:** one endpoint, hundreds of payloads, zero 5xx,
**every 2xx re-read and confirmed persisted**, running against real Supabase +
Redis in CI, harness reusable.

---

## 4. Phase 2 — Roll the matrix across every write endpoint

**Goal:** every write endpoint gets a payload-matrix test, and it becomes
*impossible to add a new write endpoint without one* (or a documented exemption).

### 4.1 The enumerated write surface (already mapped — order by risk)

The investigation enumerated **~30 state-mutating handlers**. Roll them out in
this risk order (null-forwarding + silent-persist first):

**Tier 1 — durable user writes with silent-persist or null-forwarding risk:**
- `POST /api/insights` — 200-on-failure (§1.1). *Fix + matrix first.*
- `POST /api/supplemental` — durable EMU stats → Supabase + Redis, hand-rolled validation, explicit 500 map.
- `PUT /api/studio/config` — durable badge config, hand-rolled `isValidBadgeConfig`, explicit 500 map.
- `POST /api/recalculate` / `POST /api/refresh` — snapshot replace into Supabase (the NOT-NULL forwarding path, §1.1).
- `GET /api/auth/{bitbucket,codeberg,gitlab}/callback` — shared `dbUpsertLinkedPlatform` with `refresh_token ?? null` / null `expiresAt` (`lib/auth/platform-oauth.ts:257`).
- `GET /api/auth/callback` — `dbUpsertUser({ email: email ?? undefined, ... })`, fire-and-forget.

**Tier 2 — durable writes, lower null risk:**
- `POST /api/admin/campaigns` (Zod), `PATCH/DELETE /api/admin/campaigns/[id]`, `POST .../send`, `POST .../test`.
- `PATCH /api/admin/feature-flags` (Zod), `POST /api/admin/bulk-recalculate`.
- `POST /api/telemetry` (public, unauth, fire-and-forget — persistence is best-effort by design; matrix asserts no 5xx, *not* persistence).
- `POST /api/challenge` (email only, no durable DB write — matrix asserts no 5xx).

**Tier 3 — Redis-only / mutating GET (audit for "GET should be safe" + no 5xx):**
- `GET /api/cli/auth/poll` (Redis writes), `POST /api/cli/auth/approve`.
- `GET /api/auth/login` (Redis oauth-state), `POST /api/auth/logout`.
- `GET /api/notifications/unsubscribe` (Supabase update via HMAC token, fail-open).
- `POST /api/generate` (warms caches).

Record for each: method, path, validation style (Zod vs hand-rolled vs none),
auth style, whether it reads a body, and whether success implies a durable row
(→ needs `assertPersisted`).

### 4.2 The registration checker (the durable part)

Write a checker script that mirrors the repo's existing "adoption ratchet" scripts
(the same shape as `check:circular` / `validate:migrations` / the craft-propagation
guard already wired into `ci.yml`'s `lint-and-typecheck` job). It:

1. Discovers every write handler under `apps/web/app/api/**/route.ts` (static regex
   for the `export async function POST|PUT|PATCH|DELETE` forms, **plus GET handlers
   that write** — Chapa has several: cron endpoints, `auth/login`, `auth/callback`,
   `cli/auth/poll`, `notifications/unsubscribe`).
2. Discovers which handlers are *registered* — imported and driven by a matrix
   contract test (grep the contract test dir for imports of each route module's
   write method).
3. Maintains an explicit **exemption map** `"<METHOD> /path": "reason"`. Only
   legitimately out-of-scope endpoints belong here. Chapa's real exemption
   categories:
   - **Webhooks** — `POST /api/webhooks/resend` (Svix HMAC-verified provider
     payload, raw-body-before-parse; not user JSON).
   - **Cron** — `GET /api/cron/{warm-cache,sync-audience,process-campaigns}`
     (`CRON_SECRET` bearer, no request body; covered by §6 freshness gates instead).
   - **Dev-only** — `POST/DELETE /api/admin/agents/run` (blocked in prod).
   - **Body-less writes** — `POST /api/generate`, `POST /api/recalculate`
     (read no body — nothing to fuzz; still get a *single* real-stack smoke test,
     just not the full matrix).
   - **Email-only, no durable DB write** — `POST /api/challenge`.
4. **Gates CI** at `--max-unregistered=0`: any write handler neither registered nor
   exempt fails the build with an actionable message.

**Audit the exemption list adversarially.** A route that accepts a plain JSON body
and writes to Supabase must NOT be exempt — that's the whole point. Note that
`notifications/unsubscribe` is a *mutating GET behind an HMAC token* — it writes to
Supabase, so it belongs in the matrix (drive it with a valid signed token), not the
exemption list.

### 4.3 Fix the drifts you find along the way

Enumerating the surface surfaces dead/weak controls:

- **Validation split.** Only 2 of ~30 routes use Zod; the rest hand-roll `isValid*`.
  Where a hand-rolled guard is weaker than the DB constraint (e.g. accepts an
  unbounded string for a bounded column, or doesn't bound a numeric that hits
  `NUMERIC(5,2)` overflow at `tool_insights`), either tighten the guard or accept it
  explicitly in `docs/accepted-risks.md`.
- **The blunt-500 seam.** `studio/config` and `supplemental` map any DB-layer
  `false` to a flat 500 with no discrimination between "DB down" and "constraint
  violated," and no `23505`-as-idempotent-success handling. If the inline pattern
  grows past ~5 sites, add a shared PG-error classifier (`23505`→idempotent 200,
  `23502/22P02/22003`→400, else 500). **Don't build it prematurely** (§8) — right
  depth beats clever abstraction.

**Expected yield:** every seam bug in §7 that maps to a Chapa route, found in CI
deterministically instead of by a user's failed CLI upload or a missing lifetime
snapshot.

---

## 5. Phase 3 — Real-journey E2E with device + data variety

Contract tests prove the *server* survives every payload and persists it. They
don't prove the *whole journey* works on a real phone with real interaction
timing, offline queues, and client-side state. Phase 3 adds one high-value E2E.

Chapa's Playwright is Chromium-desktop-only with no offline and no DB re-read.
Build:

1. **A phone profile.** Add a second Playwright project (`Pixel 5` / mobile
   Chromium) to `apps/web/playwright.config.ts` alongside the existing desktop
   Chromium. Chapa's mobile layouts move primary actions (the badge toolbar, the
   share CTA, the studio controls) — the least-tested, most-used path. Make every
   interaction viewport-robust (click whichever CTA is visible).
2. **A complete journey with data variety.** Not "load one page" — a full session:
   **login (seeded GitHub session) → `/generating/:handle` → badge renders →
   `/studio` customize + save → `/u/:handle` share page → refresh.** Include the
   meaningfully-different persistence shapes: a profile *with* Craft (5th dimension,
   pentagon radar) and *without* (4-dim diamond), plus a linked-platform badge
   (multi-logo footer) — different persistence + render shapes through the same
   paths. Data variety is where the NOT-NULL snapshot drop and the silent-column
   class hide.
3. **Offline → online mid-journey.** Toggle `context.setOffline(true)`, perform a
   studio save or a badge view, assert the client's queued/unsaved UI and its
   local-storage/owner-cache-warm behavior, toggle back online, assert it flushes.
   This exercises the retry/replay paths (`useOwnerCacheWarm`, `useSession`,
   `useTrendData`) that only run under real network failure — and which today
   surface non-2xx fetches to **no** monitoring (§6.2).
4. **Re-read Supabase at the end — the crux.** After the journey, query with the
   service-role client and assert: the `metrics_snapshots` row exists for today
   with the correct per-shape values (Craft populated for the craft profile, null
   for the non-craft one — *this is exactly the NOT-NULL-forwarding drop from §1.1*),
   the `studio_configs` row matches what was saved, and `user_platforms` reflects
   any link. **This assertion is what a UI-only E2E omits and is exactly what
   catches silent data loss.**
5. **Realistic seed fixtures.** Seed data that mirrors what the real stats pipeline
   emits (all optional columns populated), not minimal fixtures — otherwise you
   never exercise the nullable columns (`craft`, `micro_commit_ratio`,
   `docs_only_pr_ratio`, `confidence_penalties`) that break.
6. **Retry-safety.** The journey mutates state (saves config, writes a snapshot).
   Give it a dedicated fixture handle + per-test reset so CI retries start clean and
   it never collides with other specs' fixtures. **Watch seed-count coupling** (§8)
   — Chapa's smoke specs use `__chapa_smoke=1` and branch on
   `DEPLOYMENT_SMOKE_STRICT`; don't inflate a counted view.

**Wire it into the pre-merge `e2e` job** on both device profiles. Note the current
`e2e` job runs on **dummy env with no DB** — this journey needs the real-DB job's
Supabase, so it either joins that job or the DB-backed job feeds it (§8 env parity).

---

## 6. Phase 4 — Silent-failure canaries

Some failures don't throw — they quietly don't happen. Chapa already has a strong
central alert path (`withErrorCapture` → PostHog + `CHAPA_ALERT_WEBHOOK_URL`);
Phase 4 extends it to the three blind spots the investigation found.

### 6.1 Promote real metrics into the health degrade gate + add a cron heartbeat

`GET /api/health` degrades to 503 if any dependency isn't `"ok"`, and fires a P1
`health_degraded` alert. But it has two gaps:

- **It computes metrics it never gates on.** `pingRedis()` runs `dbsize()` but
  **discards the count** (`lib/cache/redis.ts:350`); the GitHub probe returns
  `remaining`/`limit` but that's admin-only and never affects status — a near-zero
  GitHub quota (which would cripple badge generation) does not degrade health.
  Promote these: gate on GitHub `remaining` below a floor, and surface `dbsize` so
  a wiped cache is visible.
- **No cron writes a last-run timestamp; there is no staleness metric anywhere.**
  A cron that stops firing entirely, or runs and does zero work
  (`process-campaigns` returning `status:"idle"` is indistinguishable from a stuck
  queue), goes **unpaged** today. Add a heartbeat: each cron writes
  `cron:lastrun:<name>` to Redis **at the end of successful work** (not the start —
  the source's bug was writing "last run" before doing the work, so a green check
  proved only that the endpoint was *invoked*). Then gate health: *`now -
  cron:lastrun:warm-cache` > 26h → degraded → 503.* Compute it in the always-run
  path so the 503 fires for uptime monitors, not just admins. Add a contract test
  for the new degrade condition.

### 6.2 Capture client errors (the biggest monitoring hole)

Server 5xx already flow through `captureServerError` → PostHog + webhook, and
`badge_5xx` / `oauth_callback_failure` / `cron_failure` auto-classify. But the
**client is effectively unmonitored**:

- `apps/web/app/global-error.tsx` renders static UI and **discards the `error`
  prop** — it reports nothing.
- There is **no `window.onerror` / `unhandledrejection` handler** anywhere.
- Non-2xx client fetches (`useTrendData`, `useOwnerCacheWarm`, `useSession`) are
  handled for local UI state but **never reported** — a wave of client-side 5xx is
  invisible.

Fix: have `global-error.tsx` POST the error to `/api/telemetry` (or a small new
client-error sink), register a global `unhandledrejection`/`onerror` handler that
emits a PostHog event, and have the shared client-fetch helper report non-2xx
responses. Then add an alert rule on the *rate* of client errors — the user's
actual experience — alongside the existing server-5xx path.

### 6.3 A nightly scheduled production probe

Chapa only exercises prod **at deploy time**: the `deployment-smoke` job is
push-gated (required on `main`, skipped elsewhere). A quiet week = zero
verification, and the first signal of a post-deploy regression is a user. Add a
**scheduled** GitHub Actions workflow (nightly cron, like the existing
`gitleaks.yml` / `security.yml` schedules) that runs a **read-only** synthetic
journey + a deep authorized `/api/health` probe against production, reusing the
`DEPLOYMENT_SMOKE_BASE_URL` secret and a synthetic user. Two notes:

- Keep it a **separate** workflow from `deployment-smoke` — a nightly failure isn't
  a "roll back this deploy" signal.
- Do **not** gate it behind a human-approval environment (it's unattended; it'll
  hang). Read-only smoke doesn't need the gate.

### 6.4 Root-cause silent incidents; don't paper over them

When a silent failure has happened (a user reports a missing lifetime snapshot, or
a CLI upload that "succeeded" but never appears), run it to ground with hypotheses
ranked by code evidence. The prime suspects are already known: the `after()`-
deferred snapshot write truncating on serverless freeze
(`public-profile.ts:106-116` via `badge.svg/route.ts:257`), the insights
200-on-failure path, and NOT-NULL forwarding. The §6.1 cron-heartbeat + health
gates double as the real-time detector for the cron-stall variant.

---

## 7. The bug taxonomy — what this actually catches (Chapa-annotated)

Use as a checklist and as evidence for skeptics. Each class below is either
confirmed present in Chapa (with `file:line`) or a latent risk the harness guards.

1. **Silent write reported as success.** *(CONFIRMED — Chapa's flagship class.)*
   `POST /api/insights` returns 200 with `stored ?? scores` even when
   `dbUpsertToolInsights` returned `null` (`insights/route.ts:87,104`; the null
   comes from `.single()` throwing at `tool-insights.ts:96`). Caught only by
   write-then-re-read. **Fix: check the result, 500 on persist failure.**
2. **NOT-NULL violation → silent drop.** *(CONFIRMED.)* Snapshot numerics forwarded
   with no `?? 0` (`snapshots.ts:113-137`); an `undefined` field → `23502` → caught
   → `false` → unchecked inside `after()` → lost lifetime history. **Fix: default
   the numerics, and check the return where it isn't deferred.**
3. **`ABSENT` vs `null` forwarding.** *(RISK.)* `dbUpsertUser({ email: email ??
   undefined })` (`auth/callback:163`), shared OAuth `refresh_token ?? null` /
   null `expiresAt` (`platform-oauth.ts:257`). Columns are nullable today (safe),
   but the pattern is the classic seam — the matrix pins it.
4. **`.single()` on 0/2 rows.** *(CONFIRMED — 1 site.)* `tool-insights.ts:96` is the
   only non-`maybeSingle()` write. **Fix: `.maybeSingle()` + explicit handling, or
   `order + limit(1)`.**
5. **Blunt 500 with no error discrimination.** *(RISK.)* `studio/config`,
   `supplemental` map any DB `false` → flat 500; no `23505`-idempotent path. A
   legal payload that trips a UNIQUE constraint 500s instead of succeeding
   idempotently.
6. **Numeric overflow.** *(THEORETICAL.)* `tool_insights.*` is `NUMERIC(5,2)`; a
   craft score ≥ 1000 → `22003`. Scores are 0–100, so bounded in practice — the
   matrix's numeric candidates confirm the guard holds.
7. **Mutating GET.** *(AUDIT.)* `auth/login`, `auth/callback`, `cli/auth/poll`,
   `notifications/unsubscribe` all write on GET. Ensure each is intentional and
   idempotent; none should be cacheable-and-writing.
8. **Fire-and-forget truncation.** *(RISK.)* Durable writes inside `after()`
   (`badge.svg:257`, `page.tsx:169`) and `fireAndForget` (`telemetry:66`,
   `auth/callback` `dbUpsertUser`) can be frozen mid-flight. **Fix: keep durable
   writes on the awaited path; only defer caches/invalidation.**
9. **Redis scalar round-trip.** *(LATENT.)* `cacheSetNxStatus` stores bare `1` and
   is safe *because it never reads it back* (detects via SET return). Any future
   `cacheGet<string>` of a key written with `1` gets `number 1` — the bug that
   broke OAuth in v2.9.0 (see project memory). Guard in review.
10. **Cron ticks, does no work.** *(CONFIRMED gap.)* No last-run timestamp, no
    staleness gate; `cron_failure` only fires on a 5xx throw, not a 200-with-no-work.
    Closed by §6.1.

Note the classes from the source that **don't** apply to Chapa: CHECK-constraint
violations and PG enum drift — Chapa has neither (all status/type fields are plain
`TEXT`, validated only in app code). That's its own latent risk (bad status stored,
not rejected) but a different fix (tighten app validation or add constraints), not
a matrix target.

---

## 8. Lessons & gotchas — the part that saves you a week

- **CI env parity is the #1 trap — and Chapa is primed for it.** `lib/env.ts`
  *never throws* on missing vars, and CI `build`/`e2e` run on **dummy env**. The new
  real-DB job must export the *exact* vars the routes read against `supabase start`
  (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, the Upstash/Redis pair,
  `CHAPA_VERIFICATION_SECRET`, `CRON_SECRET`/`ADMIN_SECRET` test values). Mirror it
  in the local test runner so local === CI. A dummy `UPSTASH_*` that "looks set"
  will make writes silently no-op and mask the very bugs you're hunting.
- **A skipped job is not a passing job.** Chapa's `e2e` and `deployment-smoke`
  `needs: [build]`, and `build` `needs: [lint-and-typecheck, test]`. If `test`
  fails first, the whole downstream matrix is *skipped* — green-looking but never
  run. Don't trust green until the DB-backed job actually executed.
- **`after()` throws outside a request scope.** The moment the matrix (or any test)
  drives a route that calls `after()` (`insights`, `badge.svg`, `page.tsx`) without
  mocking it, every payload turns into a 500. Mock `after()` to run its callback
  inline. Scan proactively: which handler-importing tests don't mock the lifecycle
  hooks?
- **Fail-open masks the bug you're testing.** Chapa's whole DB layer returns
  sentinels on error. In the matrix you *want* the real error to surface as a
  persistence-assertion failure — so `assertPersisted` must re-read, not trust the
  handler's status. A 200 from a fail-open route proves nothing about persistence.
- **Seed-count coupling.** Adding a fixture handle can break any E2E that hard-
  asserts a count (`toHaveCount`) or the `__chapa_smoke` strict assertions. Grep
  specs before changing shared fixtures.
- **Auth/seed under load.** Seeding/cleaning many test users against local Supabase
  auth can transiently error under a big suite. Bounded-retry the seed; make cleanup
  best-effort (warn, don't throw) — a teardown hiccup must never red a passing suite.
- **Coverage ratchet vs new branches.** Every new error-mapping branch (`if (err.code
  === "23505") ...`) is a new branch. Chapa's coverage thresholds are **global-only**
  (75/70/65/75), no per-file floors — if the new branches are covered by *contract*
  tests (a separate job, likely excluded from the coverage run) but not unit tests,
  the global % can dip. Add unit tests for the branches or account for it — **never
  lower the ratchet.**
- **The harness will get knip-flagged.** Chapa runs `knip.yml`. A test-only helper
  module that only *tests* import will trip the dead-export checker. Add
  `test/contract/payload-matrix.ts` to the knip ignore list.
- **Don't centralize the PG-error mapper prematurely.** Chapa's fail-open sentinel
  convention means there's no single `{data, error}` chokepoint; the per-route
  status choice (404-to-avoid-leaking vs 400-for-business-rule vs 200-idempotent) is
  contextual. Flag a shared classifier as a follow-up only if the inline pattern
  passes ~5 sites.

---

## 9. Phase 5 — Process guarantees (so it can't regress)

Tooling catches the bugs; process stops the *class* from coming back. Wire these
into the RPI commands and agent rules this repo already uses.

1. **Instance-sweep rule.** Every fix must grep for the *signature* of its bug
   class — the pattern, not just the one file named in the report — and fix + test
   **every** instance in the same change. Record the grep signature and the full
   `file:line` list in the PR. (This already exists in spirit as the project-memory
   "instance-sweep" lesson; make it explicit in `/remediate` and `/triage`.) A
   finding is not resolved until the class is closed.
2. **"A 500 on user input — or a silent write failure — is always a bug," codified.**
   Every production `server_error` / `badge_5xx` / `oauth_callback_failure` in
   PostHog **and** every reported "it said success but nothing saved" becomes a
   tracked issue with a regression test **at the failing seam via the real stack**
   (a matrix test or a DB-reading E2E). A unit-mock reproduction is explicitly *not
   sufficient* for a seam bug.
3. **New write endpoint ⇒ payload-matrix registration** — enforced by the Phase-2
   checker, but state it as policy in `CLAUDE.md`'s engineering rules too.
4. **Weekly error triage** in the existing triage cadence — covering **both**
   PostHog `server_error` events and the new client-error stream (§6.2), feeding
   rule (2). Fold this into the `/triage` agent-report cycle.
5. **Pre-launch gate.** Add "payload-matrix coverage is complete
   (`--max-unregistered=0`)" and "cron heartbeat health-gate passes" to the
   `/pre-launch` qa-lead + devops checklists.

---

## 10. Adoption checklist

Rough effort in parens.

- [ ] **Confirm the hard requirement:** import & invoke a real route handler in a
      test, with `supabase start` + a real/faithful Redis + a real seeded session.
      Chapa already imports handlers and passes `NextRequest`; the missing piece is
      the real backend. *(0.5–1 day)*
- [ ] **Stand up Supabase + Redis in a new CI job** (`supabase start` + a local
      Redis behind the Upstash shim, or a faithful in-memory Redis fake). Export the
      exact env the routes read. *(1–2 days — this is the biggest single lift.)*
- [ ] **Port the harness** (`declareField` / `generatePayloads` / `runMatrix` +
      `ABSENT` + mulberry32) **plus the `assertPersisted` re-read**. ~250 lines.
      Add to the knip ignore list. *(1 day)*
- [ ] **Prove it on `POST /api/insights`.** Reproduce the 200-on-failure bug; watch
      `assertPersisted` go red on current code, green on the fix. *(0.5 day)*
- [ ] **Roll the matrix across all write endpoints**, Tier 1 → Tier 3 (§4.1).
      Expect real bugs; triage as you go — file each as a GitHub issue per the repo's
      issue-driven workflow. *(1–2 weeks)*
- [ ] **Build the registration checker + CI gate** (`--max-unregistered=0`) with an
      audited exemption list, mirroring the existing ratchet scripts in
      `lint-and-typecheck`. *(1 day)*
- [ ] **Add one real-journey E2E** with a phone profile, data variety (craft /
      non-craft / linked-platform), offline/online, and a Supabase re-read. *(2–4 days)*
- [ ] **Phase 4 canaries:** cron heartbeat + health-gate promotion; client-error
      capture (`global-error.tsx` + `unhandledrejection` + non-2xx fetch reporting);
      a nightly read-only prod probe. *(2–4 days, incremental)*
- [ ] **Write Phase 5 into `/remediate`, `/triage`, `/pre-launch`, and CLAUDE.md.**
      *(0.5 day)*
- [ ] **Budget for the §8 gotchas** — especially env parity (Chapa's dummy-env CI
      + never-throwing env module) and "skipped job ≠ passing job."

---

## 11. Sequencing & cost notes

- **Phases 1–2 are the ROI.** The payload matrix across Chapa's ~30 write routes —
  with the persistence re-read — finds the silent-data-loss class that hurts most.
- **The infra lift is front-loaded.** Chapa has *zero* real-DB tests today, so
  Phase 1's `supabase start` CI job is a real cost the source app didn't pay. Do it
  once; every subsequent route is cheap.
- **Run the DB-backed suite for real, early.** Don't let it sit behind `build`'s
  `needs:` chain where a `test` failure skips it. The first honest full run is where
  the CI-vs-local env gaps surface — find them there, not in a release.
- **Expect a fix-forward loop after the first real CI run** — env parity, an
  `after()` mock gap, a fixture-count coupling. Each is a quick fix; budget the
  round-trips.
- **Every CI run / deploy costs money and time** (and per project rules, no Vercel
  deploys without authorization). Batch the rollout; don't push one route at a time.

---

## 12. One-paragraph pitch for the skeptic

> "Our tests are green and our DB layer is fail-open, so when a write silently
> fails, the route still returns `{ success: true }` and nothing is red anywhere —
> `POST /api/insights` does exactly this today. Every test mocks Supabase, so no
> test ever runs a real payload through real Postgres constraints. We're going to
> stand up `supabase start` + Redis in CI once, build one ~250-line harness that
> fires each write endpoint's entire legal payload space at the real handler, and
> assert it never 5xx's **and the row is actually there afterward**. Then we make
> 'every write endpoint has one' a CI gate, add one phone-profile end-to-end journey
> that re-reads Supabase to prove nothing's silently dropped, promote a cron
> heartbeat and client-error capture into our existing alert path, and write it into
> `/remediate` and `/triage` so the class can't come back."

---

## Appendix A — Confirmed seam bugs found while writing this playbook

File these as GitHub issues (`type: bug`, `area: scoring`/`area: infra`) before or
alongside Phase 1 — they're the proof-of-concept targets:

| # | Bug | Location | Class (§7) | Fix |
| - | --- | -------- | ---------- | --- |
| A | Insights upload reports 200 success even when the durable upsert fails | `apps/web/app/api/insights/route.ts:87,104` | 1 | Check `stored`; return 500 on persist failure |
| B | Snapshot NOT-NULL numerics forwarded with no `?? 0`; `undefined` → `23502` → silent drop inside `after()` | `apps/web/lib/db/snapshots.ts:113-137` | 2 | Default the numerics; assert persistence |
| C | Only non-`maybeSingle()` write; `.single()` throws on 0/2 rows, feeding bug A | `apps/web/lib/db/tool-insights.ts:96` | 4 | `.maybeSingle()` + explicit handling |
| D | Durable snapshot write deferred inside `after()` — freeze-truncation risk | `apps/web/lib/profile/public-profile.ts:106-116` via `badge.svg/route.ts:257`, `u/[handle]/page.tsx:169` | 8 | Keep the durable write awaited; defer only caches |
| E | No cron last-run timestamp / staleness gate — a cron that stops or does no work is unpaged | `apps/web/app/api/cron/*`, `apps/web/app/api/health/route.ts` | 10 | §6.1 heartbeat + health degrade condition |
| F | Client errors unmonitored: `global-error.tsx` discards the error, no `unhandledrejection`, non-2xx fetches unreported | `apps/web/app/global-error.tsx`, client hooks | — | §6.2 client-error capture |

---

_Adapted from a portable reliability-hardening playbook. The source's specifics
(single Postgres, RPC + CHECK constraints, Sentry, a job queue) are incidental;
Chapa's realities (Supabase + Redis two-store, fail-open everywhere, `after()`
deferral, webhook alerts, no real-DB tests) are what this version encodes. The
principles are the portable part: **test the seams with the real stack, assert
persistence not just status, make silence impossible, and fix the class not the
site.**_
