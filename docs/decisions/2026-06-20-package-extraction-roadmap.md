# ADR: Package Extraction Roadmap (impact-engine, badge-renderer)

**Date:** 2026-06-20
**Status:** Accepted (direction); Roadmap (not immediate work)
**Refs:** Refs #771 (AR-S1)

> This ADR records an **agreed direction and a phased plan**. It is not a
> commitment to do the work now. No extraction should be scheduled until the
> blockers below are cleared and a concrete milestone is opened.

## Context

`apps/web/lib/` has grown to ~20k LOC of non-test TypeScript across 27
subdirectories. Two of those subtrees are conceptually self-contained domains
with clean inputs and outputs:

- **`apps/web/lib/impact/`** — the Impact v6 scoring engine. Pure functions that
  take aggregated GitHub `StatsData` and produce an `ImpactV6Result` (dimensions,
  archetype, composite, confidence, tier). The project's engineering rules already
  mandate these be pure and deterministic.
- **`apps/web/lib/render/`** — the badge SVG renderer. React-to-SVG templates that
  take a sanitized profile + `BadgeConfig` and produce an SVG string (and, via
  `@resvg/resvg-js`, a PNG for OG images).

Both currently live inside the `@chapa/web` app and are imported with the `@/`
path alias. They are tightly tested but not independently packaged, versioned, or
reusable (e.g., by a future CLI, a worker, or an external embedder).

## Decision

Adopt, as an **accepted future direction**, the extraction of two workspace
packages:

| Proposed package | Source today | Public surface |
|------------------|--------------|----------------|
| `packages/impact-engine` | `apps/web/lib/impact/*` | `materializeProfile`-adjacent pure functions, dimension/archetype/tier computation, the v6 types |
| `packages/badge-renderer` | `apps/web/lib/render/*` | `renderBadgeSvg()`, SVG escaping, `BadgeConfig` rendering, font bundling |

This is a **direction**, not scheduled work. The migration only proceeds once the
blockers below are resolved and the acceptance criteria can be met.

## Boundaries and Dependency Direction

The strict dependency rule is **one-directional**:

```
@chapa/shared  ◄── packages/impact-engine ◄── @chapa/web
       ▲                                          │
       └──────────── packages/badge-renderer ◄────┘
```

- **`@chapa/shared`** stays the leaf — types only (`StatsData`, `ImpactV6Result`,
  `BadgeConfig`, etc.). No runtime logic.
- **`packages/impact-engine`** depends only on `@chapa/shared`. It must contain
  **no** I/O — no Redis, no Supabase, no GitHub fetch. It is pure compute. (Today
  `lib/impact/` is already free of those concerns; this boundary mostly needs to
  be enforced, not retrofitted.)
- **`packages/badge-renderer`** depends only on `@chapa/shared` (and its
  rendering deps: React for JSX-to-string, `@resvg/resvg-js`). It must receive
  **already-sanitized** inputs and **already-computed** profiles — no scoring, no
  fetching.
- **`@chapa/web`** depends on all three. App-level concerns (caching, OAuth, DB,
  route handlers, side effects) stay in the app.

Anything that imports cache/db/github/auth must **not** move into a package. The
extraction succeeds only if these two subtrees are genuinely pure at the seam.

## What Blocks This Today

1. **`packages/shared` has no build step.** It relies on Next.js
   `transpilePackages` to compile its TypeScript at app build time (documented as
   an accepted risk in `docs/accepted-risks.md`, #450). A package consumed by
   *another package* (not just the Next app) cannot lean on `transpilePackages` —
   it needs its own emitted output (or to be transpiled by the consuming package's
   bundler). **This is being addressed in #748** (giving `packages/shared` a real
   build/emit step). Package extraction should not start until #748 lands, because
   `impact-engine` and `badge-renderer` would inherit the same build gap.
2. **Import-boundary enforcement is app-scoped.** The CI rule forbidding relative
   imports of `packages/shared` (use `@chapa/shared`) and the circular-dependency
   check (`pnpm run check:circular` via madge) are tuned for the current layout.
   New packages need their own boundary lint + circular checks.
3. **Coverage thresholds are configured per-module in `vitest.config.ts`.** Moving
   files changes module paths; thresholds and the test runner's project config
   would need to follow the code so coverage gates don't silently weaken.
4. **Font asset tracing.** `next.config.ts` uses `outputFileTracingIncludes` to
   bundle `lib/render/fonts/**/*.ttf` for the badge/OG routes. A `badge-renderer`
   package must own its font assets and document how the consuming app traces
   them.
5. **No demonstrated second consumer yet.** Extraction earns its complexity only
   when a second consumer exists (CLI, worker, external SDK). Until then the
   packages add build/release overhead for a single consumer.

## Phased Migration

**Phase 0 — Unblock (prerequisite).** Land #748 so `packages/shared` builds/emits
its own output. Confirm a package can be consumed by another package, not just by
the Next app.

**Phase 1 — Extract `impact-engine`.** It is the cleanest seam (pure compute, no
assets). Move `lib/impact/*` to `packages/impact-engine`, depend only on
`@chapa/shared`, port tests, add boundary + circular lint, wire coverage
thresholds. App imports change from `@/lib/impact/*` to `@chapa/impact-engine`.

**Phase 2 — Extract `badge-renderer`.** Move `lib/render/*`, including font
assets and the `@resvg/resvg-js` dependency. Update `outputFileTracingIncludes`
to trace fonts from the package. Port escaping tests (XSS-critical) and snapshot
tests.

**Phase 3 — Enforce purity at the seam.** Add a lint rule (or madge boundary)
that forbids either package from importing cache/db/github/auth modules.

Each phase ships independently, with green CI, on `develop`. No phase touches
`main` outside the normal release process.

## Acceptance Criteria (per phase)

- The extracted package builds standalone (`tsc`/bundler emit), not only via the
  app's `transpilePackages`.
- No circular dependencies (`pnpm run check:circular` green, including new
  packages).
- Per-module coverage thresholds preserved or raised — never weakened.
- The package imports **only** `@chapa/shared` (+ its declared rendering deps for
  `badge-renderer`); zero imports of cache/db/github/auth.
- App typecheck, lint, full test suite, and a production build all pass.
- Badge SVG and OG image routes render byte-identically before/after (snapshot
  parity), with fonts correctly traced.

## Consequences

- **Positive:** Clear domain boundaries; pure scoring/rendering become reusable
  and independently versionable; the app shrinks toward orchestration only.
- **Negative:** More build/release surface (each package needs build, lint,
  coverage wiring); upfront cost with no payoff until a second consumer exists.
- **Neutral:** Until Phase 0 (#748) lands, this remains a documented direction
  with no code movement.

## Review Schedule

Revisit when #748 lands, or when a second consumer (CLI, worker, external SDK)
concretely appears — whichever comes first.
