---
phase: 11A
release: v2.11.0
issues: ["#744", "#747"]
batch_eligible: false
effort: L
---

# Phase 11A — Platform fetcher unification + `normalizeStats` (`#744`, `#747`)

## Goal

Two related architecture fixes that hit the same files:

- **`#744`** — `_fetchBitbucketIfLinked` and `_fetchCodebergIfLinked` are
  ~70% duplicated. Both `bitbucket/stats-aggregation.ts` and
  `codeberg/stats-aggregation.ts` are 95% identical. This is the root
  cause of prior platform scoring divergence bugs.
- **`#747`** — `StatsData` defaults are scattered across three platform
  aggregators plus scoring code. This was the root cause of three
  v2.7.x craft bugs (#680).

Address both at once: introduce a `PlatformFetcher` interface, unify the
two fetcher functions into one parameterized `_fetchLinkedPlatform`, and
funnel all aggregator outputs through a new `normalizeStats(raw): StatsData`
helper in `@chapa/shared`.

## Design

```ts
// packages/shared/src/normalize-stats.ts (new)
export function normalizeStats(raw: Partial<StatsData>): StatsData {
  return {
    contributions: raw.contributions ?? 0,
    contributionsLastWeek: raw.contributionsLastWeek ?? 0,
    activeWeeks: raw.activeWeeks ?? 0,
    weeksWithContributions: raw.weeksWithContributions ?? 0,
    repositories: raw.repositories ?? 0,
    languages: raw.languages ?? 0,
    starsReceived: raw.starsReceived ?? 0,
    forksOnRepos: raw.forksOnRepos ?? 0,
    watchersOnRepos: raw.watchersOnRepos ?? 0,
    pullRequestsOpened: raw.pullRequestsOpened ?? 0,
    pullRequestsMerged: raw.pullRequestsMerged ?? 0,
    issuesOpened: raw.issuesOpened ?? 0,
    issuesClosed: raw.issuesClosed ?? 0,
    reviewsSubmitted: raw.reviewsSubmitted ?? 0,
    primaryReviewsSubmittedCount: raw.primaryReviewsSubmittedCount ?? 0,
    batchSizeScore: raw.batchSizeScore ?? 0,
    medianPrLeadTimeHours: raw.medianPrLeadTimeHours ?? 0,
    // ... every field in StatsData explicitly
  };
}
```

```ts
// apps/web/lib/platform/types.ts (new)
export interface PlatformFetcher {
  name: "bitbucket" | "codeberg";
  isLinked(handle: string): Promise<boolean>;
  fetchStats(handle: string, token: string): Promise<Partial<StatsData>>;
  refreshToken(handle: string): Promise<string | null>;
}
```

```ts
// apps/web/lib/github/client.ts
// Replace _fetchBitbucketIfLinked and _fetchCodebergIfLinked with a single
// generic _fetchLinkedPlatform(fetcher: PlatformFetcher).

import { bitbucketFetcher } from "@/lib/bitbucket/fetcher";
import { codebergFetcher } from "@/lib/codeberg/fetcher";
import { normalizeStats } from "@chapa/shared";

async function _fetchLinkedPlatform(fetcher: PlatformFetcher, handle: string) {
  if (!(await fetcher.isLinked(handle))) return null;
  const token = await fetcher.refreshToken(handle);
  if (!token) return null;
  const raw = await fetcher.fetchStats(handle, token);
  return normalizeStats(raw); // single source of defaults
}

// Call site
const [bitbucket, codeberg] = await Promise.allSettled([
  _fetchLinkedPlatform(bitbucketFetcher, handle),
  _fetchLinkedPlatform(codebergFetcher, handle),
]);
```

The two `stats-aggregation.ts` files collapse: the 95%-identical code
moves into a `apps/web/lib/platform/stats-aggregator.ts` helper that takes
the platform-specific GraphQL/REST query as a callback.

## Files

- New: `packages/shared/src/normalize-stats.ts`
- New: `packages/shared/src/normalize-stats.test.ts`
- New: `apps/web/lib/platform/types.ts`
- New: `apps/web/lib/platform/stats-aggregator.ts`
- New: `apps/web/lib/bitbucket/fetcher.ts` (just the platform-specific bits)
- New: `apps/web/lib/codeberg/fetcher.ts`
- Modified: `apps/web/lib/github/client.ts` — replace the two `_fetch*If*`
  with the unified `_fetchLinkedPlatform`
- Removed: `apps/web/lib/bitbucket/stats-aggregation.ts` (logic now in
  `lib/platform/stats-aggregator.ts` + `lib/bitbucket/fetcher.ts`)
- Removed: `apps/web/lib/codeberg/stats-aggregation.ts` (same)

## Acceptance criteria

### Automated
- [ ] `pnpm run test`, `pnpm run typecheck`, `pnpm run lint` all pass
- [ ] `lib/impact/pipeline.test.ts` still green (this test catches scoring
      regressions across `aggregation -> merge -> scoring -> snapshot`)
- [ ] New test: `normalizeStats({})` returns a fully-populated `StatsData`
      with all default values; new fields added to `StatsData` later will
      cause TS errors here (forces single source of truth)
- [ ] `find apps/web/lib -name 'stats-aggregation.ts'` returns 0 results
- [ ] Lines-of-code count: `wc -l apps/web/lib/{bitbucket,codeberg}/*.ts`
      drops by ≥30% (deduplication acceptance signal)

### Manual
- Manual smoke on a multi-platform handle (linked Bitbucket + GitHub):
  verify scores match before/after the refactor exactly
- Force a Bitbucket fetch failure; verify the share page still renders
  with GitHub stats only

## Closing the issues

```bash
gh issue close 744 --comment "Fixed in <sha>. PlatformFetcher interface unifies Bitbucket/Codeberg paths into a single _fetchLinkedPlatform; per-platform code reduced to thin adapters."
gh issue close 747 --comment "Fixed in <sha>. normalizeStats() in @chapa/shared is the single source of StatsData defaults; all aggregators flow through it."
```
