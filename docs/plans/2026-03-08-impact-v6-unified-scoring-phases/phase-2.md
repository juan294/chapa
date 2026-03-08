# Phase 2: History, Snapshots, Trend [batch-eligible]

> Can run in parallel with Phase 3 — no shared files.
> Depends on: Phase 1 (types + constants)

## Objective

Update the history/snapshot pipeline to capture and track the optional 5th `craft` dimension. Existing snapshots without craft remain valid (field is optional).

## Changes

### 2.1 — Add `craft` to `buildSnapshot` (`apps/web/lib/history/snapshot.ts:42-45`)

```typescript
// BEFORE
delivery: impact.dimensions.delivery,
quality: impact.dimensions.quality,
consistency: impact.dimensions.consistency,
breadth: impact.dimensions.breadth,

// AFTER — add craft (conditional)
delivery: impact.dimensions.delivery,
quality: impact.dimensions.quality,
consistency: impact.dimensions.consistency,
breadth: impact.dimensions.breadth,
...(impact.dimensions.craft != null && { craft: impact.dimensions.craft }),
```

### 2.2 — Add `craft` to `TrendSummary` type (`apps/web/lib/history/trend.ts:21-26`)

```typescript
// Add to TrendSummary.dimensions:
craft?: DimensionTrend;  // optional — absent for users without insights history
```

### 2.3 — Add craft trend calculation (`apps/web/lib/history/trend.ts:67-72`)

```typescript
// After breadth trend calculation, add:
if (latest.craft != null) {
  dimensions.craft = computeDimensionTrend(snapshots, "craft");
}
```

### 2.4 — Add `craft` to `SnapshotDiff` type (`apps/web/lib/history/diff.ts:27-32`)

```typescript
// Add to SnapshotDiff.dimensions:
craft?: number;  // optional delta
```

### 2.5 — Add craft delta calculation (`apps/web/lib/history/diff.ts:79-91`)

```typescript
// After breadth delta, add:
if (current.craft != null && previous.craft != null) {
  dimensions.craft = current.craft - previous.craft;
}
```

## Tests

### New tests to write FIRST (TDD):

1. **`snapshot.test.ts`**:
   - `buildSnapshot()` with craft dimension → includes `craft` field
   - `buildSnapshot()` without craft dimension → no `craft` field in output
   - Existing snapshot tests still pass

2. **`trend.test.ts`**:
   - Trend with craft snapshots → includes `craft` trend
   - Trend without craft snapshots → no `craft` in dimensions
   - Mixed snapshots (some with craft, some without) → handles gracefully

3. **`diff.test.ts`**:
   - Diff with both snapshots having craft → includes `craft` delta
   - Diff with one missing craft → no `craft` delta
   - Existing diff tests still pass

## Success Criteria

### Automated
- [ ] `pnpm run typecheck` passes
- [ ] `pnpm run test` passes — all history tests + new craft tests
- [ ] Snapshots without craft data produce identical output to v5
- [ ] Snapshots with craft data include the `craft` field

### Manual
- None
