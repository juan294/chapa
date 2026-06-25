# Documentation Update Report
> Generated on 2026-06-25 | Branch: `develop` | Changes since v2.14.0

## Summary
- 2 documents updated
- 0 diagrams refreshed (no Mermaid diagrams in project)
- 5 version references corrected (Unreleased link + 4 missing compare links)
- 0 inline doc blocks updated
- 0 items flagged [NEEDS REVIEW]

## Changes by File

### `CHANGELOG.md`
Added full `[2.15.0]` section covering 180 commits (6 feat, 70 fix) since v2.14.0. Fixed stale
`[Unreleased]` compare link (was `v2.11.0...HEAD`, now `v2.15.0...HEAD`). Added 4 missing
compare-link reference footers (`[2.15.0]`, `[2.14.0]`, `[2.13.0]`, `[2.12.0]`).

The `[Unreleased]` link was 3 releases out of date. The section headings for v2.12.0, v2.13.0,
v2.14.0 existed but had no hyperlinks because their `[x.y.z]:` reference-link definitions were
missing. v2.15.0 had no entry at all.

New section highlights:
- Added: score challenge flow, score transparency panel, Supabase studio config backing store,
  fail-closed rate limiting, cross-platform aggregation helper, Zod admin validation, health
  alertWebhook field, `no-restricted-imports` ESLint rule
- Fixed: avatar timeout, static landing page, 6 i18n keys, supplemental dual-write errors,
  admin bulk-recalculate dedup, CLI auth window, bundle size budget, vercel cron maxDuration,
  validation range caps, CSP documentation, posthog import optimisation
- Changed: migration runbook added; test count updated (8,112 across 473 files)

### `apps/web/package.json`
`"version"` bumped from `"2.14.0"` to `"2.15.0"`.

6 `feat:` commits since v2.14.0 warrant a minor version bump per semver. No breaking changes
were introduced (0 `BREAKING CHANGE` markers in git log).

## Docs Checked and Left Unchanged

| Document | Reason unchanged |
|----------|-----------------|
| `docs/impact-v6.md` | Scoring algorithm unchanged since v2.14.0 |
| `docs/design-system.md` | Design tokens and patterns unchanged |
| `docs/accepted-risks.md` | Updated during Wave 2 remediation (#959) |
| `docs/runbooks/migrations.md` | Updated during Wave 1 remediation (#941) |
| `docs/runbooks/release-checklist.md` | Updated during Wave 1 remediation (#942) |
| `CLAUDE.md` | Routes and types updated during remediation session |
| `README.md` | No user-facing API surface changes |
| `packages/shared` | No README exists (intentional — internal workspace) |
| `docs/plans/*`, `docs/research/*` | Historical context, correct as written |
| `docs/agents/*-report.md` | Timestamped audit outputs, not living docs |

## Version References Corrected

| File | Was | Now |
|------|-----|-----|
| `CHANGELOG.md` `[Unreleased]` link | `…v2.11.0…HEAD` | `…v2.15.0…HEAD` |
| `CHANGELOG.md` | missing `[2.15.0]:` compare link | added |
| `CHANGELOG.md` | missing `[2.14.0]:` compare link | added |
| `CHANGELOG.md` | missing `[2.13.0]:` compare link | added |
| `CHANGELOG.md` | missing `[2.12.0]:` compare link | added |
| `apps/web/package.json` | `"version": "2.14.0"` | `"version": "2.15.0"` |

## Flagged for Review
None.

## Verification
- `pnpm run lint`: passed (0 errors, 0 warnings)
- markdownlint: project has no `.markdownlint` config; existing docs fail the same
  line-length and blank-line rules. New section matches the established project style.
