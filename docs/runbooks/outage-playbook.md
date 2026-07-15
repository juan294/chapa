# Outage Playbook

Quick reference for the three most likely external service outages.

---

## Redis Down (Upstash Unavailable)

**Symptoms:** `/api/health` returns `{"status":"degraded","dependencies":{"redis":"error",...}}`. Badge SVG loads slowly (no cache hits). Rate limiting stops working.

**Design behavior:** The rate limiter in `lib/cache/redis.ts` is intentionally fail-open — all requests are allowed through when Redis is unavailable. See `docs/accepted-risks.md`. GitHub's own API limits and CDN `s-maxage=21600` caching provide secondary protection.

**Diagnosis:**
```bash
curl https://chapa.thecreativetoken.com/api/health | jq '{status, dependencies}'
# Check Upstash status: https://status.upstash.com/
```

**Response:**
1. Verify outage at [status.upstash.com](https://status.upstash.com/). If Upstash confirms, wait for resolution.
2. While Redis is down, badge requests still serve — they will be slower (full GitHub API fetch per request) and rate limits are unenforced.
3. If the outage is prolonged (>1 hour), optionally set a maintenance notice on the landing page.
4. Once Redis recovers, cache will rebuild automatically on the next request per user. No manual intervention needed.

**No rollback needed** — the application degrades gracefully.

---

## Supabase Down

**Symptoms:** `/api/health` returns `{"status":"degraded","dependencies":{"supabase":"error",...}}`. Admin dashboard fails to load user list. Feature flags fall back to environment variable defaults. Lifetime metric snapshots are not recorded.

**Design behavior:** All Supabase calls have graceful degradation — no Supabase call throws an unhandled error to the user. The badge SVG endpoint (`/u/:handle/badge.svg`) does not depend on Supabase for its primary path.

**Diagnosis:**
```bash
curl https://chapa.thecreativetoken.com/api/health | jq '{status, dependencies}'
# Check Supabase status: https://status.supabase.com/
```

**Response:**
1. Verify outage at [status.supabase.com](https://status.supabase.com/).
2. Core badge functionality continues. Share pages and badge SVGs are unaffected.
3. Feature flags fall back to `NEXT_PUBLIC_*` environment variables — no feature flag changes take effect until Supabase recovers.
4. Metric snapshots missed during the outage are permanently lost (no backfill mechanism). This is an accepted risk.
5. Admin dashboard (`/admin`) will show errors — expected, no action needed.

**No rollback needed.**

---

## GitHub API Down or Rate-Limited

**Symptoms:** Badge generation fails or returns stale data. `/api/generate` or `/api/refresh` returns errors. Stats fetch logs show 403 or 429 responses.

**Rate limits:** 60 req/hr unauthenticated, 5000 req/hr per authenticated user token.

**Diagnosis:**
```bash
# Check GitHub status
curl https://www.githubstatus.com/api/v2/status.json | jq '.status.description'

# Check rate limit for a token
curl -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/rate_limit
```

**Response:**
1. If GitHub is fully down: all cached badges continue serving from Redis (TTL 24h). No action needed for cached users. New badge generation will fail gracefully with a "try later" message — this is the designed behavior.
2. If rate-limited (unauthenticated): ensure users are authenticated via GitHub OAuth to get their own 5000 req/hr allocation.
3. If the fallback `GITHUB_TOKEN` is rate-limited: it's a shared token — authenticated users have independent limits. Consider generating a new PAT with higher rate limits.
4. Check `GITHUB_TOKEN` in Vercel env vars is set and not expired (PATs can have expiry dates).

**Cache is the primary protection.** The hourly warm-cache cron (`/api/cron/warm-cache`; #1010 — was daily) keeps priority handles fresh. Handles in `WARM_CACHE_PRIORITY_HANDLES` are always refreshed first.

**No rollback needed** for transient rate limiting.
