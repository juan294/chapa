# Phase 5: Badge + Share Page Display

> Parent plan: [Insights Integration](../2026-03-07-insights-integration.md)
> Depends on: Phase 1 (types), Phase 3 (API/DB), Phase 4 (upload UI)

## Goal

Display the Craft Score on the badge SVG and share page when a user has uploaded insights data. Add a craft breakdown section to the share page with tooltips for each sub-dimension.

## Badge SVG: Craft Indicator

### Design

When a user has a craft score, render a small indicator pill in the badge footer area (near the branding). This is subtle — it enriches the badge without cluttering it for non-users.

```
┌─────────────────────────────────────────────────────────────────┐
│  [Badge content: heatmap, radar, stats, score, tier, etc.]     │
│                                                                 │
│  ┌─────────────┐                                               │
│  │ AI Craft 72 │  ← small pill, amber accent                  │
│  └─────────────┘                                               │
│  Forged from purpose. Driven by curiosity.  [GH] [BB] [CB]    │
└─────────────────────────────────────────────────────────────────┘
```

**Pill specs:**
- Position: bottom-left, above the branding line
- Background: `rgba(139,92,246,0.08)` (same as platform pill)
- Border: `rgba(139,92,246,0.15)` with 1px stroke
- Text: "AI Craft" in `font-size: 10`, `fill: #8B8FA0` (secondary)
- Score: craft score number in `font-size: 12`, `font-weight: 700`, `fill: #8B5CF6` (amber)
- Corner radius: 6px
- Only rendered when `craftScore` is provided to the badge renderer

### File: `apps/web/lib/render/BadgeCraft.tsx`

```typescript
/**
 * Render the craft score indicator pill for the badge SVG.
 * Returns empty string if no craft score.
 */
export function renderBadgeCraft(
  x: number,
  y: number,
  craftScore: number | null
): string
```

### Modified: `apps/web/lib/render/BadgeSvg.tsx`

Add craft score to the badge rendering pipeline:

```typescript
// In the main render function, after branding:
const craftSvg = renderBadgeCraft(PAD, craftY, craftScore);
```

The `craftScore` is passed as a new optional parameter to the badge render function.

### Modified: `apps/web/app/u/[handle]/badge.svg/route.ts`

Fetch craft score alongside stats:

```typescript
import { dbGetToolInsights } from "@/lib/db/tool-insights";

// In the GET handler, after getStats():
const craftResult = await dbGetToolInsights(handle);
const craftScore = craftResult?.craftScore ?? null;

// Pass to renderer:
const svg = renderBadgeSvg(stats, impact, {
  // ...existing options
  craftScore,
});
```

## Share Page: Craft Breakdown Section

### Design

A new section on the share page that appears below the Impact breakdown when craft data exists. Follows the terminal-section pattern (command + output).

```
$ craft --breakdown
  ┌────────────────────────────────────────────────────┐
  │  AI Craft Score                              72    │
  │  Expert                                            │
  │                                                    │
  │  Proficiency    ████████████████████░░░░  78       │
  │  Effectiveness  ██████████████████░░░░░░  68       │
  │  Sophistication ██████████████████░░░░░░  70       │
  │                                                    │
  │  Source: Claude Code                               │
  │  Period: Feb 20 – Mar 7, 2026                     │
  └────────────────────────────────────────────────────┘
```

### File: `apps/web/components/CraftBreakdown.tsx`

```typescript
"use client";

interface CraftBreakdownProps {
  craftResult: CraftResult;
}

export function CraftBreakdown({ craftResult }: CraftBreakdownProps)
```

**Renders:**
- Craft score (large number) + tier label
- Three horizontal bars for proficiency, effectiveness, sophistication (0-100)
- Each bar has a label, fill bar (amber gradient), and numeric value
- Source tool icon + name ("Claude Code")
- Report period in human-readable format
- InfoTooltips on each sub-dimension explaining what it measures

**Sub-dimension tooltip content:**
- **Proficiency**: "Measures tool mastery — diverse tool usage, agent orchestration, advanced features like parallel sessions, and consistent engagement depth."
- **Effectiveness**: "Measures outcome quality — how often sessions achieve their goals, satisfaction rates, and how well friction and errors are managed."
- **Sophistication**: "Measures workflow complexity — multi-task sessions, lines of code per session, parallel workflows, and breadth of file changes."

### Modified: `apps/web/app/u/[handle]/page.tsx`

Fetch craft score server-side and pass to the page:

```typescript
const craftResult = await dbGetToolInsights(handle);

// In the JSX, after the Impact breakdown section:
{craftResult && <CraftBreakdown craftResult={craftResult} />}
```

### Modified: `apps/web/components/BadgeOverlay.tsx`

Add craft score tooltip to the badge overlay (if present):

- When hovering over the craft indicator on the badge preview, show a tooltip with:
  - "AI Craft Score: 72 (Expert)"
  - "Proficiency: 78 | Effectiveness: 68 | Sophistication: 70"
  - "Source: Claude Code"

Uses the standard tooltip pattern (portal, fixed position, z-99999 — see MEMORY.md).

## Data Flow

```
Badge route:
  getStats(handle) → stats
  computeImpactV4(stats) → impact
  dbGetToolInsights(handle) → craftResult | null
  renderBadgeSvg(stats, impact, { craftScore: craftResult?.craftScore }) → SVG

Share page:
  getStats(handle) → stats
  computeImpactV4(stats) → impact
  dbGetToolInsights(handle) → craftResult | null
  Render: ImpactBreakdown + (craftResult ? CraftBreakdown : null) + InsightsImporter
```

## Acceptance Criteria

- [x] Badge SVG shows craft indicator pill when score exists
- [x] Badge SVG renders unchanged when no craft score (backward compatible)
- [x] Share page shows craft breakdown section when data exists
- [x] Share page shows nothing extra when no craft data (no empty state)
- [x] Sub-dimension bars render correctly with proper fill widths
- [x] Tooltips work on hover/tap/keyboard for all 3 sub-dimensions
- [x] Badge overlay shows craft tooltip
- [x] Responsive layout on mobile
- [x] Typography follows design system (font-heading for numbers, font-body for labels)
- [x] Colors follow design system (amber accent, text-secondary for labels)

## Verification

```bash
pnpm run typecheck 2>&1; pnpm run lint 2>&1; pnpm run test 2>&1
```

Manual verification:
1. Upload insights via the Phase 4 importer
2. Navigate to `/u/{handle}` — verify craft breakdown section appears
3. Navigate to `/u/{handle}/badge.svg` — verify craft pill appears in SVG
4. Hover over sub-dimensions — verify tooltips
5. Check a user without insights — verify no extra UI
