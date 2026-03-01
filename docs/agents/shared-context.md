# Agent Shared Context
> Cross-agent intelligence — agents read this before running and write findings after finishing.
> Pruned automatically to keep the last 3 entries per agent type.
>
> **Rules:**
> 1. Read this file before starting any work
> 2. Write an entry after finishing — use the format below
> 3. Cross-agent recommendations are mandatory
> 4. Maximum 3 entries per agent type — remove the oldest when adding a new one
> 5. Be specific with findings — numbers, file paths, and actionable items

<!-- ENTRY:START agent=coverage timestamp=2026-03-01T11:40:00Z -->
## Coverage Agent — 2026-03-01
- **Status**: GREEN
- Overall coverage (corrected): 78.4% stmts, 74.4% branch, 70.3% funcs
- Test suite: 272 files, 4,232 tests, 100% pass rate, 0 flaky
- Critical paths (impact/render/api/db/github/auth/cache/history): 88–100% stmts, 100% test file coverage
- Coverage config bug: `packages/shared/node_modules.nosync/` inflates uncovered count (reports ~3% instead of ~78%)
- Largest untested file: `app/studio/StudioClient.tsx` (119 stmts, 0%)
- 8 components below 80%: `AuthorTypewriter.tsx` (20%), `BadgeToolbar.tsx` (21%), `PostHogProvider.tsx` (24%)
- `lib/effects` at 65.9% — `ParticleBackground.tsx` (113 stmts, 1%) is canvas-heavy

**Cross-agent recommendations:**
- [Security]: No security-relevant test gaps — all auth routes, OAuth callbacks, and session handling have 88%+ coverage. SVG escape tests exist in `lib/render/escape.test.ts`.
- [QA]: Fix vitest coverage config to exclude `**/node_modules.nosync/**`. Add smoke tests for Studio pages (`StudioClient.tsx` is the biggest gap at 119 stmts/0%).
- [Performance]: `ParticleBackground.tsx` (113 stmts) is untested — verify it doesn't cause runtime issues on low-end devices.
- [DevOps]: Coverage thresholds (75%/70%/65%/75%) are met when corrected. CI may report false failures due to the `node_modules.nosync` config bug.
<!-- ENTRY:END -->
