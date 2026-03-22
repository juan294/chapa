# Fix Solo Profile Scoring Regression

> Date: 2026-03-08
> Triggered by: Score dropped 58→47 after v6 merge — solo profile composite formula accidentally changed.

## Problem

The v6 unified scoring implementation accidentally removed the solo profile composite exception. On v5 (production/main), solo developers (no code reviews) had their composite calculated from 3 dimensions — Quality was excluded because it was hard-zero for reviewless profiles. The v6 refactor:

1. **Changed Quality computation**: `return 0` → `return computeSoloQuality(stats)` (non-zero value based on PR descriptions, branch strategy, etc.)
2. **Removed the solo composite exception**: All profiles now use `avg(4+ dims)` instead of solo getting `avg(3 dims)`
3. **Removed Quality Champion exclusion** for solo profiles in archetype derivation
4. **Changed SOLO_DIMENSION_KEYS**: Added "quality" (was excluded on main)

The v6 plan's Phase 1.8 showed the "BEFORE" composite code as the collaborative-only branch, missing the solo conditional. The implementation followed the plan literally, removing the solo branch.

## Root Cause (code diff)

**Main (v5) — `apps/web/lib/impact/v4.ts:196-207`:**
```typescript
const compositeScore =
  profileType === "solo"
    ? Math.round((dimensions.delivery + dimensions.consistency + dimensions.breadth) / 3)
    : Math.round((dimensions.delivery + dimensions.quality + dimensions.consistency + dimensions.breadth) / 4);
```

**Develop (v6) — `apps/web/lib/impact/v4.ts:206-211`:**
```typescript
const activeDims = [dimensions.delivery, dimensions.quality,
  dimensions.consistency, dimensions.breadth];
if (dimensions.craft != null) activeDims.push(dimensions.craft);
const compositeScore = Math.round(
  activeDims.reduce((sum, v) => sum + v, 0) / activeDims.length
);
```

## Fix Design

Restore solo profile composite behavior while preserving v6 craft integration:

1. **Solo composite**: `avg(delivery, consistency, breadth [, craft])` — 3 or 4 dims, **quality excluded**
2. **Collaborative composite**: `avg(delivery, quality, consistency, breadth [, craft])` — 4 or 5 dims (unchanged)
3. **Keep `computeSoloQuality()`**: Solo quality IS computed and shown on radar/cards as informational, but does NOT count toward the composite score
4. **Restore Quality Champion exclusion** for solo profiles in archetype derivation
5. **`SOLO_DIMENSION_KEYS`**: `["delivery", "consistency", "breadth", "craft"]` — quality excluded, craft included

### Why this design

- **v5 parity**: Solo devs without craft get identical scores to v5 (the plan's promise)
- **v6 craft works**: Solo devs WITH craft get craft factored in (4 dims instead of 3)
- **Quality still visible**: `dimensions.quality` is computed by `computeSoloQuality()` and displays on radar/cards — useful information even if it doesn't affect the composite
- **Archetype correctness**: Can't be "Quality Champion" without doing code reviews — soloQuality is a proxy metric, not true review quality

## Phase Structure

Single phase — all changes are tightly coupled (same scoring pipeline).

| Phase | Description | Files |
|-------|-------------|-------|
| 1 | Restore solo composite + archetype + constants + tests | 5 files |

## Files Changed

| File | Change |
|------|--------|
| `packages/shared/src/constants.ts` | Remove "quality" from SOLO_DIMENSION_KEYS |
| `packages/shared/src/constants.test.ts` | Update SOLO_DIMENSION_KEYS tests (4 elements, no quality) |
| `apps/web/lib/impact/v4.ts` | Restore solo composite branch + Quality Champion exclusion |
| `apps/web/lib/impact/v4.test.ts` | Update solo composite + archetype tests |
| `docs/impact-v6.md` | Document solo profile exception |

## Automated Success Criteria

- [x] `pnpm run typecheck` passes
- [x] `pnpm run lint` passes
- [x] `pnpm run test` passes — 4435 tests
- [x] Solo profile composite uses 3 dims (no quality) without craft
- [x] Solo profile composite uses 4 dims (delivery, consistency, breadth, craft) with craft
- [x] Collaborative composite unchanged (4 or 5 dims)
- [x] Solo profiles cannot be assigned Quality Champion archetype
- [x] Solo profiles can still be assigned Artificer archetype
- [x] `computeSoloQuality()` still returns non-zero for solo devs with PRs
- [x] `dimensions.quality` is still populated for solo profiles (display purposes)

## Manual Success Criteria

- [ ] Score for a solo dev without insights matches v5 calculation
