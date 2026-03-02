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

<!-- ENTRY:START agent=cost-analyst timestamp=2026-03-02T12:00:00Z -->
## Cost Analyst — 2026-03-02
- **Status**: GREEN
- Redis memory: ~5 MB at ~50 users, all keys have TTLs except 3 intentional permanent keys (~12 KB fixed)
- Avatar cache is the dominant cost driver: ~50 KB/user (47% of per-user Redis storage)
- Stats duplication (primary 6h + stale 7d): ~40 KB/user (38% of per-user storage)
- 27 rate-limited endpoints, all with window-based expiry, fail-open design
- Supabase: 6 tables + 2 views, singleton connection, zero N+1 queries in hot paths
- GitHub API budget: ~167 calls/hr at 1,000 users vs 5,000/hr limit — 97% headroom
- Feature flag queries hit Supabase directly (no cache layer) — acceptable at current scale
- Upstash free tier (256 MB) exceeded at ~3,000 users without avatar optimization
- No resource leaks: all clients are lazy singletons, all buffers are transient, all async work uses Promise.allSettled
- CLAUDE.md documents Redis sorted sets for history — actual implementation uses Supabase (documentation drift)

**Cross-agent recommendations:**
- [Performance]: Avatar base64 caching in Redis (~50 KB/user) is the #1 cost growth driver. At 1,000+ users, consider CDN-served avatars instead. Bundle analyzer available via `ANALYZE=true pnpm run build`.
- [Security]: Fail-open rate limiting is intentional and documented. 365-day `badge:notified:*` keys grow indefinitely but are 1 byte each — negligible risk. Token encryption at rest in `user_platforms` is properly implemented.
- [Coverage]: Feature flag queries (`isStudioEnabled()`, `isBitbucketEnabled()`) lack caching — no tests verify behavior under Supabase unavailability. Warm-cache cron batch logic (rotation offset, batch processing) is cost-critical and should have thorough coverage.
- [QA]: CLAUDE.md references Redis sorted sets for `history:<handle>` — outdated, actual storage is Supabase `metrics_snapshots` table. Documentation should be updated to match implementation.
<!-- ENTRY:END -->

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
