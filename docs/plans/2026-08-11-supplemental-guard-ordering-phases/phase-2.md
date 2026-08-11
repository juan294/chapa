# Phase 2 — Teach `heal-poisoned-stats` the pre-merge shape `[batch-eligible]`

> Files: `scripts/heal-poisoned-stats.ts`, `scripts/heal-poisoned-stats.test.ts`
> No file overlap with phases 1, 3, 4.

## 1. Why

The documented recovery path could not have recovered #1060. `healHandle`
(`scripts/heal-poisoned-stats.ts:360-411`) classifies an entry via
`statsValueIsPoisoned` (`:225-232`), which ORs `isPoisonedStats` and
`isScopeBlindedStats` — both keyed purely on `prsMergedCount` / `prsMergedWeight` /
lines. `supplemental:<handle>` appears nowhere in the script.

The frivas entry on 2026-08-11 was not poisoned by either definition. It was
*pre-merge*: structurally valid GitHub-derived data that simply predated the
supplemental upload. The operator fix was a manual three-key delete.

## 2. Changes

**2.1 — Read the new baseline key.** `staleStatsKey` (`:115-117`) currently returns
`stats:stale:${handle}`. Point it at `stats:stale:v2:${handle}` to match phase 1's D2.
The script re-declares its own key builders today (`:110-120`); keep that pattern
rather than importing from `apps/web` — it is what makes this phase independent.

**2.2 — Add a `stale_supplemental` detection.** A new predicate, local to the script:

```
async function detectStaleSupplemental(cfg, handle) -> {stale: bool, uploadedAt, mergedFetchedAt}
    supplemental = await redis(cfg, ["GET", `supplemental:${handle}`])
    merged       = parsed stats:v2:merged:<handle>
    if supplemental == null or merged == null: return {stale: false}
    # A composed entry must carry the marker mergeStats sets (merge.ts:86).
    # Its absence, or a fetchedAt predating the upload, means the entry was
    # written from a value that never saw this supplemental record.
    stale = (merged.hasSupplementalData !== true)
            or (merged.fetchedAt < supplemental.uploadedAt)
    return {stale, uploadedAt: supplemental.uploadedAt, mergedFetchedAt: merged.fetchedAt}
```

**2.3 — Repair action.** When `stale` is true under `--apply`, `DEL` the composed key
and the snapshot key so the next tokenless request recomposes. Do **not** delete
`stats:stale:v2:` — it is the protected GitHub-derived baseline and is not the
defective value. Do **not** delete `supplemental:<handle>`.

**2.4 — Reporting.** Extend `HealResult` with `supplementalStale` and surface it in
`run`'s dry-run output alongside the existing poisoned flags, so an operator sees
*why* a handle was selected.

## 3. Tests

Extend `scripts/heal-poisoned-stats.test.ts`:

- composed entry with `hasSupplementalData: true` and `fetchedAt` after
  `uploadedAt` → not flagged.
- composed entry lacking `hasSupplementalData` while a supplemental record exists
  → flagged; under `--apply`, composed + snapshot keys deleted, baseline key retained.
- composed entry with `hasSupplementalData: true` but `fetchedAt` before
  `uploadedAt` → flagged (the stale-recompose case).
- no supplemental record → predicate returns false regardless of the composed entry.
- dry-run (no `--apply`) performs zero `DEL` calls — assert on the redis mock.
- **Fixture based on the real incident**: composed entry `fetchedAt`
  `2026-08-11T08:01:47.493Z`, supplemental `uploadedAt` `2026-08-11T11:14:49Z`,
  `prsMergedCount: 0`, `commitsTotal: 54` → must be flagged. This is the executable
  record that the script now catches the case it previously missed.

## 4. Success criteria

**Automated**
- `pnpm run test -- heal-poisoned-stats` green, including the incident fixture.
- `pnpm run typecheck`, `pnpm run lint` clean.

**Manual**
- Dry-run the script against a production handle known to have an EMU record and
  confirm it reports `supplementalStale: false` after phase 1 has healed it.
