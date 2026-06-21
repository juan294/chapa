# Pre-Launch Codebase Audit
> Generated on 2026-06-21 | Branch: `develop` | Focus: release readiness

## Summary

Pre-launch audit found the codebase locally healthy but not release-ready until
the remediation set below was completed. The active release branch was clean at
the start of the pass, with `develop` ahead of `main` and the previous release
tagged as `v2.11.0`.

Initial local gates passed:

- `pnpm run test`: 7,944 tests passed
- `pnpm run typecheck`: passed
- `pnpm run lint`: passed
- `pnpm audit --audit-level moderate`: no known vulnerabilities
- `pnpm run build`: passed, with one Turbopack NFT trace warning

## Findings

### Backend / Data

- Score-changing APIs did not invalidate the rendered badge SVG cache.
- Linked-platform upstream failures could be cached as fresh partial stats.
- Linked-platform refresh/unlink DB writes were fire-and-forget.
- Supplemental stats validation accepted loose numeric and heatmap data.

### Security

- Session/token paths validated presence of `NEXTAUTH_SECRET` but not minimum
  length consistently.
- Support email forwarding relied on regex-style HTML sanitization.
- DOMPurify appeared in dependency metadata without a current local license note.

### Performance

- Linked-platform live fetches could consume the entire stats deadline.
- Platform link/unlink refreshed stats caches but not the share page/read-model
  artifacts.
- Public profile API bypassed the latest-snapshot cache and always queried tool
  insights.
- Root layout preconnected to GitHub on every page.
- Particle canvases kept animation loops alive while offscreen or backgrounded.
- OG image SVG-to-PNG font path resolution caused a Turbopack NFT trace warning.

### Frontend

- `/u/[handle]` used a request-time locale read that defeated ISR expectations.
- `SharePageOwnerContentLazy` disabled SSR for owner/visitor content.
- Client feature flags could diverge from DB-backed server gates.

### DevOps / Architecture

- Deployment smoke was optional/missing in repo configuration.
- Production health treated skipped dependencies as healthy.
- Migration validation was not part of CI.
- Main branch protection omitted launch-relevant workflows.
- Computed `process.env[...]` reads bypassed the typed env boundary lint rule.
- `@chapa/shared` linting was not wired into recursive root lint.
- Package-extraction ADR described `@chapa/shared` as types-only, but the package
  intentionally exports pure runtime utilities.

## Release-Blocking State

Release was blocked until remediation completed, local verification was green,
deployment smoke was configured, and main branch protection required the
launch-relevant checks.
