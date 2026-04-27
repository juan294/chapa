# Phase 8 — Render: all-zero radar fallback

**Source findings:** B12
**Depends on:** none
**Batch:** [batch-eligible]

## Goal

When every dimension is 0 (newly-onboarded handle, empty data cases), render a visible "no-data" center dot instead of collapsing the polygon to a zero-area point that's invisible on dark backgrounds.

## Files touched

- `apps/web/lib/render/RadarChart.ts` (lines around 71–76)
- Tests: `RadarChart.test.ts`

## TDD — Red tests first

```ts
// RadarChart.test.ts
describe("RadarChart — all-zero dimensions (B12)", () => {
  it("renders a visible center marker instead of collapsing polygon", () => {
    const svg = RadarChart({ delivery: 0, quality: 0, consistency: 0, breadth: 0 });
    // No empty polygon
    expect(svg).not.toMatch(/<polygon points=""/);
    // Visible center placeholder (a small circle or textual indicator)
    expect(svg).toMatch(/<circle .*r="3".*data-role="radar-empty-marker"/);
  });
  it("renders a 5-dim pentagon normally when craft is present", () => {
    const svg = RadarChart({ delivery:50, quality:60, consistency:70, breadth:40, craft:30 });
    expect(svg).toMatch(/<polygon/);
  });
});
```

## Green — implementation pseudocode

```ts
// RadarChart.ts
const allZero = Object.values(dims).every(v => v === 0);
if (allZero) {
  return `
    <g class="radar-empty">
      ${axesSVG}
      <circle cx="${cx}" cy="${cy}" r="3" data-role="radar-empty-marker"
              fill="var(--color-text-secondary)" opacity="0.5" />
      <text x="${cx}" y="${cy + 18}" text-anchor="middle"
            font-family="JetBrains Mono" font-size="10"
            fill="var(--color-text-secondary)" opacity="0.6">no data yet</text>
    </g>
  `;
}
// ... existing polygon rendering ...
```

## Automated success criteria

- New tests green.
- Existing RadarChart snapshot tests updated once with a note in the phase commit.
- `pnpm run test -- RadarChart` green.

## Manual success criteria

- Visit `/u/:handle/badge.svg` for a freshly-logged-in user with no data yet (or mock a zero snapshot in preview). Confirm the center marker + "no data yet" caption appears instead of an invisible polygon.

## Notes

- Copy is deliberately soft ("no data yet") — matches the non-accusatory-messaging rule already in effect for confidence penalties.
- Works for both 4-dim (diamond fallback) and 5-dim (pentagon) variants — the zero-check wraps both rendering branches.

## Status

- [x] Implemented on 2026-04-22
- [x] Verified with `pnpm run typecheck`, `pnpm run lint`, `pnpm exec vitest run apps/web/lib/render/RadarChart.test.ts`, and `pnpm run test`
- [x] Added the all-zero empty-state marker for both the 4-axis and 5-axis radar variants
- [x] Updated the existing RadarChart tests for the new marker behavior; there were no separate RadarChart snapshot fixtures in this repo to refresh
