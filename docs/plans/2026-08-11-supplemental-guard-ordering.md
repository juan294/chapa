# Plan: separate GitHub-derived stats from composed stats in the caching pipeline

> Date: 2026-08-11 · Branch base: `develop` · Issues: **#1060** (critical), **#1061** (high)
> Research: `docs/research/2026-08-11-supplemental-merge-ordering.md`
> Owner decisions recorded: 2026-08-11 (see §3)

---

## 1. Problem

`_fetchAndCache` (`apps/web/lib/github/client.ts:183-437`) merges EMU supplemental
data into `stats` at line 258, then hands that merged object to two integrity guards
that exist solely to detect **GitHub token-scope blindness** — `isDegradedPrFetch`
at line 359 and the non-downgrading cache-write rule at lines 411-423.

Two defects follow from that single ordering:

- **#1060** — when the downgrade rule rejects a fetch it writes the pre-fetch `stale`
  object to the primary key (`client.ts:422`). That object was never re-composed with
  the supplemental record read moments earlier, so a user who runs `chapa merge` and
  then clicks Refresh loses the merge for 6 hours, silently, on repeat.
- **#1061** — `isDegradedPrFetch` reads `fresh.prsMergedCount`, which `mergeStats`
  has already inflated with supplemental PRs (`merge.ts:50`). A large enough EMU
  contribution lifts a blinded GitHub fetch over both detection signatures.

Neither is reachable by the existing suite: every guard test declares supplemental
`null`, every supplemental test declares stale `null`, and no test combines them
(research §8).

## 2. Approach

Establish two clearly-typed roles for stats data and never conflate them again:

- **GitHub-derived** — the raw `fetchStats` output for a handle. This is the only
  thing whose completeness depends on the authenticating token's scope, and therefore
  the only thing the integrity guards may inspect or use as a baseline.
- **Composed** — GitHub-derived with linked platforms (Bitbucket/Codeberg/GitLab) and
  EMU supplemental layered on top. This is what callers receive and what the primary
  cache key stores.

The pipeline becomes one path with one invariant:

> The guards only ever see `primary`. Everything else composes onto whichever
> GitHub-derived value wins.

This collapses today's three serve paths (`_serveStaleAndReCache` × 2 call sites plus
the normal return) into a single compose-and-return, and removes the
`stats.fetchScope` post-composition mutation.

## 3. Decisions (owner, 2026-08-11)

| # | Decision | Rationale |
|---|---|---|
| D1 | The guards judge **GitHub primary only**. Linked platforms and EMU both layer on top afterwards. | The guards detect GitHub token-scope blindness; no non-GitHub source belongs in the value they inspect. Fixes #1061 at the root and pre-empts the identical defect for Bitbucket/Codeberg/GitLab. |
| D2 | The protected baseline stores **GitHub-derived data only**, under a **new versioned key** `stats:stale:v2:<handle>`. | The guard baseline must be composed the same way as the fresh value it is compared against. Versioning orphans the existing merged-content entries so no handle is ever judged against a mismatched baseline. Old entries age out on the 7-day TTL. |
| D3 | Scope includes all four adjacent findings: heal-script supplemental awareness, the degraded-fetch telemetry field, the refresh/supplemental invalidation asymmetry, and the missing ADR. | |

### D4 — deliberate behaviour change (derived from D1/D2, flagged for approval)

Today the two rejection paths disagree about what the *caller* receives:

- degraded fetch → returns `stale` (`client.ts:376`; asserted `client.test.ts:359`)
- pure scope downgrade → returns the caller's own blinded `stats`
  (`client.ts:418-423` falls through to `return stats` at `:436`; asserted
  `client.test.ts:315` — `expect(result!.fetchScope).toBe("public")`)

Under this plan **both** return the composed better-scoped value. A user whose refresh
is rejected now sees their correct score rather than their own blinded one — which is
precisely the user-visible complaint behind #1060. `client.test.ts:294-320` is updated
to assert the new contract.

### D5 — accepted cost

On total GitHub-fetch failure the overlay sources (3 linked-platform lookups + the
supplemental read) are now loaded before serving, where today the function returns
early. This is required: the baseline is GitHub-derived, so serving it without
re-composition would drop EMU and platform data during a GitHub outage. Cost lands
only on the outage path; for unlinked users the platform calls are a short-circuited
DB check (`fetchBitbucketIfLinked` and siblings return null when unlinked). The badge
cache-miss SLO is 3000ms (`lib/monitoring/latency-slo.ts`), against which this is
comfortably in budget.

## 4. Phases

| Phase | Title | Batch | Files |
|---|---|---|---|
| 1 | Compose-after-guard restructure + versioned baseline key | no — must land first | `apps/web/lib/github/client.ts`, `stats-integrity.ts`, `client.test.ts`, `stats-integrity.test.ts` |
| 2 | Teach `heal-poisoned-stats` the pre-merge shape | `[batch-eligible]` | `scripts/heal-poisoned-stats.ts`, `scripts/heal-poisoned-stats.test.ts` |
| 3 | Normalize refresh/supplemental invalidation | `[batch-eligible]` | `apps/web/app/api/refresh/route.ts`, `apps/web/app/api/supplemental/route.ts` + their tests |
| 4 | ADR + doc updates | `[batch-eligible]` | `docs/decisions/`, `CLAUDE.md`, `docs/accepted-risks.md` |

Phases 2-4 have no file overlap with each other and none consumes Phase 1's code
output — Phase 2 and 3 are independent subsystems, Phase 4 records decisions already
fixed in this document. They may run in parallel via `/batch` once Phase 1 is merged.

Phase files: `docs/plans/2026-08-11-supplemental-guard-ordering-phases/phase-N.md`

## 5. Success criteria

### Automated

- `pnpm run test` green, including the new cross-seam cases enumerated in phase 1 §5.
- `pnpm run typecheck`, `pnpm run lint`, `pnpm run check:circular` clean.
- Coverage floor for `apps/web/lib/github/stats-integrity.ts` (90/85/90/90) still met
  (`vitest.config.ts`).
- `pnpm run test -- heal-poisoned-stats` green (phase 2).
- `pnpm run check:write-registration` unaffected.

### Manual

- On a preview deploy: upload a supplemental record for a test handle, immediately
  call `/api/refresh` as that handle, and confirm the badge reflects the merge rather
  than reverting. This is the exact sequence that produced #1060 and no automated test
  can exercise the real GitHub scope boundary.
- Confirm `stats:stale:v2:<handle>` contains no `hasSupplementalData` field and no
  linked-platform contribution for a handle that has both.

## 6. Rollout

`stats:stale:v2:` is a cold key on deploy. The first fetch per handle writes it; until
then `baseline` is null and both guards no-op (`stats-integrity.ts:60` returns false
with no baseline), so fetches write through normally. This is the intended
self-healing path — no backfill, no migration script. The hourly warm-cache cron
(#1010) populates the new key across the active handle set within an hour.

Existing `stats:stale:<handle>` entries become orphaned and expire on their 7-day TTL.
Phase 2 updates the heal script to read the new key.
