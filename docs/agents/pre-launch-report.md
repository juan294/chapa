# Pre-Launch Codebase Audit
> Generated on 2026-06-24 | Branch: `develop` | Focus: release readiness

## Summary

The 2026-06-24 pre-launch pass found `develop` locally healthy at baseline, but
not release-ready until several launch-blocking findings were remediated. No
partial push was performed during remediation.

## Findings

### Frontend / UX

- **FE-M1 / PE-H1**: Static public routes (`/about`, legal pages, `/verify`,
  and `/archetypes/*`) had regressed to request-time rendering through locale
  reads.
- **UX-H1**: Making those pages static with default-locale server copy would
  leave returning non-default-locale users seeing stale body content.
- **UX-M1**: `NavbarClient` could replace server-provided localized nav labels
  with client fallback dictionary labels on first paint.

### Backend / Data

- **BE-H1**: Admin bulk recalculation persisted new snapshots without
  invalidating public read models, badge SVG cache, history, or share-page ISR.
- **BE-M1**: Bulk recalculation pagination could skip users because the cursor
  order did not match deterministic sorted handle order.

### Security

- **SE-M1**: `/api/supplemental` parsed unauthenticated JSON request bodies
  before authentication, IP throttling, or payload-size enforcement.
- **SE-M2**: License compliance checked only the repository root and could miss
  `apps/web` production runtime dependency licenses.

### DevOps / Release Safety

- **DO-H1**: Vercel preview deployments could be skipped, allowing deployment
  smoke to run against a stale URL rather than the release candidate.
- **DO-M1**: `main` branch protection omitted the required `pnpm audit` context.
- **DO-M2**: Cron readiness was documented too weakly; production could pass
  release review without an explicit `CRON_SECRET` and scheduled-job auth gate.

## Release-Blocking State

Release was blocked until all findings above were fixed, local verification was
green, branch protection included `pnpm audit`, and the release documentation
reflected the stricter deployment-smoke and cron-readiness gates.
