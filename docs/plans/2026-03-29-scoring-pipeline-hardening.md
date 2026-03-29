# Scoring Pipeline Hardening

> Created: 2026-03-29 | Research: `docs/research/2026-03-28-scoring-pipeline-hardening.md`
> Triggered by: v2.5.0 bugs — mergeStats field-dropping, isOwner regression

## Problem

Chapa's scoring pipeline has 5 chokepoints where fields pass through explicit enumeration, but no automated mechanism verifies that all fields survive the journey. TypeScript's structural typing allows optional fields to be absent without error. Safe defaults silently absorb field loss. Coverage can't catch it — the v2.5.0 mergeStats bug had 100% line coverage.

## Goal

Make it structurally impossible to add a field to `StatsData` without the compiler, tests, or CI catching any pipeline stage that fails to handle it.

## Phases

| # | Phase | Description | Batch |
|---|-------|-------------|-------|
| 1 | Field completeness guard | Compile-time + test-time assertion that mergeStats and buildStatsFromRaw output every StatsData field | [batch-eligible] |
| 2 | Golden-file scoring tests | Reference profiles with known-correct scores; any scoring change must update the golden file | [batch-eligible] |
| 3 | End-to-end pipeline test | Traces raw data → merge → scoring → snapshot, asserting field survival and score ranges | depends on Phase 4 |
| 4 | makeFullStats() factory | Test fixture that populates ALL StatsData fields (required + optional) | [batch-eligible] |
| 5 | Scoring change CI gate | CI job that runs golden-file tests when scoring files change | depends on Phase 2 |

## Phase Details

See `docs/plans/2026-03-29-scoring-pipeline-hardening-phases/phase-N.md` for each phase.

## Verification

- [ ] Phase 1: Field completeness guard
- [ ] Phase 2: Golden-file scoring tests
- [ ] Phase 3: End-to-end pipeline test
- [ ] Phase 4: makeFullStats() factory
- [ ] Phase 5: Scoring change CI gate
