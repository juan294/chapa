# Secret Rotation Runbook

Rotate secrets immediately if any of the following happen:
- A secret is committed to the repository (even briefly)
- An employee/contractor with access leaves
- A third-party service reports a breach
- Suspicious API activity is detected

## GITHUB_CLIENT_SECRET

1. Go to [github.com/settings/developers](https://github.com/settings/developers) → OAuth Apps → Chapa (production app).
2. Click **Generate a new client secret**.
3. Copy the new secret immediately (it's shown only once).
4. Update in Vercel: **Project Settings → Environment Variables → GITHUB_CLIENT_SECRET** (Production scope).
5. Redeploy (or promote a new deployment) so the new secret takes effect.
6. Revoke the old secret from the GitHub OAuth App settings.

**Impact:** All active user sessions remain valid (sessions are signed by `NEXTAUTH_SECRET`, not `GITHUB_CLIENT_SECRET`). New logins will use the new secret.

## NEXTAUTH_SECRET

1. Generate a new secret:
   ```bash
   openssl rand -base64 32
   ```
2. Update in Vercel: **Project Settings → Environment Variables → NEXTAUTH_SECRET** (Production scope).
3. Redeploy.

**Impact:** All existing sessions are immediately invalidated — all users will be logged out. This is expected and acceptable. Users can log in again with GitHub OAuth.

## UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN

1. Open the [Upstash Console](https://console.upstash.com/) → select the Chapa Redis database.
2. Navigate to **Details** → **REST API** section.
3. Reset the token (button varies by Upstash version — look for "Reset Token" or "Rotate Credentials").
4. Copy the new `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
5. Update both in Vercel: **Project Settings → Environment Variables** (Production scope).
6. Redeploy.

**Impact:** Cache is still warm — Redis data is unaffected by token rotation. The application will have a brief period of cache misses until the new deployment is live.

## CHAPA_VERIFICATION_SECRET

1. Generate a new secret:
   ```bash
   openssl rand -hex 32
   ```
2. Update in Vercel: **Project Settings → Environment Variables → CHAPA_VERIFICATION_SECRET** (Production scope).
3. Redeploy.

**Impact:** All existing badge verification hashes become invalid. Any embed with a `?hash=` parameter will show as "unverified" until the badge is regenerated. Run a bulk recalculate via `/api/admin/bulk-recalculate` to refresh hashes.

## ADMIN_SECRET

1. Generate a new secret:
   ```bash
   openssl rand -hex 32
   ```
2. Update in Vercel: **Project Settings → Environment Variables → ADMIN_SECRET** (Production scope).
3. Update any scripts or cron jobs that use the bearer token for `/api/admin/stats`.
4. Redeploy.

## CRON_SECRET

1. Generate a new secret:
   ```bash
   openssl rand -hex 32
   ```
2. Update in Vercel: **Project Settings → Environment Variables → CRON_SECRET** (Production scope).
3. Update `vercel.json` if the cron secret is embedded there (it should only be in env vars).
4. Redeploy.

**Impact:** Scheduled cron jobs (`/api/cron/*`) will fail until the new deployment is live.

## After Any Rotation

1. Verify the affected endpoint works:
   ```bash
   curl https://chapa.thecreativetoken.com/api/health
   ```
2. Test the specific flow (login, badge verify, cron) that depends on the rotated secret.
3. Document the rotation in the incident log or as a GitHub issue comment.
