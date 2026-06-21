# Phase 4: Integrated Validation Gate

Parent plan: `docs/plans/2026-06-21-data-sources-linking-scoring-hardening.md`

## Goal

Validate the complete link/unlink/scoring hardening work after implementation phases land.

## Scope

No feature code changes expected. This phase is verification and any final documentation corrections required by implementation reality.

## Automated Verification

Run sequentially:

```bash
pnpm exec vitest run apps/web/lib/auth/platform-oauth.test.ts apps/web/app/api/auth/bitbucket/callback/route.test.ts apps/web/app/api/auth/bitbucket/disconnect/route.test.ts apps/web/app/api/auth/codeberg/callback/route.test.ts apps/web/app/api/auth/codeberg/disconnect/route.test.ts apps/web/app/api/auth/gitlab/callback/route.test.ts apps/web/app/api/auth/gitlab/disconnect/route.test.ts apps/web/components/UserMenu.test.tsx apps/web/components/UserMenu.render.test.tsx apps/web/lib/github/client.test.ts apps/web/lib/github/merge.test.ts apps/web/lib/impact/pipeline.test.ts apps/web/lib/impact/smoothing.test.ts apps/web/lib/impact/utils.test.ts apps/web/lib/profile/materialize-profile.test.ts apps/web/lib/profile/materialize-profile-parallel.test.ts apps/web/lib/profile/public-profile.test.ts
pnpm run typecheck
pnpm run lint
pnpm run test
```

## Manual Verification

Where OAuth credentials are available:

1. Link one enabled platform.
2. Confirm callback redirects to `/u/{handle}?{platform}=linked`.
3. Confirm Data Sources and badge branding include the linked platform after the next profile render.
4. Unlink the same platform.
5. Confirm the menu remains linked on server failure and changes to unlinked on server success.
6. Confirm score display no longer reuses a stale same-day snapshot after the link-state change.

## Completion Criteria

- All automated commands pass.
- Any manual checks possible in the available environment are recorded in the implementation summary.
- No phase leaves unresolved clarification markers.
