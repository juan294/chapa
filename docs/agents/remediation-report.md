# Remediation Report
> Generated on 2026-06-24 | Branch: `develop` | Pre-launch remediation pass

## Summary

All findings from the 2026-06-24 pre-launch pass were remediated locally in one
batch. No partial push was performed.

## Remediated

- Restored static generation for `/about`, `/about/scoring`,
  `/about/verification`, `/privacy`, `/terms`, `/verify`, and all archetype
  pages while moving visible body copy into client renderers backed by
  `useTranslation()`.
- Kept public-page metadata static through `DEFAULT_LOCALE` server metadata and
  preserved build output as static (`○`) for all affected routes.
- Changed `NavbarClient` to trust server-provided nav labels on first paint.
- Added admin bulk-recalculation invalidation for profile read models, badge SVG
  cache, snapshots, history, and share-page ISR; sorted and deduped handles
  before cursor pagination.
- Hardened `/api/supplemental` with IP rate limiting before auth lookup,
  authentication before JSON parsing, and a 256 KiB payload cap.
- Updated license compliance to scan `apps/web` production dependencies.
- Removed the Vercel `ignoreCommand` that skipped non-production builds and made
  strict deployment smoke require Redis, Supabase, and GitHub dependencies to be
  exactly `ok`.
- Updated release and deployment-smoke runbooks to require the exact release
  candidate preview URL/SHA and explicit cron-secret readiness.
- Updated `main` branch protection to require `pnpm audit` in addition to the
  existing required contexts.

## Verification

- `pnpm run typecheck`: passed
- `pnpm run lint`: passed
- `pnpm run test`: 464 files, 7,986 tests passed
- `pnpm run check:circular`: 886 files processed, no circular dependency found
- `pnpm audit --audit-level moderate`: no known vulnerabilities
- `pnpm run build`: passed; affected public routes remain static in Next output
