# Remediation Report
> Generated on 2026-06-21 | Branch: `develop` | Pre-launch pass

## Summary

All code-fixable findings from the 2026-06-21 pre-launch pass were remediated in
one local batch. No partial push was performed.

One GitHub issue remains open:

- `#531 chore: migrate to ESLint 10` — still upstream-blocked because the current
  Next/React ESLint stack does not yet support ESLint 10.

## Remediated

- Enforced 32-character `NEXTAUTH_SECRET` validation across session paths and
  updated test fixtures/workflow dummy secrets.
- Added badge SVG invalidation to profile read-model invalidation and all
  score-changing API paths.
- Added linked-platform per-fetch deadlines and prevented partial upstream
  results from being cached as successful stats.
- Awaited linked-platform token refresh and unlink DB writes.
- Revalidated share pages after platform link/unlink, with unit-test-safe
  best-effort handling outside Next runtime context.
- Hardened supplemental stats validation for finite numbers, bounded ratios,
  active-day limits, and heatmap shape.
- Changed support forwarding to escape the inbound HTML body instead of relying
  on sanitizer regexes.
- Switched public profile API reads to `getCachedLatestSnapshot` and skipped tool
  insight queries when `snapshot.craft` is already present.
- Made `/u/[handle]` ISR-safe by using `DEFAULT_LOCALE` at render time.
- Re-enabled SSR for `SharePageOwnerContentLazy`.
- Hydrated client feature flags from DB-backed server helpers in the root layout
  and consumed those flags in `UserMenu`.
- Removed root GitHub preconnect/dns-prefetch hints.
- Paused particle canvas animation loops on hidden documents and offscreen
  canvases.
- Removed the OG image Turbopack NFT trace warning by using module-relative font
  URLs.
- Treated skipped production health dependencies as degraded.
- Added migration validation to CI and made deployment smoke fail on `main` when
  unconfigured.
- Wired recursive root lint through `packages/shared`, with a package-local ESLint
  config and TypeScript parser.
- Expanded env-boundary lint to catch computed `process.env[...]` reads.
- Updated branch protection for `main` to require `Deployment Smoke`,
  `Lighthouse Audit`, `Analyze Bundle Size`, and `Bundle Analyzer Report` in
  addition to existing required checks.
- Configured `DEPLOYMENT_SMOKE_BASE_URL` GitHub Actions secret to
  `https://chapa.thecreativetoken.com`.
- Documented DOMPurify transitive license posture and corrected the
  package-extraction ADR for `@chapa/shared` runtime utilities.

## Verification

- `pnpm run typecheck`: passed
- `pnpm run lint`: passed
- `pnpm run test`: 462 files, 7,948 tests passed
- `pnpm run validate:migrations`: 26 migrations valid
- `pnpm run check:circular`: 877 files processed, no circular dependency found
- `pnpm audit --audit-level moderate`: no known vulnerabilities
- `pnpm run build`: passed with no Turbopack NFT warning
