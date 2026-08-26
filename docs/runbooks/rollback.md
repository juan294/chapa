# Rollback Runbook

`docs/release/release-playbook.md` owns release ordering and selects this
runbook when a rollback trigger fires. Every rollback changes production and
requires explicit rollback authorization. Analyzer PASS or an earlier release
approval does not authorize rollback.

## When to Roll Back

Roll back when a production deployment causes:
- Badge SVG endpoint returning 5xx at scale
- OAuth login broken (users cannot authenticate)
- Health endpoint (`/api/health`) returning errors
- Any data-loss scenario

## Resolve the Approved Target

Before using either rollback method, read the failed release report. Resolve
its `rollbackReference` as `approvedRollbackTag` and its previous
evidence-approved production commit as `approvedRollbackCommit`. Do not
recompute either from `develop` ancestry.
Require the annotated tag to identify that exact commit:

```bash
test "$(git cat-file -t "$approvedRollbackTag")" = tag
test "$(git rev-parse "${approvedRollbackTag}^{commit}")" = "$approvedRollbackCommit"
```

Any missing value or mismatch blocks rollback target selection.

## Rollback via Vercel Dashboard

1. Open [vercel.com/dashboard](https://vercel.com/dashboard) and select the Chapa project.
2. Navigate to **Deployments** tab.
3. Select the report's named deployment for `approvedRollbackCommit`. Do not
   choose merely by chronology.
4. Click the three-dot menu on that deployment and select **Promote to Production**.
5. Confirm the target identity, then obtain explicit rollback authorization.
6. Promote it; traffic shifts immediately without a rebuild.

## Rollback via Vercel CLI

```bash
# List recent deployments
vercel ls --app chapa

# After explicit rollback authorization, promote the report's approved target
vercel promote "$approvedDeploymentUrl"
```

## Rollback via Git (emergency revert)

If the bad code needs to be reverted from `main` and re-deployed, obtain
explicit authorization for the emergency `main` mutation first:

```bash
# On main branch
git revert HEAD --no-edit
git push origin main
# Vercel auto-deploys from main — the revert triggers a new build
```

## Verifying the Rollback

After promoting or reverting:

```bash
# Verify restored deployment identity
restoredVersion="$(curl -fsS https://chapa.thecreativetoken.com/api/version)"
restoredCommit="$(printf '%s' "$restoredVersion" | jq -er 'select(.environment == "production") | .commitSha')"
test "$restoredCommit" = "$approvedRollbackCommit"

# Check health and core dependency state
curl https://chapa.thecreativetoken.com/api/health

# Verify the read-only smoke badge
curl -I 'https://chapa.thecreativetoken.com/u/octocat/badge.svg?__chapa_smoke=1'

# Confirm the deployment URL in response headers
curl -I https://chapa.thecreativetoken.com | grep x-vercel-deployment-url
```

Require the equality check above to pass; a healthy response from another
commit is not a successful rollback. Record the failed `runId`, failed candidate/main
identities, rollback deployment URL and commit, command/operator, time, health,
badge, header, and restored identity evidence.

## Schema Changes Are Not Covered by This Runbook

Everything above rolls back **application code** — it does not touch the
database. If the incident involves a destructive Supabase migration that was
already applied to production (dropped column/table, narrowed type, removed
constraint), rolling back code alone will not fix it: the restored code
expects a schema that no longer exists. See "Reversing a Migration" in
`docs/runbooks/migrations.md` for the paired reverse-SQL-script procedure —
schema rollback and code rollback must be coordinated, not treated as the same
action.

## Post-Rollback

1. Open a GitHub issue describing the incident (use `type: bug`, `priority: critical`) and link the failed release evidence and rollback identities.
2. Revert or fix the bad code on `develop` before re-deploying.
3. File a post-mortem using the template in `docs/runbooks/incident-response.md`.
