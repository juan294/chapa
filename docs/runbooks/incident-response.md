# Incident Response Runbook

## Severity Definitions

| Severity | Description | Response time |
|----------|-------------|---------------|
| **P1 — Critical** | Production is down or data loss is occurring. Core user flow broken (login, badge SVG 5xx). | Immediate |
| **P2 — High** | Major feature degraded. Admin dashboard broken, cron jobs failing, >50% of badge requests failing. | Within 1 hour |
| **P3 — Medium** | Non-critical feature degraded. Analytics not recording, email not sending, share page errors. | Within 24 hours |
| **P4 — Low** | Minor visual bugs, slow responses, non-blocking errors. | Next deploy cycle |

## Detection

Incidents are typically discovered via:
- Manual monitoring of `/api/health` — returns JSON with `redis` and `supabase` status
- Vercel deployment failure notifications
- GitHub CI failure on `develop`
- User report via support email

```bash
# Quick health check
curl https://chapa.thecreativetoken.com/api/health
```

## Escalation

This is a solo project. Escalation means:
1. Stop new feature work.
2. Focus all effort on the incident.
3. If a service dependency (Upstash, Supabase, GitHub) is down, check their status pages — resolution is external.

## Response Steps

### P1 — Critical

1. **Assess:** Check `/api/health`, Vercel deployment logs, recent commits (`git log main --oneline -10`).
2. **Isolate:** Identify whether the issue is in code, config, or a dependency.
3. **Roll back if needed:** See `docs/runbooks/rollback.md`.
4. **Communicate:** If the project has public users, add a status note.
5. **Fix forward if rollback isn't sufficient:** Patch on `develop`, merge to `main` via PR.
6. **Verify:** Confirm health endpoint green and core flows working.

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
