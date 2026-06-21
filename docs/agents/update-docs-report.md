# Documentation Update Report
> Generated on 2026-06-21 | Branch: `develop` | Changes since v2.11.0

## Summary

Updated release-adjacent documentation after the pre-launch remediation pass.

## Changes by File

### `docs/agents/pre-launch-report.md`

Replaced the stale 2026-06-19 report with the 2026-06-21 release-readiness
findings and initial verification state.

### `docs/agents/remediation-report.md`

Replaced the stale prior remediation summary with the 2026-06-21 remediation
record, external GitHub configuration changes, remaining upstream-blocked issue,
and final local verification evidence.

### `docs/accepted-risks.md`

- Updated review stamp to 2026-06-21 / v42.
- Added DOMPurify transitive dependency license note. DOMPurify is pulled through
  PostHog tooling, offers Apache-2.0 as an allowed license option, and remains
  pinned by the root override as a security floor.

### `docs/decisions/2026-06-20-package-extraction-roadmap.md`

Corrected `@chapa/shared` policy from "types only" to "domain types plus small
pure runtime constants/utilities"; retained the no-I/O, no-framework-runtime
boundary.

## Not Updated

Historical research and plan files were intentionally left unchanged. They record
the state and decisions at the time they were written.
