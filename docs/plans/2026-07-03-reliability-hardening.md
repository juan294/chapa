# Implementation Plan — Chapa Reliability-Hardening Playbook

> **Status:** Ready to implement. RPI plan phase output.
> **Research input:** `docs/playbooks/reliability-hardening-playbook.md` (contains
> the full codebase investigation with `file:line` references — treat it as the
> research doc).
> **Date:** 2026-07-03

---

## 1. Goal

Close the seam-bug class in Chapa: user-facing 5xx on legal input **and** silent
data loss (a durable write that fails but reports success). Today every test mocks
the layer below it, so no test runs a real client payload through real Postgres.
This plan stands up a real-stack contract layer, rolls it across the write surface,
adds a real-device journey that re-reads the DB, makes silent failures loud, and
writes the lessons into process.

## 2. Decisions locked (from clarification)

| # | Decision | Consequence for the plan |
| - | -------- | ------------------------ |
| D1 | **Write philosophy: case-by-case per route.** Every durable-write failure on legal input must be *observable* (captured to PostHog/alert at minimum). It returns **5xx or a client-visible `persisted:false`** where the data is unrecoverable (snapshots), and is **graceful-but-logged** where the value is recomputable from the same input (insights — the CLI can re-upload). | Each write route gets a **loud / graceful-but-logged** classification (§5). The matrix asserts *persistence* on `loud` routes and *observability-signal-fired* on `graceful` routes. Appendix-A bug A (insights) becomes "capture + `persisted` flag," not a 5xx. |
| D2 | **Real-DB CI: `supabase start` (full local stack via Supabase CLI) + an in-memory Redis fake, run on every PR.** | New `contract` CI job boots the Supabase CLI stack and applies the 27 migrations; supabase-js hits real PostgREST so real constraint error codes (`23505`/`23502`/`22003`/`PGRST116`) surface. Redis is a faithful in-memory fake of `lib/cache/redis.ts` (avoids an Upstash HTTP-shim sidecar; the surface is small and centralized). A fidelity test pins the fake to the documented Upstash semantics. |

**Why the fake for Redis, not a real service:** `@upstash/redis` speaks Upstash's
**HTTP REST** protocol, not the Redis wire protocol — a `redis:7` service container
needs a `serverless-redis-http` sidecar to work with it. The `lib/cache/redis.ts`
surface is ~15 centralized functions with one subtle behavior (`cacheSetNxStatus`
detects newness via the SET return, not a read-back). A faithful in-memory fake +
a fidelity contract test is cheaper and just as safe for the write-path bugs we're
hunting (which live in Postgres constraints, not Redis semantics).

## 3. Non-goals

- Not changing Chapa's fail-open philosophy for **reads and caches** — that's
  correct and stays. D1 applies only to **durable user writes**.
- Not building a central PG-error-code → HTTP mapper up front (§8 of the playbook:
  defer until the inline pattern passes ~5 sites).
- Not adding CHECK constraints / PG enums to the schema (separate hardening track;
  out of scope here).
- No production deploys or Vercel changes without explicit authorization (project
  rules). CI infra changes on `develop` only.

## 4. Phase overview & dependency graph

| Phase | Title | Depends on | Batch | Primary artifact |
| ----- | ----- | ---------- | ----- | ---------------- |
| **1** | Real-DB CI foundation + payload-matrix harness (POC on 2 routes) | — | no (foundational) | `contract` CI job + `payload-matrix.ts` + Redis fake + 2 POC tests |
| **2** | Roll the matrix across all write endpoints + registration-checker gate | Phase 1 | no (shares `ci.yml` with P3) | ~28 matrix tests + `check-write-registration.ts` + CI gate |
| **3** | Real-journey phone E2E: offline + Supabase re-read | Phase 1 | no (shares `ci.yml` with P2) | mobile Playwright project + journey spec |
| **4** | Silent-failure canaries: cron heartbeat, health gate, client-error capture, nightly prod probe | — (independent files) | **[batch-eligible]** | health-gate + heartbeat + client capture + nightly workflow |
| **5** | Process guarantees | — (docs only) | **[batch-eligible]** | edits to `/remediate`, `/triage`, `/pre-launch`, CLAUDE.md |

**Dependency graph:**

```
Phase 1 ──┬──> Phase 2 ──┐
          └──> Phase 3 ──┴──> (Phase 2 and 3 both edit ci.yml — run sequentially)
Phase 4  (independent, [batch-eligible] — run any time)
Phase 5  (docs only, [batch-eligible] — run any time)
```

**Batch guidance for `/implement`:** Phase 4 and Phase 5 touch files disjoint from
each other and from Phases 1-3 (Phase 4: health/cron/analytics/global-error +
a *new* workflow file, not `ci.yml`; Phase 5: docs only) → both `[batch-eligible]`,
runnable in parallel with the Phase 1→2/3 spine. Phases 2 and 3 both edit `ci.yml`
(P2 adds a checker step to the `contract` job; P3 edits the `e2e` job) so they are
**not** mutually batch-eligible — sequence them (2 then 3, or coordinate the
`ci.yml` edits into distinct job blocks). Phase 1 must land before either.

## 5. Route classification (D1) — used by Phases 2 & 4

Every state-mutating route, classified `loud` (failure is unrecoverable → 5xx or
`persisted:false` + capture) vs `graceful` (recomputable/retriable → 200 but log +
capture). Drives the matrix's assertion mode. Full route inventory is in the
playbook §4.1.

| Route | Class | Rationale / matrix assertion |
| ----- | ----- | ---------------------------- |
| `POST /api/supplemental` | **loud** | Durable EMU stats feed scoring; loss corrupts scores. Persistence re-read. |
| `POST /api/recalculate`, `POST /api/refresh` | **loud** | Snapshot replace = lifetime history; loss is permanent. Persistence re-read. |
| `GET /api/auth/{bitbucket,codeberg,gitlab}/callback` | **loud** | Linked-platform token loss silently breaks multi-platform scoring. Persistence re-read. |
| `GET /api/auth/callback` (`dbUpsertUser`) | **graceful** | User row is re-derivable on next login; but capture on failure. No-5xx + capture. |
| `POST /api/insights` | **graceful** | CLI can re-upload; score recomputable. **Bug A fix = `persisted` flag + capture.** No-5xx + signal-fired. |
| `PUT /api/studio/config` | **loud** | User's saved customization; silent loss is user-visible data loss. Persistence re-read. |
| `POST /api/admin/campaigns` (+ PATCH/DELETE/send/test), `PATCH /api/admin/feature-flags`, `POST /api/admin/bulk-recalculate` | **loud** | Admin writes; must not silently no-op. Persistence re-read. |
| `POST /api/telemetry` | **graceful** (by design) | Best-effort fire-and-forget sink; no-5xx only, no persistence assertion. |
| `POST /api/challenge` | **graceful** | Email-only, no durable DB row; no-5xx only. |
| `POST /api/cli/auth/approve`, `GET /api/cli/auth/poll`, `GET /api/auth/login`, `POST /api/auth/logout`, `POST /api/generate` | **graceful** | Redis-only / cache-warming; no-5xx + (where applicable) Redis-state assertion. |
| `GET /api/notifications/unsubscribe` | **loud** | HMAC-token Supabase update; a silently-failed unsubscribe is a compliance issue. Persistence re-read (drive with a valid signed token). |

**Exempt from the matrix** (registration-checker exemption map, Phase 2):
`POST /api/webhooks/resend` (Svix HMAC, provider payload), the three `GET /api/cron/*`
(secret-authed, no body — covered by Phase 4 freshness gates), `POST/DELETE /api/admin/agents/run`
(dev-only, prod-blocked). Body-less writes (`generate`, `recalculate`) get a single
real-stack smoke test rather than a full fuzz, but stay **registered**.

## 6. Appendix-A seam bugs — where each is fixed

| Bug | Fix lands in | Approach (per D1) |
| --- | ------------ | ----------------- |
| A — insights 200-on-failed-persist | **Phase 1** (POC) | `graceful`: add `persisted:false` to the response + `captureServerError`/log when `stored == null`. Matrix proves no-5xx + signal fired. |
| B — snapshot NOT-NULL numerics forwarded w/o `?? 0` | **Phase 2** | `loud`: default the numerics (or validate upstream); matrix on `recalculate`/`refresh` asserts persistence, red→green. |
| C — `.single()` at `tool-insights.ts:96` | **Phase 1** | Switch to `.maybeSingle()` + explicit handling; unblocks bug A's null path. |
| D — durable snapshot write inside `after()` | **Phase 4** | Move the durable `dbInsert/ReplaceSnapshot` onto the awaited path; keep only cache invalidation in `after()`. |
| E — no cron last-run timestamp / staleness gate | **Phase 4** | Heartbeat `cron:lastrun:<name>` written at end-of-work + health degrade condition. |
| F — client errors unmonitored | **Phase 4** | `global-error.tsx` reports; `unhandledrejection`/`onerror` handler; non-2xx client-fetch capture. |

**File these as GitHub issues** (per the repo's issue-driven workflow) before
starting the phase that fixes each: `type: bug` + priority + area. A→C/scoring,
B→scoring, D→scoring/infra, E→infra, F→ux/infra.

## 7. Cross-cutting design: the contract test project

A **separate Vitest project** isolates real-stack contract tests from the mocked
unit suite so (a) they only run in the `contract` CI job with the DB up, and (b)
their new error-mapping branches don't perturb the global coverage ratchet
(playbook §8). Shape:

```
vitest.config.ts            (existing) — unit suite, mocked, coverage ratchet
vitest.config.contract.ts   (new)      — include apps/web/**/*.contract.test.ts,
                                          setupFiles: contract-setup.ts (env + supabase reset),
                                          NO coverage thresholds, testTimeout ~30s
package.json                            — "test:contract": "vitest run -c vitest.config.contract.ts"
```

Contract tests use the naming `*.contract.test.ts` and are **excluded** from the
default `test` include so `pnpm run test` stays fast and mock-only.

## 8. Global risks & mitigations

| Risk | Mitigation |
| ---- | ---------- |
| **CI env parity** (`lib/env.ts` never throws; a missing var → silent fake/no-op that masks the bug). | The `contract` job exports the *exact* vars the routes read against the local stack; a `contract-setup.ts` assertion fails loudly if any required var is absent. Mirror in a local `.env.contract`. |
| **Skipped job ≠ passing job** (P1 job downstream of a failing `test` gets skipped). | The `contract` job `needs:` only checkout/install, **not** `test` — it runs independently so a unit failure can't silently skip the matrix. |
| **`after()` throws outside request scope** in contract runtime. | Contract setup mocks `after()` to run its callback inline-and-awaited (same pattern already in `insights/route.test.ts:77`). |
| **supabase start boot time / flakiness in CI.** | Cache the CLI; boot once per job; bounded-retry the health-wait. Seed/cleanup best-effort (warn, don't throw). |
| **Redis fake drifts from real Upstash.** | A `redis-fake.contract.test.ts` pins the fake to documented Upstash behaviors (esp. `cacheSetNxStatus` returning `"OK"`/`null`, auto-deserialization, `incr` returning numbers). |
| **Coverage ratchet dip from new branches.** | Contract project has no thresholds; any branch that must count toward the unit ratchet gets a unit test too. Never lower the ratchet. |
| **Harness flagged as dead code by knip.** | Add `apps/web/test/contract/**` to the knip ignore list. |
| **CI cost** (deployment-safety: every run costs money). | Batch the Phase-2 rollout (all routes in one PR, not one-per-push). The `contract` job adds ~1-2 min/PR — accepted per D2. |

## 9. Success criteria (whole plan)

**Automated:**
- `pnpm run test:contract` runs against a real Supabase stack + Redis fake in CI on
  every PR and is green.
- The payload matrix fires the full legal payload space of every non-exempt write
  route with **zero 5xx**, and asserts persistence (loud) / signal-fired (graceful)
  per §5.
- `check-write-registration.ts --max-unregistered=0` gates CI; adding an
  unregistered, non-exempt write handler fails the build.
- A phone-profile E2E journey (login→generate→badge→studio→share→refresh, with
  craft / non-craft / linked-platform variety and an offline→online toggle) passes
  and its Supabase re-read confirms per-shape persistence.
- `/api/health` degrades to 503 when a cron heartbeat is stale or GitHub quota is
  below floor; a contract test covers each new degrade condition.
- Client errors (`global-error`, `unhandledrejection`, non-2xx fetch) emit capture
  events.
- A nightly scheduled workflow runs a read-only prod probe.

**Manual:**
- Reproduce bug A: force `dbUpsertToolInsights` to return null against the real
  stack; confirm the response now carries `persisted:false` and a capture event
  fired (previously silent 200).
- Confirm the six Appendix-A bugs each have a merged fix + a real-stack regression
  test (not a unit-mock repro).
- Skim the process-doc edits (Phase 5) for accuracy.

## 10. Phase files

- [Phase 1 — Foundation + harness](2026-07-03-reliability-hardening-phases/phase-1.md)
- [Phase 2 — Roll matrix + registration gate](2026-07-03-reliability-hardening-phases/phase-2.md)
- [Phase 3 — Phone-journey E2E](2026-07-03-reliability-hardening-phases/phase-3.md)
- [Phase 4 — Silent-failure canaries](2026-07-03-reliability-hardening-phases/phase-4.md)
- [Phase 5 — Process guarantees](2026-07-03-reliability-hardening-phases/phase-5.md)

Each phase is its own conversation. STOP after each phase and wait for human
confirmation (RPI protocol). Run all automated verification after each phase.
