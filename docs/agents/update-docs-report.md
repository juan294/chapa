# Documentation Update Report

> Generated on 2026-07-15 | Branch: `develop` | Changes since `v2.17.0` (2026-07-08)

## Summary

- **8 documents updated** (`CHANGELOG.md`, `CLAUDE.md`, `docs/impact-v6.md`, `docs/how-it-works.md`, `docs/svg-design.md`, `README.md`, `docs/plans/2026-07-03-reliability-hardening.md`, `docs/playbooks/reliability-hardening-playbook.md`)
- **1 diagram refreshed** (`docs/chapa-architecture.drawio` — GitLab was missing entirely)
- **1 version/stat reference corrected** (README test-count)
- **0 inline doc blocks updated** — JSDoc in `lib/impact/*` and `lib/github/*` was already current, in fact ahead of the architecture-level docs on #1004
- **1 dead document deleted** (`docs/tasks.md`, user-approved)
- **1 stale convention removed from CLAUDE.md** (`docs/prs/{number}_description.md` — directory never existed, user-approved removal)
- **0 items flagged [NEEDS REVIEW]**

Discovery ran 4 parallel read-only agents (change-analyst, doc-inventory, diagram-analyzer, version-scanner). `git log v2.17.0..HEAD` showed 242 commits, but branch-hash divergence meant most were already-released content re-listed under different hashes — the tree diff confirmed only **23 commits of genuinely new work** since the release. Several updates below (#1004) address gaps that predate this release cycle: the scoring-integrity contract shipped *in* v2.17.0 but was never reflected in the architecture-level docs, only in CHANGELOG and inline code comments.

## Changes by File

### `CHANGELOG.md`

Populated the empty `[Unreleased]` section covering the 23 real commits since v2.17.0:

- **Added**: badge latency SLO + `Server-Timing` header (#974), snapshot-write reconciliation alert
- **Fixed**: fail-closed rate limiting on session/refresh routes, supplemental-stats validation hardening, health-check probe fix (`metrics_snapshots` not `users`), static landing page, bounded refetch churn on total GitHub fetch failure
- **Changed**: shared `buildStatsFrom*` platform-stats pipeline, typed i18n accessors, CI pipeline sharding (#1007)
- **Docs**: new no-middleware ADR, 2 new accepted-risk entries

### `CLAUDE.md`

- Added a **Scoring-data integrity contract (#1004)** bullet to Caching rules — shipped in v2.17.0 but never documented at the architecture level.
- Added a **Snapshot-write reconciliation** bullet for the new `reconcileSnapshotWrite` saga (`apps/web/lib/profile/snapshot-write.ts`), satisfying the existing "durable write failure must be observable" rule.
- Fixed the stats cache TTL claim from "24h" to "6h primary, 7-day stale-fallback tier" — code has used `CACHE_TTL = 21600` (6h) since a 2026-02-12 fix (#107) never reflected in CLAUDE.md; the 7-day `STALE_TTL` fallback was undocumented entirely.
- Added a CI Gates bullet noting the contract-test job pins Node 24 while the rest of CI/dev targets Node 20+.
- Removed the `docs/prs/{number}_description.md` row from Project File Locations — the directory has never existed in the repo (user decision: drop the convention rather than adopt it retroactively).

### `docs/impact-v6.md`

Added a **Scoring-data integrity contract (#1004)** paragraph after the existing "Degraded-fetch guard (#1002)" note, matching its style — explains the three-boundary defense (fetch/cache/persist) and the new telemetry + `heal-poisoned-stats` script.

### `docs/how-it-works.md`

Added a matching **#1004** callout after the existing #1002 partial-fetch-protection callout in the EMU merge flow section.

### `docs/svg-design.md`

Fixed two stale references to a 3-platform footer (GitHub/Bitbucket/Codeberg) — GitLab shipped 2026-06-19 and `BadgeBranding.tsx` has rendered 4 platform logos since, but this doc was never updated.

### `docs/chapa-architecture.drawio`

The only diagram in the repo (no mermaid diagrams exist anywhere in the project). Missing GitLab entirely since the #855 integration (2026-06-19):

- Added a "GitLab OAuth" box to the OAuth & Auth Layer swimlane (resized the 4 existing boxes from 180px→155px to fit a 5th in the same row)
- Appended `lib/gitlab/` to the "Platform Clients" node in the Core Engine
- Added a "GitLab API" box to the External Services swimlane (shifted Resend/PostHog/Vercel down to make room)

Validated the XML is still well-formed after edits.

### `README.md`

Updated the stale test-count stat from "456+ test files, 7,800+ tests" (already stale a release prior — CHANGELOG's own v2.16.0 entry cited 477 files/8,174 tests) to "516+ test files, 8,000+ tests" (516 verified live).

### `docs/plans/2026-07-03-reliability-hardening.md`

Updated the status header from "Ready to implement" to "Implemented," listing the shipped artifacts (payload-matrix harness, `check:write-registration` gate, cron heartbeats, client-error telemetry, mobile E2E) — all verified present in the codebase.

### `docs/playbooks/reliability-hardening-playbook.md`

Added an "Implemented" status banner — the doc's forward-looking language previously read as an open proposal even though all 5 phases have shipped.

### `docs/tasks.md` — deleted

A Milestone-0 task checklist from 2026-02-12, 100% superseded by the current v2.17.0 product. User confirmed deletion.

## Checked — No Update Needed

- `docs/impact-v3/v4/v5.md` — correctly labeled historical/superseded
- `docs/design-system.md`, `docs/accepted-risks.md`, `docs/badge-verification.md`, all 8 ADRs — current
- Inline JSDoc in `apps/web/lib/impact/*`, `apps/web/lib/github/*` — already current, ahead of the architecture docs on #1004 prior to this update
- No new/removed env vars, feature flags, or API routes this cycle; no scoring-formula changes

## Flagged for Review

None — all edits trace to verified commit hashes, code line references, or live counts; no speculative or cosmetic changes.

## Notes

- **markdownlint**: the repo has no markdownlint config and existing files don't follow default rules (baseline error counts checked pre-edit: e.g. 416 pre-existing errors in `CHANGELOG.md` alone, unrelated to this pass). Not part of the project's CI gate. All edits match each file's existing conventions.
- `.github/workflows/security.yml` has an unrelated, pre-existing uncommitted change in the working tree — not touched by this pass.
- No `$LINT_CMD` (eslint) run needed — only Markdown/XML docs and one deletion changed; no application source was touched.
