# Phase 5: Scoring Change CI Gate

## Goal
CI job that automatically runs golden-file tests and field completeness tests when scoring files change, with a clear message if scores shift.

## Approach

### 1. Add scoring gate to existing CI workflow
Add a step in `.github/workflows/ci.yml` (Test job) that:
- Detects if any file in the scoring pipeline was modified (using git diff against base branch)
- If scoring files changed, runs the golden-file and field-completeness tests explicitly with verbose output
- Pipeline files: `apps/web/lib/impact/`, `apps/web/lib/github/merge.ts`, `packages/shared/src/stats-aggregation.ts`, `packages/shared/src/types.ts`, `packages/shared/src/constants.ts`

This is lightweight — just a conditional verbose test run, not a separate workflow.

## Dependencies
- Phase 2 (golden-file tests must exist)

## Files Changed
- Modified: `.github/workflows/ci.yml`
