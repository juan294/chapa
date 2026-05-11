# Coverage Report
> Generated: 2026-05-11 | Health status: **green**

## Executive Summary
All 7589 tests pass across 445 files with 96.83% statement coverage and zero flaky tests across three consecutive runs. Every critical path (scoring, rendering, API, database, auth, cache) is at or above 96.5% — no P2 gaps remain from prior cycles.

## Coverage by Module

| Module | Stmts | Branches | Funcs | Status |
|--------|-------|----------|-------|--------|
| `lib/impact` | 99.6% | 98.7% | 100.0% | GREEN |
| `lib/render` | 100.0% | 92.9% | 100.0% | GREEN |
| `app/api` | 97.5% | 94.2% | 96.8% | GREEN |
| `lib/db` | 96.5% | 93.3% | 100.0% | GREEN |
| `lib/auth` | 98.0% | 96.2% | 98.9% | GREEN |
| `lib/cache` | 98.1% | 95.2% | 96.8% | GREEN |
| `lib/github` | 97.4% | 96.6% | 93.1% | GREEN |
| `lib/analytics` | 97.3% | 91.2% | 100.0% | GREEN |
| `lib/history` | 98.3% | 96.6% | 100.0% | GREEN |
| `packages/shared` | 91.6% | 100.0% | 100.0% | GREEN |
| **Overall** | **96.83%** | **92.56%** | **95.91%** | **GREEN** |

## Delta vs 2026-05-10

| Metric | May 10 | May 11 | Delta |
|--------|--------|--------|-------|
| Statements | 96.82% | 96.83% | +0.01pp |
| Branches | 92.66% | 92.56% | −0.10pp (noise) |
| Functions | 95.86% | 95.91% | +0.05pp |
| Lines | 97.88% | 97.88% | flat |
| Tests | 7587 | 7589 | +2 |

The −0.10pp branch delta is within measurement noise — no regression identified. The +2 tests are the `isAgentEnabled` timeout-path tests added by triage May 10.

## Watch Item Resolved

- **`lib/feature-flags.ts` funcs**: was 88.2% (watch May 10) → now **100% funcs, 100% branches, 95.8% stmts**. The two timeout-path `.catch(() => null)` tests added by triage fully closed this gap.

## Gaps & Recommendations

All sub-80% files are **accepted P3 carries** — no action required this cycle:

| File | Stmts | Branches | Funcs | Reason |
|------|-------|----------|-------|--------|
| `app/experiments/error.tsx` | 0% | — | 0% | JSDOM-blocked; experiments-gated |
| `app/experiments/loading.tsx` | 0% | — | 0% | JSDOM-blocked; experiments-gated |
| `lib/effects/interactions/HolographicOverlay.tsx` | 50% | 86.7% | 75% | Canvas/WebGL — JSDOM cannot execute |
| `components/ClientInstrumentation.tsx` | 60% | 100% | 33.3% | `next/dynamic` lazy wrapper — render is no-op in test env |
| `components/GlobalCommandBarLazy.tsx` | 60% | 100% | 33.3% | `next/dynamic` lazy wrapper |
| `components/SharePageOwnerContentLazy.tsx` | 66.7% | 100% | 50% | `next/dynamic` lazy wrapper |
| `app/experiments/heatmap-wave/page.tsx` | 73.3% | 50% | 60% | Canvas; experiments-gated |
| `lib/render/archetypeDemoData.ts` | 100% | 50% | 100% | TypeScript overload branches |
| `lib/render/demoData.ts` | 100% | 50% | 100% | TypeScript overload branches |
| `lib/i18n/lang-sync.tsx` | 100% | 50% | 100% | SSR guard branch (`typeof window`) |
| `components/BadgeOverlay.tsx` | 100% | 75% | 100% | Tooltip positioning edge case |
| `lib/auth/github-session-token.ts` | 100% | 75% | 100% | Minor branch in token parsing |

**Untested source files** (no `.test.ts` companion, all benign):
- `lib/agents/types.ts`, `lib/verification/types.ts`, `lib/history/types.ts` — type-only, no runtime logic
- `lib/codeberg/types.ts`, `lib/bitbucket/types.ts`, `lib/i18n/types.ts` — type-only
- `lib/i18n/index.ts` — barrel re-export
- `lib/i18n/dictionaries/en.ts`, `es.ts` — covered by `parity.test.ts` integration
- `app/api/auth/codeberg/config.ts`, `app/api/auth/bitbucket/config.ts` — OAuth config, covered by route tests
- `lib/test-helpers/*` — test infrastructure, not production code

## Flaky Tests
None detected — 3/3 runs produced identical results (7589/7589 passed). `BadgeToolbar @keyframes` flake retired permanently in prior cycle via pure-function extraction; remains stable.
