# Phase 2 — Pure observed-core calculator [batch-eligible]

Depends on phase1. May run independently alongside phase3 in an isolated worktree. No shared-file writes or tests in parallel with root integration gates.

## Files and implementation

Read `apps/web/lib/impact/v7.ts:68`, `apps/web/lib/impact/v7-evidence.ts:237`, `packages/shared/src/scoring-window.ts:28` and new phase1 contracts. Own new `apps/web/lib/impact/observed-v7.ts`, `observed-v7.test.ts`, `observed-v7-evidence.test.ts` and local pure fixtures. Do not edit pinned `v7.ts` or `craft-v7.ts`, shared exports, collectors, routes, migrations or dictionaries.

```text
derived = deriveCoreEvidenceV7(evidence)
for each count:
  selectedCount = originalBounds.lower
  record originalBounds + scalar normalization trace
D/Q/C/B = fixed policy formulas(selectedCounts)
coreExact = (D+Q+C+B)/4
coreDisplay = policyPointDisplay(coreExact)
tier = original unrounded threshold classifier(coreExact)
archetype = calculateCoreV7(originalBoundedInputs).core.archetype (or exact equivalent)
return new-policy point results + original coverage + scalar trace
```

A source-error result must not be manufactured into successfully observed zero inputs. This pure calculator only receives a validated evidence state; runtime handles read failures in phase5. Missing/unassessed criteria are disclosed, not imputed. Core arithmetic never inspects optional reports, tool choice, user age, confidence or v6 profile type.

Implement the canonical display rule once: normal nearest integer; when it crosses tier boundary, truncate to two decimals. Test floating-point neighbors, not only round decimal strings. Keep an exact point separately, so replay verifies every scalar step and no consumer recomputes labels.

## Automated acceptance

C01–C05, C17–C18 from acceptance.md. Include zero, saturation, archived observed46.40250879691149, monotonic observed additions, duplicate-work invariance, changing only upper completion bounds leaving the point unchanged, all four weights fixed even when Q unassessed, report absent/present/deleted invariant, and existing archetype eligibility/tie order, including incomplete-source saturation whose normalized endpoints coincide. All current result values are points; metadata does not falsify unknown coverage.

```sh
pnpm exec vitest run apps/web/lib/impact/observed-v7.test.ts apps/web/lib/impact/observed-v7-evidence.test.ts apps/web/lib/impact/v7.test.ts apps/web/lib/impact/v7-evidence.test.ts apps/web/lib/impact/v7-fairness.test.ts --no-file-parallelism
```

Root runs combined typecheck/lint/unit gates after integrating phases2/3; agents don't each run broad suites in parallel. Independent reviewer checks formula and context boundaries against policy, including precise meaning of zero observed credit.

## Manual / stop

No browser or external data collection. Supply exact fixture outputs, changed paths and test results; stop. Do not activate the new calculator in runtime before receipts/replay are complete.
