# Implementation Plan: Bitbucket as a Linked Platform

> Date: 2026-02-23
> Research: `docs/research/2026-02-23-bitbucket-integration.md`
> Branch: `feature/bitbucket-integration`

## Overview

Add Bitbucket Cloud (bitbucket.org) as a linked platform. Users log in with GitHub (unchanged), then optionally link their Bitbucket account. Bitbucket data is fetched server-side via OAuth, transformed into `StatsData`, and merged with GitHub data using the existing `mergeStats()` pipeline. The scoring engine, badge rendering, and all downstream consumers remain unchanged.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **UI entry point** | User Menu dropdown | Simplest, no new pages. "Link Bitbucket" alongside "Your Badge" and "Creator Studio" |
| **Bitbucket scope** | Cloud only (bitbucket.org) | Covers 95%+ of users. Data Center requires different OAuth and adds complexity |
| **Confidence penalty** | No penalty for verified platform data | Bitbucket data is server-fetched via OAuth — independently verifiable. New `platform_linked` informational flag (0 penalty) replaces `supplemental_unverified` for platform-linked data |
| **Token storage** | Supabase `user_platforms` table | Bitbucket tokens expire (~2h) and need refresh. Persistent DB storage survives Redis flushes |
| **Feature flag** | `NEXT_PUBLIC_BITBUCKET_ENABLED` | Gated like Studio — disabled by default, enable when ready |
| **Primary identity** | GitHub handle remains canonical | No change to session model. Bitbucket is additive data only |

## Architecture

```
                    ┌─────────────────────────────────────┐
                    │        Badge / Share / Studio         │
                    └──────────────┬──────────────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────────────────┐
                    │           getStats(handle)            │
                    │    apps/web/lib/github/client.ts      │
                    └───┬──────────────┬──────────────────┘
                        │              │
              ┌─────────▼──────┐  ┌───▼──────────────────┐
              │  GitHub Stats   │  │  Bitbucket Stats      │
              │  (existing)     │  │  (NEW — if linked)    │
              │  GraphQL → Raw  │  │  REST → Raw           │
              │  → StatsData    │  │  → StatsData          │
              └─────────┬──────┘  └───┬──────────────────┘
                        │              │
                        ▼              ▼
                    ┌─────────────────────────────────────┐
                    │   mergeStats(github, bitbucket)       │
                    │   apps/web/lib/github/merge.ts        │
                    │   (existing, unchanged)                │
                    └──────────────┬──────────────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────────────────┐
                    │   computeImpactV4(mergedStats)        │
                    │   (existing, unchanged)                │
                    └─────────────────────────────────────┘
```

## Phases

| Phase | Name | Summary | New/Modified Files |
|-------|------|---------|-------------------|
| 1 | [Foundation](./2026-02-23-bitbucket-integration-phases/phase-1.md) | Types, DB migration, feature flag, platform DB access | 6 new, 3 modified |
| 2 | [Bitbucket OAuth](./2026-02-23-bitbucket-integration-phases/phase-2.md) | OAuth connect/disconnect/refresh, token storage | 5 new, 1 modified |
| 3 | [Data Fetching](./2026-02-23-bitbucket-integration-phases/phase-3.md) | Bitbucket REST client, raw types, StatsData transform | 5 new |
| 4 | [Merge Pipeline](./2026-02-23-bitbucket-integration-phases/phase-4.md) | Wire Bitbucket into getStats(), cache keys, confidence | 4 modified |
| 5 | [UI](./2026-02-23-bitbucket-integration-phases/phase-5.md) | User Menu "Link Bitbucket", status API, disconnect | 3 modified, 1 new |

## Environment Variables (New)

```
BITBUCKET_CLIENT_ID=           # Bitbucket OAuth consumer key
BITBUCKET_CLIENT_SECRET=       # Bitbucket OAuth consumer secret
NEXT_PUBLIC_BITBUCKET_ENABLED= # Set to "true" to enable Bitbucket linking
```

## Files Unchanged

All of these operate on `StatsData` / `ImpactV4Result` and require zero modification:

- `apps/web/lib/impact/v4.ts` — scoring engine
- `apps/web/lib/impact/utils.ts` — confidence, tier (except new flag constant)
- `apps/web/lib/impact/heatmap-evenness.ts` — heatmap analysis
- `apps/web/lib/impact/recency.ts` — recency weighting
- `apps/web/lib/render/BadgeSvg.tsx` — badge SVG rendering
- `apps/web/lib/render/heatmap.ts` — heatmap rendering
- `apps/web/lib/render/RadarChart.ts` — radar chart
- `apps/web/lib/github/merge.ts` — mergeStats()
- `apps/web/lib/validation.ts` — isValidStatsShape()
- `packages/shared/src/constants.ts` — SCORING_CAPS
- `packages/shared/src/stats-aggregation.ts` — buildStatsFromRaw()
- `packages/shared/src/scoring.ts` — computePrWeight()

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Bitbucket API rate limit (1000/hr) | Low | Medium | Daily caching (6h TTL), pagination limits |
| Token refresh race condition | Medium | Low | Atomic refresh with Redis lock |
| Workspace enumeration too slow | Low | Medium | Cap at 10 workspaces, timeout at 30s |
| Bitbucket API changes | Low | High | Type-safe response parsing, integration tests |
| OAuth consumer approval delays | Medium | Low | Can develop with test consumer, production approval parallel |

## Verification Strategy

Each phase has automated verification:
```bash
pnpm run test          # Unit + integration tests
pnpm run typecheck     # Type safety
pnpm run lint          # Code quality
```

Phase 3 additionally requires manual verification of Bitbucket API responses (need a real Bitbucket account with activity).
