# Observability Runbook — Logs, Retention & Log Drains

**Refs:** Fixes #751 (DO-L1)

This runbook covers log retention and how to wire a durable **log drain** so
production logs outlive Vercel's short built-in retention window. It complements
the alerting path already described in `docs/runbooks/incident-response.md`.

## The problem: Vercel log retention is short

Vercel's built-in runtime/function logs are intended for **live debugging**, not
durable observability:

- Logs are queryable only for a short retention window (roughly an hour of
  real-time logs on lower plans; longer historical access requires a higher plan
  or an external drain).
- There is no full-text search over weeks of history out of the box.
- Once the window passes, the logs are gone — you cannot retroactively investigate
  an incident from three days ago.

For a production site, that means a P1 you didn't catch in real time may have **no
recoverable log trail**. The fix is a **log drain**: Vercel streams every log line
to an external store that retains and indexes it.

## Recommendation: Axiom Log Drain (free tier)

Use **Axiom** as the log drain destination. Rationale:

- Generous free tier suitable for a solo project's volume.
- Native Vercel integration (one-click) plus a Log Drains config path.
- Full-text search, structured fields, dashboards, and saved queries over weeks of
  history.

Alternatives (Datadog, Logtail/Better Stack, a custom HTTPS drain endpoint) work
too; the steps below are written for Axiom but the shape is the same.

> **This is a user dashboard action.** Wiring a log drain requires connecting an
> Axiom account and authorizing the Vercel integration. An automated agent cannot
> complete it — the steps below must be performed by the project owner in the
> Vercel and Axiom dashboards. There is no code change in this repo.

## Setup (step by step)

### Option 1 — Vercel ↔ Axiom integration (recommended, easiest)

1. Create a free account at [axiom.co](https://axiom.co) and create a dataset
   (e.g., `chapa-vercel`).
2. In the **Vercel dashboard** → **Integrations** (Marketplace) → search **Axiom**
   → **Add Integration**.
3. Authorize the integration and select the **Chapa** project and the Axiom
   dataset created in step 1.
4. Confirm scope: production (and optionally preview) deployments.
5. Trigger some traffic (load `/api/health` and a badge URL) and verify log lines
   appear in the Axiom dataset within a minute or two.

### Option 2 — Vercel Log Drains (manual, any HTTPS endpoint)

1. In Axiom, get the dataset's ingest URL and an API token.
2. In the **Vercel dashboard** → **Project Settings** → **Log Drains** → **Add Log
   Drain**.
3. Set the delivery endpoint to the Axiom ingest URL, add the token header, choose
   **JSON** format, and select the log sources (function logs at minimum; edge and
   build optionally).
4. Save and verify ingestion with live traffic.

> Note: Log Drains availability depends on the Vercel plan. If the team plan does
> not expose Log Drains, use Option 1 (the Marketplace integration) which works on
> standard plans.

## What to monitor (saved queries / dashboards)

Once logs are flowing, set up saved queries for the signals the app already emits:

| Signal | Where it comes from | Why it matters |
|--------|--------------------|----------------|
| `[db] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing` | `lib/db/supabase.ts` `console.warn` | DB silently disabled in prod (misconfiguration) |
| 5xx on `/u/:handle/badge.svg` | function logs | Core public flow broken (P1) — also alerts via webhook |
| 5xx on `/api/auth/callback` | function logs | OAuth login broken (P1) |
| 5xx / non-200 on `/api/cron/*` | function logs | Cron job failing (warm-cache, sync-audience, process-campaigns, latency-check) |
| `/api/health` returning `degraded` / 503 | function logs | Dependency outage (Redis/Supabase/GitHub) |
| Rate-limiter fallback (Redis unavailable) | `lib/cache/redis.ts` warnings | Fail-open in effect — secondary protection only |
| Post-response side-effect rejections | badge route `after()` path | Missed snapshots/analytics (low severity, but track trends) |

Build at least: an **errors dashboard** (all 5xx grouped by route), a **cron
dashboard** (last N runs of each cron path + status), and a **health dashboard**
(`/api/health` status over time).

## Relationship to existing alerting

Log drains are for **retention and forensics**; they are **not** the real-time
alert path. The app already does active alerting independently:

- `CHAPA_ALERT_WEBHOOK_URL` (documented in `CLAUDE.md` and
  `docs/runbooks/incident-response.md`) receives **P1/P2 alerts** for
  `health_degraded`, `badge_5xx`, `oauth_callback_failure`, `cron_failure`,
  `warm_cache_high_failure_rate`, and `warm_cache_ceiling_approached`. Alert
  payloads are JSON with secrets scrubbed.

So the two layers are complementary:

- **`CHAPA_ALERT_WEBHOOK_URL`** → push, real-time, "wake me up now."
- **Axiom log drain** → pull, durable, "let me investigate what happened."

Configure both. The webhook tells you something broke; the log drain lets you find
out why after the fact.

## Verification checklist

- [ ] Axiom account + dataset created.
- [ ] Vercel integration (or Log Drain) connected to the Chapa production project.
- [ ] Test traffic visible in Axiom within ~2 minutes.
- [ ] Saved queries for the signals table above created.
- [ ] Errors / cron / health dashboards built.
- [ ] `CHAPA_ALERT_WEBHOOK_URL` confirmed set in Vercel production env (real-time
      alert path) — see incident-response runbook.

## Useful links

- Axiom: [axiom.co](https://axiom.co)
- Vercel Integrations (Marketplace): in the Vercel dashboard → Integrations
- Vercel Log Drains: Project Settings → Log Drains
- Health endpoint: [chapa.thecreativetoken.com/api/health](https://chapa.thecreativetoken.com/api/health)
- Incident response: `docs/runbooks/incident-response.md`
