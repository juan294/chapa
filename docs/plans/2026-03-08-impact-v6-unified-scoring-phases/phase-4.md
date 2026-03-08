# Phase 4: Badge Route + Share Page Integration

> Depends on: Phases 1, 2, 3

## Objective

Wire the craft score from the database into the `computeImpactV4()` call so the 5th dimension flows through the entire pipeline: scoring → snapshot → badge → share page. Remove the standalone `CraftBreakdown` component.

## Changes

### 4.1 — Pass craft score to `computeImpactV4` in badge route (`apps/web/app/u/[handle]/badge.svg/route.ts`)

```typescript
// BEFORE (line ~100-110)
const impact = computeImpactV4(stats);
// ... later ...
const craftResult = await dbGetToolInsights(handle);

// AFTER — fetch craft BEFORE computing impact, pass as 2nd arg
const craftResult = await dbGetToolInsights(handle);
const impact = computeImpactV4(stats, craftResult?.craftScore ?? undefined);
```

**Also remove `craftScore` from badge render options** since craft is now a radar dimension:

```typescript
// BEFORE
renderBadgeSvg(stats, impact, { ..., craftScore: craftResult?.craftScore ?? null })

// AFTER — no craftScore option needed
renderBadgeSvg(stats, impact, { ..., /* craftScore removed */ })
```

### 4.2 — Pass craft score to `computeImpactV4` in share page (`apps/web/app/u/[handle]/page.tsx`)

```typescript
// BEFORE (line ~127-128)
const impact = stats ? computeImpactV4(stats) : null;

// AFTER
const craftResult = /* already fetched via dbGetToolInsights in Promise.all */;
const impact = stats ? computeImpactV4(stats, craftResult?.craftScore ?? undefined) : null;
```

### 4.3 — Remove standalone CraftBreakdown from share page (`apps/web/app/u/[handle]/page.tsx`)

```typescript
// REMOVE:
import { CraftBreakdown } from "@/components/CraftBreakdown";

// REMOVE the CraftBreakdown section (lines ~339-342):
{craftResult && <CraftBreakdown craftResult={craftResult} />}

// Craft is now shown as the 5th dimension card in ImpactBreakdown/ImpactDashboard.
```

### 4.4 — Delete `CraftBreakdown.tsx` (`apps/web/components/CraftBreakdown.tsx`)

Delete the entire file — superseded by the unified dimension card system.

### 4.5 — Update snapshot building in badge route

The `buildSnapshot()` call already captures `impact.dimensions` which now includes `craft` (from Phase 2). No code change needed here — just verify it works.

### 4.6 — Update demo data (`apps/web/lib/render/demoData.ts`)

Add craft dimension to demo impact data so demo badges show the pentagon:

```typescript
// Add to demo ImpactV4Result.dimensions:
craft: 72,  // demo craft score
```

### 4.7 — Update archetype demo data (`apps/web/lib/render/archetypeDemoData.ts`)

Add craft dimension to each archetype's demo data. For the Artificer archetype, craft should be the highest dimension.

## Tests

### New tests to write FIRST (TDD):

1. **`badge.svg/route.test.ts`**:
   - Badge with craft insights: `impact.dimensions.craft` is set, composite uses 5 dims
   - Badge without craft insights: identical to v5 (4 dims)
   - `craftScore` option no longer in badge render call
   - Snapshot includes craft field when insights exist

2. **`page.test.tsx`**:
   - Share page with craft: no `CraftBreakdown` rendered, craft dimension in impact
   - Share page without craft: identical to current behavior
   - No `CraftBreakdown` import

3. **`demoData.test.ts`** (if exists):
   - Demo data includes craft dimension

## Success Criteria

### Automated
- [ ] `pnpm run typecheck` passes
- [ ] `pnpm run test` passes
- [ ] Badge route computes 5-dim impact when craft exists
- [ ] Badge route computes 4-dim impact when craft absent
- [ ] Share page does not render CraftBreakdown
- [ ] No `CraftBreakdown` references remain in codebase
- [ ] Demo badges render with pentagon radar

### Manual
- [ ] Visit `/u/{handle}/badge.svg` for a user with craft data → pentagon radar visible
- [ ] Visit `/u/{handle}` share page → craft shown as 5th dimension card, no separate breakdown
