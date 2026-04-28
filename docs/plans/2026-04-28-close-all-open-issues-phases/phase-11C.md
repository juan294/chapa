---
phase: 11C
release: v2.11.0
issues: ["#745"]
batch_eligible: true
depends_on: []
effort: S
---

# Phase 11C — Hooks consolidation (`#745`)

## Goal

`apps/web/hooks/` has 5 hooks in `camelCase`. `apps/web/lib/hooks/` has
1 hook in `kebab-case` (`use-trend-data.ts`). Consolidate to a single
location with a single naming convention.

## Decision

Pick `apps/web/hooks/` as canonical (it has the most hooks already).
Move `lib/hooks/use-trend-data.ts` -> `hooks/useTrendData.ts`. Rename to
camelCase to match the rest.

## Steps

```bash
git mv apps/web/lib/hooks/use-trend-data.ts apps/web/hooks/useTrendData.ts
git mv apps/web/lib/hooks/use-trend-data.test.ts apps/web/hooks/useTrendData.test.ts
rmdir apps/web/lib/hooks
```

Update all imports:

```bash
grep -rln "lib/hooks/use-trend-data" apps/web --include="*.ts" --include="*.tsx" \
  | xargs sed -i '' 's|@/lib/hooks/use-trend-data|@/hooks/useTrendData|g'
```

(macOS `sed -i ''` syntax. On Linux drop the `''`.)

Add lint guard:

```js
// eslint.config (apps/web)
{
  rules: {
    "no-restricted-imports": ["error", {
      patterns: [
        { group: ["@/lib/hooks/*"], message: "Hooks live in @/hooks/" }
      ]
    }]
  }
}
```

## Files

- Moved: `apps/web/lib/hooks/use-trend-data.ts` -> `apps/web/hooks/useTrendData.ts`
- Moved: `apps/web/lib/hooks/use-trend-data.test.ts` -> `apps/web/hooks/useTrendData.test.ts`
- Removed: `apps/web/lib/hooks/` (empty directory)
- Modified: every importer of `@/lib/hooks/use-trend-data`
- Modified: ESLint config to add the import-pattern guard

## Acceptance criteria

### Automated
- [ ] `find apps/web/lib/hooks -type f 2>/dev/null | wc -l` returns `0`
- [ ] `pnpm run typecheck && pnpm run test && pnpm run lint` all pass
- [ ] No stale imports of `@/lib/hooks/*` remain

### Manual
- N/A — pure refactor

## Closing the issue

```bash
gh issue close 745 --comment "Fixed in <sha>. All hooks consolidated to apps/web/hooks/ with camelCase naming; ESLint blocks new imports from @/lib/hooks/*."
```
