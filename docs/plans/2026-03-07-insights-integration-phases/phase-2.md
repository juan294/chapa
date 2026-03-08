# Phase 2: HTML Parser

> Parent plan: [Insights Integration](../2026-03-07-insights-integration.md)
> Depends on: Phase 1 (types)
> Batch eligible: Yes (with Phase 1 — no file overlap)

## Goal

Implement `parseInsightsHtml()` that extracts structured `InsightsUpload` data from a Claude Code `/insights` HTML report. This runs **client-side** in the browser — the raw HTML never leaves the user's machine.

## HTML Report Structure (Reference)

Based on analysis of the actual Claude Code insights report (`~/.claude/usage-data/report.html`):

### Key data locations in the HTML

| Data | HTML pattern | Extraction method |
|------|-------------|-------------------|
| Period | `<p class="subtitle">549 messages across 66 sessions (189 total) \| 2026-02-20 to 2026-03-07</p>` | Regex on subtitle text |
| Volume stats | `<div class="stat"><div class="stat-value">549</div><div class="stat-label">Messages</div></div>` | Query `.stat` divs, map label→value |
| Tool usage | Bar chart in `.chart-card` with title "Top Tools Used" | Query bar rows: `.bar-label` + `.bar-value` |
| Languages | Bar chart with title "Languages" | Same pattern |
| Session types | Bar chart with title "Session Types" | Same pattern |
| Outcomes | Bar chart with title "Outcomes" | Same pattern |
| Friction types | Bar chart with title "Primary Friction Types" | Same pattern |
| Satisfaction | Bar chart with title "Inferred Satisfaction" | Same pattern |
| Tool errors | Bar chart with title "Tool Errors Encountered" | Same pattern |
| Multi-clauding | Div with title "Multi-Clauding (Parallel Sessions)" — 3 stat values | Query stat values within section |
| Response time | Div with title "User Response Time Distribution" — footer has median/average | Regex on footer text |
| Raw hour counts | JavaScript variable: `const rawHourCounts = {...}` | Regex on script content |
| Total sessions | Embedded in subtitle: "66 sessions (189 total)" | Regex |

### Parser strategy

Use `DOMParser` (browser-native) to parse HTML, then:
1. Query specific CSS selectors for structured data
2. Fall back to regex for embedded values (subtitle, script block)
3. Every field has a default/fallback (0 for numbers, empty for strings)

## Implementation

### File: `apps/web/lib/insights/parser.ts`

```typescript
/**
 * Parse a Claude Code /insights HTML report into structured InsightsUpload data.
 * Runs client-side only (uses DOMParser).
 * Best-effort extraction — missing fields default to 0/empty.
 */
export function parseInsightsHtml(html: string): InsightsUpload
```

**Internal helpers:**

```typescript
// Extract bar chart data from a chart card by title
function extractBarChart(doc: Document, chartTitle: string): Record<string, number>

// Extract stat values from .stats-row or inline stat divs
function extractStats(container: Element): Record<string, string>

// Parse subtitle: "549 messages across 66 sessions (189 total) | 2026-02-20 to 2026-03-07"
function parseSubtitle(text: string): { messages: number; sessions: number; start: string; end: string }

// Parse lines stat: "+16,843/-1,230" → { added: 16843, deleted: 1230 }
function parseLinesStat(text: string): { added: number; deleted: number }

// Parse multi-clauding section
function parseMultiClauding(doc: Document): { overlapEvents: number; sessionsInvolved: number; messagePercent: number }

// Parse response time footer: "Median: 80.6s * Average: 188.4s"
function parseResponseTime(doc: Document): { medianSeconds: number; averageSeconds: number }

// Compute totalToolCalls from tool usage counts
function sumToolCalls(toolUsage: Record<string, number>): number
```

**Key parsing rules:**
- Numbers with commas: strip commas before `parseInt`/`parseFloat`
- Percentages: strip `%` suffix, parse as number
- Lines stat format: `+N/-M` with potential commas
- Date format: `YYYY-MM-DD` (already ISO-compatible)
- If a section is missing (report version differs), return defaults — never throw

### Mapping from HTML labels to InsightsUpload fields

| HTML label | InsightsUpload field | Transform |
|-----------|---------------------|-----------|
| "Messages" stat | `volume.messages` | parseInt |
| "Lines" stat | `volume.linesAdded`, `volume.linesDeleted` | parseLinesStat |
| "Files" stat | `volume.files` | parseInt |
| "Days" stat | `volume.days` | parseInt |
| "Msgs/Day" stat | `volume.msgsPerDay` | parseFloat |
| "Top Tools Used" chart | `toolUsage` | Record<string, number> |
| "Session Types" chart | `sessionTypes` | Record<string, number> |
| "Outcomes" chart | `outcomes.*` | Map "Fully Achieved"→fullyAchieved, etc. |
| "Primary Friction Types" chart | `friction.*` | Map "Buggy Code"→buggyCode, etc. |
| "Inferred Satisfaction" chart | `satisfaction.*` | Map "Satisfied"→satisfied, etc. |
| "Tool Errors Encountered" chart | `toolErrors` | Record<string, number> |
| Multi-Clauding stats | `multiClauding.*` | parseInt for counts, strip % |
| Response time footer | `responseTime.*` | parseFloat |
| Subtitle sessions | `totalSessions` | parseInt |

## Test Coverage

### File: `apps/web/lib/insights/parser.test.ts`

### Test fixture: `apps/web/lib/insights/__fixtures__/claude-code-report.html`

A sanitized, minimal version of the real report with known values for deterministic testing. Must include:
- Stats row with all 5 values
- At least 2 chart cards (tools, outcomes)
- Multi-clauding section
- Response time section
- Subtitle with period and session count

**Required test cases:**

1. **Full report parsing** — parse the fixture, verify all fields match expected values
2. **Volume extraction** — messages, lines, files, days, msgsPerDay all correct
3. **Tool usage** — all tools extracted with correct counts
4. **Session types** — all types with counts
5. **Outcomes** — fully/mostly/partially achieved correctly mapped
6. **Friction** — buggy code, wrong approach, misunderstood correctly mapped
7. **Satisfaction** — all 3 levels correctly mapped
8. **Multi-clauding** — overlap events, sessions involved, message percent
9. **Response time** — median and average seconds
10. **Tool errors** — all error types with counts
11. **Total sessions** — extracted from subtitle
12. **Total tool calls** — computed as sum of toolUsage values
13. **Report period** — start and end dates from subtitle
14. **Missing sections** — report with missing chart cards → defaults to 0
15. **Malformed values** — commas in numbers, missing % signs → handled gracefully
16. **Empty HTML** — returns valid InsightsUpload with all zeros

## Acceptance Criteria

- [x] Parser extracts all fields from the reference report correctly
- [x] Missing sections produce defaults (no crashes)
- [x] Malformed values handled gracefully
- [x] All 16+ test cases pass (44 tests across 12 describe blocks)
- [x] Parser works with `DOMParser` (browser) — verify with jsdom in tests

## Verification

```bash
pnpm run typecheck 2>&1; pnpm run test -- --run apps/web/lib/insights/parser.test.ts 2>&1
```
