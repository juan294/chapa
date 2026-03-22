# Phase 3: Change `low_activity_signal` from AND to OR

> [batch-eligible with Phase 1]

## Goal

Ensure the `low_activity_signal` confidence penalty triggers when **either** `activeDays < 30` or `commitsTotal < 50`, not only when both are true. This provides more accurate confidence for profiles with limited temporal or volume signal.

## Rationale

A developer with 17 active days out of 365 has genuinely limited temporal signal — the consistency and heatmap evenness dimensions have less data to work with regardless of total commit count. The confidence system should reflect this honestly (it's about signal quality, not behavior judgment).

## Files

| File | Change |
|------|--------|
| `apps/web/lib/impact/utils.ts:182` | Change `&&` to `\|\|` |
| `apps/web/lib/impact/utils.ts:82-91` | Update JSDoc table |
| `apps/web/lib/impact/utils.test.ts:290-328` | Update tests for OR logic |
| `docs/impact-v6.md:88-91` | Update condition in spec table |
| `docs/impact-v4.md` | Update condition reference (if exists) |

## Changes

### 1. Change condition operator

**File:** `apps/web/lib/impact/utils.ts:182`

```diff
- if (stats.activeDays < 30 && stats.commitsTotal < 50) {
+ if (stats.activeDays < 30 || stats.commitsTotal < 50) {
```

### 2. Update JSDoc

**File:** `apps/web/lib/impact/utils.ts:89`

```diff
- * | `low_activity_signal`       | -10     | < 30 active days AND < 50 total commits        |
+ * | `low_activity_signal`       | -10     | < 30 active days OR < 50 total commits         |
```

### 3. Update tests

**File:** `apps/web/lib/impact/utils.test.ts`

Replace the `low_activity_signal` describe block:

```typescript
describe("low_activity_signal flag", () => {
  it("applies -10 when both activeDays < 30 AND commitsTotal < 50", () => {
    const { confidence, penalties } = computeConfidence(
      makeStats({ activeDays: 20, commitsTotal: 30 }),
    );
    expect(confidence).toBe(90);
    expect(penalties).toHaveLength(1);
    expect(penalties[0]!.flag).toBe("low_activity_signal");
    expect(penalties[0]!.penalty).toBe(10);
  });

  it("applies when activeDays < 30 even if commitsTotal >= 50", () => {
    const { penalties } = computeConfidence(
      makeStats({ activeDays: 17, commitsTotal: 65 }),
    );
    expect(
      penalties.find((p) => p.flag === "low_activity_signal"),
    ).toBeDefined();
  });

  it("applies when commitsTotal < 50 even if activeDays >= 30", () => {
    const { penalties } = computeConfidence(
      makeStats({ activeDays: 100, commitsTotal: 30 }),
    );
    expect(
      penalties.find((p) => p.flag === "low_activity_signal"),
    ).toBeDefined();
  });

  it("does NOT apply when both activeDays >= 30 AND commitsTotal >= 50", () => {
    const { penalties } = computeConfidence(
      makeStats({ activeDays: 30, commitsTotal: 50 }),
    );
    expect(
      penalties.find((p) => p.flag === "low_activity_signal"),
    ).toBeUndefined();
  });

  it("applies at boundary: activeDays=29, commitsTotal=50", () => {
    const { penalties } = computeConfidence(
      makeStats({ activeDays: 29, commitsTotal: 50 }),
    );
    expect(
      penalties.find((p) => p.flag === "low_activity_signal"),
    ).toBeDefined();
  });

  it("applies at boundary: activeDays=30, commitsTotal=49", () => {
    const { penalties } = computeConfidence(
      makeStats({ activeDays: 30, commitsTotal: 49 }),
    );
    expect(
      penalties.find((p) => p.flag === "low_activity_signal"),
    ).toBeDefined();
  });
});
```

### 4. Update docs

**File:** `docs/impact-v6.md` — update the condition in the confidence table:

```diff
- | `low_activity_signal` | -10 | < 30 active days AND < 50 total commits |
+ | `low_activity_signal` | -10 | < 30 active days OR < 50 total commits |
```

**File:** `docs/impact-v4.md` — same change if the table exists there.

## TDD Sequence

1. **Red:** Update tests first (change AND expectations to OR). The two tests that previously checked "does NOT apply when only one condition is true" now expect the penalty to apply. These will fail.
2. **Green:** Change `&&` to `||` in `utils.ts:182`.
3. **Refactor:** Update JSDoc and docs.

## Verification

```bash
cd <worktree> && pnpm run test -- apps/web/lib/impact/utils.test.ts
```

## Success Criteria (automated)

- [x] All 6 updated low_activity_signal tests pass
- [x] All other confidence tests still pass
- [x] All v4 impact tests still pass
- [x] TypeScript compiles cleanly
- [x] impact-v4.md condition updated (impact-v6.md doesn't reference this flag directly)

## Impact Assessment

The -10 confidence penalty translates to a ~1.5% score reduction via the adjusted score formula (`base * (0.85 + 0.15 * confidence/100)`). At confidence 90 (one penalty): `multiplier = 0.985`. A composite score of 43 becomes ~42. This is a minor but honest adjustment.
