# Deep Engineering Audit — Implementation Plan

**Source research:** `docs/research/2026-04-18-deep-engineering-audit.md`
**Branch:** `develop`
**Date:** 2026-04-20
**Phase doc:** RPI `/plan` (per `.claude/rules/rpi-details.md`)

---

## 1. Policy decisions resolved with the user

| Q | Resolution | Impact on plan |
|---|---|---|
| Q1 — `burst_activity` threshold (§3.3) | **Code is authoritative; JSDoc is wrong.** Update `utils.ts:83` JSDoc `>= 20` → `>= 100`. | Phase 1 |
| Q2 — `/api/telemetry` auth (§3.1) | **Keep unauthenticated.** `chapa-cli/src/telemetry.ts` posts to it; adding auth would break the CLI. Instead: harden rate-limit, add a `verified: false` column, document the trust model. | Phase 3 |
| Q3 — Verification payload coverage (§3.2) | **Add missing fields + bump payload `v` byte.** Accept legacy 32-char hashes for a **90-day** deprecation window via the existing `HASH_PATTERN` (`verify/[hash]/route.ts:7` already supports `8|16|32` hex). | Phase 2 |

## 2. Accepted-risks contract still honored

No phase in this plan touches an item in `docs/accepted-risks.md`. Specifically preserved:
- HMAC 128-bit truncation (#401) — unchanged
- Redis rate-limit fail-open (#398) — unchanged
- Component-level admin gating (#402) — unchanged
- Wildcard CORS on `/api/verify/[hash]` (#596) — unchanged
- Share-page `dangerouslySetInnerHTML` (#596) — unchanged
- Cron fail-open when `CRON_SECRET` unset (#685) — unchanged
- Solo boundary at 0.15 (`constants.ts:43`) — unchanged

## 3. Phase map

```
 P1 scoring-correctness ─┐
                         │ (sequential: scoring change requires cache bump)
 P4 cache-versioning ────┤
                         │
 P11 structural ─────────┤ (touches packages/shared/src/constants.ts, conflicts with P1)
                         │
 P10 test-coverage ──────┤ (touches test files updated throughout)
                         │
 P12 performance ────────┘

 [batch-eligible] parallel group A — can all run via /batch after P1:
   P2 verification-v2      (own files)
   P3 telemetry-hardening  (own files)
   P5 admin-hardening      (own files)
   P6 auth-details         (own files)
   P7 data-hygiene         (own files)
   P8 render               (own file)
   P9 plausibles           (own files)
```

## 4. Phase summary table

| # | Title | Batch | Depends on | Tests-first files |
|---|---|---|---|---|
| 1 | [Scoring correctness & JSDoc alignment](./2026-04-20-deep-engineering-audit-fixes-phases/phase-1.md) | — | — | `heatmap-evenness.test.ts`, `recency.test.ts`, `stats-aggregation.test.ts` |
| 2 | [Verification v2 payload + secret assert + timing-safe lookup](./2026-04-20-deep-engineering-audit-fixes-phases/phase-2.md) | [batch-eligible] | — | `hmac.test.ts`, `verify/[hash]/route.test.ts`, `store.test.ts` |
| 3 | [Telemetry hardening (unauth, `verified=false`)](./2026-04-20-deep-engineering-audit-fixes-phases/phase-3.md) | [batch-eligible] | — | `telemetry/route.test.ts`, `db/telemetry.test.ts` |
| 4 | [Cache versioning + insights→snapshot invalidation](./2026-04-20-deep-engineering-audit-fixes-phases/phase-4.md) | — | P1 | `snapshot-cache.test.ts`, `craft-cache.test.ts`, `insights/route.test.ts` |
| 5 | [Admin hardening](./2026-04-20-deep-engineering-audit-fixes-phases/phase-5.md) | [batch-eligible] | — | 5 route tests + `health/route.test.ts` |
| 6 | [Auth details (OAuth nonce, bearer trim, secret-length assert)](./2026-04-20-deep-engineering-audit-fixes-phases/phase-6.md) | [batch-eligible] | — | `resolve-request-auth.test.ts`, `callback/route.test.ts`, `session.test.ts` |
| 7 | [Data-layer hygiene](./2026-04-20-deep-engineering-audit-fixes-phases/phase-7.md) | [batch-eligible] | — | `db/campaigns.test.ts`, `email/campaigns.test.ts`, `history/snapshot.test.ts`, `og-image/route.test.ts` |
| 8 | [Render — all-zero radar fallback](./2026-04-20-deep-engineering-audit-fixes-phases/phase-8.md) | [batch-eligible] | — | `RadarChart.test.ts` |
| 9 | [Plausibles: emailId guard + CLI poll rate-limit](./2026-04-20-deep-engineering-audit-fixes-phases/phase-9.md) | [batch-eligible] | — | `resend/route.test.ts`, `cli/auth/poll/route.test.ts` |
| 10 | [Test coverage — close observed gaps](./2026-04-20-deep-engineering-audit-fixes-phases/phase-10.md) | — | P1, P2, P3, P4 | `pipeline.test.ts`, new fixtures |
| 11 | [Structural / maintainability](./2026-04-20-deep-engineering-audit-fixes-phases/phase-11.md) | — | P1 | `constants.test.ts` |
| 12 | [Performance hardening](./2026-04-20-deep-engineering-audit-fixes-phases/phase-12.md) | — | P4 | 5 files |

## 5. Global success criteria

**Automated (blocking merge to develop):**
- `pnpm run typecheck` clean
- `pnpm run lint` clean
- `pnpm run test` — all existing tests pass + all new tests (tracked per phase) pass
- Each phase's new tests added to CI run
- No new `any` types introduced in `lib/db/*` (except justified with ESLint disable + comment)
- `docs/accepted-risks.md` unchanged (contract preserved)

**Manual (require human verification):**
- Badge verification page at `/verify/:hash` still resolves for a pre-existing badge (legacy 32-char hash path) — spot-check one historical badge
- Studio save still round-trips after P4 cache-key shape change
- Admin dashboard still loads (P5 doesn't regress admin UX)
- CLI `chapa` still merges EMU stats after P3 (telemetry not broken)

## 6. RPI execution discipline

- Each phase is its own `/implement` conversation. `/clear` between phases.
- Atomic loop per phase: **implement → review → fix → approve → `/simplify` → verify**.
- After each phase: STOP and wait for human confirmation before moving on.
- `[batch-eligible]` phases (P2, P3, P5, P6, P7, P8, P9) can be parallelized via `/batch` once P1 is merged.
- P10 (test-coverage) intentionally runs *after* P1–P4 so it exercises the finalized shapes.
- P11 runs after P1 because it consolidates the scoring thresholds P1 edits.
- P12 runs after P4 because the badge-render lock depends on the versioned cache key.

## 7. Out of scope for this plan

- Live Supabase RLS audit — tracked as a separate operational task.
- Core Web Vitals measurement — not in the research; out of scope.
- Bundle-size analysis — not in the research; out of scope.
- Anything touching `main` — all work lands on `develop`.

## 8. Issue tracking

Each phase opens its own GitHub issue with `type: fix`, `type: chore`, or `type: security` + appropriate `area:` labels. Issue numbers referenced in commits via `Fixes #N` (see CLAUDE.local.md issue workflow).
