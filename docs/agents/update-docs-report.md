# Documentation Update Report
> Generated on 2026-04-26 | Branch: `develop` | Changes since `v2.7.2`

## Summary
- 3 documents updated
- 1 diagram refreshed
- 1 version reference corrected
- 0 inline doc blocks updated
- 0 items flagged [NEEDS REVIEW]

## Discovery

4 parallel agents investigated the project:

- **change-analyst**: 125 commits since v2.7.2 across 390 files. Key areas: auth modules, profile modules, craft scoring fix, campaign safety, cron hardening, accessibility, observability, Spanish localization, 6 new runbooks, 237 new tests.
- **doc-inventory**: ~50 markdown files catalogued. Most docs already updated by recent commits (`c0c35ff`, `4394470`). Stale items identified: CHANGELOG missing [Unreleased], cli-guide Node version mismatch, user-manual missing Artificer command.
- **diagram-analyzer**: One diagram found (`docs/chapa-architecture.drawio`). Assessed as stale — updated and re-exported to PNG.
- **version-scanner**: `apps/web/package.json` at `2.7.2` (defer to `/release`). `CACHE_VERSION` and `PAYLOAD_VERSION` intentionally pinned. README badges current.

## Changes by File

### `CHANGELOG.md`
Added `[Unreleased]` section before `[2.7.2]`. Covers 125 commits since v2.7.2, organized into:
- **Added** (23 items): Active alerts, structured error logger, auth modules, profile modules, Spanish localization, lease-based campaign sends, deployment smoke gate, migration validator, auto-commit launchd job, 6 runbooks, AGENTS.md, backfill script, new hooks/components, health probe, 237 new tests
- **Fixed** (28 items): Craft scoring single source of truth, OAuth token storage to Supabase, campaign deduplication, admin stabilization, badge cache hardening, Redis fail-open, cron fail-secure, auth cookie policy, InfoTooltip z-index, heatmap keyboard nav, radar reduced-motion, and more
- **Security** (2 items): PostCSS XSS CVE pin, Next.js 16.2.4 PPR DoS fix
- **Changed** (2 items): Removed stale components, license inventory refresh
- **Dependencies** (10 bumps): Next.js, React, TypeScript, ESLint, vitest, supabase-js, posthog-js, resend, playwright, @types/node

### `docs/cli-guide.md` — lines 33–34
Fixed version mismatch. The prerequisites section (line 25) correctly stated "Node.js 20 or later" and "npm 10 or later" but the shell example below it showed `v18.x.x` and `7.x.x`. Corrected to match:
- `v18.x.x or higher` → `v20.x.x or higher`
- `7.x.x or higher` → `10.x.x or higher`

### `docs/user-manual.md`
Two gaps found and patched:
1. **Missing `/artificer` command**: The Global Command Bar archetype command list had all 7 archetypes except Artificer. Added `/artificer → View the Artificer archetype page` between `/polymath` and `/balanced`.
2. **Stale radar chart tooltip description**: "What the four dimensions represent" updated to "What the dimensions represent (4 axes for standard profiles; 5 axes when Craft is present)" — reflects pentagon mode added in v2.7.0.

## Flagged for Review
None.

### `docs/chapa-architecture.drawio` + `docs/chapa-architecture.drawio.png`
Rebuilt the architecture diagram to reflect changes since v2.7.2:
- **Frontend**: Added 5th box — "About + Archetypes `/about · /archetypes/*`"
- **Auth Layer**: Added second row with 4 new modules: Session Mgmt, Cookie Policy, OAuth State (Redis-backed CSRF), GitHub Token Store (Supabase-backed)
- **API Layer**: Added second row — Campaign API, Cron Jobs (moved from separate cell), Verification, Feature Flags + Webhooks + Telemetry
- **Core Engine**: Added Profile Modules row (lib/profile/ — materialize, orchestrate, public); added third row with Observability (withErrorCapture, structured JSON logger) and Email + Campaigns (lib/email/, lib/campaigns/, lease-based send claiming)
- **External Services**: Expanded panel height to cover full diagram
- All edge waypoints updated for new layer positions
- Re-exported PNG with embedded XML

## Documents Verified — No Update Needed

| Document | Reason |
|----------|--------|
| `docs/how-it-works.md` | Updated in `c0c35ff` — OAuth token storage, Redis state |
| `docs/accepted-risks.md` | Updated in `4394470` — badge route side-effects mechanism |
| `docs/design-system.md` | Updated recently — light-mode color table values added |
| `CLAUDE.md` | Updated recently — GitHub API probe added to `/api/health` |
| `README.md` | Updated recently — test counts and badges current |
| `LICENSE-THIRD-PARTY.md` | Updated in `67bcb60` |
| `docs/svg-design.md` | Confirmed current — v3 pentagon mode documented correctly |
| All runbooks (6) | New files added since v2.7.2, already complete |
| `AGENTS.md` | New file added since v2.7.2, complete |
| Legacy specs (impact-v3/v4/v5) | Intentionally historical — no update needed |

## Lint Note
`markdownlint` reports pre-existing violations throughout `CHANGELOG.md` (MD013 line-length, MD022 heading spacing, MD024 duplicate headings per-version, MD032 list spacing). These violations exist uniformly across all pre-existing entries and reflect the established CHANGELOG format. The new `[Unreleased]` section follows the same format.
