# Phase 1: Types, Constants, Scoring Engine

> Foundation phase — all subsequent phases depend on this.

## Objective

Add `craft` as an optional 5th dimension to the core type system and scoring engine. When craft data is available, the composite score averages 5 dimensions; when absent, it averages 4 (identical to v5).

## Changes

### 1.1 — Add `craft` to `DimensionScores` (`packages/shared/src/types.ts:66-71`)

```typescript
// BEFORE
interface DimensionScores {
  delivery: number;
  quality: number;
  consistency: number;
  breadth: number;
}

// AFTER
interface DimensionScores {
  delivery: number;
  quality: number;
  consistency: number;
  breadth: number;
  craft?: number;  // 0-100, optional (absent when no insights uploaded)
}
```

### 1.2 — Add `"Artificer"` to `DeveloperArchetype` (`packages/shared/src/types.ts:74-80`)

```typescript
// BEFORE
type DeveloperArchetype =
  | "Builder" | "Quality Champion" | "Marathoner"
  | "Polymath" | "Balanced" | "Emerging";

// AFTER
type DeveloperArchetype =
  | "Builder" | "Quality Champion" | "Marathoner"
  | "Polymath" | "Balanced" | "Emerging"
  | "Artificer";
```

### 1.3 — Add `craft` to `MetricsSnapshot` (`packages/shared/src/types.ts:198-201`)

```typescript
// Add after breadth field:
  craft?: number;  // 0-100, optional (v6+)
```

### 1.4 — Add `"craft"` to dimension key arrays (`packages/shared/src/constants.ts:34-51`)

```typescript
// BEFORE
export const DIMENSION_KEYS = ["delivery", "quality", "consistency", "breadth"];
export const SOLO_DIMENSION_KEYS = ["delivery", "quality", "consistency", "breadth"];

// AFTER
export const DIMENSION_KEYS = ["delivery", "quality", "consistency", "breadth", "craft"];
export const SOLO_DIMENSION_KEYS = ["delivery", "quality", "consistency", "breadth", "craft"];
```

**Note:** Since `craft` is optional (`craft?: number`), code that iterates over `DIMENSION_KEYS` and reads `dimensions[key]` must handle `undefined`. This is already the pattern for the Breadth reserved weight — the scoring engine uses `?? 0` for safety.

### 1.5 — Add Artificer archetype color (`apps/web/lib/render/theme.ts`)

```typescript
// Add to getArchetypeColor():
case "Artificer": return "#F59E0B";
```

### 1.6 — Update `computeImpactV4` signature (`apps/web/lib/impact/v4.ts:195-228`)

```typescript
// BEFORE
export function computeImpactV4(stats: StatsData): ImpactV4Result

// AFTER — optional craftScore parameter
export function computeImpactV4(stats: StatsData, craftScore?: number): ImpactV4Result
```

### 1.7 — Update `computeDimensions` (`apps/web/lib/impact/v4.ts:129-136`)

```typescript
// BEFORE
export function computeDimensions(stats: StatsData): DimensionScores {
  return {
    delivery: computeDelivery(stats),
    quality: computeQuality(stats),
    consistency: computeConsistency(stats),
    breadth: computeBreadth(stats),
  };
}

// AFTER
export function computeDimensions(stats: StatsData, craftScore?: number): DimensionScores {
  const dims: DimensionScores = {
    delivery: computeDelivery(stats),
    quality: computeQuality(stats),
    consistency: computeConsistency(stats),
    breadth: computeBreadth(stats),
  };
  if (craftScore != null) {
    dims.craft = Math.round(Math.max(0, Math.min(100, craftScore)));
  }
  return dims;
}
```

### 1.8 — Update composite score calculation (`apps/web/lib/impact/v4.ts:200-206`)

```typescript
// BEFORE
const compositeScore = Math.round(
  (dimensions.delivery + dimensions.quality +
   dimensions.consistency + dimensions.breadth) / 4
);

// AFTER — dynamic dimension count
const activeDims = [dimensions.delivery, dimensions.quality,
  dimensions.consistency, dimensions.breadth];
if (dimensions.craft != null) activeDims.push(dimensions.craft);
const compositeScore = Math.round(
  activeDims.reduce((sum, v) => sum + v, 0) / activeDims.length
);
```

### 1.9 — Add Artificer to `ARCHETYPE_MAP` (`apps/web/lib/impact/v4.ts:151-156`)

```typescript
// BEFORE
const ARCHETYPE_MAP = [
  { key: "breadth", archetype: "Polymath" },
  { key: "quality", archetype: "Quality Champion" },
  { key: "consistency", archetype: "Marathoner" },
  { key: "delivery", archetype: "Builder" },
];

// AFTER — Artificer at lowest priority
const ARCHETYPE_MAP = [
  { key: "breadth", archetype: "Polymath" },
  { key: "quality", archetype: "Quality Champion" },
  { key: "consistency", archetype: "Marathoner" },
  { key: "delivery", archetype: "Builder" },
  { key: "craft", archetype: "Artificer" },
];
```

### 1.10 — Update `deriveArchetype` to handle optional craft (`apps/web/lib/impact/v4.ts:158-189`)

The function iterates `DIMENSION_KEYS` and reads `dimensions[key]`. Since `craft` is optional, filter out undefined values:

```typescript
// In deriveArchetype:
const keys = isSolo ? SOLO_DIMENSION_KEYS : DIMENSION_KEYS;
const values = keys.map((k) => dimensions[k]).filter((v): v is number => v != null);
// rest of logic unchanged — avg, max, min, range all work on filtered values

// In ARCHETYPE_MAP iteration:
for (const { key, archetype } of ARCHETYPE_MAP) {
  const val = dimensions[key];
  if (val != null && val >= 60 && val === max) {
    return archetype;
  }
}
```

## Tests

### New tests to write FIRST (TDD):

1. **`v4.test.ts`** — Composite score with craft:
   - `computeImpactV4(stats)` without craft → same as v5 (avg of 4)
   - `computeImpactV4(stats, 80)` with craft → avg of 5 dimensions
   - Craft dimension appears in `result.dimensions.craft`
   - Craft dimension absent when no craftScore provided
   - Composite is correctly rounded

2. **`v4.test.ts`** — Archetype with craft:
   - Artificer triggers when `craft >= 60 AND craft === max`
   - Artificer does NOT trigger when another dim is higher (lowest priority)
   - Existing archetypes unchanged when craft is absent
   - Balanced archetype still works with 5 dimensions (range ≤ 20, avg ≥ 50)
   - Emerging gate with 5 dimensions

3. **`constants.test.ts`** — Dimension keys include "craft"

4. **`types` compile check** — DimensionScores accepts craft as optional

## Success Criteria

### Automated
- [ ] `pnpm run typecheck` passes
- [ ] `pnpm run lint` passes
- [ ] `pnpm run test` passes — all existing tests + new v6 tests
- [ ] `computeImpactV4(stats)` returns identical results to v5 (no craft)
- [ ] `computeImpactV4(stats, craftScore)` returns 5-dim result with correct composite
- [ ] Artificer archetype triggers correctly
- [ ] All 6 other archetypes still trigger correctly

### Manual
- None — all verifiable via automated tests
