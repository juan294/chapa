---
phase: 11E
release: v2.11.0
issues: ["#771", "#773", "#815"]
batch_eligible: true
effort: M (writing only)
---

# Phase 11E — Three ADRs (`#771`, `#773`, `#815`)

## Goal

Three strategic issues that propose architectural changes too large to
implement in a normal release cycle. Per user direction, write Architecture
Decision Records documenting the decision to defer, the rationale, and
the trigger conditions for revisiting. Then close the issues referencing
the ADR.

## #771 — `lib/` approaching 50K LOC — extraction roadmap

### File: `docs/decisions/0001-defer-lib-extraction.md`

```markdown
# ADR 0001 — Defer extraction of lib/ into separate packages

Date: 2026-04-28
Status: Accepted
Issue: #771

## Context

`apps/web/lib/` has grown to ~50K LOC across many subdirectories
(scoring, github, profile, render, db, cache, auth, history, ...).
The original concern: as the directory grows, internal coupling between
unrelated subsystems (scoring vs render vs db) becomes harder to spot.

## Decision

We defer package extraction. We will keep `lib/` as a single tree
inside `apps/web/` for the foreseeable future.

## Rationale

- The current structure is not blocking development. Subdirectories
  already enforce conceptual separation; cross-imports are visible.
- Package extraction has real costs: build orchestration, version
  management within the workspace, IDE go-to-definition friction during
  active development.
- The team is one person. Multi-package boundaries pay off most when
  multiple humans need to negotiate shared APIs.

## Triggers for revisiting

Reopen this decision when ANY of:
- Another developer joins the project full-time and needs an enforced
  boundary
- A subsystem (e.g., scoring or rendering) gets reused outside `apps/web`
- Total `lib/` LOC exceeds 100K
- Build times exceed 60s and lib/ is identified as the cause

## Alternatives considered

1. Full extraction now into `packages/scoring`, `packages/render`,
   `packages/db` — rejected: premature, no caller benefits today.
2. Internal entry-point gates (`lib/index.ts` re-exports only the public
   API of each subdir) — partial benefit but adds boilerplate; deferred.

## References

- Issue #771
```

## #773 — No ADR for the production stack selection

### File: `docs/decisions/0002-production-stack-selection.md`

```markdown
# ADR 0002 — Production stack selection

Date: 2026-04-28
Status: Accepted
Issue: #773

## Context

The project ships on Next.js 16 (App Router) + Vercel + Upstash Redis +
Supabase. There is no written record of why this stack was chosen over
alternatives (Cloudflare Workers, Fly.io, plain Postgres, etc.).

## Decision

We document the current stack as intentional and the rationale for each
choice. We do not commit to revisiting any specific component on a
schedule.

## Stack choices and rationale

- **Next.js (App Router)** — Server Components fit the SSR-then-cache
  pattern for the share page. ISR for `/u/<handle>` is cheap and
  cache-friendly. Tight Vercel integration.
- **Vercel** — Zero-config deploys from GitHub, Edge Network CDN,
  serverless function pricing competitive at the project's scale.
  Trade-off: vendor lock for the deploy + cron paths, mitigated because
  app code is portable.
- **Upstash Redis** — REST API works in Vercel functions without
  connection pooling pain. Pricing competitive for our cache traffic.
- **Supabase** — Postgres + Row-Level Security + a managed dashboard.
  Service role used server-side; client never gets a service key.

## Triggers for revisiting

Reopen any specific layer when:
- Vercel function cold start exceeds 2s p95 on the share page
- Upstash Redis rate-limits us at sustained load
- Supabase availability drops below 99.9% for any 30-day window
- Costs exceed $200/mo without proportional traffic growth

## References

- Issue #773
```

## #815 — Public Traffic, Admin Ops, Cron Work, Campaign Sending share one runtime

### File: `docs/decisions/0003-defer-runtime-boundary-split.md`

```markdown
# ADR 0003 — Defer runtime split between public and operational paths

Date: 2026-04-28
Status: Accepted
Issue: #815

## Context

`@chapa/web` ships everything in one Next.js app: public badge rendering,
cron warmers, admin dashboard, campaign send orchestration. They all
share deployment, dependencies, and cold-start behavior.

## Decision

We defer splitting these into separate runtimes (e.g., admin and crons
on a separate Next.js app or as Cloudflare Workers).

## Rationale

- The public badge route has its own cache layer; admin/cron work can't
  block it under normal conditions
- Vercel scales each route independently; concurrent admin/cron work
  doesn't slow the badge route's serverless instances
- Splitting into multiple deploys multiplies CI/CD complexity and adds
  a separate auth boundary to maintain
- Today's traffic is small enough that runtime mixing is not a measurable
  problem

## Triggers for revisiting

- Cron or admin work starts triggering 5xx on public routes (would show
  up in PostHog with the active alerts wiring from v2.9.0)
- Public route p95 latency exceeds 1s sustained
- A specific dependency required by admin (e.g., a heavy ML library)
  starts bloating the public bundle
- Campaign sends grow to >100k recipients per send

## Alternatives considered

1. Move admin/cron to a separate Next.js app — rejected for now,
   complexity > benefit at current scale.
2. Use Vercel Edge Runtime for public-only routes — possible follow-up
   if cold-start becomes the bottleneck; not done yet.

## References

- Issue #815
- ADR 0002 (production stack selection)
```

## Files

- New: `docs/decisions/0001-defer-lib-extraction.md`
- New: `docs/decisions/0002-production-stack-selection.md`
- New: `docs/decisions/0003-defer-runtime-boundary-split.md`

## Acceptance criteria

### Automated
- [ ] All three ADR files exist and pass `markdownlint` (line length is
      not strictly enforced — match existing project style)
- [ ] `pnpm run typecheck && pnpm run test && pnpm run lint` still pass
      (this phase is doc-only)

### Manual
- N/A — pure documentation

## Closing the issues

```bash
gh issue close 771 --comment "Resolved by docs/decisions/0001-defer-lib-extraction.md. Fixed in <sha>."
gh issue close 773 --comment "Resolved by docs/decisions/0002-production-stack-selection.md. Fixed in <sha>."
gh issue close 815 --comment "Resolved by docs/decisions/0003-defer-runtime-boundary-split.md. Fixed in <sha>."
```
