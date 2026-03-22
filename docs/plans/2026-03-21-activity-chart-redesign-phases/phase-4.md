# Phase 4: Tests Update

> Update test suite to cover the new activity chart elements and remove tests for removed elements.

## Changes

### 1. Remove obsolete tests

- Remove test "renders dot timeline chart" that queries for `role="img"` with old name (if the aria-label changed)
- Remove any test checking for "active days in the last year" paragraph (removed in Phase 3)

### 2. New tests for insight cards

```pseudo
it("renders streak card with day indicators", () => {
  render(<ActivityHeatmap heatmapData={data} activeDays={5} dimensions={dims} />);
  expect(screen.getByText("Current streak")).toBeTruthy();
  // 7 day indicator dots should be present
  expect(screen.getByText("Best:")).toBeTruthy();
});

it("renders rhythm card with weekday distribution", () => {
  render(<ActivityHeatmap heatmapData={data} activeDays={5} dimensions={dims} />);
  expect(screen.getByText("Most active day")).toBeTruthy();
  // Mini bar chart has 7 day labels
  expect(screen.getAllByText(/^[MTWTFSS]$/).length).toBeGreaterThanOrEqual(7);
});

it("renders this-week card with average comparison", () => {
  render(<ActivityHeatmap heatmapData={data} activeDays={5} dimensions={dims} />);
  expect(screen.getByText("This week")).toBeTruthy();
});
```

### 3. New tests for dot grid improvements

```pseudo
it("shows day-of-week column headers", () => {
  render(<ActivityHeatmap heatmapData={data} activeDays={5} />);
  // Should have M, T, W, T, F, S, S headers
  const headers = screen.getAllByText(/^[MTWFS]$/);
  expect(headers.length).toBeGreaterThanOrEqual(7);
});

it("shows relative week labels for recent weeks", () => {
  // Generate data ending today so "This wk" appears
  const recentData = makeDays(recentStartDate, counts);
  render(<ActivityHeatmap heatmapData={recentData} activeDays={10} />);
  expect(screen.getByText("This wk")).toBeTruthy();
});

it("highlights peak day dot", () => {
  // Peak dot should have a box-shadow ring
  // This is a visual test — verify via style attribute or class
});

it("shows dot size legend", () => {
  render(<ActivityHeatmap heatmapData={data} activeDays={5} />);
  expect(screen.getByText("Low")).toBeTruthy();
  expect(screen.getByText("Med")).toBeTruthy();
  expect(screen.getByText("High")).toBeTruthy();
});
```

### 4. Test for summary header

```pseudo
it("shows contextual summary instead of generic active days count", () => {
  render(<ActivityHeatmap heatmapData={data} activeDays={42} />);
  // Should NOT show the old generic paragraph
  expect(screen.queryByText(/active days in the last year/)).toBeNull();
  // Should show a summary (exact text depends on data, so test for structure)
  // The summary is inside a <p> with text-secondary styling
});
```

### 5. Keep passing tests

Verify existing passing tests still work:
- Dimension legend rendering
- Peak callout (now integrated into grid, but tooltip still works)
- CSS variable usage (static analysis test)
- Graceful fallback without dimensions prop

## Files Changed
- `apps/web/components/dashboard/ActivityHeatmap.test.tsx`

## Success Criteria
- **Automated:** all tests pass, no skipped tests, full suite green
