# Release Checklist (develop → main)

Use this checklist every time you prepare a production release. The goal is to catch regressions before real users hit them.

## Pre-Release Gates

All of these must be green before creating the `develop → main` PR.

### 1. CI Passes on develop

```bash
gh run list --branch develop --limit 5
```

All recent runs must be passing (green). If any are failing, fix them first.

### 2. Full Test Suite + Type Check + Lint

Run locally in the worktree or main project:

```bash
pnpm run test && pnpm run typecheck && pnpm run lint
```

All must exit 0. No exceptions.

### 3. Preview Deployment Soak (24h recommended, 1h minimum)

Every push to `develop` creates a Vercel preview deployment automatically.

1. Open the preview URL from the Vercel dashboard or from the GitHub PR checks.
2. Test the following flows manually:

| Flow | Steps |
|------|-------|
| **GitHub login** | Click login → GitHub OAuth → confirm redirect back to app with session |
| **Badge generation** | Log in → `/generate` or visit `/u/<handle>` → confirm badge renders |
| **Badge SVG public** | Open `/u/<handle>/badge.svg` in incognito → must load without auth |
| **Share page** | Visit `/u/<handle>` → badge preview, breakdown, and embed snippet visible |
| **Health endpoint** | `curl <preview-url>/api/health` → `{"redis":"ok","supabase":"ok"}` |
| **Verification** | Click verify link on share page → `/verify/:hash` renders correctly |

For production, confirm `CHAPA_ALERT_WEBHOOK_URL` is configured before release. It receives `health_degraded`, `badge_5xx`, `oauth_callback_failure`, and `cron_failure` alerts as documented in `docs/runbooks/incident-response.md`.

3. Leave the preview running for at least 24 hours if the change touches caching, scoring, or OAuth. For documentation-only changes, 1 hour is sufficient.

### 4. Rollback Decision Criteria

Before merging, confirm you're prepared to roll back if needed:

- You know which commit introduced each change (`git log develop --oneline`)
- The previous production deployment is still available in Vercel (it always is — Vercel keeps deployment history)
- Rollback procedure is documented in `docs/runbooks/rollback.md`

**Rollback triggers** (if any of these happen within 30 minutes of going live):
- `/api/health` returns errors
- Badge SVG endpoint returns 5xx
- GitHub login flow broken
- Error rate spike visible in Vercel logs

## Creating the Release PR

Only after all gates above are green:

```bash
# Confirm develop is ahead of main
git log main..develop --oneline

# Create the PR
gh pr create --base main --head develop --title "Release: [brief description]" --body "..."
```

The PR description should list all commits since the last release and link to any relevant issues.

## Post-Release Verification

Within 15 minutes of merge to `main`:

```bash
# Verify production health
curl https://chapa.thecreativetoken.com/api/health

# Verify a badge loads
curl -I https://chapa.thecreativetoken.com/u/<known-handle>/badge.svg
```

If anything is wrong: **roll back immediately** (see `docs/runbooks/rollback.md`), then investigate on `develop`.

## Notes on the Current Backlog Gap

As of April 2026, `develop` is approximately 41 commits ahead of `main`. Before the next release:
1. Run the full checklist above against a fresh preview deployment.
2. Prioritize `pnpm run test && pnpm run typecheck` — these catch most regressions automatically.
3. Manually test the badge SVG and OAuth flows — these are the highest-impact user paths.
