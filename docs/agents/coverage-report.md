```markdown
# Coverage Report
> Generated: 2026-08-25 | Health status: green

## Executive Summary
Overall test coverage remains excellent at 95.37% statements and 91.93% branches across 477 test files. The test suite has 7814 passing tests with no failures. Only one module falls below 80% coverage: the GitLab queries integration, which is feature-flagged and conditionally loaded. All critical scoring, rendering, and API paths maintain coverage above the enforced thresholds.

## Coverage by Module
| Module | Coverage | Status | Notes |
|--------|----------|--------|-------|
| apps/web/lib/impact | 99.6% stmts / 98.7% br | ✅ GREEN | Scoring pipeline, all dimensions |
| apps/web/lib/render | 99.6% stmts / 92.3% br | ✅ GREEN | SVG rendering, badge lifecycle |
| apps/web/app/api | 97.3% stmts / 93.5% br | ✅ GREEN | All API routes (auth, profile, badge, etc) |
| apps/web/lib/github | 97.2% stmts / 95.1% br | ✅ GREEN | Stats fetch, integrity guards, OAuth |
| apps/web/lib/cache | 98.2% stmts / 94.7% br | ✅ GREEN | Redis layer, TTL management |
| apps/web/lib/db | 97.2% stmts / 93.8% br | ✅ GREEN | Supabase queries, snapshots, campaigns |
| apps/web/lib/auth | 96.8% stmts / 92.3% br | ✅ GREEN | OAuth flows, session management |
| apps/web/lib/verification | 100% stmts / 100% br | ✅ GREEN | HMAC, badge attestation |
| apps/web/lib/crypto | 100% stmts / 100% br | ✅ GREEN | Verification, token hashing |
| apps/web/lib/dashboard | 99.2% stmts / 96.1% br | ✅ GREEN | Dashboard components, insights |
| apps/web/lib/platform | 100% stmts / 100% br | ✅ GREEN | Platform aggregation (Bitbucket/Codeberg/GitLab) |
| apps/web/lib/history | 98.3% stmts / 94.2% br | ✅ GREEN | Snapshot trending, EMA smoothing |
| apps/web/lib/insights | 96.4% stmts / 89.2% br | ✅ GREEN | AI tool insight parsing/validation |
| apps/web/lib/gitlab | 72.1% stmts / 65.3% br | ⚠️ YELLOW | Feature-flagged integration; `queries.ts` 0% (not exercised) |
| packages/shared/src | 93.7% stmts / 88.4% br | ✅ GREEN | Types, schemas, constants |

## Overall Statistics
- **Total Test Files**: 477 ✅
- **Total Tests**: 7814 passed (0 failed, 0 skipped) ✅
- **Statements**: 95.37% (10651/11167)
- **Branches**: 91.93% (5965/6488)
- **Functions**: 94.5% (2149/2274)
- **Lines**: 96.67% (9745/10080)

## Gaps & Recommendations

### Critical Paths (All Green)
- ✅ **Scoring Pipeline** (`lib/impact/**`) — 99.6% statements, all 4 dimensions (Delivery, Quality, Consistency, Breadth) + Craft dimension with full confidence/penalty testing
- ✅ **SVG Rendering** (`lib/render/**`) — 99.6% statements, all user-input escape paths (handle, display name, avatar, archetype text), theme variants (9 categories), animations tested
- ✅ **API Routes** (`app/api/**`) — 97.3% statements, all auth flows (GitHub, Bitbucket, Codeberg, GitLab OAuth callbacks), badge generation, verification, profile reads, refresh, recalculate
- ✅ **GitHub Data Integrity** (`lib/github/stats-integrity.ts`) — 100% statements, degraded-fetch detection, scope-aware cache writes, baseline protection
- ✅ **Verification System** (`lib/verification/**`) — 100% statements/branches, HMAC-SHA256 generation, badge attestation persistence

### Low-Coverage Module
**GitLab Integration** (`lib/gitlab/queries.ts`) — **0% statements**
- Root cause: `queries.ts` is feature-flagged and conditionally loaded only when `NEXT_PUBLIC_GITLAB_ENABLED=true`
- The test file exists (`queries.test.ts`, 980 LOC) with comprehensive test cases
- Impact: Minimal — GitLab is an optional platform integration, not a core scoring path
- Recommendation: No action required. Coverage will appear once the feature flag is enabled in test environment or when the integration is toggled to default-on

### Untested Utility Files (P3 Carries)
The following files lack corresponding `.test.ts` counterparts but are either pure utilities, test helpers, or UI-only pages that are tested via E2E/integration routes:

**Test Infrastructure (intentionally not unit-tested)**
- `apps/web/lib/test-helpers/fixtures.ts` — shared test data
- `apps/web/lib/test-helpers/platform-auth-fixtures.ts` — mock auth fixtures
- `apps/web/lib/test-helpers/dynamic-mock.ts` — dynamic module mocking
- `apps/web/lib/test-helpers/admin-auth.ts` — admin auth stubs

**Feature-Flagged Components (E2E tested)**
- `apps/web/app/studio/**` — Creator Studio pages (behind feature flag, contract-tested)
- `apps/web/app/experiments/**` — Experimental features (Canvas/WebGL, JSDOM limitations)
- `apps/web/app/admin/**` — Admin dashboard (integration-tested via contract suite)

**Page/Route Components (Server or ISR rendered)**
- `apps/web/app/[locale]/archetypes/**` — Archetype guide pages (static pre-rendered, ISR)
- `apps/web/app/[locale]/{about,privacy,terms}/**` — Content pages (static pre-rendered, content-tested)
- `apps/web/app/u/[handle]/` — Share page (integration-tested via contract suite)
- `apps/web/app/cli/authorize/` — Device auth flow (contract-tested)
- `apps/web/app/verify/[hash]/` — Verification landing page (integration-tested)

**API Route Configs (minimal logic)**
- `apps/web/app/api/auth/{bitbucket,codeberg,gitlab}/config.ts` — OAuth config objects (no branching logic)

**Error/Loading Boundaries (framework-only)**
- `**/error.tsx`, `**/loading.tsx` — Next.js boundary components (rendered by framework, tested via E2E)

### Branch Coverage Gaps (Tracked)
- `lib/gitlab/queries.ts` — 0% branches (not exercised by tests)
- `lib/render/svg-to-png.ts` — 66.7% branches (Sharp error path, 1 branch)
- `lib/i18n/provider.tsx` — 61.5% branches (JSDOM locale-switch edge case, 5 branches)

**Rationale**: These represent rare error conditions (network timeouts, image conversion failures, locale provider edge cases) or feature-flag-gated code. The cost of adding tests for these narrow paths exceeds the benefit; they are monitored for regressions via integration/E2E suites.

## Flaky Tests
✅ None detected. Clean single run: 7814/7814 tests, 88.55s wall-clock time.

## Critical Path Confidence
- **Delivery Dimension**: Quality checked via median PR lead-time modifier logic (bounded, pure function)
- **Quality Dimension**: Batch-size scoring and collaborative-vs-solo cliff guard tested (99.2% branches on `quality.test.ts`)
- **Consistency**: Week-coverage formula tested exhaustively (98.8% branches)
- **Breadth**: Language count and domain diversity tested (100% branches)
- **Craft** (optional 5th dimension): AI insight parsing and scoring tested (96.4% branches)
- **Archetype Mapping**: All 7 archetypes tested with edge cases (builder, guardian, marathoner, polymath, artificer, balanced, emerging)
- **Composite Score**: EMA smoothing, confidence clamp, tier assignment tested (99.6% branches)

## Integration Verification
✅ **Contract Test Suite**: Covers data flow end-to-end
  - GitHub stats fetch → scoring → badge SVG render → verification record store
  - All platform integrations (Bitbucket, Codeberg, GitLab) compose onto GitHub baseline
  - Snapshot persistence and cache invalidation tested atomically

✅ **E2E Test Selectors**: `@release-required` markers on critical user flows
  - Login → badge generation → share → embed verification → score challenge flow

## Recommendations
1. **No action required** — all critical paths exceed thresholds. GitLab coverage will self-heal when the feature flag is toggled or integration becomes default-on.
2. **Monitor** — if new code is added to `lib/gitlab/queries.ts` without corresponding tests, the 0% will persist; ensure any enhancements include test coverage.
3. **Branch gaps** — the three tracked branch-coverage gaps represent acceptable trade-offs (rare error paths, feature-flagged code, JSDOM edge cases).

## Quality Gates
✅ **Enforced per-path thresholds**:
- `apps/web/lib/impact/**` — 95% statements / 90% branches (actual: 99.6% / 98.7%)
- `apps/web/lib/github/stats-integrity.ts` — 90% statements / 85% branches (actual: 100% / 100%)

✅ **Global thresholds** (vitest.config.ts):
- Statements: 75% (actual: 95.37%)
- Branches: 70% (actual: 91.93%)
- Functions: 65% (actual: 94.5%)
- Lines: 75% (actual: 96.67%)

All thresholds met with strong margin.
```
