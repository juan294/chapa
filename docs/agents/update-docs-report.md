# Documentation Update Report
> Generated on 2026-05-03 | Branch: `develop` | Changes since v2.9.1

## Summary
- 6 documents updated
- 1 diagram flagged `[NEEDS REVIEW]`
- 3 version references corrected
- 0 inline doc blocks updated (no existing JSDoc found on changed modules)
- 1 item flagged `[NEEDS REVIEW]`

## Changes by File

### `CHANGELOG.md`
Added missing `[Unreleased]` section with the full i18n feature summary (LanguageSwitcher, structured dictionaries, locale detection, cookie persistence, parity test, insignia→Chapa rename). Added `[2.9.1]` hotfix entry (Upstash OAuth state comparison fix) and `[2.9.0]` release entry (typed env getters, structured JSON logger, withErrorCapture on all 44 routes, share page perf improvements). Added compare links for all three new sections.

### `README.md`
- Updated test counts from "389+ files, 6,950+ tests" → "440+ files, 7,530+ tests"
- Added **Bilingual UI (ES / EN)** to the Features section
- Added `lib/dashboard/`, `lib/i18n/`, `lib/insights/`, `lib/profile/` to the project structure tree

### `CLAUDE.md`
- Fixed cookie name: `locale` → `chapa-locale` (i18n section)
- Fixed key count: `550+` → `650+` leaf keys per dictionary
- Added three Code Ownership entries: `lib/i18n/`, `lib/dashboard/ + components/dashboard/`, `BadgeToolbar`

### `docs/user-manual.md`
Added new **Language Switcher** section explaining the globe-icon picker, how to switch locales, and how the default is auto-detected from `Accept-Language`.

### `docs/runbooks/release-checklist.md`
Added **Language switcher** row to the Preview Deployment Soak table: click globe icon → switch ES↔EN → confirm page re-renders in selected locale.

### `docs/impact-v6.md`
Corrected ASCII pipeline diagram: `"8 penalty flags"` → `"9 flag entries: 8 scored + 1 informational at 0 penalty"` to match the actual implementation in `lib/impact/utils.ts`.

### `docs/chapa-architecture.drawio`
Added `<!-- [NEEDS REVIEW] -->` XML comment. The DrawIO diagram is missing `lib/i18n/` module, `LanguageSwitcher` component, `lib/dashboard/`, and `lib/insights/` swimlane nodes — last updated for v2.8.0. Requires the DrawIO desktop app to update properly.

## Flagged for Review

| File | Issue |
|------|-------|
| `docs/chapa-architecture.drawio` | Missing: `lib/i18n/` module, `LanguageSwitcher` in Frontend swimlane, `lib/dashboard/`, `lib/insights/`. Open in DrawIO to add nodes. |

## Not Updated (checked, current)

`docs/design-system.md` (LanguageSwitcher already documented), `docs/accepted-risks.md` (two i18n risks already added), `docs/svg-design.md`, `docs/how-it-works.md`, `docs/cli-guide.md`, `docs/badge-verification.md`, all deprecated impact specs (correctly archived), all research/plans docs (intentional historical snapshots), all other runbooks.
