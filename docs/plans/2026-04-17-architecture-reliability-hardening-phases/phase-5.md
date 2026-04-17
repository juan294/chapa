# Phase 5: Deterministic Craft Selection And Flag Cache Coherence

## Status

Completed on 2026-04-17 after making tool-insights selection explicitly newest-uploaded wins on both reads and recomputes, preserving `uploaded_at` through recompute writes, and invalidating the in-process feature-flag cache immediately after successful admin updates.

## Goal

Eliminate two remaining nondeterministic infrastructure behaviors:

- ambiguous craft-score selection when multiple tool-insights rows exist for one handle
- stale in-process feature-flag reads after admin updates

## Batch Eligibility

[batch-eligible]

This phase can run in parallel with Phase 4 after Phase 3 is complete.

## Files Expected

- Modified: `apps/web/lib/db/tool-insights.ts`
- Modified: `apps/web/lib/cache/craft-cache.ts` if read semantics change materially
- Modified: `apps/web/app/api/insights/[handle]/route.ts`
- Modified: `apps/web/app/api/profile/[handle]/route.ts`
- Modified: `apps/web/lib/feature-flags.ts`
- Modified: `apps/web/app/api/admin/feature-flags/route.ts`
- Modified tests for tool insights and feature flags

## Implementation Sketch

### 1. Make tool-insights reads deterministic

Current behavior:

```text
select ... from tool_insights where handle = ? limit 1
```

Target behavior:

```text
select ... from tool_insights
where handle = ?
order by uploaded_at desc
limit 1
```

Apply the same rule to:
- read current craft score
- recompute craft from stored raw data

### 2. Document the current authoritative rule

Until the product supports tool-specific selection:

```text
latest uploaded report wins
```

This rule should be encoded in code comments and tests.

### 3. Invalidate in-process feature-flag cache after admin updates

Current behavior invalidates Redis-backed caches only.

Target behavior:

```text
PATCH /api/admin/feature-flags
  -> dbUpdateFeatureFlag(...)
  -> invalidate in-process flag cache entry or clear all
```

This should happen in the same request path that reports success.

### 4. Add regression tests

- Two tool-insights rows for one handle with different `uploaded_at` values
- Admin feature-flag PATCH followed by immediate server-side read on the same instance

## Automated Success Criteria

- Craft reads are stable and order-defined under multiple tool rows.
- Public profile and badge-adjacent APIs use the same deterministic craft-source rule.
- Successful feature-flag updates are visible immediately to same-instance server reads.

## Manual Success Criteria

- Upload multiple tool-insights reports for the same handle and confirm the selected craft score follows the newest record.
- Toggle a flag in admin and confirm the gated behavior changes immediately without waiting for TTL expiry.

## Verification

- `pnpm run typecheck`
- `pnpm run test`
- Targeted tests for:
  - `apps/web/lib/db/tool-insights.test.ts`
  - `apps/web/app/api/insights/[handle]/route.test.ts`
  - `apps/web/app/api/profile/[handle]/route.test.ts`
  - `apps/web/lib/feature-flags.test.ts`
  - `apps/web/app/api/admin/feature-flags/route.test.ts`

## Risks

- If downstream code implicitly relied on whichever tool row happened to come back first, this phase will surface that assumption. That is desirable, but tests may need updating.
- Clearing the full in-process flag cache is simpler and safer than targeted invalidation; prefer simplicity unless profiling proves otherwise.

## Stop Condition

Stop when craft selection and feature-flag behavior are deterministic and regression-tested.
