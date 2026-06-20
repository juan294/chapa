# ADR: Production Deployment Stack Selection

**Date:** 2026-06-20
**Status:** Accepted
**Refs:** Fixes #773 (DO-S1)

## Context

Chapa is a single Next.js (App Router) application that serves a public,
embeddable SVG badge, a share page, a Creator Studio, an admin dashboard, and a
set of cron-driven background jobs (cache warming, audience sync, campaign
processing). The stack must satisfy a few hard constraints:

1. **Public-facing, embeddable assets** — the badge SVG is embedded in third-party
   READMEs and portfolios. It must be globally cached at the edge and survive
   traffic spikes without per-request GitHub API calls.
2. **Solo-operated** — there is no ops team. Every service must have a managed
   tier, sensible defaults, and degrade gracefully when not configured.
3. **Low baseline cost** — the project runs on free / low-cost tiers until it
   reaches scale; cost decisions are documented separately (see the cost-analyst
   reports under `docs/agents/`).
4. **Cheap-to-reason-about boundaries** — the team prefers managed first-party
   integrations over self-hosted infrastructure.

This ADR records the selected production stack and the rationale per service so
the choices are not re-litigated implicitly.

## Decision

The production stack is:

| Concern | Service | Role |
|---------|---------|------|
| Application host | **Vercel** | Next.js App Router host, edge CDN, serverless functions, cron |
| Cache + rate limit | **Upstash Redis** | Computed stats/impact/SVG cache, rate-limit buckets, dirty markers |
| Relational data | **Supabase (Postgres)** | `metrics_snapshots`, `supplemental_stats`, `feature_flags`, email campaigns, etc. |
| Transactional + campaign email | **Resend** | Score-bump notifications, campaign sends, inbound webhook forwarding |

All four are managed services consumed via first-party or well-supported SDKs.
Three of the four (Upstash, Supabase, Resend) are **optional at runtime** — the
app degrades gracefully when their env vars are unset (see Graceful Degradation
below).

## Rationale per Service

### Vercel — application host

- **Native Next.js App Router support.** Chapa uses App Router, server
  components, route handlers, `after()` for post-response side effects, and ISR
  with per-locale static rendering. Vercel is the reference platform for these
  features and ships them without configuration drift.
- **Edge CDN for the badge SVG.** The badge route sets
  `Cache-Control: public, s-maxage=21600, stale-while-revalidate=86400`. Vercel's
  CDN serves embedded badges from the edge, which is the primary protection
  against GitHub rate limits and traffic spikes.
- **Built-in cron.** The three cron jobs are declared in `vercel.json`
  (`warm-cache` at 06:00, `sync-audience` at 03:30, `process-campaigns` at 08:00
  UTC) and authenticated via `CRON_SECRET`. No separate scheduler is required.
- **Zero-config secrets and preview deploys.** Env vars and preview deployments
  on `develop` are first-party; production deploys from `main` only.

### Upstash Redis — cache + rate limit

- **Serverless-native (HTTP REST).** Upstash exposes Redis over HTTP, which works
  cleanly from Vercel serverless/edge functions without holding TCP connections.
- **Used for:** per-user/day computed stats + impact cache (24h TTL), per-handle
  SVG cache (24h + jitter), OG image cache, rate-limit buckets, the
  `stats:dirty:<handle>` same-day refresh marker, and CLI device-auth state.
- **Fail-open rate limiting.** The limiter (`lib/cache/redis.ts`) intentionally
  allows all requests when Redis is unavailable — an availability-first choice
  for embeddable badges (documented in `docs/accepted-risks.md`, #398).

### Supabase (Postgres) — durable relational data

- **Permanent history + durable EMU stats.** Redis is ephemeral (TTL-bound).
  Anything that must survive — `metrics_snapshots` (lifetime history, one row per
  handle/day), `supplemental_stats` (EMU merge payloads), `feature_flags`, and
  the email campaign tables — lives in Postgres.
- **Tables referenced in `apps/web/lib/db/`:** `users`, `metrics_snapshots`,
  `supplemental_stats`, `feature_flags`, `admin_users`, `user_platforms`,
  `tool_insights`, `verification_records`, `merge_operations`, `email_campaigns`,
  `campaign_sends`.
- **Service-role, server-only access.** The client (`lib/db/supabase.ts`) is a
  lazy singleton guarded by `import "server-only"`, using the service role key to
  bypass RLS for server-to-server access. All access is server-side; the key is
  never exposed via `NEXT_PUBLIC_*`.

### Resend — email

- **Transactional + campaign + inbound.** Resend sends score-bump notifications
  and admin campaigns, and forwards inbound support email to a configured Gmail
  address. Inbound webhooks are HMAC-verified (Svix) via `RESEND_WEBHOOK_SECRET`.
- **Simple SDK, lazy singleton.** `lib/email/resend.ts` matches the Redis lazy
  singleton pattern and no-ops when `RESEND_API_KEY` is unset.

## Alternatives Considered

| Concern | Alternative | Why not chosen |
|---------|-------------|----------------|
| Host | Netlify / Cloudflare Pages / self-hosted | Less first-party App Router parity (server components, `after()`, ISR nuances); cron/secret ergonomics weaker for a solo operator. |
| Host | AWS (Amplify / ECS / Lambda) | Significantly more ops surface (IAM, VPC, CDN wiring) for no benefit at this scale. |
| Cache | Vercel KV | Effectively Upstash under the hood; Upstash gives a direct console, status page, and portability if we leave Vercel. |
| Cache | Self-hosted Redis | TCP connection management is awkward from serverless; no managed failover. |
| Database | PlanetScale (MySQL) | We want Postgres semantics (UNIQUE constraints on handle+date, JSONB); Supabase bundles auth/storage we may use later. |
| Database | Raw Postgres on a VPS | Adds backups, patching, and uptime burden to a solo project. |
| Email | SendGrid / Postmark / SES | Resend's DX (typed SDK, inbound webhooks, audiences) fits the small surface; SES requires more setup for inbound + reputation management. |

## Graceful-Degradation Posture

A core design principle: **the application boots and serves its core flow even
when Upstash, Supabase, and Resend are all unconfigured.** Only GitHub OAuth
credentials and `NEXT_PUBLIC_BASE_URL` are functionally required for the primary
login + badge flow.

- **Upstash unset** → cache reads miss and recompute on demand; the rate limiter
  fails open (allows requests). The badge still renders.
- **Supabase unset** → `getSupabase()` returns `null` with a `console.warn`;
  history snapshots, durable EMU stats, DB feature flags, and campaigns are
  skipped. Scores still compute from live GitHub data. `pingSupabase()` returns
  `"skipped"`.
- **Resend unset** → email sends no-op; the rest of the app is unaffected.

`/api/health` reflects this: each dependency reports `ok` / `error` / `skipped`,
and `skipped` is not treated as unhealthy.

## Consequences

- **Positive:** Minimal ops surface; first-party integrations; the whole stack
  runs on free/low tiers until scale; every external dependency is optional, so a
  single provider outage degrades rather than breaks the product.
- **Negative:** Vendor coupling to Vercel for host + cron + CDN (mitigated:
  Upstash/Supabase/Resend are portable and the app is a standard Next.js project).
- **Neutral:** Four managed vendors to monitor — covered by the incident-response
  runbook (`docs/runbooks/incident-response.md`) and the `CHAPA_ALERT_WEBHOOK_URL`
  P1 alert path.

## Review Schedule

Re-evaluate when:
- Monthly Upstash memory approaches the plan ceiling (see the OG-image cache
  migration ADR, 2026-03-14).
- Vercel pricing or App Router platform support materially changes.
- The admin/cron/campaign workload justifies a runtime split (see the runtime
  boundary ADR, 2026-06-20).
