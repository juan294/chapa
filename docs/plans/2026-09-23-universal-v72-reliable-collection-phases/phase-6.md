# Phase 6: reverse the docs

Parent plan: `../2026-09-23-universal-v72-reliable-collection.md`. Depends on phase 5, because the docs must describe what shipped. Not batch-eligible.

## Goal

Every checked-in statement about consent, v6 fallback, rollout-by-flag, snapshots or v6 verification matches the new system. A new decision record supersedes the consent and fallback decisions.

## Files

| File | Change |
|---|---|
| `docs/decisions/2026-09-23-universal-v72-no-consent.md` (new) | Owner decision, the reasons (no users; opt-in is meaningless; silent skip), what is superseded, the #1239 boundary (signed-up users only), and the durable queue |
| `CLAUDE.md` | Goal #2 (drop the v6 selection and fallback sentences), goal #9 (standings are v7.2 only), goal #6 (verification is receipt tokens only), the one-liner and the "production stays on v6" paragraph. The caching rules drop the metrics snapshot / verification / snapshot-write bullets and the v6 degraded-fetch history where it is now dead. Add a `collect-evidence` cron bullet (Webhooks & Cron) and a queue bullet (Caching rules). Data & types: remove `ImpactV6Result*` and `MetricsSnapshot`. Acceptance criteria: remove the "Legacy v6 only" lines and the confidence line. Routes: add `/api/scoring/status` and `/api/cron/collect-evidence`. Health: add `scoringQueue`. |
| `docs/impact-v7.md` | Remove "rollout-off policy" and "explicitly labelled fallback" (:7-9); describe the scoring states |
| `docs/impact-v6.md` | Add a header: "Retired 2026-09-23. Historical reference only." |
| `docs/runbooks/scoring-v7-transition.md` | Replace with `docs/runbooks/scoring-collection-queue.md`: reading the health block, what to do about stuck or failed jobs, and how to retry. The old file is deleted and its history stays in git. |
| `docs/release/scoring-v7-release-packet.md` | Mark it superseded, pointing to the new ADR |
| `docs/decisions/2026-09-05-scoring-v7-policy.md`, `2026-09-08-scoring-v7-observed-point-policy.md` | Add a "Superseded in part by 2026-09-23" note on the consent lines |
| `docs/plans/2026-09-08-v7-single-score-consistency-phases/policy.md` | Mark the "Consent and privacy" section (:65-69) superseded |
| `docs/scoring-consumer-inventory.md` | Regenerate the consumer list without v6 |
| `docs/accepted-risks.md` | Add: public scores for all signed-up users without opt-in (owner decision) and 410 for retired v6 codes. Remove the v6-only risks. |
| `docs/webmcp.md`, `apps/web/app/llms.txt` + `llms-full.txt` routes' copy | Remove the v6/legacy wording in tool descriptions |
| `.claude/rules/*`, `.claude/skills/*` | `grep -rln "v6\|consent\|metrics_snapshots" .claude` → update any operational rule that still references them |

## Steps

1. Write the ADR first. Every other doc edit links to it.
2. Run the sweep (the output is recorded in the PR description):

   ```bash
   grep -rnE "v6|legacy aggregate|legacy_aggregate|consent|metrics_snapshots|verification_records|scoring_v7_rendering|MetricsSnapshot|ImpactV6" CLAUDE.md docs .claude apps/web/app/llms*.txt* | grep -v "docs/plans/2026-0[1-9]-[0-2]" 
   ```

   Every hit is either updated, or marked historical in a dated plan or research doc. Dated historical plans are not rewritten.
3. Run `pnpm run release:validate-docs`. It must pass.

## Success criteria

**Automated**
- `release:validate-docs` passes.
- The sweep command above shows only historical or dated-doc hits.

**Manual**
- The owner reads the ADR and the new CLAUDE.md goal #2.
