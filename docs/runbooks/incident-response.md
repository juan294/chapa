# Incident Response Runbook

`docs/release/release-playbook.md` owns release ordering. When an incident is
release-related, preserve and reference the E2E Pro `runId`, evidence report,
candidate tree, deployed commit, and rollback identity throughout this runbook.

## Severity Definitions

| Severity | Description | Response time |
|----------|-------------|---------------|
| **P1 — Critical** | Production is down or data loss is occurring. Core user flow broken (login, badge SVG 5xx). | Immediate |
| **P2 — High** | Major feature degraded. Admin dashboard broken, cron jobs failing, >50% of badge requests failing. | Within 1 hour |
| **P3 — Medium** | Non-critical feature degraded. Analytics not recording, email not sending, share page errors. | Within 24 hours |
| **P4 — Low** | Minor visual bugs, slow responses, non-blocking errors. | Next deploy cycle |

## Detection

Production should have `CHAPA_ALERT_WEBHOOK_URL` configured to an operator-owned webhook endpoint. The app sends active alerts for these launch-critical signals:

| Signal | Threshold | Severity | Recipient |
|--------|-----------|----------|-----------|
| `health_degraded` | Every `/api/health` response with status `degraded` / HTTP 503 | P1 | `CHAPA_ALERT_WEBHOOK_URL` |
| `badge_5xx` | Every captured 5xx from `/u/:handle/badge.svg` | P1 | `CHAPA_ALERT_WEBHOOK_URL` |
| `oauth_callback_failure` | Every captured 5xx from `/api/auth/callback` | P1 | `CHAPA_ALERT_WEBHOOK_URL` |
| `cron_failure` | Every captured 5xx from `/api/cron/*` | P2 | `CHAPA_ALERT_WEBHOOK_URL` |

If `CHAPA_ALERT_WEBHOOK_URL` is unset, detection falls back to:
- Manual monitoring of `/api/health` — returns `status` plus `dependencies.redis`, `dependencies.supabase`, and `dependencies.github`
- Vercel deployment failure notifications
- GitHub CI failure on `develop`
- User report via support email

```bash
# Quick health check
curl https://chapa.thecreativetoken.com/api/health | jq '{status, dependencies}'
```

Alert payloads are JSON and include `source`, `timestamp`, `signal`, `severity`, `summary`, optional `route`, and redacted `properties`. Tokens, secrets, API keys, and bearer headers are scrubbed before delivery.

## Escalation

This is a solo project. Escalation means:
1. Stop new feature work.
2. Focus all effort on the incident.
3. If a service dependency (Upstash, Supabase, GitHub) is down, check their status pages — resolution is external.

## Response Steps

### P1 — Critical

1. **Assess:** Check `/api/health`, Vercel deployment logs, recent commits (`git log main --oneline -10`). When grepping the repo for the offending code, exclude `apps/web/.next/` (gitignored build output) — it can return megabytes of compiled-chunk noise that obscures real signal (e.g. `grep -r --exclude-dir=.next ...`).
   Also read `/api/version`, the current release evidence report, its raw
   artifact references, and the named previous evidence-approved deployment.
2. **Isolate:** Identify whether the issue is in code, config, or a dependency.
3. **Roll back if needed:** See `docs/runbooks/rollback.md`.
4. **Communicate:** If the project has public users, add a status note.
5. **Fix forward if rollback isn't sufficient:** Patch on `develop`, merge to `main` via PR.
6. **Verify:** Confirm `/api/health` returns `status: "ok"` and core flows are working.

### P2-P4 — Non-critical

1. Open a GitHub issue with the right severity label (`priority: critical/high/medium/low`).
2. Add to the next sprint / development queue.
3. Fix on `develop` per normal workflow.

## Post-Mortem Template

Use this for any P1 or P2 incident. File as a GitHub issue with label `type: docs` after resolution.

```markdown
## Incident Post-Mortem — [DATE]

**Severity:** P1 / P2
**Duration:** [start time] to [end time]
**Impact:** [What was broken, how many users affected if known]
**Release run ID:** [run ID or not release-related]
**Candidate tree:** [tree digest or not applicable]
**Failed deployed identity:** [commit and deployment]
**Evidence report:** [durable reference]
**Rollback identity:** [restored commit and deployment or not applicable]

### Timeline
- HH:MM — [Event]
- HH:MM — [Event]
- HH:MM — Resolved

### Root Cause
[One paragraph describing what caused the incident]

### Resolution
[What was done to fix it]

### What Went Well
- 

### What Could Be Improved
- 

### Action Items
- [ ] [Preventive measure] — owner, deadline
```

## Useful Links

- Vercel dashboard: [vercel.com/dashboard](https://vercel.com/dashboard)
- Upstash console: [console.upstash.com](https://console.upstash.com/)
- Supabase dashboard: [app.supabase.com](https://app.supabase.com/)
- GitHub status: [githubstatus.com](https://www.githubstatus.com/)
- Upstash status: [status.upstash.com](https://status.upstash.com/)
- Supabase status: [status.supabase.com](https://status.supabase.com/)
- Production URL: [chapa.thecreativetoken.com](https://chapa.thecreativetoken.com)
- Health endpoint: [chapa.thecreativetoken.com/api/health](https://chapa.thecreativetoken.com/api/health)
