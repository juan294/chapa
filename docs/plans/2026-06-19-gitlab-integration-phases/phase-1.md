# Phase 1 — Foundation: Platform type, env, flags, logos/labels

> Parent: [GitLab integration plan](../2026-06-19-gitlab-integration.md) | Issue #855 | Depends on: none

## Goal

Register `"gitlab"` as a known platform across the type system, env layer, feature flags, and the two **exhaustive** `Record<Platform, …>` maps — so adding the union member keeps `pnpm run typecheck` green. This is the base every later phase builds on.

## Why these files together

`packages/shared/src/platforms.ts` defines `Platform` as a closed union. `BadgeBranding.tsx` (`PLATFORM_LOGOS`) and `ImpactBreakdown.tsx` (`PLATFORM_DISPLAY`, `PLATFORM_URLS`) are typed `Record<Platform, …>` — adding `"gitlab"` to the union makes them fail typecheck until a gitlab entry exists. They must land in the same phase.

## Changes

### 1. `packages/shared/src/platforms.ts:2`
```
- export type Platform = "github" | "bitbucket" | "codeberg";
+ export type Platform = "github" | "bitbucket" | "codeberg" | "gitlab";
```

### 2. `apps/web/lib/env.ts` (new GitLab block, mirror Codeberg `:157-173`)
```
// GitLab
export function getGitlabClientId(): string | undefined { return readTrimmed("GITLAB_CLIENT_ID"); }
export function getGitlabClientSecret(): string | undefined { return readTrimmed("GITLAB_CLIENT_SECRET"); }
export function getGitlabEnabledEnv(): string | undefined { return readTrimmed("NEXT_PUBLIC_GITLAB_ENABLED"); }
```

### 3. `apps/web/lib/feature-flags-sync.ts`
```
import { ..., getGitlabEnabledEnv } from "@/lib/env";
export function isGitlabEnabledSync(): boolean { return getGitlabEnabledEnv() === "true"; }
```

### 4. `apps/web/lib/feature-flags.ts` (mirror `isCodebergEnabled` `:127-132`; add re-export of `isGitlabEnabledSync`)
```
export async function isGitlabEnabled(): Promise<boolean> {
  return checkFlag("gitlab_integration", isGitlabEnabledSync() ? "true" : undefined);
}
```

### 5. `apps/web/lib/render/BadgeBranding.tsx`
- Add `gitlab` entry to `PLATFORM_LOGOS` (`:4-11`) — official GitLab tanuki logo as a 24×24 viewBox path (single `<path>` monochrome form, `fill` rendered `#9AA4B2` by the renderer).
- Append to `PLATFORM_ORDER` (`:14`): `["github", "bitbucket", "codeberg", "gitlab"]`.

### 6. `apps/web/components/ImpactBreakdown.tsx`
- `PLATFORM_DISPLAY` (`:81-82`): add `gitlab: { label: "GitLab", svgPath: <tanuki path>, viewBox: "0 0 24 24" }` (match the existing entry shape).
- `PLATFORM_URLS` (`:93`): add `gitlab: (username) => \`https://gitlab.com/${username}\``.

## Tests (write first)

- `apps/web/lib/feature-flags.test.ts`: `isGitlabEnabled()` true when env `NEXT_PUBLIC_GITLAB_ENABLED="true"`; false otherwise; DB flag override path (mirror existing codeberg assertions).
- `apps/web/lib/render/BadgeBranding.test.tsx`: `renderBadgeBranding(..., ["github","gitlab"])` includes the GitLab logo path and renders 2 logos in canonical order; `PLATFORM_ORDER` includes `"gitlab"` last.
- (If `env.test.ts` exists) assert the three GitLab getters read + trim their vars.

## Success criteria — ✅ COMPLETE (2026-06-19)

**Automated:**
- [x] `pnpm run typecheck` green (proves all `Record<Platform>` maps are exhaustive).
- [x] `pnpm run test` green incl. new flag + branding assertions — **445 files / 7605 tests passing**.
- [x] `pnpm run lint` green.

**Manual:** none.

Implemented in worktree `gitlab-foundation` (branch `worktree-gitlab-foundation`). Plan-compliance review: PASS (9/9 items). `/simplify`: no findings (uniform additive pattern-extension).

## Notes

- Source the GitLab tanuki as a single monochrome path to match how `PLATFORM_LOGOS` stores one `d` string per platform. If the brand mark needs multiple paths/fills, store the combined path data; the renderer applies a single `fill`/`opacity`.
