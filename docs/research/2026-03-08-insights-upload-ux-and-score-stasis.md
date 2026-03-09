# Research: Insights Upload UX Gaps and Score Stasis After Upload

> Date: 2026-03-08
> Triggered by: User uploaded Claude Code insights report. Craft dimension appears (pentagon radar), but: (1) no visual progress/feedback during upload, (2) composite score stayed at 58 despite craft score ~69.

## Finding 1: Upload Has No Visible Progress Feedback

### Current Behavior

The insights upload flow is triggered from `UserMenu.tsx:62-96`. The status state machine has 4 states (`idle | processing | success | error`), and the status text is rendered inside the dropdown menu at `UserMenu.tsx:309-312`:

```typescript
{insightsStatus === "idle" && "Import Claude Code Insights"}
{insightsStatus === "processing" && "Processing…"}
{insightsStatus === "success" && "Uploaded!"}
{insightsStatus === "error" && "Import failed — try again"}
```

**The dropdown closes immediately when processing starts** (`UserMenu.tsx:75`):

```typescript
setInsightsStatus("processing");
setOpen(false);  // ← Menu closes — user never sees "Processing…"
```

**Consequence:** The user selects a file, the menu closes, and nothing visible happens until the page auto-reloads 800ms after success (`UserMenu.tsx:91`). The "Processing…" and "Uploaded!" labels are invisible because they render inside the now-closed dropdown.

### Data Flow (no visible step)

```
User clicks "Import Claude Code Insights" in dropdown
  → File picker opens (system dialog)
  → User selects .html file
  → Menu closes (setOpen(false))
  → [INVISIBLE] HTML parsed client-side (parseInsightsHtml, ~instant)
  → [INVISIBLE] POST /api/insights (server validates + computes + stores)
  → [INVISIBLE] setInsightsStatus("success")
  → Page reloads after 800ms (setTimeout, UserMenu.tsx:91)
```

The user has zero feedback between file selection and page reload. On slow connections, this gap could be multiple seconds with no indication that anything is happening.

### Existing Feedback Patterns in the Codebase

The codebase has relevant patterns that could be applied:

| Pattern | Location | Mechanism |
|---------|----------|-----------|
| Multi-step progress | `apps/web/app/generating/[handle]/GeneratingProgress.tsx:1-210` | 4 visual steps with pulsing dots, checkmarks, staggered animations |
| Terminal output log | `apps/web/app/studio/StudioClient.tsx:100-117` | `makeLine("success", "Configuration saved!")` appended to terminal output |
| Loading spinner in button | `apps/web/app/studio/StudioClient.tsx:108` | `<svg className="h-4 w-4 animate-spin">` inside disabled button |
| Error banner | `apps/web/components/ErrorBanner.tsx` | Sticky top-of-page dismissible alert |
| State machine | `apps/web/app/cli/authorize/AuthorizeClient.tsx:10-79` | `idle → approving → approved → error` with button text changes |

There is **no centralized toast/notification system** (no sonner, react-hot-toast, etc.).

---

## Finding 2: Score Unchanged After Upload — EMA Same-Day Guard

### Root Cause

The composite score stays at 58 because of the EMA smoothing function's same-day guard at `apps/web/lib/impact/smoothing.ts:61-64`:

```typescript
if (latestSnapshot.date === todayStr) {
  // Snapshot is from today — EMA was already applied on the first request.
  // Return the already-smoothed value to prevent feedback loop.
  return latestSnapshot.adjustedComposite;
}
```

### Sequence of Events

1. **Earlier today**: User visited their badge → `smoothScore()` saved a snapshot with `adjustedComposite=58`, `date="2026-03-08"`
2. **User uploads insights report** → craft score (~69) stored in DB, stats cache invalidated
3. **User visits badge again** → `computeImpactV4()` runs with craft score, producing a new raw composite (~61), BUT `smoothScore()` sees today's snapshot → returns `58` (the pre-upload value)
4. **Score displays as 58** — the EMA guard prevents same-day score updates

The same-day guard exists to prevent the "feedback loop bug" — without it, every page refresh would re-apply EMA on the already-smoothed value, causing the score to spiral toward the raw score. But it has the side effect of freezing the displayed score to whatever was computed on the **first badge request of the day**.

### When Will the Score Update?

**Tomorrow** — when the smoothScore function sees the snapshot date differs from today:

```typescript
// smoothing.ts:67-68
// Snapshot is from a previous day — apply EMA normally.
return applyEMA(currentAdjusted, latestSnapshot.adjustedComposite);
```

With `EMA_ALPHA = 0.15` (`smoothing.ts:14`):
- Tomorrow: `0.15 * newRawScore + 0.85 * 58`
- If raw adjusted goes from 58 to ~61: `0.15 * 61 + 0.85 * 58 = 58.45 → 58` (rounds down)
- Day 2: `0.15 * 61 + 0.85 * 58 ≈ 58.4 → 58` (still rounds to 58)
- Day 3+: Slowly converges. With only ~3 points difference, it may take 10+ days to fully reflect.

The EMA alpha of 0.15 (half-life ~4.3 days) means small score changes take many days to manifest visibly, by design.

### CDN Caching (Secondary Factor)

The badge SVG response has `Cache-Control: public, s-maxage=21600, stale-while-revalidate=604800` (`badge.svg/route.ts:25`). CDN-cached badges persist for up to 6 hours. Even after the EMA guard is resolved (next day), CDN caching delays visibility by up to 6 hours on any given day.

### The Actual Math: Craft Score Computation

From the user's report (`/Users/juan/Desktop/report.html`):

| Input | Value |
|-------|-------|
| Messages | 460 |
| Lines Added/Deleted | +11,084 / -734 |
| Files | 193 |
| Days | 10 |
| Sessions (active/total) | 65 / 214 |
| Tool Usage | Bash: 855, Read: 401, Edit: 232, Write: 85, Grep: 83, Agent: 77 |
| Session Types | Single Task: 18, Multi Task: 17, Iterative Refinement: 6, Exploration: 1 |
| Outcomes | Fully: 32, Mostly: 7, Partially: 3 |
| Friction | Buggy Code: 18, Wrong Approach: 14, Misunderstood: 5 |
| Satisfaction | Dissatisfied: 6, Likely Satisfied: 72, Satisfied: 26, Happy: 1 |
| Multi-clauding | 26 overlap events, 35 sessions, 21% messages |
| Response Time | Median: 74.5s, Average: 174.2s |
| Tool Errors | Other: 73, Command Failed: 48, File Not Found: 4, User Rejected: 3, File Changed: 1 |

**Computed craft sub-dimensions:**

| Sub-dimension | Score | Key Drivers |
|---------------|-------|-------------|
| Proficiency | 77 | High tool diversity (0.77), strong agent usage (77/460 = 16.7%, normalized 0.85), advanced features (multi-clauding + session diversity) |
| Effectiveness | 67 | Good achievement rate (0.90), high satisfaction (0.94), BUT high friction ratio (37 friction events / 65 sessions = 0.57, over 0.5 cap → ratio drops to 0) |
| Sophistication | 62 | Good multi-clauding intensity, decent lines/session (182), complex session rate 0.35 |

**Craft Score: `round((77 + 67 + 62) / 3) = 69` → Expert tier**

The friction penalty is the main drag on Effectiveness — 37 friction events across 65 sessions (0.57 per session) exceeds the normalization cap of 0.5, dropping `frictionRatio` to 0. Without friction, effectiveness would be ~83.

### Impact on Solo Composite

For a solo profile, the composite formula is `avg(delivery, consistency, breadth [, craft])`:
- **Without craft (3 dims):** Current composite → 58
- **With craft=69 (4 dims):** Raw composite → depends on individual dimensions, but if 3-dim sum = 174, then `(174 + 69) / 4 = 60.75 → 61`

The change is **only ~3 points** in the raw composite because craft (69) is close to the existing average (58). After recency weighting, confidence adjustment, and EMA smoothing, the visible change would be further dampened.

---

## Finding 3: Parser Drops "Happy" Satisfaction Label

### Current Behavior

The report's satisfaction chart has 4 labels: "Dissatisfied", "Likely Satisfied", "Satisfied", "Happy" (1 response). The parser's `mapSatisfaction()` (`parser.ts:228-238`) only maps 3:

```typescript
function mapSatisfaction(chart: Record<string, number>): {
  dissatisfied: number;
  likelySatisfied: number;
  satisfied: number;
} {
  return {
    dissatisfied: chart["Dissatisfied"] ?? 0,
    likelySatisfied: chart["Likely Satisfied"] ?? 0,
    satisfied: chart["Satisfied"] ?? 0,
    // "Happy" is not mapped — drops silently
  };
}
```

The `InsightsUpload` type (`packages/shared/src/types.ts`) only defines 3 satisfaction fields, so "Happy" has no home. This is a minor data loss — 1 out of 105 satisfaction responses is dropped, reducing the satisfaction rate from 99/105 (94.3%) to 98/104 (94.2%). Negligible impact on craft score.

---

## Summary

| Issue | Root Cause | Impact |
|-------|-----------|--------|
| No upload progress feedback | Status text renders inside closed dropdown (`setOpen(false)` at `UserMenu.tsx:75`) | User sees nothing between file selection and page reload |
| Score unchanged after upload | EMA same-day guard (`smoothing.ts:61-64`) returns cached snapshot value | Score frozen until next day; then changes slowly (~0.5 pts/day with alpha=0.15) |
| Score barely moves even after EMA kicks in | Craft score (69) is close to existing 3-dim average (~58), and EMA alpha=0.15 dampens changes | ~3-point raw change takes 10+ days to fully manifest |
| CDN caching | `s-maxage=21600` (6 hours) on badge SVG | Additional delay on top of EMA |
| "Happy" label dropped | Parser only maps 3 of 4 satisfaction labels | Negligible (<0.1% effect on craft score) |
