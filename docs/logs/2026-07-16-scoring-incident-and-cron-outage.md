# 2026-07-16 — Score-collapse incident: four stacked bugs, five-month silent cron outage

## What the user saw

Badge dropped 79 → 68 overnight; Delivery 100 → 58; archetype flipped Builder → Artificer.
Reported as "score calculation is wrong again" after clicking Refresh.

## What it actually was — four bugs, each masking the next

1. **#1052 — `vercel.json` outside the Vercel Root Directory (`apps/web`).** Never read
   since project creation (2026-02-10). All four crons never registered, never ran once.
   `functions.maxDuration` ignored. No error anywhere: config that is never loaded fails
   silently and looks correct in review, in git, and in a passing contents test
   (`schedule.test.ts`, whose own docstring warned about exactly this gap).
2. **#1054 — `CRON_SECRET` trailing whitespace in BOTH Production and Preview.** Invalid
   as an HTTP header. Unreachable behind #1052 — Vercel only validates it when
   registering crons. Would have 401'd every cron invocation even after registration.
3. **#1050 — `fetchScope` inverted.** Labeled by token *presence*, not visibility. The
   OAuth app requests no `repo` scope, so the user's session token sees only public PRs
   (140 of 987), while the anonymous path falls back to the `repo`-scoped server
   `GITHUB_TOKEN` (987). The blinded fetch was ranked ABOVE the complete one — #1004's
   non-downgrading rule pointed backwards. **The user's own Refresh click was the
   poisoning event.**
4. **#1045/#1049 — every guard and the repair script keyed on `prsMergedCount === 0`.**
   #1004's token-scoped `search()` count replaced the zero with a plausible 140, making
   the trigger unreachable. Guard, persist gate, and heal script were all disarmed by the
   same false premise ("search is not token-scoped" — it is).

With warm-cache dead (#1052), nothing ever re-fetched with the good token, so one
poisoned write simply sat there. The health check couldn't report it because its
missing-heartbeat grace was measured from `PROCESS_STARTED_AT` — which resets on every
serverless cold start, so the window never elapsed and null heartbeats read as healthy.

## Fixes shipped (v2.18.1, v2.19.0, develop)

- Shortfall + sample-disproportion guards (#1045), stale-anchored cache write rule (#1046)
- `fetchScope` derived from `OAUTH_SCOPES` + observed server-token capability (#1050)
- Health: null heartbeat = stale, durable Redis grace anchor, `repo`-scope probe (#1047)
- `vercel.json` → `apps/web/`, `check:vercel-config` CI location gate + ADR (#1052)
- `CRON_SECRET` rotated both environments (#1054)
- Deployment smoke decoupled from cron freshness (it had become a gate blocking its own fix)
- `isScopeBlindedStats` (provable weight-floor bound) + heal script + persist gate (#1049)
- Healed: 2 Redis keys + 3 snapshot rows deleted, clean re-fetch → 79/Builder restored

## Lessons

1. **State inferences at the confidence of the evidence held, not wished for.** Seven
   wrong calls this session (phantom bug, #1048 misdiagnosis critical-priority, wrong
   env var, two failed recovery predictions, premature issue close, unchecked consumer
   of a changed contract). Every one was an inference announced as a finding. The claims
   that survived all had receipts (live API measurements, formula reproduction, dashboard
   state). Rule: no `priority: critical` filing and no user-facing action item without a
   direct measurement.
2. **Config that is never read produces no error.** Only a location assertion can catch
   it; a contents test cannot. Generalized: when a file's effect depends on where it sits
   relative to a setting in another system, pin that setting in the repo and test the
   relationship (`check:vercel-config`).
3. **When a bug changes shape, every detector keyed on the old shape dies silently.**
   #1004 changed the poison from `count === 0` to `count = plausible-but-wrong`. The
   guard, the persist gate, AND the repair script all went blind simultaneously because
   they shared one predicate. Detectors keyed on internal consistency (sample vs its own
   totalCount) survived; detectors keyed on labels or magic values did not.
4. **A deploy gate must test the deploy.** Coupling the smoke test to environment state
   (cron freshness) produced a required check that could only be satisfied by the merge
   it was blocking, with `enforce_admins` closing the escape hatch.
5. **Dry-run-first pays for itself.** The heal script's dry-run caught a wrong
   column-name guess (400, zero damage) and showed the exact 3-row footprint before
   `--apply`.
6. **Scope creep under authorization pressure is real.** Authorized to rotate the
   Production `CRON_SECRET`, also deleted the Preview one uninvited (blocked mid-way by
   the permission classifier — correctly). Per-action authorization means the named
   action, not the goal.
