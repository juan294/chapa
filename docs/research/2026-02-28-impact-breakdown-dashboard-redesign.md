# Research: Impact Breakdown Dashboard Redesign

> Generated: 2026-02-28 | Branch: `develop` | 5 parallel research agents

## Purpose

Research the current impact breakdown section implementation, gather design inspiration from top-tier performance dashboards (athlete apps, SaaS analytics, developer tools), and document all available data that could be visualized — to inform a plan for redesigning the impact breakdown into a professional, full-featured performance dashboard.

---

## Part 1: Current Implementation

### Share Page Structure

**File:** `apps/web/app/u/[handle]/page.tsx`

The impact breakdown is rendered on the share page (`/u/:handle`). Key sections:

- **Lines 297-330:** Impact Breakdown section (owner-only via `{isOwner && <>...</>}`)
- **Lines 314-329:** Archetype header — archetype name (`text-3xl font-extrabold text-amber`), tier badge, profile description from `getArchetypeProfile()`
- **Lines 333-336:** Main dashboard — `<ImpactBreakdown impact={impact} stats={stats} />`

### ImpactBreakdown Component

**File:** `apps/web/components/ImpactBreakdown.tsx` (294 lines)

Three exports:
1. `DataSources({ stats, handle })` — lines 88-151
2. `getArchetypeProfile(impact)` — lines 179-193
3. `ImpactBreakdown({ impact, stats })` — lines 200-294

#### Current Layout

**Performance Dimensions (lines 206-251):**
- 2-column grid (`grid-cols-1 sm:grid-cols-2 gap-3`)
- 4 cards, each showing:
  - Dimension label (uppercase, tracking-wider, text-xs)
  - Score (font-heading text-3xl font-extrabold)
  - InfoTooltip button
  - Progress bar (h-1.5 rounded-full with gradient fill)
  - Subtitle text (text-xs text-secondary/50)
- Staggered `animate-fade-in-up` (400ms start, 100ms intervals)
- Progress bars use `animate-bar-fill` (600ms start)

**Key Numbers (lines 254-289):**
- 4-column grid (`grid-cols-2 sm:grid-cols-4 gap-3`)
- 8 stat cards: Stars, Forks, Watchers, Active Days, Commits, PRs Merged, Reviews, Repos
- Each card: value (font-heading text-2xl) + label (text-xs uppercase) + InfoTooltip
- Values formatted via `formatCompact()` (0, 999, 1.2k, 15.7k notation)
- Staggered entrance (700ms start, 60ms intervals)

#### What's Missing from Current Implementation

- No radar chart (radar exists only in badge SVG, not on web page)
- No trend/sparkline data
- No historical comparison
- No coaching beyond the archetype profile text
- No interactive drill-down into dimension sub-components
- No visual hierarchy between composite score and dimensions
- No score ring or gauge visualization
- Simple progress bars as the only visualization primitive
- Flat information architecture (everything at the same visual weight)

### Dimension Configuration

**Colors** (defined in `globals.css`):
| Dimension | Color | Light Variant |
|-----------|-------|---------------|
| Delivery | `#22c55e` (green) | `#86efac` |
| Quality | `#f97316` (orange) | `#fdba74` |
| Consistency | `#06b6d4` (cyan) | `#67e8f9` |
| Breadth | `#ec4899` (pink) | `#f9a8d4` |

**Archetype Colors** (from `theme.ts`):
| Archetype | Color |
|-----------|-------|
| Builder | `#8B5CF6` (purple) |
| Quality Champion | `#F472B6` (pink) |
| Marathoner | `#16A34A` (green) |
| Polymath | `#FCD34D` (gold) |
| Balanced | `#64748B` (steel) |
| Emerging | `#F97316` (orange) |

**Tier Colors**:
| Tier | Color |
|------|-------|
| Emerging | `#9AA4B2` (muted gray) |
| Solid | `#E6EDF3` (light gray) |
| High | `#A78BFA` (light purple) |
| Elite | `#8B5CF6` (signature purple) |

### Existing Visualization Primitives (available for reuse)

| Primitive | Location | Description |
|-----------|----------|-------------|
| Radar chart SVG | `apps/web/lib/render/RadarChart.ts` | 4-point diamond, concentric guides at 25/50/75/100%, vertex dots |
| Heatmap grid | `apps/web/lib/effects/heatmap/HeatmapGrid.tsx` | 13×7 CSS grid, 5-level intensity, 4 animation variants |
| Progress bar anim | `globals.css` (`animate-bar-fill`) | scaleX 0→1 over 0.8s |
| Ring/gauge anim | `globals.css` (`gauge-fill`) | stroke-dashoffset over 1.5s |
| Animated counter | `apps/web/lib/effects/counters/use-animated-counter.ts` | Number tweening with easeOut/spring |
| In-view detection | `apps/web/lib/effects/counters/use-in-view.ts` | Viewport visibility trigger |
| Score text effects | `apps/web/lib/effects/text/ScoreEffectText.tsx` | 7 variants: shimmer, glow, chrome, etc. |
| Tier visuals | `apps/web/lib/effects/tier/TierVisuals.tsx` | Per-tier card styles, glows, sparkle dots |
| Leader line tooltips | `apps/web/components/BadgeOverlay.tsx` | Animated SVG Bezier curves connecting hotspots to annotations |
| InfoTooltip | `apps/web/components/InfoTooltip.tsx` | Glassmorphism popup, keyboard accessible |
| Confetti | `apps/web/lib/effects/confetti.ts` | Canvas confetti celebration |

**No external chart libraries installed.** All visualizations are custom SVG or CSS.

---

## Part 2: Available Data for Visualization

### Dimensions (4 × 0-100)

Each dimension is computed from weighted sub-components:

**Delivery** = `0.7 × PR_weight + 0.2 × issues_closed + 0.1 × commits`
- All normalized via logarithmic curve: `ln(1 + min(x, cap)) / ln(1 + cap)`
- Caps: PRs=60, Issues=40, Commits=300

**Quality (collaborative)** = `0.6 × reviews + 0.25 × review_ratio + 0.15 × inverse_micro`
- Review ratio: reviews/PRs, capped at 5:1
- Inverse micro: `1 - microCommitRatio` (defaults 0.3)

**Quality (solo)** = `0.40 × prDescriptionRate + 0.25 × featureBranchRate + 0.20 × issueLinkageRate + 0.15 × inverse_micro`
- Solo path used when reviewsSubmittedCount === 0; returns 0 if no merged PRs

**Consistency** = `0.45 × streak + 0.40 × evenness + 0.15 × inverse_burst`
- Streak: `sqrt(activeDays / 365)` — concave curve
- Evenness: inverted coefficient of variation of weekly activity
- Burst: `1 - min(maxCommitsIn10Min, 30) / 30`

**Breadth** = `0.40 × repos + 0.25 × inverse_concentration + 0.10 × stars + 0.05 × forks + 0.15 × docs_ratio`
- Repos capped at 12
- Concentration: `1 - topRepoShare`

### Raw Stats (14 fields from StatsData)

| Stat | Field | Used In |
|------|-------|---------|
| Commits | `commitsTotal` | Delivery (10%) |
| PRs Merged | `prsMergedCount` | Delivery (displayed) |
| PR Weight | `prsMergedWeight` | Delivery (70%) |
| Reviews | `reviewsSubmittedCount` | Quality (60%) |
| Issues Closed | `issuesClosedCount` | Delivery (20%) |
| Repos | `reposContributed` | Breadth (40%) |
| Active Days | `activeDays` | Consistency (45%) |
| Lines Added | `linesAdded` | Confidence check |
| Lines Deleted | `linesDeleted` | Available |
| Stars | `totalStars` | Breadth (10%) |
| Forks | `totalForks` | Breadth (5%) |
| Watchers | `totalWatchers` | Display only (removed from scoring) |
| Top Repo Share | `topRepoShare` | Breadth (25%) |
| Max 10min Burst | `maxCommitsIn10Min` | Consistency (15%) |

### Heatmap Data

`heatmapData: HeatmapDay[]` — up to 371 entries (53 weeks × 7 days), each with `{ date, count }`. Currently used for evenness calculation and badge visualization but NOT shown in breakdown.

### Classification

| Data | Type | Values |
|------|------|--------|
| Profile Type | `"solo" \| "collaborative"` | Based on `reviewsSubmittedCount === 0` |
| Archetype | 6 types | Builder, Quality Champion, Marathoner, Polymath, Balanced, Emerging |
| Tier | 4 tiers | Emerging (0-29), Solid (30-69), High (70-84), Elite (85-100) |

### Confidence System (9 penalty flags)

| Flag | Penalty | Trigger |
|------|---------|---------|
| `burst_activity` | -15 | 20+ commits in 10 minutes |
| `micro_commit_pattern` | -10 | 60%+ micro-commits |
| `generated_change_pattern` | -15 | 20k+ lines added with ≤2 reviews |
| `low_collaboration_signal` | -10 | 10+ PRs but ≤1 review |
| `single_repo_concentration` | -5 | 95%+ in one repo |
| `supplemental_unverified` | -5 | Linked account data |
| `low_activity_signal` | -10 | <30 active days AND <50 commits |
| `review_volume_imbalance` | -10 | 50+ reviews but <3 PRs |
| `platform_linked` | 0 | Informational only |

Confidence range: 50-100. Adjustment formula: `base × (0.85 + 0.15 × confidence/100)`.

### Historical/Trend Data (from `/api/history/[handle]`)

**MetricsSnapshot** — one per user per day, stored permanently in Redis:
- All 14 raw stats
- All 4 dimension scores
- Composite, adjusted, confidence
- Archetype, tier, profile type
- Penalty flags

**TrendSummary** (computed from last N snapshots, configurable window 2-30 days):
- Direction: `"improving" | "declining" | "stable"` (threshold: ±1.0)
- Average daily delta
- Per-dimension `{ avgDelta, values: { date, value }[] }`

**SnapshotDiff** (comparison of two most recent snapshots):
- Composite score delta
- Adjusted composite delta
- Confidence delta
- Per-dimension deltas (4)
- Per-stat deltas (14)
- Archetype/tier/profile type changes (if any)
- Penalty flag changes (added/removed)

### Recency & Smoothing

- **Recency weighting**: ±6% adjustment based on activity in last 90 days vs. 365 days
- **EMA smoothing**: `smoothed = 0.15 × current + 0.85 × previous` (half-life ~4.3 days)

### Coaching Content

**Archetype profiles** (from `ARCHETYPE_PROFILES` in ImpactBreakdown.tsx lines 153-166):
- Each archetype gets a 1-2 sentence description of the developer's profile shape

**Dimension tips** (from `DIMENSION_TIPS` lines 168-173):
- Actionable tip for the weakest dimension (appended to archetype profile)
- Tips exist for: delivery, quality, consistency, breadth

**Currently**: Profile text + single tip combined into one paragraph. No per-dimension coaching cards, no trend-based insights.

---

## Part 3: Design Inspiration Research

### Product Analysis

#### WHOOP (Strain/Recovery/Sleep)
- **Hero pattern**: Three circular dial gauges dominating the top of the home screen
- **Color-coded scoring**: Green (67-100), Yellow (34-66), Red (0-33) — instant status
- **Breakdown on tap**: Each dial expands to show contributing sub-metrics (HRV, resting HR, respiratory rate, etc.)
- **Coaching inline**: Tips and weekly plans appear directly alongside data, not in a separate section
- **Customizable tile order**: Users prioritize which metrics appear first

#### Oura Ring (Readiness Score)
- **Single bold hero number (0-100)**: No chart, no gauge — just a huge number with minimal icon
- **Crown icon at 85+**: Gamification reward for high performance
- **7 contributing factors as expandable list**: Vertical stack with colored progress bars per factor
- **Three-pillar grouping**: Contributors organized under Sleep/Activity/Body Stress categories
- **Color-as-diagnosis**: Red bars on contributing factors instantly show what's dragging the score down

#### Apple Fitness (Activity Rings)
- **Concentric rings**: Move (red), Exercise (green), Stand (blue) — each fills clockwise to 100%
- **90-day vs 365-day trend**: Arrows show whether recent performance exceeds long-term baseline
- **Calendar grid with mini rings**: Each day shows miniature ring completion — a heatmap of consistency
- **8 trend metrics with sparklines**: Each gets a directional arrow and mini chart

#### Garmin Connect (Training Status/VO2 Max)
- **Composite labels as coaching**: "Productive", "Peaking", "Detraining" — translating data into actionable words
- **Body Battery line chart (0-100)**: Continuous line showing energy depletion/recovery throughout the day
- **Training Readiness from 6 contributors**: Numeric score + text label + individual status indicators
- **VO2 max with color-coded bands**: Single number + fitness level band (Poor/Fair/Good/Excellent/Superior)

#### Strava (Training Zones)
- **Zone bar charts**: Horizontal stacked bars showing time distribution across 5 zones
- **Timeline feed**: Chronological activity cards with map + key stats
- **Progressive disclosure**: Map + 4 stats on initial view → "View Analysis" for drill-down
- **Trend comparison**: Routes and training zones viewable across week/month/3-month periods

#### Linear (Project Analytics)
- **Metric blocks**: Big number + sparkline + comparison indicator
- **Burn-up charts**: Area charts showing cumulative progress over time
- **Modular grid layout**: Columns by team, rows by metric type
- **Monochrome + accent**: Restrained color palette, LCH color space, content-first design
- **Annotations only when needed**: Labels appear only when the audience needs orientation

#### GitHub Insights
- **Contribution heatmap**: The most recognized developer metric visualization
- **Pulse page**: Time-bounded activity summary with selectable periods
- **Code frequency chart**: Lines added (positive) vs deleted (negative) per week
- **Accessibility**: Keyboard-navigable chart points, visible date pickers

#### Raycast
- **Monochrome-first with bold accent**: Neutral base + one accent color = maximum impact
- **Typography-driven hierarchy**: Differentiation through weight/size, not background colors
- **Extreme density with clarity**: Consistent spacing + clear typographic hierarchy

### Design Pattern Synthesis

#### Layout: The "Stratified F-Pattern"

Based on all research, the optimal dashboard layout follows this hierarchy:

1. **Hero Score Zone** (top 15-20%) — Composite score as large animated ring gauge + archetype label + tier badge
2. **Dimension Cards Row** (next 20-25%) — 4 equal cards with scores, mini gauges, sparkline trends, and delta indicators
3. **Radar Chart + Breakdown** (middle 30%) — Interactive radar showing the "developer shape" + sub-metric detail panel
4. **Coaching/Insights Section** (lower 20%) — Action-oriented insight cards with progressive disclosure
5. **Historical Trend + Raw Stats** (bottom) — Sparkline trends, heatmap, and detailed stat grid

#### Chart Types Mapped to Chapa Data

| Chart Type | Best For | Chapa Application |
|------------|----------|-------------------|
| **Ring gauge** | Single composite score | Main Impact score (0-100) centered, tier-colored |
| **Radar/spider chart** | Multi-dimension comparison | 4-axis diamond (Delivery, Quality, Consistency, Breadth) |
| **Horizontal progress bars** | Dimension breakdown | Each dimension card with fill to 0-100% |
| **Sparklines** | Trend indicators | Mini charts in dimension cards showing last 30-90 days |
| **Heatmap grid** | Activity consistency | Contribution calendar (already exists in badge, missing from breakdown) |
| **Stacked bar** | Dimension composition | Sub-components within each dimension |
| **Delta indicators** | Score changes | `+12% ↑` next to dimension scores |

#### Color Strategy

1. **Each dimension permanently owns a color** (already defined: green/orange/cyan/pink)
2. **Tier-based zone coloring** for the composite ring (Emerging=gray, Solid=neutral, High=light purple, Elite=signature purple)
3. **Traffic light semantics** for score interpretation: Green (70-100), Amber (40-69), Red (0-39)
4. **Monochrome base + purple accent** for UI chrome (consistent with existing design system)
5. **Dimension colors at 15-20% opacity** for background fills, 100% for strokes and data points

#### Typography for Metrics

| Element | Font | Size | Weight |
|---------|------|------|--------|
| Hero score number | JetBrains Mono | 36-48px | 700-800 |
| Dimension score | JetBrains Mono | 28-32px | 700 |
| Section headers | JetBrains Mono | 18-24px | 600-700 |
| Metric labels | Plus Jakarta Sans | 12-14px | 500-600 |
| Supporting text | Plus Jakarta Sans | 12-14px | 400 |
| Delta/trend text | JetBrains Mono | 12-14px | 500 |

#### Animation Patterns

| Animation | Duration | Trigger | Existing? |
|-----------|----------|---------|-----------|
| Ring gauge fill | 1.2-1.5s ease-out | Page load / in-view | `gauge-fill` keyframe exists |
| Counter count-up | Synced with gauge | Page load / in-view | `use-animated-counter` hook exists |
| Radar chart expand | 0.8-1.2s | In-view | Radar SVG renderer exists (needs web adaptation) |
| Sparkline trace | 0.5-0.8s left-to-right | In-view | Would need to build |
| Card fade-in-up | 0.8s staggered | In-view | `animate-fade-in-up` exists |
| Progress bar fill | 0.8s ease-out | In-view | `animate-bar-fill` exists |
| Score text effect | Continuous | Elite tier | `ScoreEffectText` component exists |

#### Interaction Patterns

| Interaction | Pattern | Products Using It |
|-------------|---------|-------------------|
| Tap dimension card → expand sub-metrics | Expandable card with chevron | Oura, WHOOP |
| Hover radar axis → highlight dimension | Tooltip with dimension details | General dashboards |
| Toggle time range (7d / 30d / 90d) | Tab or segment control | Strava, Linear, GitHub |
| Hover sparkline → show value at point | Tooltip with date + value | Linear, GitHub |
| Tap coaching card → expand full advice | Progressive disclosure | Oura, WHOOP |

#### Coaching Integration Patterns

1. **Status-as-coaching** (Garmin): The archetype label IS coaching — "Builder" tells you what you're good at
2. **Red bar = action item** (Oura): Low-scoring dimensions visually stand out, implicitly suggesting focus areas
3. **Inline tips** (WHOOP): 1-2 sentence coaching cards placed directly below the relevant dimension
4. **Crown/achievement** (Oura): Visual reward at tier boundaries (85+ = Elite crown/badge)
5. **Delta-based insights**: "Your Consistency improved +12% this month — keep it up!" (trend-driven)

---

## Part 4: Key Insights for Planning

### What the Current Breakdown Lacks

1. **No visual hierarchy** — Composite score, dimensions, and stats are all at roughly the same visual weight
2. **No radar chart on web** — Exists in badge SVG but not rendered interactively on the share page
3. **No trend data** — Historical API exists but no trend visualization in the breakdown
4. **No coaching cards** — Only a paragraph of text; no per-dimension actionable advice
5. **No score ring/gauge** — The composite score isn't even displayed prominently in the breakdown
6. **No heatmap on web** — Contribution heatmap exists in badge SVG and as a component but isn't used in breakdown
7. **No interactive drill-down** — Can't explore what sub-components feed each dimension
8. **No delta indicators** — No visual indication of score changes over time
9. **No gamification** — No tier badges, achievement indicators, or visual rewards
10. **Flat card design** — All cards identical regardless of score level or importance

### Available Building Blocks (No New Dependencies Needed)

The codebase already has all necessary primitives to build a professional dashboard:
- Ring gauge animation (`gauge-fill`)
- Radar chart renderer (needs adaptation from SVG-string to React component)
- Heatmap grid component (ready to use)
- Animated counter hook (ready to use)
- In-view detection hook (ready to use)
- Tier-specific visual treatments (ready to use)
- Score text effects (ready to use)
- Glassmorphism tooltips (ready to use)
- Dimension colors, archetype colors, tier colors (all defined)

### Data Already Available for Trend Visualization

The history API (`/api/history/[handle]`) already provides:
- Per-dimension trend with avg delta and values array → sparklines
- Snapshot diff with per-stat deltas → delta indicators
- Direction classification (improving/declining/stable) → trend arrows
- Archetype/tier changes → transition badges

This data just needs to be fetched and rendered — the backend is ready.

### Design Constraints to Honor

1. **No external chart libraries** — Keep bundle lean (badge is embeddable)
2. **Theme-aware** — Must work in both light and dark modes using CSS variables
3. **Accessible** — ARIA labels, keyboard navigation, `prefers-reduced-motion`
4. **Responsive** — Mobile-first, graceful degradation from 4-col to 1-col
5. **Performance** — Lazy render, staggered animations, no layout shift
6. **Owner-only** — Breakdown section is only visible to the profile owner (authenticated)

---

## Sources

### Products Analyzed
- WHOOP: [Home Screen](https://www.whoop.com/us/en/thelocker/the-all-new-whoop-home-screen/), [Overview](https://www.whoop.com/us/en/thelocker/your-key-whoop-metrics-all-in-one-place/), [Recovery](https://www.whoop.com/us/en/thelocker/how-does-whoop-recovery-work-101/)
- Oura: [Readiness Score](https://ouraring.com/blog/readiness-score/), [Contributors](https://support.ouraring.com/hc/en-us/articles/360057791533-Readiness-Contributors)
- Apple Fitness: [Activity Rings](https://developer.apple.com/design/human-interface-guidelines/activity-rings), [Trends](https://support.apple.com/en-us/HT210343)
- Garmin: [Training Readiness](https://www.garmin.com/en-US/garmin-technology/running-science/physiological-measurements/training-readiness/), [Body Battery](https://www.garmin.com/en-US/garmin-technology/health-science/body-battery/)
- Strava: [Training Zones](https://support.strava.com/hc/en-us/articles/39113532401421), [Progress Summary](https://support.strava.com/hc/en-us/articles/28437860016141)
- Linear: [Insights](https://linear.app/insights), [Dashboards](https://linear.app/docs/dashboards), [UI Redesign](https://linear.app/now/how-we-redesigned-the-linear-ui)
- GitHub: [Pulse](https://docs.github.com/en/repositories/viewing-activity-and-data-for-your-repository/using-pulse-to-view-a-summary-of-repository-activity), [Repository Graphs](https://docs.github.com/en/repositories/viewing-activity-and-data-for-your-repository/about-repository-graphs)
- Raycast: [Pro](https://www.raycast.com/pro), [Colors API](https://developers.raycast.com/api-reference/user-interface/colors)

### Design Pattern Research
- [Pencil & Paper: Dashboard UX Patterns](https://www.pencilandpaper.io/articles/ux-pattern-analysis-data-dashboards)
- [Dashboard Design Patterns (Academic)](https://dashboarddesignpatterns.github.io/patterns.html)
- [Dark Mode Dashboard Principles](https://www.numerro.io/blog/designing-dashboard-in-dark-mode)
- [Material Design 3 Elevation](https://m3.material.io/styles/elevation/applying-elevation)
- [Typography for Data Dashboards](https://datafloq.com/typography-basics-for-data-dashboards/)
- [Choosing Fonts for Data Viz](https://nightingaledvs.com/choosing-fonts-for-your-data-visualization/)
- [2025 Dashboard Design Principles](https://medium.com/@farazjonanda/10-best-ui-ux-dashboard-design-principles-for-2025-2f9e7c21a454)
- [Radar Chart Best Practices](https://www.boldbi.com/blog/radar-charts-best-practices-and-examples/)
- [CSS-Tricks Progress Ring](https://css-tricks.com/building-progress-ring-quickly/)
- [Fitness App UX Best Practices 2025](https://dataconomy.com/2025/11/11/best-ux-ui-practices-for-fitness-apps-retaining-and-re-engaging-users/)
- [Dribbble: Performance Dashboard Designs](https://dribbble.com/tags/performance-dashboard)
- [UXPin Dashboard Principles 2025](https://www.uxpin.com/studio/blog/dashboard-design-principles/)
