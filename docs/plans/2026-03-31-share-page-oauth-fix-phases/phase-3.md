# Phase 3: Cleanup [batch-eligible]

## Goal

Remove temporary debug artifacts from the prior debugging session.

## Files

| File | Action |
|------|--------|
| `apps/web/app/api/admin/debug-quality/route.ts` | **Delete** |

## Changes

### 1. Delete debug endpoint

Remove `apps/web/app/api/admin/debug-quality/route.ts` — temporary endpoint created during debugging. No other file imports or references it.

## What We Keep

| Artifact | Decision | Rationale |
|----------|----------|-----------|
| Refresh rate limit at 15/hr | **Keep** | Auto-refresh (Phase 2) adds a new source of refresh calls; 15/hr provides headroom |
| SWR reduced from 7d to 1d | **Keep** | Intentional improvement — faster CDN cache rotation |
| Cross-default PR filter | **Keep** | Correct scoring logic; appeared broken only due to GITHUB_TOKEN scope |
| `MIN_QUALITY_SAMPLE` guard | **Keep** | Safety net for limited-scope tokens |
| `baseRefName` in GraphQL query | **Keep** | Required data for cross-default filter |

## Verification

```bash
# Confirm no references to the deleted file
grep -r "debug-quality" apps/web/ --include="*.ts" --include="*.tsx"
pnpm run typecheck
pnpm run build  # ensure no broken route references
```

## Notes

- This phase has zero file overlap with Phases 1-2 and can run in parallel with Phase 2
- The debug endpoint was never referenced by other code — it was accessed directly via browser URL
