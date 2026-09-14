# Phase 1 — Baseline

Goal: pin what is under test, record the production state the run starts
from, capture everything Phase 8 must restore, and stand up a
production-mode copy beside the user's dev server. No writes.

## 1.1 Record identities

```bash
git -C /Users/juan/code/chapa rev-parse HEAD            # 8fcc0371…
git -C /Users/juan/code/chapa status --porcelain         # empty
curl -s http://localhost:3001/api/health | jq .          # status ok
curl -s http://localhost:3001/api/version | jq .
for k in SUPABASE_URL UPSTASH_REDIS_REST_URL NEXT_PUBLIC_BASE_URL; do
  printf '%s=' $k; grep "^$k=" apps/web/.env.local | cut -d= -f2- | sed -E 's#(https?://[^/]+).*#\1#'
done                                                     # production hosts, localhost:3001
grep -c '^SCORING_V7_RENDERING_ENABLED=' apps/web/.env.local   # 0: v7 off
```

## 1.2 Production state, read-only (Supabase MCP `execute_sql`)

Record in the report header:

```sql
select version from supabase_migrations.schema_migrations order by version desc limit 1;  -- 048
select key, enabled from feature_flags order by key;
select count(*) from users;
select handle, date, headline_score, adjusted_composite from metrics_snapshots
 where handle in ('juan294','octocat','juan2') order by handle, date desc limit 9;
select handle, revision, updated_at from studio_configs;
select count(*) from scoring_v7_subjects; select count(*) from scoring_v7_receipts;
```

Expect `scoring_v7_rendering` absent, v7 tables empty.

## 1.3 Capture what Phase 8 restores

- Owner Studio config: after the Phase 5 login, `GET /api/studio/config`
  from the browser session, saved as `evidence/phase1/juan294-studio-config.json`.
  Until then, the read-only SQL `select config from studio_configs where handle='juan294'`
  serves as the reference; both must agree.
- Reference badges and profile payloads, before any local write:
  ```bash
  mkdir -p docs/plans/2026-09-07-local-e2e-verification-phases/evidence/phase1
  for h in juan294 octocat; do
    curl -s "http://localhost:3001/u/$h/badge.svg" > evidence/phase1/$h.svg
    curl -s "http://localhost:3001/api/profile/$h" > evidence/phase1/$h.profile.json
  done
  ```
  A render writes today's snapshot for these two handles if none exists;
  that is the one allowed side effect of this phase.

## 1.3b Stats cache baseline, read-only

```bash
R=$(grep '^UPSTASH_REDIS_REST_URL=' apps/web/.env.local | cut -d= -f2-); T=$(grep '^UPSTASH_REDIS_REST_TOKEN=' apps/web/.env.local | cut -d= -f2-)
for h in juan294 octocat; do
  curl -s -H "Authorization: Bearer $T" -d "[\"PTTL\",\"stats:v3:$h\"]" "$R" ; echo " $h"
done
```

Record which fixture handles already hold a `stats:v3` record and its
remaining TTL; Phase 6.0 compares against this.

## 1.3c Seed the synthetic leaderboard users

Run id: `local-$(date +%Y%m%d%H%M)`. A scratch `tsx` script in the
scratchpad, using the service-role client from `.env.local` the way
`journey.spec.ts:315-398` does:

```
for role, score in [("board-a", 91), ("board-b", 64)]:
  handle = f"chapa-e2e-{runId}-{role}"
  users.insert({handle})
  metrics_snapshots.insert({handle, date: today, headline_score: score,
    adjusted_composite: score, tier, archetype, building/guarding/consistency/breadth, ...})
```

Copy the numeric field set from the journey spec's snapshot fixture so
`isValid` checks pass. Record the run id and both handles in the report;
Phase 8.5 deletes them and proves zero residue. These handles never render
a real badge (no GitHub account), so the leaderboard ranks them on the
stored headline, which is the documented fallback for a handle that cannot
be materialized.

## 1.4 Production-mode copy on port 3002

```bash
git worktree add /Users/juan/code/chapa-e2e 8fcc0371
cp /Users/juan/code/chapa/apps/web/.env.local /Users/juan/code/chapa-e2e/apps/web/.env.local
cd /Users/juan/code/chapa-e2e && pnpm install --frozen-lockfile --offline
pnpm run build                                      # doubles as Phase 2's build gate
pnpm --filter @chapa/web exec next start --port 3002 &
curl -s http://localhost:3002/api/health | jq .status
```

The copied env is deleted with the worktree in Phase 8. It points at
production like the original; the same safety rules apply on 3002.

## 1.5 Evidence directory

```bash
mkdir -p docs/plans/2026-09-07-local-e2e-verification-phases/evidence/{phase1,phase3,phase4,phase5,phase6,phase7,phase8}
```

## Exit criteria

Health ok on 3001 and 3002; report header holds SHA, production migration
head, flag table, user count, the three handles' latest snapshot rows,
the Studio config revision (29 today) and the reference SVG/profile files.
