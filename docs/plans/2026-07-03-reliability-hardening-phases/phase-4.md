# Phase 4 — Silent-failure canaries

**Depends on:** nothing structurally (touches files disjoint from Phases 1-3).
**Batch:** **[batch-eligible]** — no `ci.yml` edit (adds a *new* workflow file), no
overlap with the harness/route/e2e files. Can run in parallel with the Phase 1→2/3
spine and with Phase 5.
**Goal:** make the failures that hide loud — a cron that stops or does no work,
unmonitored client errors, a durable write truncated by `after()`, and a prod that's
only probed at deploy time. Builds on Chapa's existing central alert path
(`withErrorCapture` → PostHog + `CHAPA_ALERT_WEBHOOK_URL`).

Fixes Appendix-A bugs D, E, F.

---

## 4.1 Cron heartbeat + health degrade gate (bug E)

**Problem:** no cron writes a last-run timestamp; `/api/health` computes Redis
`dbsize` and GitHub `remaining` but gates on neither. A cron that stops firing, or
runs and does zero work (`process-campaigns` → `status:"idle"`), goes unpaged.

**Heartbeat — edit the three cron handlers** (`apps/web/app/api/cron/{warm-cache,
sync-audience,process-campaigns}/route.ts`): at **end of successful work** (not the
start — the source's bug was stamping before the work), write:

```
await cacheSet(`cron:lastrun:${name}`, Date.now(), { ex: 60 * 60 * 48 })  // 48h TTL
```

Add a `cacheGetCronLastRun(name)` helper in `lib/cache/redis.ts` (numeric read).

**Health gate — edit `apps/web/app/api/health/route.ts`:** add always-run degrade
conditions (compute in the public path so 503 fires for uptime monitors, not just
admins):

```
- staleCron = any name where (now - cron:lastrun:<name>) > threshold(name)
    warm-cache: 26h, sync-audience: 26h, process-campaigns: 26h  (daily + slack)
    // treat "never ran" (null) as NOT stale for the first N hours after deploy to
    // avoid false alarms on a fresh environment — gate on a deploy-age grace window.
- githubQuotaLow = githubRateLimit.remaining < FLOOR (e.g. 500)
- status "degraded" -> 503 if any existing dep unhealthy OR staleCron OR githubQuotaLow
- fire captureOperationalAlert P1 "health_degraded" with which condition tripped
- surface dbsize count in the admin payload (stop discarding it)
```

**Tests (unit, mocked — go in the normal suite):** extend
`apps/web/app/api/health/route.test.ts` — stale heartbeat → 503; fresh → 200; low
GitHub quota → 503; deploy-age grace window suppresses the null-heartbeat false
alarm. Add a cron-handler test asserting the heartbeat is written **after** work.

## 4.2 Move durable snapshot write off `after()` (bug D)

**Problem:** `runPublicProfileSideEffects` performs the durable
`dbInsert/ReplaceSnapshot` inside `after()` (`badge.svg/route.ts:257`,
`u/[handle]/page.tsx:169` → `lib/profile/public-profile.ts:106-116`); a serverless
freeze after the response flushes can truncate it → lost lifetime history.

**Fix:** split `runPublicProfileSideEffects` into:

```
- persistProfileSnapshot(handle, materialized)   // AWAITED before response returns
    -> dbInsert/ReplaceSnapshot + verification upsert + clear dirty marker
- deferProfileCacheWork(handle, ...)             // stays in after(): cache warms,
    revalidate, non-durable side-effects
```

Callers (`badge.svg/route.ts`, `u/[handle]/page.tsx`) `await persistProfileSnapshot`
on the response path, then `after(deferProfileCacheWork)`. Keep the
`clearStatsDirty`-only-if-persisted logic (leaves the dirty marker for retry on
failure). Mind the latency budget — the snapshot write is one upsert; measure it
doesn't materially slow the badge route (it already runs synchronously in the
refresh/recalculate paths).

**Regression test:** the Phase-3 journey re-read already covers this end-to-end; add
a unit/contract test that `persistProfileSnapshot` is awaited (not deferred) by
asserting the row exists immediately after the handler resolves, before any
`after()` flush.

> If Phase 4 runs before Phase 3, add a minimal contract test here that drives the
> badge route against the real stack and asserts the snapshot row is present
> synchronously. If Phase 3 has landed, its journey re-read suffices.

## 4.3 Client-error capture (bug F)

**Problem:** `apps/web/app/global-error.tsx` renders static UI and **discards the
`error`**; no `window.onerror`/`unhandledrejection`; non-2xx client fetches
(`useTrendData`, `useOwnerCacheWarm`, `useSession`) are never reported.

**Fix:**
- `global-error.tsx`: on mount, POST the error (message + truncated stack, sanitized)
  to a lightweight client-error sink — reuse `/api/telemetry` with a new
  `error_category` or add a small `/api/client-error` route (prefer reusing
  telemetry to avoid a new write surface + a new matrix registration).
- Add a global handler (in the root client provider or a small `use client`
  component mounted in `layout.tsx`): `window.addEventListener("unhandledrejection")`
  + `"error"` → `trackEvent("client_error", {...})` via PostHog.
- Add a shared client-fetch wrapper (or extend the existing hooks' `!response.ok`
  branches) to emit a `client_api_error` PostHog event on non-2xx — the user's actual
  experience.

**Alert rule (documented, verifiable where possible — playbook §6.2):** a rule on
the **rate** of `client_error` / `client_api_error` events. Since Chapa alerts via
webhook + PostHog (no Sentry), document the rule (trigger + target + how verified) in
`docs/` and, if a PostHog API check is feasible, add a read-only verification.

**Tests:** component test that `global-error` fires the POST on mount; a test that
the global handler forwards `unhandledrejection`; a hook test that a non-2xx response
emits the event. (jsdom env, normal suite.)

## 4.4 Nightly production probe (playbook §6.3)

**New `.github/workflows/nightly-prod-probe.yml`** (a *separate* workflow — a nightly
failure is not a "roll back this deploy" signal; do NOT reuse `ci.yml`):

```
on: { schedule: [{ cron: "0 5 * * *" }], workflow_dispatch: {} }   # 05:00 UTC, mirror gitleaks cadence
job probe:
  - checkout + install + Playwright chromium
  - run a READ-ONLY synthetic journey (reuse smoke.spec.ts style + __chapa_smoke=1)
    against DEPLOYMENT_SMOKE_BASE_URL with DEPLOYMENT_SMOKE_STRICT=true
  - deep authorized /api/health probe (admin token) — assert 200 status:"ok",
    all deps ok, no stale cron
  - NO environment approval gate (unattended; a gate would hang forever)
  - on failure: upload report; (optional) POST to CHAPA_ALERT_WEBHOOK_URL
```

Read-only only — no writes against prod. Reuse the existing
`DEPLOYMENT_SMOKE_BASE_URL` secret + synthetic user.

---

## Success criteria

**Automated:**
- [ ] Each cron writes `cron:lastrun:<name>` after successful work; a handler test
      asserts ordering (heartbeat after work).
- [ ] `/api/health` → 503 on stale heartbeat OR low GitHub quota; 200 otherwise;
      deploy-age grace suppresses the fresh-env false alarm. Covered by
      `health/route.test.ts`.
- [ ] `persistProfileSnapshot` is awaited on the response path; the snapshot row
      exists synchronously after the handler resolves (test).
- [ ] `global-error` reports on mount; global `unhandledrejection`/`onerror` handler
      forwards; non-2xx client fetch emits an event (tests green).
- [ ] `nightly-prod-probe.yml` present, scheduled, read-only, no approval gate;
      `workflow_dispatch` runs green against prod.
- [ ] `pnpm run typecheck ; pnpm run lint ; pnpm run test` clean.

**Manual:**
- [ ] Trigger `nightly-prod-probe` via `workflow_dispatch`; confirm it passes and
      touches nothing on prod (read-only).
- [ ] Simulate a stale cron locally (set an old `cron:lastrun`); confirm
      `/api/health` returns 503 + a `health_degraded` alert payload is built.
- [ ] Confirm alert rules for client-error rate are documented (trigger/target/verify).

## Files touched

- edit: `apps/web/app/api/cron/{warm-cache,sync-audience,process-campaigns}/route.ts`
  (heartbeat), `apps/web/lib/cache/redis.ts` (heartbeat helpers),
  `apps/web/app/api/health/route.ts` + `route.test.ts` (degrade gate),
  `apps/web/lib/profile/public-profile.ts` +
  `apps/web/app/u/[handle]/badge.svg/route.ts` + `apps/web/app/u/[handle]/page.tsx`
  (bug D), `apps/web/app/global-error.tsx` (bug F), root layout/provider (global
  handler), the client hooks / a shared fetch wrapper (non-2xx capture),
  `apps/web/app/api/telemetry/route.ts` (if reused as the client-error sink — note
  it's already registered/exempt, no new matrix entry)
- new: `.github/workflows/nightly-prod-probe.yml`, client-error handler component,
  alert-rules doc under `docs/`

> **Batch note:** if reusing `/api/telemetry` for client errors, no new write route
> is added → no Phase-2 registration churn. If you add `/api/client-error` instead,
> it must be registered in the matrix (couples this phase to Phase 2's checker) —
> prefer reuse to keep Phase 4 batch-independent.

## GitHub issues

Bug D (`type: bug, priority: high, area: scoring`), Bug E
(`type: enhancement, priority: medium, area: infra`), Bug F
(`type: enhancement, priority: medium, area: ux`).
