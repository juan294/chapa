# Badge Branding v2: Platform-Neutral Identity

> **Date:** 2026-02-26
> **Branch:** `develop`
> **Status:** Draft
> **Phases:** 3

## Summary

Replace GitHub-specific branding in the badge SVG with platform-neutral alternatives:

1. **Avatar placeholder** — Swap the GitHub Octocat fallback with the Chapa shield icon
2. **Footer branding** — Replace "Powered by GitHub" with "Built from your commitment" + dynamic platform logos
3. **Dynamic logos** — Personal badges show only connected platform logos; demo badge (landing page) shows all supported platforms

## Context

Chapa now supports GitHub, Bitbucket, and Codeberg as data sources. The badge template still shows GitHub-only branding in two places:
- The avatar placeholder (when no user photo exists) is a GitHub Octocat
- The footer reads "Powered by GitHub" with the Octocat icon

The `StatsData` type already carries `linkedPlatforms: Platform[]` and `linkedPlatformLogins: Record<string, string>`, populated during stats enrichment. This data is available at badge render time but not currently used in the SVG.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Avatar fallback | Chapa shield (from favicon) | Brand-forward, platform-neutral |
| Footer text | "Built from your commitment" | Inspiring, developer-centric, no platform dependency |
| Demo badge logos | All 3 platforms (GitHub + Bitbucket + Codeberg) | Promotional — shows all integrations |
| Personal badge logos | Only connected platforms | Accuracy — reflects actual data sources |
| GitHub always shown? | Yes (GitHub is the primary/required platform) | Every user authenticates via GitHub |
| Logo order | GitHub → Bitbucket → Codeberg (alphabetical after GitHub) | Consistent with share page DataSources |
| Option rename | `includeGithubBranding` → `includeBranding` | Platform-neutral naming |
| Component rename | `GithubBranding.tsx` → `BadgeBranding.tsx` | Reflects new multi-platform scope |

## Files to Modify

| File | Change |
|------|--------|
| `apps/web/lib/render/BadgeSvg.tsx` | Replace Octocat fallback with Chapa shield; pass `linkedPlatforms` to branding; rename option |
| `apps/web/lib/render/GithubBranding.tsx` → `BadgeBranding.tsx` | Rename file; rewrite to render "Built from your commitment" + dynamic platform logos |
| `apps/web/lib/render/demoData.ts` | Add `linkedPlatforms: ["github", "bitbucket", "codeberg"]` to `DEMO_STATS` |
| `apps/web/app/u/[handle]/badge.svg/route.ts` | Rename option from `includeGithubBranding` to `includeBranding` |
| `apps/web/app/page.tsx` | Update demo badge call to use new option name |
| `packages/shared/src/types.ts` | No change needed — `linkedPlatforms` already exists |
| Tests (multiple) | Update all tests referencing `includeGithubBranding`, `renderGithubBranding`, `GithubBranding`, and Octocat SVG paths |

## Phases

- [Phase 1: Avatar placeholder swap](./2026-02-26-badge-branding-v2-phases/phase-1.md)
- [Phase 2: Footer branding rewrite](./2026-02-26-badge-branding-v2-phases/phase-2.md)
- [Phase 3: Integration tests and visual verification](./2026-02-26-badge-branding-v2-phases/phase-3.md)

## Success Criteria

### Automated
- [ ] `pnpm run test` — all tests pass (including updated badge rendering tests)
- [ ] `pnpm run typecheck` — zero errors
- [ ] `pnpm run lint` — zero warnings
- [ ] Badge SVG output contains Chapa shield (not Octocat) when no avatar provided
- [ ] Badge SVG footer shows "Built from your commitment" (not "Powered by GitHub")
- [ ] Demo badge shows all 3 platform logos
- [ ] Personal badge with only GitHub shows 1 logo
- [ ] Personal badge with GitHub + Bitbucket shows 2 logos
- [ ] Personal badge with all 3 platforms shows 3 logos
- [ ] `includeGithubBranding` renamed to `includeBranding` across all files
- [ ] No references to `GithubBranding` in imports (old file removed)

### Manual
- [ ] Visual check: badge looks good at 1200×630 with new footer layout
- [ ] Visual check: Chapa shield placeholder looks good in the avatar circle
- [ ] Visual check: platform logos are readable at badge scale
