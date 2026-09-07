# Phase 8 — Read-only ops routes, Lighthouse, report, restore

Goal: the operational surface answers correctly without touching a vendor
or another user, the production build meets the accessibility floor on
mobile, every finding is written down and fixed, and every allowed write
from Phases 5–7 is reversed.

## 8.1 Operational routes, read-only subset

```bash
A=$(grep '^ADMIN_SECRET=' apps/web/.env.local | cut -d= -f2-)
curl -s http://localhost:3001/api/health | jq .                                          # ok; cron heartbeats are production's own
curl -s http://localhost:3001/api/version | jq .
curl -s -H "Authorization: Bearer $A" http://localhost:3001/api/admin/stats | jq .        # read
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/api/admin/stats           # no bearer → 401
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/api/cron/warm-cache       # no bearer → 401; never send the bearer
curl -s -D - -o /dev/null "http://localhost:3001/u/juan294/badge.svg" | grep -i -E "cache-control|vercel-cdn|vercel-cache-tag|server-timing"
curl -s -D - -o evidence/phase8/juan294-og.png "http://localhost:3001/u/juan294/og-image" | grep -i -E "content-type|cache"
curl -s -X POST http://localhost:3001/api/telemetry -H 'content-type: application/json' -d '{"event":"local_e2e_probe"}' -o /dev/null -w "%{http_code}\n"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/api/notifications/unsubscribe   # unsigned → 4xx, never 500
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3001/api/insights/juan294"
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3001/api/history/octocat"
```

Assert: badge headers carry `max-age=300`, edge `s-maxage=21600`, the
`badge-juan294` tag and a `Server-Timing` line; the OG PNG has glyphs (open
it); nothing answers 500 on legal input. **Never invoked**: `warm-cache`,
`latency-check`, `sync-audience`, `process-campaigns`, `bulk-recalculate`,
campaign send/test, `/api/challenge`, the Resend webhook.

Error surfaces: `/u/this-user-definitely-does-not-exist-xyz123` (404 in both
locales, fallback SVG at `/badge.svg`), `/nope` (not-found), `/verify/zz`
(invalid hash message), `/u/bad handle/badge.svg` (400 SVG).

## 8.2 Lighthouse, mobile emulation, production build

The tracked `lighthouserc.json` starts its own server on 3001; a scratch
config points at the worktree's 3002 and writes reports to the evidence dir:

```bash
cat > "$SCRATCHPAD/lighthouserc.local.json" <<'EOF'
{"ci":{"collect":{"url":["http://localhost:3002/","http://localhost:3002/about","http://localhost:3002/about/scoring","http://localhost:3002/u/juan294","http://localhost:3002/studio?demo=1"],"numberOfRuns":1,"settings":{"chromeFlags":"--headless","onlyCategories":["performance","accessibility","best-practices","seo"]}},
 "assert":{"assertions":{"categories:accessibility":["error",{"minScore":0.9}],"categories:performance":["warn",{"minScore":0.7}],"categories:best-practices":["warn",{"minScore":0.9}],"categories:seo":["warn",{"minScore":0.8}]}},
 "upload":{"target":"filesystem","outputDir":"docs/plans/2026-09-07-local-e2e-verification-phases/evidence/phase8/lighthouse"}}}
EOF
pnpm dlx @lhci/cli autorun --config="$SCRATCHPAD/lighthouserc.local.json"
```

Lighthouse defaults to mobile emulation. Record all four scores per URL;
accessibility below 0.90 is a finding with the failing audits listed.

## 8.3 Report

Write `docs/agents/local-e2e-report.md` (gitignored):

1. Header from Phase 1: SHA, production migration head, flag table, counts,
   the three handles' reference numbers, Studio config revision.
2. One table per phase: command or step, result, count, evidence path.
3. Findings: id `LE-<phase>-<n>`, severity (blocker / high / medium / low),
   surface, viewport and locale if visual, reproduction, suspected cause
   with `file:line`. Pre-seeded from 8fcc0371's own notes:
   - `LE-pre-1` (medium): a cold badge render pays the 9–10 s GraphQL query
     once per handle per 6 h and exceeds the 4,100 ms cache-miss SLO; record
     the measured `Server-Timing` from Phase 6.0 step 7.
   - `LE-pre-2` (docs): CLAUDE.md still documents `stats:stale:v2:` as the
     protected baseline, non-downgrading scope-aware cache writes and
     `isDegradedPrFetch` as live; none exists on develop since S08
     (`assessRawFetchIntegrity` survives). Fix the doc in this run unless the
     owner wants S15 to restore the guards instead.
4. Production writes made and their reversal (8.5), with the SQL evidence.
5. Deviations from this plan and why.
6. Verdict: `READY FOR RELEASE PREP` only when every automated criterion in
   the main plan is green and no blocker or high finding is open; otherwise
   `NOT READY` with the open list.

## 8.4 Fix loop

For every finding, in severity order, on a `fix/<short-name>` branch merged
locally into `develop` (no push, no PR during the freeze):
- failing test first at the layer that owns the seam (unit, contract, e2e),
  then the minimal fix, then the affected phase's checks again;
- one commit per finding, `LE-` id in the body until issues can be filed;
- after the last fix, re-run Phase 2 in full and Phase 4.1 on both projects,
  and update the verdict.

## 8.5 Restore and teardown

Checklist, each line ticked in the report with its evidence:

- [ ] `SCORING_V7_RENDERING_ENABLED` absent from `apps/web/.env.local`; dev
      server restarted; `/settings` shows no consent control.
- [ ] `juan294` publication consent withdrawn (`scoring_v7_subjects.public_evidence_consent = false`);
      `GET /api/verify/<v7 token>` → 410.
- [ ] `studio_configs` for `juan294` deep-equals `evidence/phase1/juan294-studio-config.json`
      (revision higher, config identical); `/u/juan294/badge.svg` on 3001
      matches `evidence/phase1/juan294.svg` except timestamps and hash.
- [ ] Synthetic users deleted and proven gone:
      ```sql
      delete from user_platforms where handle like 'chapa-e2e-%';
      delete from studio_configs   where handle like 'chapa-e2e-%';
      delete from metrics_snapshots where handle like 'chapa-e2e-%';
      delete from users            where handle like 'chapa-e2e-%';
      select (select count(*) from users where handle like 'chapa-e2e-%')
           + (select count(*) from metrics_snapshots where handle like 'chapa-e2e-%')
           + (select count(*) from studio_configs where handle like 'chapa-e2e-%')
           + (select count(*) from user_platforms where handle like 'chapa-e2e-%') as residue;  -- 0
      ```
      plus `DEL` of `stats:v3:`, `svg:`, `snapshot:v2:latest:` and `avatar:`
      keys for those handles in Redis, listed by `SCAN 0 MATCH *chapa-e2e-*`.
- [ ] `users` count equals the Phase 1 value; no row other than the
      synthetic ones was created or deleted.
- [ ] `metrics_snapshots` rows added today exist only for `juan294` and
      `octocat`.
- [ ] No `feature_flags` row changed: table equals the Phase 1 capture.
- [ ] `user_platforms` unchanged for `juan294` (no connect flow completed).
- [ ] Worktree removed:
      ```bash
      kill %1 2>/dev/null                                  # next start on 3002
      rm /Users/juan/code/chapa-e2e/apps/web/.env.local
      git worktree remove /Users/juan/code/chapa-e2e
      git -C /Users/juan/code/chapa status --porcelain     # only intended local commits
      ```

## Exit criteria

8.1 all green with no 500; 8.2 accessibility ≥ 0.90 on all five URLs;
report written with a verdict; every finding fixed or explicitly deferred
with an owner decision recorded; every restore line ticked.
