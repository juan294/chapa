# Rollback Runbook

## When to Roll Back

Roll back when a production deployment causes:
- Badge SVG endpoint returning 5xx at scale
- OAuth login broken (users cannot authenticate)
- Health endpoint (`/api/health`) returning errors
- Any data-loss scenario

## Rollback via Vercel Dashboard

1. Open [vercel.com/dashboard](https://vercel.com/dashboard) and select the Chapa project.
2. Navigate to **Deployments** tab.
3. Find the last known-good deployment (look for the deployment before the current one, or filter by date).
4. Click the three-dot menu on that deployment and select **Promote to Production**.
5. Confirm — traffic shifts immediately (no rebuild required).

## Rollback via Vercel CLI

```bash
# List recent deployments
vercel ls --app chapa

# Promote a specific deployment to production
vercel promote <deployment-url>
```

## Rollback via Git (emergency revert)

If the bad code needs to be reverted from `main` and re-deployed:

```bash
# On main branch
git revert HEAD --no-edit
git push origin main
# Vercel auto-deploys from main — the revert triggers a new build
```

## Verifying the Rollback

After promoting or reverting:

```bash
# Check health endpoint
curl https://chapa.thecreativetoken.com/api/health

# Verify a badge loads
curl -I https://chapa.thecreativetoken.com/u/<handle>/badge.svg

# Confirm the deployment URL in response headers
curl -I https://chapa.thecreativetoken.com | grep x-vercel-deployment-url
```

## Post-Rollback

1. Open a GitHub issue describing the incident (use `type: bug`, `priority: critical`).
2. Revert or fix the bad code on `develop` before re-deploying.
3. File a post-mortem using the template in `docs/runbooks/incident-response.md`.
