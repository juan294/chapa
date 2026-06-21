# Phase 3: Scoring Regression Coverage and Confidence Invariants [batch-eligible]

Parent plan: `docs/plans/2026-06-21-data-sources-linking-scoring-hardening.md`

## Goal

Add regression tests proving platform-linked input changes flow through score materialization correctly and do not reduce confidence.

## Scope

Files expected to change:

- `apps/web/lib/profile/materialize-profile.test.ts` or `apps/web/lib/profile/materialize-profile-parallel.test.ts`
- `apps/web/lib/impact/utils.test.ts`
- `apps/web/lib/impact/pipeline.test.ts` if an end-to-end merged-stats assertion needs tightening

## Implementation Notes

1. Add a materialization test with:
   - fresh stats
   - a same-day cached snapshot
   - `isStatsDirty(handle) === true`
2. Assert:
   - `inputsChanged === true`
   - display adjusted score does not reuse the stale same-day snapshot value
   - generated snapshot uses the display score
3. Add a confidence utility test:
   - base stats with no linked platform
   - same stats with `linkedPlatforms`
   - confidence is unchanged
   - penalties include `platform_linked` with `penalty: 0`
4. Preserve existing merge/scoring pipeline tests.

## Pseudocode

```ts
mockIsStatsDirty.mockResolvedValue(true);
mockGetCachedLatestSnapshot.mockResolvedValue({
  date: "2026-06-21",
  adjustedComposite: 42,
});

const result = await materializeProfile("testuser", { today: "2026-06-21" });

expect(result?.inputsChanged).toBe(true);
expect(result?.displayImpact.adjustedComposite).not.toBe(42);
expect(result?.snapshot.adjustedComposite).toBe(result?.displayImpact.adjustedComposite);
```

## Automated Verification

Run:

```bash
pnpm exec vitest run apps/web/lib/profile/materialize-profile.test.ts apps/web/lib/profile/materialize-profile-parallel.test.ts apps/web/lib/impact/smoothing.test.ts apps/web/lib/impact/utils.test.ts apps/web/lib/impact/pipeline.test.ts apps/web/lib/profile/public-profile.test.ts
```

Expected:

- Dirty marker same-day materialization bypasses stale snapshot reuse.
- Public-profile dirty side effects still replace snapshots and clear dirty markers.
- Platform-linked confidence remains informational only.

## Manual Verification

None required for this phase.

