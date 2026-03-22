# Phase 1: Restore Solo Profile Composite + Archetype + Tests

> Single phase — all changes tightly coupled.

## Objective

Restore v5 solo profile scoring behavior: composite excludes Quality, archetype excludes Quality Champion. Preserve v6 craft integration for both profile types.

## Changes

### 1.1 — Update `SOLO_DIMENSION_KEYS` (`packages/shared/src/constants.ts:47-53`)

```typescript
// BEFORE (v6 — includes quality, breaks v5 parity)
export const SOLO_DIMENSION_KEYS: (keyof import("./types").DimensionScores)[] = [
  "delivery",
  "quality",
  "consistency",
  "breadth",
  "craft",
];

// AFTER — quality excluded (matches v5), craft retained (v6 feature)
export const SOLO_DIMENSION_KEYS: (keyof import("./types").DimensionScores)[] = [
  "delivery",
  "consistency",
  "breadth",
  "craft",
];
```

Update the JSDoc comment to clarify:
```typescript
/**
 * Dimension keys used for solo profile composite scoring and archetype derivation.
 * Quality is excluded — solo quality (computed from PR descriptions, branch strategy,
 * issue linkage) is displayed on radar/cards but does not count toward the composite.
 * Craft is included when present (v6).
 */
```

### 1.2 — Restore solo composite formula (`apps/web/lib/impact/v4.ts:206-211`)

```typescript
// BEFORE (v6 — no solo exception)
const activeDims = [dimensions.delivery, dimensions.quality,
  dimensions.consistency, dimensions.breadth];
if (dimensions.craft != null) activeDims.push(dimensions.craft);
const compositeScore = Math.round(
  activeDims.reduce((sum, v) => sum + v, 0) / activeDims.length
);

// AFTER — solo excludes quality from composite, craft included when present
const activeDims = profileType === "solo"
  ? [dimensions.delivery, dimensions.consistency, dimensions.breadth]
  : [dimensions.delivery, dimensions.quality, dimensions.consistency, dimensions.breadth];
if (dimensions.craft != null) activeDims.push(dimensions.craft);
const compositeScore = Math.round(
  activeDims.reduce((sum, v) => sum + v, 0) / activeDims.length
);
```

### 1.3 — Restore Quality Champion exclusion for solo (`apps/web/lib/impact/v4.ts:186-191`)

```typescript
// BEFORE (v6 — no exclusion, solo can become Quality Champion)
for (const { key, archetype } of ARCHETYPE_MAP) {
  const val = dimensions[key];
  if (val != null && val >= 60 && val === max) {
    return archetype;
  }
}

// AFTER — solo profiles skip Quality Champion (restored from v5)
const candidates = isSolo
  ? ARCHETYPE_MAP.filter((a) => a.archetype !== "Quality Champion")
  : ARCHETYPE_MAP;

for (const { key, archetype } of candidates) {
  const val = dimensions[key];
  if (val != null && val >= 60 && val === max) {
    return archetype;
  }
}
```

### 1.4 — Update `SOLO_DIMENSION_KEYS` tests (`packages/shared/src/constants.test.ts:149-171`)

```typescript
// BEFORE
it("contains all five dimensions including craft", () => {
  expect(SOLO_DIMENSION_KEYS).toEqual(["delivery", "quality", "consistency", "breadth", "craft"]);
});
it("includes quality (solo quality uses engineering discipline signals)", () => {
  expect(SOLO_DIMENSION_KEYS).toContain("quality");
});
it("has 5 elements", () => {
  expect(SOLO_DIMENSION_KEYS).toHaveLength(5);
});

// AFTER
it("contains solo dimensions without quality", () => {
  expect(SOLO_DIMENSION_KEYS).toEqual(["delivery", "consistency", "breadth", "craft"]);
});
it("excludes quality (solo quality is displayed but not in composite)", () => {
  expect(SOLO_DIMENSION_KEYS).not.toContain("quality");
});
it("has 4 elements", () => {
  expect(SOLO_DIMENSION_KEYS).toHaveLength(4);
});
```

### 1.5 — Update solo composite tests (`apps/web/lib/impact/v4.test.ts:769-795`)

```typescript
// BEFORE
it("uses 4 dimensions (including solo quality) for solo profiles", () => {
  // ...
  // Solo composite = (delivery + quality + consistency + breadth) / 4
  const expectedAvg = Math.round(
    (dims.delivery + dims.quality + dims.consistency + dims.breadth) / 4
  );

// AFTER
it("uses 3 dimensions (excluding quality) for solo profiles without craft", () => {
  // ...
  // Solo composite = (delivery + consistency + breadth) / 3
  const expectedAvg = Math.round(
    (dims.delivery + dims.consistency + dims.breadth) / 3
  );
```

Add a new test for solo with craft:
```typescript
it("uses 4 dimensions (excluding quality, including craft) for solo profiles with craft", () => {
  const stats = makeStats({
    prsMergedWeight: 80,
    issuesClosedCount: 40,
    commitsTotal: 300,
    activeDays: 200,
    heatmapData: makeUniformHeatmap(14),
    reposContributed: 8,
    topRepoShare: 0.3,
    totalStars: 50,
    reviewsSubmittedCount: 0, // solo
    prsMergedCount: 20,
    prDescriptionRate: 0.8,
    featureBranchRate: 0.9,
    issueLinkageRate: 0.5,
  });
  const result = computeImpactV4(stats, 75); // craft score = 75
  const dims = result.dimensions;

  // Solo composite = (delivery + consistency + breadth + craft) / 4
  const expectedAvg = Math.round(
    (dims.delivery + dims.consistency + dims.breadth + dims.craft!) / 4
  );
  expect(result.compositeScore).toBe(expectedAvg);
  expect(result.profileType).toBe("solo");
  expect(dims.craft).toBe(75);
});
```

### 1.6 — Update solo archetype tests (`apps/web/lib/impact/v4.test.ts:876-879`)

```typescript
// BEFORE
it("CAN assign Quality Champion to solo profiles (solo quality is now scored)", () => {
  const dims: DimensionScores = { delivery: 50, quality: 85, consistency: 60, breadth: 55 };
  expect(deriveArchetype(dims, "solo")).toBe("Quality Champion");
});

// AFTER — restore exclusion
it("CANNOT assign Quality Champion to solo profiles", () => {
  // Even if quality is highest, solo profiles can't be Quality Champion
  const dims: DimensionScores = { delivery: 50, quality: 85, consistency: 60, breadth: 55 };
  // Quality is excluded from SOLO_DIMENSION_KEYS → not considered for archetype
  // No remaining dim >= 60 → falls to Emerging
  expect(deriveArchetype(dims, "solo")).not.toBe("Quality Champion");
});
```

### 1.7 — Update `docs/impact-v6.md`

Add a section documenting the solo profile exception:

```markdown
## Solo Profile Exception

Solo developers (zero code reviews) receive a modified composite calculation:

- **Composite**: `avg(Delivery, Consistency, Breadth [, Craft])` — Quality excluded
- **Quality dimension**: Computed via `computeSoloQuality()` (PR descriptions, branch strategy,
  issue linkage, micro-commit ratio) — displayed on radar/cards for informational purposes
- **Archetype**: Quality Champion is excluded for solo profiles
- **Rationale**: Solo quality is a proxy metric based on engineering discipline signals,
  not peer review activity. Including it in the composite would unfairly penalize solo
  developers who lack the opportunity for code reviews.

This preserves v5 scoring parity for solo developers while adding v6 craft integration.
```

## Tests

### Modified tests:
1. `SOLO_DIMENSION_KEYS` — 4 elements, excludes quality, includes craft
2. Solo composite — uses 3 dims (no quality) without craft
3. Solo composite with craft — uses 4 dims (no quality, yes craft)
4. Solo archetype — cannot be Quality Champion

### New tests:
1. Solo composite with craft score — verifies 4-dim average
2. Solo quality still computed — `dimensions.quality` is non-zero for solo with PRs (display only)

### Unchanged tests:
1. Collaborative composite — still 4 or 5 dims (all pass as-is)
2. `computeSoloQuality()` — formula unchanged
3. Craft dimension tests — unaffected by solo exception

## Verification

```bash
pnpm run typecheck 2>&1; pnpm run lint 2>&1; pnpm run test 2>&1
```

## Success Criteria

### Automated
- [ ] `pnpm run typecheck` passes
- [ ] `pnpm run lint` passes
- [ ] `pnpm run test` passes
- [ ] Solo composite = avg(3 dims) without craft
- [ ] Solo composite = avg(4 dims) with craft (quality excluded, craft included)
- [ ] Collaborative composite unchanged
- [ ] Solo cannot be Quality Champion
- [ ] Solo CAN be Artificer (with high craft)
- [ ] `dimensions.quality` still populated for solo profiles

### Manual
- [ ] None — all verifiable via automated tests
