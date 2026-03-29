# Scoring Pipeline Hardening — Research

> Generated on 2026-03-28 | Branch: `develop`
> Triggered by: v2.5.0 post-release bugs (mergeStats field-dropping, isOwner hardcoded false)

## Context

Two bugs shipped in v2.5.0 that affected production scoring:
1. `mergeStats()` in `apps/web/lib/github/merge.ts:42-73` dropped `prDescriptionRate`, `featureBranchRate`, `issueLinkageRate` — solo Quality collapsed to ~5 for users with linked platforms
2. `isOwner={false}` hardcoded in `apps/web/app/u/[handle]/page.tsx:215,277` — Refresh button hidden

This document maps the current state of the scoring pipeline, its testing infrastructure, and its integrity mechanisms.

---

## 1. Scoring Pipeline Architecture

### File Map (82 source files, 68 test files, 7 CI workflows)

**Data Flow:**
```
GitHub GraphQL API → RawContributionData
  ↓
buildStatsFromRaw() → StatsData (25 fields, 9 optional)
  ↓
mergeStats() → StatsData (multi-platform merge, explicit field listing)
  ↓
getStats() → StatsData (Redis cache, 6h TTL + 7d stale fallback)
  ↓
computeImpactV4() → ImpactV4Result (4-5 dimensions, archetype, composite, confidence)
  ↓
smoothScore() → EMA-adjusted composite (badge route only)
  ↓
buildSnapshot() → MetricsSnapshot (28-29 keys, stored in Supabase)
  ↓
renderBadgeSvg() / profile API / share page → User-visible score
```

**Source:** `apps/web/lib/github/client.ts:40-182`, `apps/web/lib/impact/v4.ts:1-369`, `apps/web/app/u/[handle]/badge.svg/route.ts:46-194`

### Pipeline Files by Stage

| Stage | Key Files | Test Files |
|-------|-----------|------------|
| GraphQL query | `packages/shared/src/github-query.ts` | — |
| Query execution | `apps/web/lib/github/queries.ts` | `queries.test.ts` |
| Aggregation | `packages/shared/src/stats-aggregation.ts` | `stats-aggregation.test.ts` (788 lines) |
| Multi-platform merge | `apps/web/lib/github/merge.ts` | `merge.test.ts` (280 lines) |
| Client + caching | `apps/web/lib/github/client.ts` | `client.test.ts` |
| Scoring engine | `apps/web/lib/impact/v4.ts` | `v4.test.ts` (1,330 lines) |
| Heatmap analysis | `apps/web/lib/impact/heatmap-evenness.ts` | `heatmap-evenness.test.ts` |
| Confidence | `apps/web/lib/impact/utils.ts` | `utils.test.ts` |
| EMA smoothing | `apps/web/lib/impact/smoothing.ts` | `smoothing.test.ts` |
| Recency | `apps/web/lib/impact/recency.ts` | `recency.test.ts` |
| Snapshot building | `apps/web/lib/history/snapshot.ts` | `snapshot.test.ts` |
| Snapshot storage | `apps/web/lib/db/snapshots.ts` | `snapshots.test.ts` |
| Badge rendering | `apps/web/app/u/[handle]/badge.svg/route.ts` | `route.test.ts` |
| Bulk recalculate | `apps/web/app/api/admin/bulk-recalculate/route.ts` | `route.test.ts` |
| Shared types | `packages/shared/src/types.ts` | `types.test.ts` |
| Constants | `packages/shared/src/constants.ts` | `constants.test.ts` |

---

## 2. StatsData Field Inventory

`packages/shared/src/types.ts` defines StatsData with 25 fields (16 required, 9 optional):

### Required Fields (always present)
| Field | Type | Set By |
|-------|------|--------|
| `handle` | string | aggregation |
| `commitsTotal` | number | aggregation |
| `activeDays` | number | aggregation |
| `prsMergedCount` | number | aggregation |
| `prsMergedWeight` | number | aggregation (capped at 120) |
| `reviewsSubmittedCount` | number | aggregation |
| `issuesClosedCount` | number | aggregation |
| `linesAdded` | number | aggregation |
| `linesDeleted` | number | aggregation |
| `reposContributed` | number | aggregation |
| `topRepoShare` | number | aggregation |
| `maxCommitsIn10Min` | number | aggregation |
| `totalStars` | number | aggregation |
| `totalForks` | number | aggregation |
| `totalWatchers` | number | aggregation |
| `heatmapData` | HeatmapDay[] | aggregation |
| `fetchedAt` | string | aggregation |

### Optional Fields (conditionally set)
| Field | Type | Set By | Default in Scoring |
|-------|------|--------|--------------------|
| `displayName` | string? | aggregation | — |
| `avatarUrl` | string? | aggregation | — |
| `microCommitRatio` | number? | aggregation | 0 |
| `docsOnlyPrRatio` | number? | never computed | 0 |
| `prDescriptionRate` | number? | aggregation (requires ≥1 PR) | 0 |
| `featureBranchRate` | number? | aggregation (requires ≥1 PR) | 0 |
| `issueLinkageRate` | number? | aggregation (requires ≥1 PR) | 0 |
| `batchSizeScore` | number? | aggregation (requires ≥1 PR) | 0.3 |
| `medianPrLeadTimeHours` | number? | aggregation (requires ≥1 PR with timestamps) | 1.0x modifier |
| `hasSupplementalData` | boolean? | client.ts (EMU merge) | false |
| `linkedPlatforms` | string[]? | client.ts | — |
| `linkedPlatformLogins` | Record? | client.ts | — |

**Source:** `packages/shared/src/types.ts:1-50`

---

## 3. Field Survival Chokepoints

### Chokepoint 1: Aggregation (stats-aggregation.ts)
- Lines 140-145: Optional fields are conditionally spread via `...(field !== undefined && { field })`
- If a field's prerequisite isn't met (e.g., 0 merged PRs), the field is `undefined` and omitted from the output object entirely
- **Mechanism:** Conditional spread operator

### Chokepoint 2: Multi-Platform Merge (merge.ts)
- Lines 42-73: Return object uses **explicit field listing** — every field must be manually enumerated
- `mergeOptionalMax()` and `mergeOptionalWeightedAvg()` helper functions handle optional fields
- **This is where the v2.5.0 bug occurred**: 3 solo quality fields were not listed in the return object
- **Mechanism:** Explicit enumeration (no spread of input)

### Chokepoint 3: Client Caching (client.ts)
- Lines 167-171: `linkedPlatforms` and `linkedPlatformLogins` are spread into the stats object after merge
- Lines 175-176: Merged stats written to Redis (primary 6h TTL + stale 7d TTL)
- **Mechanism:** Cache serialization drops undefined fields (JSON.stringify omits undefined)

### Chokepoint 4: Scoring Defaults (v4.ts)
- Solo quality (lines 130-140): `prDescriptionRate ?? 0`, `featureBranchRate ?? 0`, `issueLinkageRate ?? 0`, `batchSizeScore ?? 0.3`
- Lead time (line 32): `medianPrLeadTimeHours` undefined → modifier 1.0x
- **Mechanism:** Nullish coalescing to safe defaults — silently absorbs field loss

### Chokepoint 5: Snapshot Building (snapshot.ts)
- Lines 36-40: Optional stats conditionally spread (same pattern as aggregation)
- Heatmap excluded from snapshot (space optimization)
- **Mechanism:** Conditional spread operator

**Source:** Analyzer agent field survival matrix

---

## 4. Current Testing Infrastructure

### Test Coverage
- **Overall:** 92.43% statements, 70%+ branches (enforced in CI via `vitest.config.ts`)
- **Scoring pipeline (`lib/impact/`):** 99.5% statement coverage
- **Total test count:** 6,609 tests across 379 files
- **Zero flaky tests** (verified 3 consecutive runs, per `docs/agents/coverage-report.md`)

### Test Categories

**Unit tests (isolated formulas):** ~210 scoring-specific tests
- Each dimension formula tested independently (`v4.test.ts:1330 lines`)
- Confidence penalties, tier mapping, adjusted score (`utils.test.ts`)
- Heatmap evenness with 18 cases (`heatmap-evenness.test.ts`)
- EMA smoothing with feedback loop prevention (`smoothing.test.ts`)
- Recency weighting boundaries (`recency.test.ts`)

**Merge tests:** 28 test cases (`merge.test.ts:280 lines`)
- Tests each field category: sums, caps, max, weighted avg, identity preservation
- Tests determinism (same input → same output)
- Tests `hasSupplementalData` flag behavior
- Solo quality fields tested (added post-v2.5.0 hotfix)

**Snapshot tests:** 15+ cases (`snapshot.test.ts`)
- Tests explicit field extraction ("extracts all stats fields from StatsData")
- Tests expected key count (28 or 29 keys)
- Tests pure function contract ("does not mutate input objects")

**Integration tests (mocked dependencies):**
- `bulk-recalculate/route.test.ts`: Mocks getStats, computeImpactV4, buildSnapshot, dbReplaceSnapshot
- `badge.svg/route.test.ts`: Mocks scoring pipeline layers
- All integration tests mock dependencies — no test runs the real pipeline end-to-end

**E2E tests (Playwright):**
- Badge SVG: validates SVG content type, cache headers
- Share page: validates page title, h1, badge image, JSON-LD
- Health API: validates response shape
- No scoring value assertions in E2E tests

### Test Helpers
**`apps/web/lib/test-helpers/fixtures.ts`:**
- `makeStats(overrides)`: Factory with 16 required fields set, optional fields NOT set by default
- `makeImpact(overrides)`: Factory for ImpactV4Result
- `makeSnapshot(overrides)`: Factory for MetricsSnapshot

### Pre-Commit Hooks (`.husky/pre-commit`)
- Sequential: `typecheck && lint && test`
- All 6,609 tests run before every commit

### CI Pipeline (`.github/workflows/ci.yml`)
4 jobs (sequential):
1. Lint & Typecheck + circular dependency check
2. Test with coverage (thresholds enforced)
3. Build
4. E2E (Playwright on Next.js build)

Additional workflows: Security Scan, Secret Scanning, Bundle Size, Lighthouse, Dead Code (Knip), Claude Code Review

---

## 5. What Exists vs. What Doesn't

### Exists
- Unit tests for every scoring formula and sub-signal
- Field-by-field merge tests (explicit assertions per field)
- Snapshot key count assertion (28/29 expected keys)
- Pure function contracts (no mutation tests)
- 99.5% coverage on scoring code
- TDD protocol enforced (CLAUDE.md, `.claude/rules/testing.md`)
- Pre-commit hooks running full test suite
- 7 CI workflows including coverage thresholds

### Does Not Exist
- **No field completeness test**: No test iterates over `keyof StatsData` to verify `mergeStats()` output contains every field. New fields added to the type can be silently missed in merge.
- **No end-to-end pipeline test**: No test traces raw GraphQL response → StatsData → merged stats → ImpactV4Result → MetricsSnapshot → API response with real data.
- **No golden-file / snapshot tests**: No `toMatchSnapshot()` or `toMatchInlineSnapshot()` usage. No reference profiles with known-correct scores.
- **No real-data fixtures**: All tests use synthetic zero-based `makeStats()`. No test uses a real developer's GitHub data to verify scoring output.
- **No schema validation in merge**: TypeScript's structural typing doesn't enforce that `mergeStats()` return object includes every StatsData field — it only checks that returned fields match the type, not that all fields are present (optional fields can be missing).
- **No staging scoring validation**: `bulk-recalculate` hits production directly. No preview/staging scoring comparison mechanism.
- **No scoring change gate**: CI doesn't have a scoring-specific check that runs when scoring files change (e.g., compare scores for a set of reference profiles before/after).
- **No ADRs for testing strategy**: `docs/decisions/` has no architecture decision records about scoring validation.

---

## 6. How the v2.5.0 Bugs Escaped

### Bug 1: mergeStats Field Dropping

**Root cause:** `merge.ts` uses explicit field enumeration in its return object (lines 42-73). When `batchSizeScore` and `medianPrLeadTimeHours` were added in v6.1, the 3 existing solo quality fields (`prDescriptionRate`, `featureBranchRate`, `issueLinkageRate`) were not added alongside them.

**Why tests didn't catch it:**
- `merge.test.ts` tested fields individually by category, not exhaustively. No test verifies "every key in StatsData is present in output."
- `makeStats()` defaults optional fields to `undefined`, so the merge test fixtures never populated solo quality fields before the fix.
- `v4.test.ts` tests `computeSoloQuality()` with direct input (bypasses merge), so it never saw the field loss.
- TypeScript didn't flag it: `StatsData` has optional fields (`prDescriptionRate?: number`), so returning an object without them is type-safe.

**What would have caught it:**
- A test that asserts `Object.keys(mergeStats(full, full)).sort()` contains every key from a fully-populated StatsData
- An end-to-end test that runs `getStats() → computeImpactV4()` with a multi-platform fixture and verifies Quality > 0
- A golden-file test comparing scores for a known profile before/after the merge

### Bug 2: isOwner Hardcoded False

**Root cause:** Share page is a server component that cannot access client session. `isOwner` was previously computed server-side but got replaced with `false` during a refactor (commit `6f81904`, 2026-02-13) when `RefreshBadgeButton` was consolidated into `BadgeToolbar`.

**Why tests didn't catch it:**
- `page.test.ts` tested that `isOwner` was passed to the toolbar, but didn't test whether the toolbar actually showed the Refresh button (source-level test checked prop presence, not rendered output)
- `BadgeToolbar.render.test.tsx` received `isOwner` as a prop and tested both `true` and `false` paths — but the share page always passed `false`
- No integration test rendered the share page with a logged-in session and verified the Refresh button appeared

**What would have caught it:**
- An E2E test that logs in, visits the share page, and asserts the Refresh button is visible
- A source-level test that verifies the share page computes `isOwner` from session data, not hardcodes it

---

## 7. Current Integrity Mechanisms

### Type System
- `StatsData` interface enforces field types but not presence (optional fields)
- `ImpactV4Result` interface enforces all dimension scores
- `MetricsSnapshot` type enforces snapshot shape
- **Gap:** TypeScript structural typing allows partial objects to satisfy interfaces with optional fields

### Pure Function Design
- All scoring functions (`computeImpactV4`, `computeDelivery`, `computeQuality`, etc.) are pure — deterministic output for given input
- `buildSnapshot()` has a test verifying it "does not mutate input objects"
- EMA smoothing has a test preventing feedback loops on same-day calls
- **Gap:** Purity is tested per-function but not across the pipeline

### Safe Defaults
- Scoring functions use `?? 0` or `?? 0.3` for missing optional fields (v4.ts:130-140)
- `computeLeadTimeModifier()` returns 1.0x for undefined input
- **Gap:** Safe defaults silently absorb field loss — a missing field produces a low but non-zero score instead of an error

### Coverage Thresholds
- CI enforces: 75% statements, 70% branches, 65% functions, 75% lines
- Scoring code is at 99.5% — well above thresholds
- **Gap:** Coverage measures code execution, not correctness. The mergeStats bug had 100% line coverage (every line executed) but the field was still missing from the return object.

---

## 8. Pipeline File Counts

| Category | Source Files | Test Files | Lines (approx) |
|----------|-------------|------------|----------------|
| Scoring engine | 6 | 6 | ~835 |
| Data fetching | 7 | 9 | ~750 |
| Data merging | 2 | 2 | ~430 |
| Caching | 3 | 4 | ~350 |
| Database | 4 | 4 | ~500 |
| Display/APIs | 5 | 5 | ~750 |
| Recalculation | 3 | 3 | ~500 |
| History/Trends | 6 | 5 | ~530 |
| Rendering | 9 | 9 | ~720 |
| Shared types | 5 | 5 | ~250 |
| CI/CD | 7 | — | ~500 |
| **Total** | **57** | **52** | **~6,115** |

---

## 9. Reference: Existing Test Patterns That Work Well

### Pattern: Dimension Isolation (v4.test.ts)
Each dimension is tested independently with `makeStats()` overrides that zero-out all other signals. This ensures each formula component is verified in isolation.

### Pattern: Boundary Testing (heatmap-evenness.test.ts)
18 test cases cover: empty data, uniform distribution, burst patterns, outlier clipping, single-week edge case, position-independence.

### Pattern: Feedback Loop Prevention (smoothing.test.ts)
`"does NOT re-apply EMA on same-day repeated calls"` — ensures multiple badge views on the same day don't cascade score changes.

### Pattern: Non-Accusatory Messaging (non-accusatory-messaging.test.ts)
Tests that all confidence penalty reasons use neutral language — ensures user-facing text never implies wrongdoing.

### Pattern: Determinism (merge.test.ts)
`"produces the same output for the same inputs"` — ensures merge function is pure.

### Pattern: Identity Preservation (merge.test.ts)
Verifies primary user's handle, displayName, avatarUrl, fetchedAt are preserved after merge — secondary identity is discarded.
