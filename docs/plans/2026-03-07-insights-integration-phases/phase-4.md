# Phase 4: Upload UI

> Parent plan: [Insights Integration](../2026-03-07-insights-integration.md)
> Depends on: Phase 1 (types), Phase 2 (parser), Phase 3 (API)

## Goal

Build the user-facing interface for importing Claude Code insights: a file picker with preview and upload flow, accessible from the share page (for the profile owner) and the user menu.

## Design

### UX Flow

1. User clicks "Import AI Insights" (from share page or user menu)
2. File picker opens — accepts `.html` files only
3. Client-side: `parseInsightsHtml(file)` extracts structured data
4. Preview screen shows extracted metrics (messages, sessions, tools used, outcomes)
5. User confirms → POST `/api/insights` with JSON payload
6. Success → craft score appears on share page, badge updates on next render
7. User can re-import anytime (upserts — replaces previous)

### Visual Design (follows design system)

- **Import button:** Ghost/outline style (`border-stroke`, `text-text-secondary`), with a small upload icon
- **Preview card:** `bg-card border-stroke rounded-xl` — shows key metrics in a grid
- **Metrics grid:** 2-column on mobile, 3-column on desktop — each metric as a stat card
- **Confirm button:** Primary CTA (`bg-amber text-white`)
- **Tool icon:** Claude Code logo (simple `<svg>` inline — matches our icon pattern)
- **Success state:** Terminal-style success message (`text-terminal-green`)
- **Error state:** Terminal-style error (`text-terminal-red`)

### Component Architecture

```
InsightsImporter (orchestrator)
  ├─ State: idle → parsing → preview → uploading → success → error
  ├─ File input (hidden, triggered by button)
  ├─ parseInsightsHtml(fileContent) on file select
  ├─ InsightsPreview (shows extracted data)
  │   ├─ Volume section (messages, lines, files, days)
  │   ├─ Tools section (top 5 tools with counts)
  │   ├─ Outcomes section (achievement rates)
  │   └─ Period (date range)
  ├─ Confirm/Cancel buttons
  └─ POST /api/insights on confirm
```

## Implementation

### File: `apps/web/components/InsightsImporter.tsx`

```typescript
"use client";

interface InsightsImporterProps {
  handle: string;
  onSuccess?: (craftScore: CraftResult) => void;
  onClose?: () => void;
}

export function InsightsImporter({ handle, onSuccess, onClose }: InsightsImporterProps)
```

**States:**
- `idle` — shows import button / file picker trigger
- `parsing` — reading file, parsing HTML (should be instant)
- `preview` — shows InsightsPreview with extracted data
- `uploading` — POST in flight, button disabled
- `success` — shows craft score result with terminal-green success message
- `error` — shows error message with retry option

**Key behaviors:**
- File is read as text via `FileReader.readAsText()`
- HTML is parsed client-side — raw HTML never sent to server
- Only the structured JSON (`InsightsUpload`, ~2KB) is uploaded
- Preview must show enough data for user to verify it looks right
- No drag-and-drop (keep it simple) — standard file input

### File: `apps/web/components/InsightsPreview.tsx`

```typescript
interface InsightsPreviewProps {
  data: InsightsUpload;
}

export function InsightsPreview({ data }: InsightsPreviewProps)
```

Renders a preview card with:
- **Period**: "Feb 20, 2026 – Mar 7, 2026"
- **Volume grid**: Messages, Lines (+/-), Files, Days active
- **Top tools**: Top 5 by count, with bar visualization
- **Outcomes**: Fully/mostly/partially achieved as pills or mini bar
- **Sessions**: Total count + session type breakdown
- **Multi-clauding**: overlap events, parallel message %

Uses design system tokens: `font-heading` for numbers, `font-body` for labels, `bg-card`, `border-stroke`.

### Modified: `apps/web/app/u/[handle]/page.tsx`

Add an "Import AI Insights" section that appears **only when the authenticated user is viewing their own profile**:

```tsx
{isOwner && insightsEnabled && (
  <section className="...">
    <InsightsImporter handle={handle} onSuccess={handleInsightsUploaded} />
  </section>
)}
```

Gate behind the `insights_integration` feature flag.

### Modified: `apps/web/components/UserMenu.tsx`

Add "Import AI Insights" menu item that navigates to `/u/{handle}#insights` (scroll to the insights section on the share page).

## Accessibility

- File input has proper `<label>` and `aria-label`
- Preview data uses semantic HTML (`<dl>` for stats)
- Upload button has loading state with `aria-busy="true"`
- Success/error messages use `role="status"` and `aria-live="polite"`
- All interactive elements are keyboard accessible

## Acceptance Criteria

- [x] User can select an HTML file from their filesystem
- [x] Parser extracts data and shows preview correctly
- [x] User can confirm upload → data is sent to API
- [x] Success state shows craft score
- [x] Error state shows actionable message
- [x] Only the profile owner sees the import option
- [x] Feature flag gates the entire UI
- [x] Works on mobile (responsive layout)
- [x] Keyboard accessible

## Verification

```bash
pnpm run typecheck 2>&1; pnpm run lint 2>&1
```

Manual verification: navigate to `/u/{handle}`, verify import button appears, upload a report, verify preview and success state.
