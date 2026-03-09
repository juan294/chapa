# Immediate Score Feedback + Upload UX Fix

> Date: 2026-03-08
> Triggered by: User uploads insights report, sees no progress feedback, and score stays frozen at 58 due to EMA same-day guard + stale snapshot cache. Need immediate dopamine hit on deliberate actions while keeping EMA protection for passive changes.

## Problem

Three compounding issues after insights upload:

1. **No upload progress**: Status text renders inside closed dropdown — user sees nothing between file selection and page reload.
2. **Stale snapshot cache**: `/api/insights` clears `stats:v2:merged:` but never clears `snapshot:latest:` — badge route reads OLD snapshot.
3. **EMA same-day guard**: `smoothScore()` returns cached `adjustedComposite` when snapshot is from today — score frozen until tomorrow.

## Design

### Core Principle

**Deliberate user actions** (insights upload, platform connect, refresh) should produce immediate, visible score feedback. **Passive changes** (GitHub stats rolling window) should continue to be smoothed by EMA.

### Architecture

```
User uploads insights report
  → Toast shows "Processing report…" (immediately visible, outside dropdown)
  → POST /api/insights → craft score computed + stored
  → POST /api/recalculate → fresh impact with craft, snapshot replaced
  → Toast updates: "Craft: 69 Expert · Score: 58 → 61 ✓"
  → Page reloads with new score
```

### Components

1. **Toast Component** — Floating notification rendered via `createPortal`, visible above all UI.
2. **`dbReplaceSnapshot()`** — Upserts today's snapshot (replaces instead of ignoring duplicates).
3. **`invalidateSnapshotCache()`** — Deletes `snapshot:latest:{handle}` from Redis.
4. **`POST /api/recalculate`** — Fetches stats + craft, computes impact, replaces snapshot, returns new score. Reusable for any score-affecting action.
5. **Upload flow rewrite** — Toast-based progress with score preview after recalculation.

## Phase Structure

| Phase | Description | Depends On | Files |
|-------|-------------|------------|-------|
| 1 | Toast component | — | 3 files |
| 2 | Snapshot replacement infrastructure | — | 3 files |
| 3 | Recalculate endpoint | Phase 2 | 3 files |
| 4 | Upload flow integration | Phases 1 + 3 | 4 files |

Phases 1 and 2 are independent — no file overlap, no dependency. [batch-eligible]

## Files Changed

| File | Phase | Change |
|------|-------|--------|
| `apps/web/components/Toast.tsx` | 1 | New — floating toast component with portal |
| `apps/web/components/Toast.test.tsx` | 1 | New — tests for Toast |
| `apps/web/styles/globals.css` | 1 | Add slide-out animation keyframe |
| `apps/web/lib/db/snapshots.ts` | 2 | Add `dbReplaceSnapshot()` function |
| `apps/web/lib/db/snapshots.test.ts` | 2 | Tests for `dbReplaceSnapshot()` |
| `apps/web/lib/cache/snapshot-cache.ts` | 2 | Add `invalidateSnapshotCache()` export |
| `apps/web/app/api/recalculate/route.ts` | 3 | New — recalculate endpoint |
| `apps/web/app/api/recalculate/route.test.ts` | 3 | New — tests for recalculate |
| `apps/web/app/api/insights/route.ts` | 3 | Add snapshot cache invalidation to `after()` |
| `apps/web/components/UserMenu.tsx` | 4 | Rewrite upload flow with toast + recalculate |
| `apps/web/components/UserMenu.test.tsx` | 4 | Tests for new upload flow |
| `apps/web/app/api/insights/route.test.ts` | 4 | Update to verify snapshot cache invalidation |
| `docs/impact-v6.md` | 4 | Document recalculate endpoint + immediate feedback |

## Automated Success Criteria

- [ ] `pnpm run typecheck` passes
- [ ] `pnpm run lint` passes
- [ ] `pnpm run test` passes
- [ ] Toast renders via portal outside dropdown, visible during upload
- [ ] Toast shows 3 states: processing → success with score → auto-dismiss
- [ ] `dbReplaceSnapshot()` updates existing same-day snapshot (not ignored)
- [ ] `invalidateSnapshotCache()` deletes `snapshot:latest:{handle}` from Redis
- [ ] `POST /api/recalculate` returns new `adjustedComposite` and `dimensions`
- [ ] After insights upload + recalculate, badge shows updated score immediately
- [ ] EMA smoothing still applies normally for passive badge views (no regression)
- [ ] Recalculate endpoint is rate limited and auth-protected

## Manual Success Criteria

- [ ] Upload insights report → see toast with progress, then score change
- [ ] Badge SVG reflects new score after upload (not frozen at old value)
