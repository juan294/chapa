---
plan: close-all-open-issues
created: 2026-04-28
goal: Close all 58 remaining open GitHub issues across 4 minor releases
state: planned
---

# Close All Open Issues — Roadmap to v2.12.0

## Goal

Close every open GitHub issue in `juan294/chapa`. Today's count: **58** (down
from 59 — `#710` closed as resolved by v2.8.0 release).

Group the work into **four independent minor releases** so any release can ship
on its own without blocking the others. Each release is its own RPI cycle:

```
v2.9.0  -> v2.10.0 -> v2.11.0 -> v2.12.0
```

Each release MUST stay green on CI, MUST close every issue listed for it, and
MUST be merged via the standard `develop -> main` PR with explicit user
authorization (Production Safety rules apply).

## Why this structure

1. **Foundation first** (v2.9.0). Observability (`withErrorCapture`,
   structured logger, typed env) plus high-confidence small fixes. Future
   releases can use these new primitives.
2. **Performance next** (v2.10.0). The biggest user-visible wins
   (bundle-size reduction, share-page TTFB) sit here, after the foundation
   is in place.
3. **Architecture refactor** (v2.11.0). The wave-2 architect cluster
   (platform fetcher consolidation, hooks, tsconfig base, shared package
   build, dead-code, route-owned modules) — plus ADRs for the strategic
   decisions we are *not* making.
4. **Polish + older + tooling** (v2.12.0). UX/QA/security/devops
   long-tail cleanup, ESLint 10 migration, the two older bugs (`#516`,
   `#680`).

## Issue map

### v2.9.0 — Foundation + Quick Wins (10 issues)

| Phase | Issues | Eligible for `/batch`? |
|---|---|---|
| `phase-9A.md` | `#707` | yes (foundation A) |
| `phase-9B.md` | `#712` | yes (foundation B) |
| `phase-9C.md` | `#749` | yes (foundation C) |
| `phase-9D.md` | `#702`, `#750` | yes (warm-cache cluster) |
| `phase-9E.md` | `#726`, `#731`, `#766`, `#767`, `#768` | yes (one-line fixes) |

`9A`, `9B`, `9C`, `9D`, `9E` are all `[batch-eligible]` — they touch
disjoint files. `/batch` can run them in parallel.

### v2.10.0 — Bundle + Share-Page Perf (11 issues)

| Phase | Issues | Notes |
|---|---|---|
| `phase-10A.md` | `#798`, `#791` | Owner-only dynamic split |
| `phase-10B.md` | `#719`, `#729`, `#754` | Layout chunk lazy-loading |
| `phase-10C.md` | `#720`, `#800`, `#759` | Share-page TTFB hot path |
| `phase-10D.md` | `#757`, `#758`, `#760` | Per-route perf |

`10A` and `10B` both touch the share page; run sequentially.
`10C` and `10D` can run in parallel after `10A` lands. Markers in each phase.

### v2.11.0 — Architect Refactor + ADRs (13 issues)

| Phase | Issues | Notes |
|---|---|---|
| `phase-11A.md` | `#744`, `#747` | Platform fetcher unification + `normalizeStats` |
| `phase-11B.md` | `#748`, `#746`, `#772` | Shared build + tsconfig base + ES2022 |
| `phase-11C.md` | `#745` | Hooks consolidation |
| `phase-11D.md` | `#811`, `#814`, `#774` | Module boundaries + dead-code + store primitive |
| `phase-11E.md` | `#771`, `#773`, `#815` | Three ADRs (close-and-defer) |
| `phase-11F.md` | `#783` | Close as by-design |

`11A`–`11D` touch overlapping `lib/` paths and must run sequentially.
`11E` and `11F` are doc-only and `[batch-eligible]` against each other and
against `11A`–`11D`.

### v2.12.0 — Polish + Older + Tooling (24 issues)

| Phase | Issues | Notes |
|---|---|---|
| `phase-12A.md` | `#531` | ESLint 10 migration (its own phase — risky) |
| `phase-12B.md` | `#516`, `#763`, `#765` | Experiment pages refactor + coverage cleanup |
| `phase-12C.md` | `#680` | Craft propagation regression tests |
| `phase-12D.md` | `#769`, `#770`, `#779`, `#780`, `#781`, `#782` | UX polish batch |
| `phase-12E.md` | `#762`, `#764`, `#777`, `#817` | QA cleanup batch |
| `phase-12F.md` | `#778` | Security: tighten CSP `unsafe-inline` |
| `phase-12G.md` | `#751`, `#752`, `#753` | Devops: log drain + lighthouse + e2e preview |
| `phase-12H.md` | `#755`, `#756`, `#761` | Frontend M-batch (Navbar ISR, dup icons, paginate) |
| `phase-12I.md` | `#775`, `#776` | Strategic perf (Supabase split + SVG ADR) |

All phase pairs in v2.12 are `[batch-eligible]` against each other —
they touch disjoint files. `12A` should run first (touches every TS file
through lint config) and then `12B`–`12I` can `/batch` in parallel.

## Acceptance criteria per release

For every release, ALL of the following must be true before merging
`develop -> main`:

- [ ] Every issue listed is closed via `gh issue close N --comment "Fixed in <sha>"`
- [ ] All automated checks green on `develop`: `pnpm run test`, `pnpm run typecheck`,
      `pnpm run lint`, full E2E suite, bundle analyzer, deployment smoke
- [ ] `apps/web/package.json` version bumped to the release version
- [ ] `CHANGELOG.md` `[Unreleased]` -> `[X.Y.Z] - YYYY-MM-DD` with all changes listed
- [ ] Comparison link anchor added at bottom of `CHANGELOG.md`
- [ ] PR description summarizes scope and references every closed issue
- [ ] Vercel preview manually smoke-tested: landing, `/u/<handle>`, `/studio`, `/admin`
- [ ] User explicitly authorizes the production merge (per CLAUDE.local.md)

After merge: tag `vX.Y.Z`, push tag, create GitHub release with notes pulled
from `CHANGELOG.md`, watch the Vercel deploy until production health is green.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Bundle-size targets in v2.10 don't actually hit 450KB | Phase 10E added if v2.10 lands above target — measure first |
| Platform fetcher refactor (`#744`) regresses scoring | Run `lib/impact/pipeline.test.ts` after every commit; build a multi-platform e2e fixture |
| Shared package build (`#748`) breaks consumer imports | Keep `main`/`types` pointing at `dist/` after migration; verify all imports resolve via `pnpm install && pnpm run typecheck` |
| ESLint 10 (`#531`) introduces new rule violations | Run with `--max-warnings 0` in CI; fix violations before promoting flat config |
| Strategic ADRs in v2.11 turn out to be wrong | Each ADR documents trigger conditions for revisiting — not "never" |

## Out of scope for this plan

- Anything not currently filed as an open issue. New issues filed during
  implementation get their own labels and live or die by `priority`.
- Net-new features. This plan is purely cleanup + remediation.
- Supabase schema changes beyond what individual issues require.
- Production env-var changes (those are user-driven).

## Phase index

- [phase-9A](2026-04-28-close-all-open-issues-phases/phase-9A.md) — `withErrorCapture` everywhere
- [phase-9B](2026-04-28-close-all-open-issues-phases/phase-9B.md) — Structured logger
- [phase-9C](2026-04-28-close-all-open-issues-phases/phase-9C.md) — Typed env getters
- [phase-9D](2026-04-28-close-all-open-issues-phases/phase-9D.md) — Warm-cache observability
- [phase-9E](2026-04-28-close-all-open-issues-phases/phase-9E.md) — One-line correctness fixes
- [phase-10A](2026-04-28-close-all-open-issues-phases/phase-10A.md) — Owner-only dynamic split
- [phase-10B](2026-04-28-close-all-open-issues-phases/phase-10B.md) — Layout chunk lazy-loading
- [phase-10C](2026-04-28-close-all-open-issues-phases/phase-10C.md) — Share-page TTFB hot path
- [phase-10D](2026-04-28-close-all-open-issues-phases/phase-10D.md) — Per-route perf
- [phase-11A](2026-04-28-close-all-open-issues-phases/phase-11A.md) — Platform fetcher unification
- [phase-11B](2026-04-28-close-all-open-issues-phases/phase-11B.md) — Shared build + tsconfig base
- [phase-11C](2026-04-28-close-all-open-issues-phases/phase-11C.md) — Hooks consolidation
- [phase-11D](2026-04-28-close-all-open-issues-phases/phase-11D.md) — Module boundaries + dead-code
- [phase-11E](2026-04-28-close-all-open-issues-phases/phase-11E.md) — Three ADRs
- [phase-11F](2026-04-28-close-all-open-issues-phases/phase-11F.md) — Close `#783` as by-design
- [phase-12A](2026-04-28-close-all-open-issues-phases/phase-12A.md) — ESLint 10
- [phase-12B](2026-04-28-close-all-open-issues-phases/phase-12B.md) — Experiment refactor + coverage
- [phase-12C](2026-04-28-close-all-open-issues-phases/phase-12C.md) — Craft propagation tests
- [phase-12D](2026-04-28-close-all-open-issues-phases/phase-12D.md) — UX polish batch
- [phase-12E](2026-04-28-close-all-open-issues-phases/phase-12E.md) — QA cleanup batch
- [phase-12F](2026-04-28-close-all-open-issues-phases/phase-12F.md) — Tighten CSP
- [phase-12G](2026-04-28-close-all-open-issues-phases/phase-12G.md) — Devops batch
- [phase-12H](2026-04-28-close-all-open-issues-phases/phase-12H.md) — Frontend M-batch
- [phase-12I](2026-04-28-close-all-open-issues-phases/phase-12I.md) — Strategic perf
