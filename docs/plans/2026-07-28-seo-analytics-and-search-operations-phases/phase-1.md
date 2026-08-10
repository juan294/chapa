# Phase 1 — Search-Intent Baseline and Executable SEO Contract

**Status:** Planned
**Batch eligibility:** Not batch-eligible
**Depends on:** None

## Objective

Create deterministic Chapa-specific search-intent tooling and lock the route, content, analytics, privacy, and measurement contracts consumed by later phases.

## Files

Create:

- `scripts/seo/autocomplete.ts`
- `scripts/seo/autocomplete.test.ts`
- `scripts/seo/fetch-autocomplete-insights.mjs`
- `docs/seo/measurement-and-content-contract.md`
- `docs/research/2026-07-28-autocomplete-search-intent-report.md`

Modify:

- `package.json`

## Implementation

1. Extract the reusable fetch, normalization, categorization, case-insensitive dedupe, and Markdown rendering logic into `scripts/seo/autocomplete.ts`.
2. Keep the executable wrapper in `scripts/seo/fetch-autocomplete-insights.mjs`.
3. Define the five seed families from the main plan in English and Spanish. Query direct seeds plus a bounded letter expansion with a delay and a descriptive user agent.
4. Treat network failures as per-query empty results while recording a final request/error count. Fail the command only when every query fails or the report would be empty.
5. Make tests use fixtures; tests never call Google.
6. Add `pnpm run seo:keywords`.
7. Generate the dated report once and classify each returned phrase by seed family, locale, and likely intent.
8. Write the measurement/content contract with:
   - the unprefixed canonical topology;
   - the exact five resource routes;
   - Clarity’s positive allowlist and excluded routes;
   - the event/key-event table;
   - the no-PII analytics rule;
   - the external property names;
   - the phase authorization gates.

## Pseudocode

```text
for each locale and seed family:
  suggestions = fetch(seed) + fetch(seed + bounded suffixes)
  normalize whitespace and Unicode
  discard exact seed echoes and empty strings
  dedupe case-insensitively across the report
  retain the source family and locale

if successfulRequestCount == 0 or uniqueSuggestionCount == 0:
  fail without replacing an existing report

render deterministic Markdown ordered by family, seed, suggestion
```

## Automated success criteria

- Fixture tests prove direct suggestions, suffix expansion, normalization, global dedupe, deterministic order, error accounting, and empty-report failure.
- A second run on the same fixtures produces a byte-identical report.
- `pnpm run seo:keywords` produces a non-empty dated report in a network-enabled environment.
- The contract test asserts that every route and event in the main plan appears in `measurement-and-content-contract.md`.
- `pnpm run typecheck`, `pnpm run lint`, and `pnpm run test` pass sequentially.

## Manual success criteria

- Review the generated phrases for obvious cross-product contamination or unsafe claims.
- Confirm the four guide intents remain aligned with Chapa’s actual product.
- Confirm no report value includes credentials, account identifiers, profile handles, or user data.

## Stop gate

Commit the tooling, generated report, and contract. Stop for the Phase 1 checkpoint before changing application routes or metadata.
