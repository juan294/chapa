# Phase 3: Database + API

> Parent plan: [Insights Integration](../2026-03-07-insights-integration.md)
> Depends on: Phase 1 (types + scoring), Phase 2 (parser — for validation shape reference)

## Goal

Create the Supabase table, database access functions, and API routes for uploading and reading craft scores.

## Database

### Supabase migration: `tool_insights` table

```sql
CREATE TABLE tool_insights (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  handle          text NOT NULL,
  tool            text NOT NULL,
  report_start    date NOT NULL,
  report_end      date NOT NULL,
  raw_data        jsonb NOT NULL,
  proficiency     smallint NOT NULL CHECK (proficiency BETWEEN 0 AND 100),
  effectiveness   smallint NOT NULL CHECK (effectiveness BETWEEN 0 AND 100),
  sophistication  smallint NOT NULL CHECK (sophistication BETWEEN 0 AND 100),
  craft_score     smallint NOT NULL CHECK (craft_score BETWEEN 0 AND 100),
  craft_tier      text NOT NULL CHECK (craft_tier IN ('Novice', 'Practitioner', 'Expert', 'Master')),
  uploaded_at     timestamptz DEFAULT now(),
  UNIQUE(handle, tool)
);

CREATE INDEX idx_tool_insights_handle ON tool_insights(handle);
```

Run via Supabase SQL Editor (same as other tables — we don't use migration files).

## Database Access

### File: `apps/web/lib/db/tool-insights.ts`

```typescript
import { supabase } from "./client";
import type { CraftResult, InsightsUpload, InsightsTool } from "@chapa/shared";

/**
 * Upsert a tool insights record (one active report per handle+tool).
 * Returns the stored CraftResult.
 */
export async function dbUpsertToolInsights(
  handle: string,
  data: InsightsUpload,
  scores: CraftResult
): Promise<CraftResult | null>

/**
 * Get the active craft score for a handle (across all tools).
 * Returns null if no insights uploaded.
 */
export async function dbGetToolInsights(
  handle: string
): Promise<CraftResult | null>

/**
 * Get the active craft score for a specific tool.
 */
export async function dbGetToolInsightsByTool(
  handle: string,
  tool: InsightsTool
): Promise<CraftResult | null>

/**
 * Delete tool insights for a handle+tool (user wants to remove).
 */
export async function dbDeleteToolInsights(
  handle: string,
  tool: InsightsTool
): Promise<boolean>
```

**Graceful degradation:** If Supabase is unavailable, return `null` (same pattern as other db modules). Never throw — the badge renders fine without craft data.

## API Routes

### File: `apps/web/app/api/insights/route.ts`

#### POST `/api/insights` — Upload insights report

```
Auth: Session required (GitHub OAuth — same as /api/studio/config)
Body: InsightsUpload JSON
Rate limit: 10 req/handle/24h (same pattern as /api/supplemental)

Flow:
1. Validate session → extract handle
2. Check feature flag (insights_integration)
3. Validate InsightsUpload shape
4. computeCraftScore(data) → CraftResult
5. dbUpsertToolInsights(handle, data, scores)
6. Invalidate badge cache: delete stats:v2:merged:{handle}
7. Return { success: true, craftScore: CraftResult }
```

**Response:** `200 { success: true, craftScore: CraftResult }`
**Errors:** `401` (no session), `400` (invalid data), `403` (feature disabled), `429` (rate limited)

#### GET `/api/insights/[handle]/route.ts` — Read craft score (public)

```
Auth: None (public endpoint, rate-limited)
Rate limit: 60 req/IP/min (standard public rate limit)

Flow:
1. Validate handle format
2. dbGetToolInsights(handle)
3. Return craft score (no raw_data — privacy)

Response: { craftScore: CraftResult } or { craftScore: null }
```

## Validation

### File: `apps/web/lib/insights/validation.ts`

```typescript
/**
 * Validate that an object has the correct InsightsUpload shape.
 * Returns { valid: true } or { valid: false, reason: string }.
 */
export function isValidInsightsUpload(
  data: unknown
): { valid: true } | { valid: false; reason: string }
```

**Validation rules:**
- `tool` must be `"claude-code"` (extensible later)
- `reportPeriod.start` and `reportPeriod.end` must be valid ISO dates
- `reportPeriod.end` must be >= `reportPeriod.start`
- `volume.*` must be non-negative numbers
- `toolUsage` must be a Record with string keys and non-negative number values
- `sessionTypes` same validation
- `outcomes.*` must be non-negative integers
- `friction.*` must be non-negative integers
- `satisfaction.*` must be non-negative integers
- `multiClauding.messagePercent` must be 0-100
- `responseTime.*` must be non-negative numbers
- `totalSessions` must be positive integer (>= 1)
- `totalToolCalls` must be non-negative integer

## Test Coverage

### File: `apps/web/app/api/insights/route.test.ts`

Test by importing the handler and passing `NextRequest` (same pattern as other API route tests).

**Required test cases:**

1. **POST success** — valid session + valid data → 200 + CraftResult
2. **POST no session** — no auth → 401
3. **POST invalid data** — missing fields → 400 with reason
4. **POST feature disabled** — flag off → 403
5. **POST rate limited** — 11th request → 429
6. **POST cache invalidation** — verify badge cache key deleted after upload
7. **GET success** — existing insights → 200 + CraftResult (no raw_data)
8. **GET no data** — no insights uploaded → 200 + `{ craftScore: null }`
9. **GET invalid handle** — bad handle format → 400
10. **POST upsert** — second upload replaces first (same handle+tool)

### File: `apps/web/lib/insights/validation.test.ts`

1. **Valid upload** — complete data → `{ valid: true }`
2. **Missing tool** → invalid
3. **Invalid tool value** → invalid
4. **Missing report period** → invalid
5. **Negative numbers** → invalid
6. **messagePercent > 100** → invalid
7. **Zero sessions** → invalid
8. **Extra fields** — allowed (forward compatibility)
9. **Missing optional sections** — graceful

## Acceptance Criteria

- [x] Table created in Supabase (via Management API)
- [x] POST endpoint stores data and returns craft score
- [x] GET endpoint returns craft score publicly (no raw data leak)
- [x] Rate limiting works (10 req/handle/24h for POST, 60 req/IP/min for GET)
- [x] Feature flag gates the upload endpoint
- [x] Cache invalidation triggers on successful upload
- [x] All 19+ test cases pass (25 tests: 12 route + 12 validation + 1 GET rate limit)
- [x] Graceful degradation when Supabase is unavailable

## Verification

```bash
pnpm run typecheck 2>&1; pnpm run test -- --run apps/web/app/api/insights/route.test.ts apps/web/lib/insights/validation.test.ts 2>&1
```
