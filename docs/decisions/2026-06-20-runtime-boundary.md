# ADR: Single-Runtime Boundary for Public, Admin, and Background Workloads

**Date:** 2026-06-20
**Status:** Accepted (keep monolith now; revisit at scale)
**Refs:** Refs #815 (AR-S1)

## Context

The `@chapa/web` application is a single Next.js deployment that hosts several
workloads with very different traffic profiles, sensitivity, and failure modes:

| Workload | Examples | Profile |
|----------|----------|---------|
| **Public read** | `/u/:handle/badge.svg`, `/u/:handle`, `/api/profile/:handle`, `/api/verify/:hash` | High volume, anonymous, edge-cached, embeddable |
| **Authenticated user** | `/studio`, `/api/generate`, `/api/refresh`, CLI device auth | Medium volume, session-gated |
| **Admin ops** | `/admin`, `/api/admin/*`, campaign CRUD | Very low volume, privileged |
| **Background / cron** | `/api/cron/warm-cache`, `/api/cron/sync-audience`, `/api/cron/process-campaigns` | Scheduled, `CRON_SECRET`-gated, batch |
| **Campaign sending** | `process-campaigns` cron + `/api/admin/campaigns/:id/send` | Bursty, talks to Resend + Supabase |

All of these run in **one deployment** on Vercel, sharing the same serverless
runtime, env vars, and CDN configuration. The cron jobs are declared in
`vercel.json` and run inside the same project as the public badge route.

This ADR records the tradeoff of that shared boundary and the conditions under
which we would split it.

## Decision

**Keep the single `@chapa/web` runtime for now.** Do not split admin, cron, or
campaign workloads into separate deployments yet. Revisit when scale or
operational pressure (below) makes the shared boundary a liability.

## The Tradeoff

### Why a shared runtime is acceptable today

- **Deploy simplicity.** One build, one deploy pipeline, one set of env vars, one
  health endpoint, one CI gate. For a solo-operated project this is a major
  reduction in operational surface.
- **Code reuse without package boundaries.** Admin, cron, and public routes share
  `lib/db/*`, `lib/cache/*`, `lib/impact/*`, and `lib/render/*` directly via the
  `@/` alias. No internal versioning or publish step.
- **Low ops volume on the privileged paths.** Admin is a tiny surface (one
  dashboard, a handful of API routes) gated by session auth **and** the
  `ADMIN_HANDLES` allowlist. Cron runs three times a day, gated by `CRON_SECRET`.
  Campaign sends are infrequent and operator-initiated. None of these compete with
  the public badge route for capacity in practice.
- **Isolation already exists where it matters.** Privileged routes are
  authenticated independently of the public ones; a flood of badge traffic cannot
  reach `/api/admin/*` or `/api/cron/*` without the respective secret/session. The
  badge route is edge-cached, so most public load never reaches a function
  invocation at all.

### What we give up

- **Shared blast radius for deploys.** A bad deploy affects public, admin, and
  cron simultaneously. (Mitigated by `develop` → `main` PR discipline, CI gates,
  and the rollback runbook.)
- **Coupled scaling and resource limits.** All workloads share the same function
  concurrency/memory configuration. A heavy campaign batch and a public traffic
  spike draw from the same pool.
- **Coupled secrets.** Admin/cron secrets and public-path config live in one env
  namespace. (Mitigated: secrets are server-only and never `NEXT_PUBLIC_*`.)
- **Build-time coupling.** Admin-only dependencies are part of the same build,
  even though they never serve a public request. Bundle-size budgets and dead-code
  checks apply across the whole app.

## Future Split Options (if/when justified)

These are **options, not commitments**, ordered roughly by increasing effort:

1. **Vercel deployment-boundary split (lightest).** Move cron and admin routes
   behind separate Vercel projects (or a separate deployment of the same repo with
   a route-scoped config), so background/privileged work runs in an isolated
   function pool with its own concurrency and secrets. The public deployment hosts
   only badge/share/public-API routes.
2. **Dedicated worker for campaign sending.** Extract `process-campaigns` (and the
   admin-triggered send path) into a separate worker/queue so a large campaign run
   cannot contend with public traffic or block cron windows. Pairs naturally with
   a queue (e.g., Upstash QStash) instead of a single daily cron pass.
3. **Full workload separation.** Three deployables: public-read, authenticated +
   admin, and background/cron. Maximum isolation, maximum ops overhead — only
   worth it at significant scale or with a team to operate it. This option also
   benefits from the package-extraction roadmap (impact-engine, badge-renderer),
   since separated runtimes would share logic via published packages rather than
   the `@/` alias.

## Recommendation

**Keep the monolith now.** The shared runtime is the right call while the project
is solo-operated, admin/cron volume is low, and the public path is edge-cached and
already auth-isolated from privileged routes. Splitting earns its complexity only
when one of the triggers below fires.

## Triggers to Revisit

- A campaign send (or any background batch) measurably contends with public badge
  traffic, or repeatedly overruns its cron window.
- Function concurrency/memory limits force a tradeoff between background work and
  public latency.
- The admin/campaign surface grows enough that coupled deploys become a real
  release-risk concern.
- A second consumer or a team forms, making package extraction (and therefore a
  clean runtime split) cheap to adopt.

## Consequences

- **Positive:** One deploy, one pipeline, one health surface; lowest possible ops
  burden for a solo operator; privileged paths already auth-isolated.
- **Negative:** Shared deploy blast radius and shared scaling pool; documented and
  accepted until a trigger fires.
- **Neutral:** No code change today — this ADR exists so the boundary is a
  deliberate choice rather than an accident, and so the split path is pre-designed.
