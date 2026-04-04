# AI Tool Insights Integration Plan

> Date: 2026-03-07
> Issue: TBD (create before implementation)
> Branch: `feature/insights-integration`
> Research: Inline (scoring pipeline + Claude Code `/insights` report analysis)

## Overview

> **Update (2026-03-08):** The Craft Score is now integrated as the 5th Impact dimension in v6 (see `docs/plans/2026-03-08-impact-v6-unified-scoring.md`). It is no longer a parallel score — it directly affects the composite and appears as a radar axis on the badge.

Add an **Insights Layer** to Chapa that lets developers import usage reports from AI coding tools (starting with Claude Code `/insights`) to enrich their Impact profile. Insights data captures *how* a developer works — tool proficiency, workflow sophistication, delegation patterns, achievement rates — complementing the existing 4 dimensions which measure *what* they produce.

The Insights Layer is a **parallel score** that sits alongside the Impact v6 profile. It does NOT replace or modify the 4 existing dimensions. Instead, it adds a new "Craft Score" (0–100) with its own sub-dimensions, visible on the badge, share page, and breakdown.

**Scope:** Claude Code insights only for v1. Architecture supports future tools (Cursor, Copilot, Windsurf, etc.).

## Why This Matters

Current Impact v6 measures code activity (commits, PRs, reviews, heatmap). But modern developers increasingly work *through* AI tools — the quality of that collaboration is itself a signal of developer sophistication. A developer who orchestrates parallel agents, maintains high achievement rates, and uses advanced features is demonstrably more capable than one who uses AI as a simple autocomplete.

Claude Code's `/insights` report is the first structured source of this signal. It contains:

- **Volume metrics**: messages, lines changed, files touched, days active, msgs/day
- **Tool usage distribution**: Bash, Read, Edit, Write, Grep, Agent counts
- **Session patterns**: single-task vs. multi-task vs. iterative refinement vs. exploration
- **Outcome rates**: fully achieved, mostly achieved, partially achieved
- **Friction analysis**: buggy code count, wrong approach count, misunderstood request count
- **Multi-clauding**: parallel session overlap events, % of messages in overlap
- **Response time distribution**: how quickly the developer responds (engagement signal)
- **Satisfaction inference**: dissatisfied, likely satisfied, satisfied counts
- **Qualitative assessments**: strengths, weaknesses, workflow patterns (narrative)

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Score placement | Parallel "Craft Score" alongside Impact v6 | Non-breaking — existing users unaffected. Score is optional enrichment |
| Data format | Structured JSON (parsed from HTML report) | HTML is the current format; we parse it client-side and upload JSON to the API |
| Initial tool | Claude Code only | First mover, richest data. Architecture is tool-agnostic |
| Score model | 3 sub-dimensions: Proficiency, Effectiveness, Sophistication | Maps cleanly to the insights data signals |
| Storage | Supabase `tool_insights` table | Permanent storage (not ephemeral like Redis supplemental stats) |
| Confidence | Separate from Impact confidence | Insights confidence reflects data completeness, not tampering risk |
| Badge display | Small "Craft" indicator below main score (when present) | Optional, doesn't clutter the badge for non-users |
| Privacy | Opt-in only, user uploads explicitly | No automatic scraping — user controls what data is shared |
| Extensibility | `tool` field in schema, tool-specific parsers | Adding Cursor/Copilot = new parser + mapping, same scoring engine |

## Craft Score Model (0–100)

Three sub-dimensions, each 0–100, averaged into a composite Craft Score:

### 1. Proficiency (0–100) — "How well do you use the tool?"

Measures tool mastery and feature adoption depth.

| Signal | Weight | Source | Scoring |
|--------|--------|--------|---------|
| Tool diversity | 0.30 | Tool usage counts (Bash, Read, Edit, Agent, etc.) | Shannon entropy of tool distribution, normalized. Using 6+ tools well > hammering one |
| Agent usage rate | 0.25 | Agent tool calls / total messages | Higher = more orchestration capability. normalize(agentCalls/messages, 0.20) |
| Advanced feature adoption | 0.25 | Multi-clauding %, session type diversity | Parallel sessions + varied session types = advanced usage |
| Engagement depth | 0.20 | Messages per day, median response time | Consistent, responsive interaction (not just opening and closing) |

### 2. Effectiveness (0–100) — "How well do your sessions go?"

Measures outcome quality and friction management.

| Signal | Weight | Source | Scoring |
|--------|--------|--------|---------|
| Achievement rate | 0.40 | Fully/mostly/partially achieved counts | Weighted: full=1.0, mostly=0.7, partial=0.3. Score = weighted sum / total |
| Satisfaction rate | 0.25 | Satisfied + likely satisfied vs dissatisfied | (satisfied + likelySatisfied) / total |
| Friction ratio (inverse) | 0.20 | Buggy code + wrong approach + misunderstood / total sessions | Lower friction = higher score. 1 - normalize(frictionEvents/sessions, 0.5) |
| Error recovery | 0.15 | Tool errors / total tool calls | Lower error rate = better. 1 - normalize(errors/toolCalls, 0.15) |

### 3. Sophistication (0–100) — "How ambitious are your workflows?"

Measures workflow complexity and strategic tool use.

| Signal | Weight | Source | Scoring |
|--------|--------|--------|---------|
| Multi-task sessions | 0.30 | Multi-task + iterative refinement / total sessions | Higher ratio = more complex work |
| Lines per session | 0.25 | (linesAdded + linesDeleted) / sessions | normalize(linesPerSession, 500). More output per session = higher leverage |
| Multi-clauding intensity | 0.25 | Overlap events, % messages in parallel | normalize(overlapEvents, 30) × 0.6 + normalize(parallelMsgPct, 0.40) × 0.4 |
| Files per session | 0.20 | Total files / sessions | normalize(filesPerSession, 15). Broader changes = more sophisticated |

### Composite Craft Score

```
craftScore = round((proficiency + effectiveness + sophistication) / 3)
```

### Craft Tier

| Tier | Range | Meaning |
|------|-------|---------|
| Novice | 0–29 | Basic tool usage, learning |
| Practitioner | 30–54 | Competent, standard workflows |
| Expert | 55–79 | Advanced features, high effectiveness |
| Master | 80–100 | Orchestration-level mastery, top-tier outcomes |

## Data Pipeline

```
User generates insights report
  → Claude Code `/insights` → report.html

User uploads to Chapa
  → Share page or Studio has "Import Insights" button
  → Client-side: parse HTML → extract structured data → InsightsUpload JSON
  → POST /api/insights
    ├─ Validate: handle matches session, data shape valid
    ├─ Auth: session auth (GitHub OAuth)
    ├─ Parse & score: compute 3 sub-dimensions → CraftScore
    ├─ Store: Supabase tool_insights table (upsert by handle + tool)
    └─ Invalidate: badge cache for handle

On next badge/share page request:
  → getStats() pipeline unchanged
  → getCraftScore(handle) — separate query
  → Badge render includes craft indicator if score exists
  → Share page shows craft breakdown section
```

## InsightsUpload JSON Schema

Structured data extracted from the HTML report:

```typescript
interface InsightsUpload {
  tool: "claude-code";                // tool identifier
  reportPeriod: {
    start: string;                    // ISO date
    end: string;                      // ISO date
  };
  volume: {
    messages: number;
    linesAdded: number;
    linesDeleted: number;
    files: number;
    days: number;
    msgsPerDay: number;
  };
  toolUsage: Record<string, number>;  // e.g. { "Bash": 1213, "Read": 572, ... }
  sessionTypes: Record<string, number>; // e.g. { "Single Task": 16, ... }
  outcomes: {
    fullyAchieved: number;
    mostlyAchieved: number;
    partiallyAchieved: number;
  };
  friction: {
    buggyCode: number;
    wrongApproach: number;
    misunderstoodRequest: number;
  };
  satisfaction: {
    dissatisfied: number;
    likelySatisfied: number;
    satisfied: number;
  };
  multiClauding: {
    overlapEvents: number;
    sessionsInvolved: number;
    messagePercent: number;           // 0-100
  };
  responseTime: {
    medianSeconds: number;
    averageSeconds: number;
  };
  toolErrors: Record<string, number>; // e.g. { "Command Failed": 64, ... }
  totalSessions: number;
  totalToolCalls: number;             // sum of all tool usage counts
}
```

## Database Schema

### Supabase: `tool_insights` table

```sql
CREATE TABLE tool_insights (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  handle        text NOT NULL,
  tool          text NOT NULL,          -- 'claude-code', future: 'cursor', 'copilot'
  report_start  date NOT NULL,
  report_end    date NOT NULL,
  raw_data      jsonb NOT NULL,         -- full InsightsUpload JSON
  proficiency   smallint NOT NULL,      -- 0-100
  effectiveness smallint NOT NULL,      -- 0-100
  sophistication smallint NOT NULL,     -- 0-100
  craft_score   smallint NOT NULL,      -- 0-100 composite
  craft_tier    text NOT NULL,          -- 'Novice', 'Practitioner', 'Expert', 'Master'
  uploaded_at   timestamptz DEFAULT now(),
  UNIQUE(handle, tool)                  -- one active report per tool per user
);

CREATE INDEX idx_tool_insights_handle ON tool_insights(handle);
```

**Upsert semantics:** New uploads replace the previous report for the same handle+tool. The `raw_data` column preserves the full upload for re-scoring if the algorithm changes.

## Architecture

```
Client (browser)
  ├─ InsightsImporter component
  │   ├─ File input (accept .html)
  │   ├─ parseInsightsHtml(file) → InsightsUpload (client-side parser)
  │   ├─ Preview: show extracted metrics before upload
  │   └─ POST /api/insights with JSON body
  │
Server
  ├─ POST /api/insights (route handler)
  │   ├─ Auth: session required (GitHub OAuth)
  │   ├─ Validate: InsightsUpload shape
  │   ├─ Score: computeCraftScore(data) → CraftResult
  │   ├─ Store: upsert into tool_insights
  │   └─ Invalidate: badge cache
  │
  ├─ GET /api/insights/:handle (public, rate-limited)
  │   └─ Returns craft score + sub-dimensions (no raw data)
  │
  ├─ lib/insights/parser.ts
  │   └─ parseInsightsHtml(html: string) → InsightsUpload
  │       (extracts structured data from HTML report)
  │
  ├─ lib/insights/scoring.ts
  │   └─ computeCraftScore(data: InsightsUpload) → CraftResult
  │       (pure function: 3 sub-dimensions + composite + tier)
  │
  ├─ lib/db/tool-insights.ts
  │   ├─ dbUpsertToolInsights(handle, tool, data, scores)
  │   └─ dbGetToolInsights(handle) → CraftResult | null
  │
Badge + Share Page
  ├─ Badge SVG: optional craft indicator (small pill below score)
  ├─ Share page: "AI Craft" section with sub-dimension breakdown
  └─ BadgeOverlay: tooltips for craft sub-dimensions
```

## Phases

| Phase | Description | New files | Modified files | Batch eligible |
|-------|-------------|-----------|----------------|----------------|
| **1: Types + scoring engine** | Define InsightsUpload, CraftResult types. Implement `computeCraftScore()` pure function with full test coverage | 4 | 1 | No |
| **2: HTML parser** | Implement `parseInsightsHtml()` that extracts structured data from Claude Code insights HTML. Full test coverage with fixture | 3 | 0 | [batch-eligible] with Phase 1 |
| **3: Database + API** | Create Supabase table, db access functions, POST/GET API routes with auth + validation | 5 | 0 | No |
| **4: Upload UI** | InsightsImporter component on share page — file picker, preview, upload. Import button in user menu | 3 | 2 | No |
| **5: Badge + share page display** | Craft score indicator on badge SVG, craft breakdown section on share page, tooltips | 2 | 4 | No |

**Total: ~17 new files, ~7 modified files**

## File Inventory

### Phase 1: Types + Scoring
| File | Action | Description |
|------|--------|-------------|
| `packages/shared/src/types.ts` | Modify | Add `InsightsUpload`, `CraftResult`, `CraftTier`, `CraftDimensions` types |
| `apps/web/lib/insights/scoring.ts` | Create | Pure scoring function: `computeCraftScore(data) → CraftResult` |
| `apps/web/lib/insights/scoring.test.ts` | Create | Full test coverage for scoring edge cases |
| `packages/shared/src/constants.ts` | Modify (minor) | Add craft scoring caps/thresholds if needed |

### Phase 2: HTML Parser
| File | Action | Description |
|------|--------|-------------|
| `apps/web/lib/insights/parser.ts` | Create | `parseInsightsHtml(html: string) → InsightsUpload` |
| `apps/web/lib/insights/parser.test.ts` | Create | Test with real HTML fixture |
| `apps/web/lib/insights/__fixtures__/claude-code-report.html` | Create | Sanitized sample report for testing |

### Phase 3: Database + API
| File | Action | Description |
|------|--------|-------------|
| `apps/web/lib/db/tool-insights.ts` | Create | `dbUpsertToolInsights()`, `dbGetToolInsights()` |
| `apps/web/app/api/insights/route.ts` | Create | POST (upload) + GET (public read) |
| `apps/web/app/api/insights/route.test.ts` | Create | Auth, validation, scoring, storage tests |
| `apps/web/lib/insights/validation.ts` | Create | `isValidInsightsUpload()` shape validation |
| `apps/web/lib/insights/validation.test.ts` | Create | Validation edge case tests |

### Phase 4: Upload UI
| File | Action | Description |
|------|--------|-------------|
| `apps/web/components/InsightsImporter.tsx` | Create | File picker + preview + upload component |
| `apps/web/components/InsightsPreview.tsx` | Create | Pre-upload preview of extracted metrics |
| `apps/web/app/u/[handle]/page.tsx` | Modify | Add "Import Insights" section for authenticated owner |
| `apps/web/components/UserMenu.tsx` | Modify | Add "Import AI Insights" menu item |

### Phase 5: Badge + Share Page Display
| File | Action | Description |
|------|--------|-------------|
| `apps/web/lib/render/BadgeCraft.tsx` | Create | Craft score SVG indicator component |
| `apps/web/components/CraftBreakdown.tsx` | Create | Share page craft dimensions breakdown |
| `apps/web/lib/render/BadgeSvg.tsx` | Modify | Include craft indicator when score exists |
| `apps/web/app/u/[handle]/badge.svg/route.ts` | Modify | Fetch craft score alongside stats |
| `apps/web/app/u/[handle]/page.tsx` | Modify | Render CraftBreakdown section |
| `apps/web/components/BadgeOverlay.tsx` | Modify | Add craft dimension tooltips |

## Environment Variables (new)

None required. This feature uses existing Supabase credentials and session auth.

## Feature Flag

Gate behind a Supabase feature flag: `insights_integration` (default: disabled).

Add `NEXT_PUBLIC_INSIGHTS_ENABLED` env var as override (same dual-tier pattern as Bitbucket/Codeberg).

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| HTML report format changes between CC versions | Medium | Medium | Parser is best-effort with fallbacks for missing fields. Version detection in parser. Test with fixtures |
| Users upload fabricated/modified reports | Medium | Low | This is opt-in self-reported data. Confidence is inherently lower. Label as "self-reported" |
| Scoring model needs tuning after real-world data | High | Low | Raw data stored in `raw_data` JSONB column — can re-score all users if algorithm changes |
| Other AI tools have different report formats | Expected | None | Tool-specific parsers, shared scoring engine. Architecture already handles this |
| Report HTML is too large for upload | Low | Low | Client-side parsing means only the JSON (< 2KB) is uploaded, not the HTML |

## Future Extensions (not in scope)

- **Cursor/Copilot/Windsurf parsers** — each tool gets a parser that maps to the same `InsightsUpload` schema
- **API-based import** — if tools offer APIs, skip the HTML parsing entirely
- **Historical tracking** — store multiple reports over time, show craft score trends
- **Craft influence on Impact** — optional modifier where high craft scores boost confidence or provide a small composite bonus
- **Tool-specific badges** — "Claude Code Expert" / "Cursor Power User" sub-badges
- **Leaderboard integration** — craft scores in future leaderboard features

## Phase files

- [Phase 1: Types + scoring engine](./2026-03-07-insights-integration-phases/phase-1.md)
- [Phase 2: HTML parser](./2026-03-07-insights-integration-phases/phase-2.md)
- [Phase 3: Database + API](./2026-03-07-insights-integration-phases/phase-3.md)
- [Phase 4: Upload UI](./2026-03-07-insights-integration-phases/phase-4.md)
- [Phase 5: Badge + share page display](./2026-03-07-insights-integration-phases/phase-5.md)
