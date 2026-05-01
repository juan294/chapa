---
phase: 11D
release: v2.11.0
issues: ["#811", "#814", "#774"]
batch_eligible: false
depends_on: []
effort: M
---

# Phase 11D — Module boundaries + dead-code + store primitive (`#811`, `#814`, `#774`)

## Goal

Three architectural cleanups that work together cleanly:

- **`#811`** — Reusable layers (`lib/agents/report-parser.ts`,
  `components/ShareBadgePreview.tsx`) currently import types and components
  from route-owned `app/*` directories. Reverse the dependency: move
  shared types/components into neutral `lib/` or `components/` locations.
- **`#814`** — Dead code in `components/dashboard/`: `HeroScoreZone`,
  `RadarChartInteractive`, plus possibly `SharePageOwnerContent.tsx:142`
  branch and `ImpactDashboard.tsx:46`.
- **`#774`** (wave-3 hoisted) — Three diverging module-level store
  patterns. Extract a single `createReactStore` primitive (already started
  in Phase 10B) and migrate the other two stores to it.

## #811 — Boundary cleanup

Issue cited:
- `lib/agents/report-parser.ts:8` imports from `app/admin/agents-types.ts:17`
- `components/ShareBadgePreview.tsx:4` imports from
  `app/studio/BadgePreviewCard.tsx:46` and `app/studio/StudioClient.tsx:261`

```ts
// Move app/admin/agents-types.ts -> lib/agents/types.ts (or apps/web/types/agents.ts)
git mv apps/web/app/admin/agents-types.ts apps/web/lib/agents/types.ts

// Move studio types/components used outside the route into a neutral location:
//   apps/web/components/studio/BadgePreviewCard.tsx (just the component)
//   apps/web/lib/studio/badge-types.ts (just the types)
// Re-export from app/studio/* for backward compat during migration; remove
// the re-exports in the same release once call sites are updated.
```

Update every importer with grep+sed.

## #814 — Dead code removal

First confirm the four flagged components really are unused:

```bash
grep -rn "HeroScoreZone\|RadarChartInteractive" apps/web --include="*.ts" --include="*.tsx"
```

If imports are only from test files: delete component + test together.
If a component IS used somewhere unexpected: keep, document in
`docs/accepted-risks.md`.

Remove (anticipated — confirm during /implement):
- `apps/web/components/dashboard/HeroScoreZone.tsx`
- `apps/web/components/dashboard/HeroScoreZone.test.tsx`
- `apps/web/components/dashboard/RadarChartInteractive.tsx`
- `apps/web/components/dashboard/RadarChartInteractive.test.tsx`

For `SharePageOwnerContent.tsx:142` and `ImpactDashboard.tsx:46`: read
those branches, determine whether they're reachable, and either remove
the branch or document why it stays.

## #774 — Single store primitive

The three module-level stores currently in the codebase:
1. `KeyboardShortcutsListener` store (will move to `lib/stores/createReactStore.ts` in Phase 10B)
2. `useSession` module cache (already partially structured but bespoke)
3. `useTrendData` module cache (also bespoke)

Pseudocode:

```ts
// apps/web/lib/stores/createReactStore.ts
export function createReactStore<T>(initial: T) {
  const listeners = new Set<() => void>();
  let value = initial;
  return {
    get: () => value,
    set: (next: T | ((prev: T) => T)) => {
      value = typeof next === "function" ? (next as (p: T) => T)(value) : next;
      listeners.forEach(l => l());
    },
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    useStore: function useStore<S>(selector: (v: T) => S = (v) => v as unknown as S) {
      return useSyncExternalStore(this.subscribe, () => selector(this.get()));
    },
  };
}
```

Migrate `useSession` and `useTrendData` to use this primitive. Behavior
must remain identical (verified via existing tests).

## Files

- Multiple moves under `apps/web/lib/agents/` and `apps/web/components/studio/`
- Removed: 4 dashboard component+test files (pending audit)
- Modified: `apps/web/hooks/useSession.ts` — use `createReactStore`
- Modified: `apps/web/hooks/useTrendData.ts` — use `createReactStore`
- Modified: matching tests

## Acceptance criteria

### Automated
- [ ] `pnpm run typecheck && pnpm run test && pnpm run lint` all pass
- [ ] `npx knip` reports no fewer dead exports than before (or strictly
      more cleared)
- [ ] No imports from `app/*` directories outside their own route files
      remain in `lib/*` or `components/*` (grep guard)
- [ ] All three stores use `createReactStore` primitive

### Manual
- Smoke: own profile page still loads, session still resolves, trend
  data still appears

## Closing the issues

```bash
gh issue close 811 --comment "Fixed in <sha>. Cross-route types moved to lib/agents/types.ts and lib/studio/badge-types.ts; preview components moved to components/studio/; lib/* no longer imports from app/*."
gh issue close 814 --comment "Fixed in <sha>. HeroScoreZone, RadarChartInteractive, and dead branches in SharePageOwnerContent + ImpactDashboard removed (or kept with explicit accepted-risks doc)."
gh issue close 774 --comment "Fixed in <sha>. lib/stores/createReactStore primitive shared by KeyboardShortcutsListener, useSession, and useTrendData."
```
