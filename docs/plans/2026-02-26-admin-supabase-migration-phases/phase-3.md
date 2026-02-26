# Phase 3: Rewrite Admin API Route

## Goal
Replace the Redis-based `GET /api/admin/users` with the new Supabase-backed `dbGetAdminUsers()`. Accept query parameters for pagination, sorting, and filtering. Remove Redis cache dependency entirely.

## Changes

### 3.1 Rewrite `apps/web/app/api/admin/users/route.ts`

The route keeps its auth and rate-limit logic but replaces the data layer completely.

```pseudo
// REMOVE these imports:
- cacheMGet, rateLimit from "@/lib/cache/redis"
- computeImpactV4 from "@/lib/impact/v4"
- applyEMA from "@/lib/impact/smoothing"
- getTier from "@/lib/impact/utils"
- dbGetLatestSnapshotBatch from "@/lib/db/snapshots"
- StatsData from "@chapa/shared"

// KEEP these imports:
+ rateLimit from "@/lib/cache/redis"  (rate limiting still uses Redis — that's fine)
+ readSessionCookie, isAdminHandle, getClientIp

// ADD:
+ dbGetAdminUsers from "@/lib/db/admin-users"

// REMOVE the AdminUserEntry interface (moved to shared types or admin-users.ts)
```

### 3.2 New route handler

```pseudo
export async function GET(request: NextRequest) {
  // Auth + rate limit (unchanged)
  const ip = getClientIp(request);
  const rl = await rateLimit(`ratelimit:admin-users:${ip}`, 10, 60);
  if (!rl.allowed) return 429;

  const session = readSessionCookie(...);
  if (!session) return 401;
  if (!isAdminHandle(session.login)) return 403;

  // Parse query params
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") ?? "1", 10);
  const limit = parseInt(url.searchParams.get("limit") ?? "25", 10);
  const sort = (url.searchParams.get("sort") ?? "adjustedComposite") as AdminSortField;
  const dir = (url.searchParams.get("dir") ?? "desc") as "asc" | "desc";
  const search = url.searchParams.get("search") ?? undefined;
  const tier = url.searchParams.get("tier") ?? undefined;
  const archetype = url.searchParams.get("archetype") ?? undefined;

  // Validate sort field against allowlist
  if (!VALID_SORT_FIELDS.includes(sort)) {
    return NextResponse.json({ error: "Invalid sort field" }, { status: 400 });
  }

  // Single Supabase call replaces: dbGetUsers + cacheMGet + computeImpactV4 + applyEMA
  const result = await dbGetAdminUsers({ page, limit, sort, dir, search, tier, archetype });

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
```

### 3.3 Response shape change

**Before:**
```json
{
  "users": [{ "handle": "...", "statsExpired": true|false, ... }]
}
```

**After:**
```json
{
  "users": [{ "handle": "...", "registeredAt": "...", "lastSnapshotDate": "..." | null, ... }],
  "total": 150,
  "page": 1,
  "limit": 25,
  "totalPages": 6
}
```

Key changes:
- `statsExpired` removed — replaced by `lastSnapshotDate` (null means "no snapshot yet")
- `registeredAt` added — useful for "member since" display
- Pagination metadata added (`total`, `page`, `limit`, `totalPages`)

### 3.4 Update `AdminUserEntry` type

Move the type to `apps/web/lib/db/admin-users.ts` (co-located with the query) and export it.

```pseudo
export interface AdminUserEntry {
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
  registeredAt: string;           // NEW: from users table
  lastSnapshotDate: string | null; // NEW: replaces statsExpired
  fetchedAt: string | null;       // captured_at from snapshot
  commitsTotal: number | null;
  prsMergedCount: number | null;
  reviewsSubmittedCount: number | null;
  activeDays: number | null;
  reposContributed: number | null;
  totalStars: number | null;
  archetype: string | null;
  tier: string | null;
  adjustedComposite: number | null;
  rawScore: number | null;
  confidence: number | null;
}
```

## Tests

### `apps/web/app/api/admin/users/route.test.ts` — rewrite:

The test mocking strategy changes significantly. Instead of mocking `cacheMGet`, `computeImpactV4`, `applyEMA`, `getTier`, and `dbGetLatestSnapshotBatch`, we mock only `dbGetAdminUsers`.

1. **Returns 401 without session** — unchanged
2. **Returns 401 without NEXTAUTH_SECRET** — unchanged
3. **Returns 403 for non-admin** — unchanged
4. **Returns 429 when rate limited** — unchanged
5. **Returns paginated users from Supabase** — mock `dbGetAdminUsers` returns `{ users, total, page, limit, totalPages }`
6. **Passes default query params** — page=1, limit=25, sort=adjustedComposite, dir=desc
7. **Passes custom query params** — page=2, limit=50, sort=handle, dir=asc, search=juan
8. **Returns 400 for invalid sort field** — sort=invalid
9. **Passes tier filter** — tier=Elite
10. **Passes archetype filter** — archetype=Builder
11. **Returns empty result when no users** — dbGetAdminUsers returns { users: [], total: 0 }
12. **Includes pagination metadata in response** — total, page, limit, totalPages
13. **Cache-Control: no-store header** — unchanged
14. **No Redis dependency in data path** — verify cacheMGet is NOT called
15. **No computeImpactV4 dependency** — verify it's NOT imported/called

## Success Criteria

### Automated
- [x] All 16 route tests pass (exceeded plan's 15 — added statsExpired-absent and all-valid-sort-fields tests)
- [x] `pnpm run typecheck` — no type errors
- [x] `pnpm run lint` — clean
- [x] No unused imports flagged

### Manual
- [ ] Hit the API with curl: `curl -H "Cookie: ..." "localhost:3001/api/admin/users?page=1&limit=5"`
- [ ] Verify response includes pagination metadata
- [ ] Verify users without snapshots show null fields (not "data expired")
