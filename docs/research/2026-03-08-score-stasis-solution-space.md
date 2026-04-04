# Research: Score Stasis Solution Space — Immediate Feedback vs. EMA Protection

> Date: 2026-03-08
> Triggered by: User uploads insights report, sees craft dimension (pentagon), but composite score stays at 58. No visible feedback during upload. User wants their "dopamine hit" for deliberate actions while maintaining scoring integrity.

## The Two Distinct Problems

### Problem 1: No Upload Feedback
Status text ("Processing…", "Uploaded!") renders inside the dropdown menu (`UserMenu.tsx:309-312`), but the menu closes immediately when processing starts (`UserMenu.tsx:75: setOpen(false)`). User sees nothing between file selection and page reload.

### Problem 2: Score Frozen After Upload
Three compounding mechanisms prevent the score from updating same-day:

| Mechanism | Location | Effect |
|-----------|----------|--------|
| **Stale snapshot cache** | `snapshot:latest:{handle}` never invalidated by `/api/insights` | Badge route reads OLD snapshot from cache |
| **DB dedup** | `dbInsertSnapshot` uses `ignoreDuplicates: true` on `(handle, date)` | Same-day snapshot insert is silently ignored |
| **EMA same-day guard** | `smoothing.ts:61-64` | Returns cached `adjustedComposite` when snapshot is from today |

### The Fundamental Insight

The EMA exists to dampen **organic GitHub stat fluctuations** — contributions aging out of the 365-day window, minor daily changes. These are passive, gradual, and shouldn't cause jarring score swings.

But an **insights upload is a deliberate user action**. The user chose to generate a report, navigate to Chapa, and upload it. This is categorically different from passive stat drift. The scoring system should distinguish between:

- **Passive changes** (GitHub stats rolling window) → EMA smoothing protects against noise
- **Deliberate actions** (insights upload, platform connect, refresh) → user expects immediate feedback

---

## Architecture: How Scores Flow Today

```
                                ┌─────────────────────────┐
                                │   POST /api/insights     │
                                │   stores craft in DB     │
                                │   deletes stats cache    │
                                │   does NOT touch snapshot│
                                └────────────┬────────────┘
                                             │
                                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  GET /u/{handle}/badge.svg                                       │
│                                                                  │
│  1. getStats(handle) ─── cache miss → fresh from GitHub          │
│  2. dbGetToolInsights(handle) ─── fresh craft from DB            │
│  3. getCachedLatestSnapshot(handle) ─── STALE from Redis ⚠️     │
│                                                                  │
│  4. computeImpactV6(stats, craftScore) → raw composite ~61       │
│                                                                  │
│  5. smoothScore(61, staleSnapshot) ──┐                           │
│     │ staleSnapshot.date === today   │                           │
│     │ → return staleSnapshot.adjustedComposite (58) ⚠️          │
│     └────────────────────────────────┘                           │
│                                                                  │
│  6. impact.adjustedComposite = 58 (unchanged)                    │
│  7. Render badge with 58                                         │
│                                                                  │
│  after():                                                        │
│    buildSnapshot(stats, impact) → snapshot.adjustedComposite = 58│
│    dbInsertSnapshot → IGNORED (duplicate for today) ⚠️          │
│    updateSnapshotCache → NOT called (insert returned false)      │
└──────────────────────────────────────────────────────────────────┘
```

Three ⚠️ points block the score update. All three must be addressed.

---

## Intervention Points

### Point 1: Snapshot Cache Invalidation (`snapshot-cache.ts`)

**Current state:** The insights upload route (`/api/insights/route.ts:59`) invalidates `stats:v2:merged:{handle}` but does NOT invalidate `snapshot:latest:{handle}`. The snapshot cache key is never deleted anywhere in the codebase.

**What exists:**
- `cacheDel()` in `apps/web/lib/cache/redis.ts` — available and working
- `snapshotCacheKey()` in `snapshot-cache.ts:18` — computes `snapshot:latest:{handle.toLowerCase()}`
- No export for `snapshotCacheKey` — it's a private helper

**Other callers of `cacheDel` for reference:**

| Route | Keys Deleted |
|-------|-------------|
| `/api/insights` | `stats:v2:merged:{handle}` only |
| `/api/supplemental` | `stats:v2:merged:{handle}` only |
| `/api/refresh` | `stats:v2:merged:{handle}` only |
| `/api/auth/bitbucket/callback` | `stats:v2:merged:{handle}` + `stats:v2:bitbucket:{handle}` |
| `/api/auth/codeberg/callback` | `stats:v2:merged:{handle}` + `stats:v2:codeberg:{handle}` |

None delete the snapshot cache.

### Point 2: Snapshot DB Deduplication (`db/snapshots.ts`)

**Current state:** `dbInsertSnapshot()` at `apps/web/lib/db/snapshots.ts:206-231` uses Supabase `.upsert()` with `ignoreDuplicates: true` on the `(handle, date)` unique constraint. Same-day inserts return `status: 200` (ignored) rather than `status: 201` (inserted).

**What exists:**
- Supabase supports `onConflict` with `do update set` — changing from `ignoreDuplicates: true` to explicit update columns would allow same-day replacement
- The `buildSnapshot` function is pure — can be called multiple times safely
- The unique constraint is `(handle, date)` — intentional design to keep 1 snapshot/user/day

### Point 3: EMA Same-Day Guard (`smoothing.ts`)

**Current state:** `smoothScore()` at `smoothing.ts:50-69` returns the cached `adjustedComposite` when `latestSnapshot.date === todayStr`. This prevents the feedback loop bug where every page refresh would re-apply EMA on an already-smoothed value.

**What exists:**
- The guard is a simple date comparison — no concept of "why" the score changed
- The function accepts an optional `today` parameter (for testing) but no "bypass" parameter
- EMA alpha = 0.15, half-life ~4.3 days

---

## Solution Design Options

### Option A: Snapshot Invalidation + Replacement (Minimal)

After insights upload, invalidate the snapshot cache AND replace today's snapshot in DB with the newly computed score.

**Changes:**
1. `/api/insights/route.ts` — also delete `snapshot:latest:{handle}` in `after()`
2. `/api/insights/route.ts` — after storing craft, re-compute impact and replace today's snapshot
3. `db/snapshots.ts` — add `dbReplaceSnapshotToday(handle, snapshot)` that uses `upsert` with `do update` instead of `ignoreDuplicates`

**Pros:** Minimal code change, score updates immediately on next badge view
**Cons:** EMA is bypassed for the day, raw score jump could be jarring if GitHub stats also changed

### Option B: "Event-Driven" EMA Bypass

Track whether a score change was triggered by a deliberate user action. When event-driven, compute the new score without EMA and store it as the new reference point.

**Changes:**
1. `/api/insights/route.ts` — after upload, compute full impact with craft, store as "event snapshot"
2. `smoothing.ts` — accept an `eventTriggered` flag that bypasses the same-day guard
3. Badge/share page — detect if snapshot was event-triggered, skip EMA for that request

**Pros:** Clean separation of passive vs. active changes
**Cons:** More complex, adds state to the snapshot model

### Option C: Immediate Preview in Upload Response (Client-Side)

The upload API already returns the craft score. Extend it to also return the projected composite score. Show the projected score in a toast/banner immediately after upload — the user sees the impact before the badge even regenerates.

**Changes:**
1. `/api/insights/route.ts` — after computing craft, also compute projected impact and return it
2. `UserMenu.tsx` — after successful upload, show a toast with "Your Craft score: 69 (Expert) — badge updating..."
3. New toast/notification component for persistent feedback
4. Still combine with Option A so the badge catches up on next view

**Pros:** Instant gratification, clear communication, badge catches up naturally
**Cons:** Needs a new UI component (toast), projected score might differ slightly from final badge score

### Option D: Score Recalculation Endpoint

Create a dedicated endpoint that the client calls after upload to force-recalculate and display the new score. This is the "premium refresh" — used only after deliberate user actions.

**Changes:**
1. New `POST /api/recalculate` — fetches stats, computes impact with new craft, replaces snapshot, invalidates all caches
2. Client calls this after successful insights upload
3. Page reloads with fresh data

**Pros:** Single point of recalculation, reusable for any "score-affecting action"
**Cons:** Another endpoint, more API calls

---

## Existing Code Assets That Support Each Option

### For snapshot replacement (Options A, B, D):
- `buildSnapshot()` at `history/snapshot.ts:12` — pure function, safe to call repeatedly
- `updateSnapshotCache()` at `snapshot-cache.ts:62` — updates Redis cache
- `computeImpactV6()` at `impact/v6.ts:206` — pure function, accepts optional craftScore
- `getStats()` at `github/client.ts` — cache-first with fallback to API
- `dbGetToolInsights()` at `db/tool-insights.ts` — fetches craft from Supabase

### For client-side feedback (Option C):
- `computeCraftScore()` at `insights/scoring.ts:167` — already called in upload route, result returned
- `computeImpactV6()` — could be called server-side in the upload route for a projected score
- `GeneratingProgress` at `generating/[handle]/GeneratingProgress.tsx` — multi-step progress pattern
- `ErrorBanner` at `components/ErrorBanner.tsx` — existing persistent banner component
- Design system tokens: `text-terminal-green` for success, `animate-fade-in-up` for entrance

### For EMA awareness (Option B):
- `MetricsSnapshot` type at `history/types.ts` — could add an `eventTriggered?: boolean` field
- `smoothScore()` at `smoothing.ts:50` — already accepts optional params, could add bypass flag
- `toDateString()` at `utils/date.ts` — date formatting utility

---

## The Upload UX Feedback Gap

### Current flow (invisible):
```
File selected → menu closes → [nothing visible] → page reloads
```

### What users of other platforms expect:
```
File selected → progress indicator → success confirmation with score preview → badge regenerates
```

### Existing patterns to reuse:

1. **GeneratingProgress** (`generating/[handle]/GeneratingProgress.tsx:1-210`):
   - 4-step visual progress with states: `pending | active | done | error`
   - Active step: pulsing amber dot
   - Done step: green checkmark
   - Staggered animations, terminal-themed

2. **StudioClient save** (`studio/StudioClient.tsx:100-117`):
   - In-button spinner: `<svg className="h-4 w-4 animate-spin">`
   - Terminal output log: `makeLine("success", "Configuration saved!")`

3. **BadgeToolbar refresh** (`components/BadgeToolbar.tsx:19-43`):
   - State machine: `idle | loading | success | error`
   - Button text changes with state
   - Page reload after 500ms on success

### What's missing:
- No centralized toast/notification component
- No floating/overlay progress indicator (everything is inline or inside closed menus)
- No post-action score preview ("Your score will change from X to Y")

---

## CDN Cache Consideration

The badge SVG has `Cache-Control: public, s-maxage=21600, stale-while-revalidate=604800` (`badge.svg/route.ts:25`). Even after the server-side score updates, CDN-cached badges persist for up to 6 hours.

**Mitigation options:**
- Add a cache-busting query parameter: `/u/{handle}/badge.svg?v={timestamp}` after upload
- Use `stale-while-revalidate` — CDN serves stale but revalidates in background (already set to 7 days)
- Shorten `s-maxage` for authenticated requests (when user is viewing their own badge)
- Client-side: show the projected score in a toast while the CDN catches up

---

## Summary: What the Codebase Already Has vs. What's Needed

| Need | Exists? | Location |
|------|---------|----------|
| Craft score computation | Yes | `insights/scoring.ts:167` |
| Impact computation with craft | Yes | `impact/v6.ts:206` |
| Snapshot building | Yes | `history/snapshot.ts:12` |
| Snapshot cache update | Yes | `cache/snapshot-cache.ts:62` |
| Snapshot cache invalidation | **No** | Needs `cacheDel("snapshot:latest:{handle}")` |
| Same-day snapshot replacement | **No** | Needs `dbReplaceSnapshotToday()` or upsert change |
| EMA bypass for events | **No** | Needs param or flag in `smoothScore()` |
| Toast/notification component | **No** | Need new component |
| Upload progress indicator | **No** | Need to render outside closed dropdown |
| Projected score preview | **No** | Need to compute in upload response |
| CDN cache busting | **No** | Need query param or shorter TTL |
