# Phase 6 — Scoring: v6 consistency, then the v7 cutover on and off

Goal: the number a visitor sees is the same number everywhere, the
leaderboard is built from the drawn headline, and the flag-gated v7 path
issues, verifies, replays and reverses. Requires the Phase 5 owner session.

Writes in this phase, all in production and all on the fixture handles:
snapshots for `juan294`, `octocat`, `juan2`; v7 consent, receipt and
verification rows for `juan294`, withdrawn in 6.4. Production's running code
(v2.29.5) reads none of the v7 tables, so those rows are invisible to
production users while they exist.

## 6.0 Read-model cache regressions (8fcc0371)

Ask the user to keep the dev-server terminal visible, or to run
`pnpm run dev 2>&1 | tee logs/local-e2e/dev.log` for this phase; the
checks below read `[github] fetch` lines. Redis reads use the helper from
Phase 1.3b.

1. **Record shape.** Pick the fixture whose Phase 1.3b `PTTL` was `-2`
   (no record). If all three hold one, use `juan294` after an owner
   `POST /api/refresh`, which invalidates its record; a refresh of another
   handle is not allowed. After one cold render of `/u/<handle>`:
   `GET stats:v3:<handle>` returns `{binding: <64 hex>, referenceDate: "<today UTC>", stats: {...}}`
   and `PTTL` ≤ 21,600,000 ms.
2. **One fetch per render.** The dev log for that render contains exactly
   one `[github] fetch` line for the handle. Two lines is the dead-inflight
   regression.
3. **Inflight dedup under a burst.** For a fixture handle with no record,
   fire five concurrent `GET /api/profile/<handle>` (`xargs -P5`). Expect
   five 200s and one `[github] fetch` line.
4. **Warm read.** Second `GET /u/<handle>` on 3002 in < 2 s and no new
   `[github] fetch` line.
5. **Binding isolation.** `/u/juan294` as a visitor (server token) writes a
   record; then as the owner (session token) the `binding` value changes and
   one new fetch happens; then as a visitor again, it changes back with one
   fetch. Neither response is missing fields the other scope would have
   (the owner view still shows confidence; the visitor view never does).
6. **Invalidation.** After `POST /api/refresh?handle=juan294` and after a
   Studio save, `stats:v3:juan294` is deleted or rewritten with a later
   `PTTL` (post-write invalidation targets the real key).
7. **Cold badge miss timing.** With the SVG key absent (`?ts=` bypass does
   not bypass Redis; use the handle whose record just expired), read
   `Server-Timing` on `/u/<handle>/badge.svg`: record `materialize` and
   `total`. Exceeding the 4,100 ms cache-miss SLO is the pre-existing
   finding LE-pre-1, recorded, not re-opened.
8. **Zero timeout lines.** At the end of the phase:
   `grep -c "TimeoutError\|Unexpected end of JSON input" logs/local-e2e/dev.log`
   is 0. Any hit is a finding with the handle and what else was rendering.
9. **Landing render.** `/` on 3002 cold < 5 s and warm < 2 s (also asserted
   by the crawl), and the dev log shows no serial run of candidate
   materializations after 6.1 gives the three fixtures a headline.

## 6.1 v6 consistency (flag off)

For `juan294` (and `octocat` for the read-only surfaces):

```bash
h=juan294
curl -s "http://localhost:3001/u/$h/badge.svg?ts=$(date +%s)" > evidence/phase6/$h-v6.svg
curl -s "http://localhost:3001/api/profile/$h" | jq '{displayScore, displayTier, adjustedComposite, compositeScore, tier, archetype, scoring}'
curl -s "http://localhost:3001/api/history/$h" | jq '{trend: .trend, latest: .snapshots[-1]}'
```
```sql
select date, headline_score, adjusted_composite from metrics_snapshots where handle='juan294' order by date desc limit 3;
```

Assert: the headline in the SVG `<text>` equals `displayScore`, the share
header, and `headline_score` on the latest snapshot; `adjusted_composite`
(EMA-smoothed) may differ and must not be shown anywhere. `/api/profile` for
a visitor carries no `confidence`.

Leaderboard needs three rows whose **latest** snapshot has a headline. The
two synthetic users from Phase 1.3c hold one; `juan294`'s row for today was
written by production's cron with `headline_score = null`, so:

```bash
pnpm run recalculate-handles juan294            # dry run, read the plan
pnpm run recalculate-handles juan294 --apply    # sets stats:dirty, re-snapshots today with a headline
```

Then `/` shows three places: `board-a` (91) first, `juan294` on its badge
headline, `board-b` (64) last, each linking to `/u/<handle>`; the `juan294`
number equals its badge and `/api/profile`. On 3002 restart `next start` to
see a fresh board (revalidate 3600). No other production handle appears,
because none has a headline on its latest row.

Recompute paths, owner session:
- `POST /api/refresh?handle=juan294`: 200 once, then 429 on an immediate
  repeat; badge unchanged when inputs are unchanged.
- `POST /api/recalculate`: 200 with `persisted` reported truthfully.
- The owner panel explains v6 arithmetic (confidence, penalties, tier) and
  never words it as v7.

## 6.2 Turn v7 on, locally only

There is no `scoring_v7_rendering` row in production (049 pending), so the
env fallback governs and production is untouched:

```bash
echo 'SCORING_V7_RENDERING_ENABLED=true' >> /Users/juan/code/chapa/apps/web/.env.local
# user restarts pnpm run dev; also append to the worktree copy and restart next start on 3002
```

Immediately after: `/u/juan294/badge.svg` is **still v6** (no consent, so
`readRenderableReceipt` finds no receipt) and `/settings` now shows the
publication consent control with the withdrawal consequence stated before
agreement.

## 6.3 Consent and issuance

1. `/settings` → grant. `POST /api/evidence` `{action:"consent", owner:"juan294",
   enabled:true, publicationAcknowledged:true}` → 2xx;
   `scoring_v7_subjects.public_evidence_consent` true.
2. Grant issues synchronously:
   ```sql
   select owner_handle, revision, supersedes_id, issued_at from scoring_v7_receipts;
   select signature, receipt_id, key_version, issued_at from scoring_v7_verification;
   ```
   Expect one row, revision 1, `key_version` `v7-1`.
3. `GET /api/profile/juan294` → `scoring.policyVersion == "v7"`, composite
   point or range, `receiptId`, `revisionId`; `displayScore` null when the
   composite is a range, `displayTier` still present.
4. Badge: diamond radar (Craft never a core axis), `lower–upper` headline
   sized from the ring when ranged, no tier when the range spans a boundary,
   "insufficient evidence" instead of an archetype when any dimension is a
   range. Save `evidence/phase6/juan294-v7.svg`. OG image and Studio preview
   draw the same model.
5. Verification: strip prints `/verify/v7.<uuid>.<64-hex>`; `/verify/<token>`
   and `GET /api/verify/<token>` return the record; the legacy hex hash from
   6.1 still resolves.
6. Offline replay: `public_receipt` from the row → `evidence/phase6/receipt.json`;
   `pnpm exec tsx scripts/scoring/reference-calculator.ts evidence/phase6/receipt.json`
   prints `arithmetic_reproduced`.
7. No-op skip (#1321): `POST /api/refresh?handle=juan294` with unchanged
   evidence → still one receipt row. The revision chain on real change is
   covered by `scoring-v7-enabled.contract.test.ts` in Phase 2; it is not
   forced here because that would compose synthetic evidence onto the
   owner's production record.
8. Owner panel explains the receipt's own arithmetic; Craft shown beside the
   core, never inside it.
9. Leaderboard: a v7 range takes no place; a v7 point ranks on the drawn number.
10. `pnpm exec tsx scripts/scoring/migrate-v7.ts juan294 octocat` twice →
    byte-identical output; `--apply` refused without `CHAPA_MIGRATION_TARGET=local`
    and is not run.

## 6.4 Withdraw, then flag off

1. `/settings` → withdraw. `GET /api/verify/<v7 token>` → 410; badge, share
   page and API fall back to v6.
2. Remove the `SCORING_V7_RENDERING_ENABLED` line from both env files;
   restart both servers. Consent control disappears from `/settings`.
3. `curl … /u/juan294/badge.svg?ts=` → diff against `evidence/phase6/juan294-v6.svg`
   ignoring the generated-at text and the verification hash: no other
   difference. Repeat for `octocat`.
4. `GET /api/profile/juan294` `scoring` is null again (the receipt is
   withdrawn; the reader is unflagged by design and fails closed).
5. Record the residual production state: one `scoring_v7_subjects` row with
   consent false, one receipt row plus its revocation tombstone. The release
   runbook expects a clean recompute at relaunch, so this residue is
   acceptable and is listed in the report.

## Exit criteria

- 6.1: three handles, one number each across five surfaces; leaderboard
  places match; recompute paths behave as listed.
- 6.3: receipt and verification rows, `arithmetic_reproduced`, no-op skip
  holds, `v7.` token round-trips.
- 6.4: 410 after withdrawal, v6 byte-identical after flag off, env line gone.
