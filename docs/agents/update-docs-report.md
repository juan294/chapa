# Documentation Update Report
> Generated on 2026-08-19 | Branch: `develop` | Changes since `v2.21.0`

## Summary
- 2 documents updated (`CLAUDE.md`, `CHANGELOG.md`)
- 0 diagrams refreshed (none exist in the repo — confirmed by diagram-analyzer)
- 0 version references corrected (none stale — a prior cycle already fixed the only two that existed)
- 0 inline doc blocks updated (no signature changes in this window that would stale existing JSDoc)
- 0 items flagged `[NEEDS REVIEW]`

## Baseline correction
The naive merge-base between `develop` HEAD and the `v2.21.0` tag (`51a830e`) was **not** the right diff boundary — `v2.21.0` lives on a divergent `main` history via squash-merge PRs, so that merge-base sits several releases further back than what actually shipped. The change-analyst agent found that commit `b59858b4` on `develop` is byte-identical to the `v2.21.0` tag content (`git diff b59858b4 dda3f060 --stat` is empty). The correct range is **`b59858b4..HEAD`**: 98 commits, 342 files, dated 2026-08-18/19 — an overnight remediation batch closing issues #1063–#1136.

## Changes by file

### `CLAUDE.md`
5 targeted additions to existing bullets (no new sections, no restructuring):
1. **Badge latency SLO (#974) bullet** — added the new materialize-deadline + background-continuation pattern (#1086: 2200ms `BADGE_MATERIALIZE_DEADLINE_MS`, stale-SVG fallback with `s-maxage=60`, `warmBadgeCacheInBackground`) and the four-outcome avatar cache tracking including the new permanently-absent short-TTL state (#1080/#1088).
2. **New bullet after the scoring-data integrity contract bullet** — documents the `readOnly` cold-key short-circuit (#1083) that stops public read endpoints from live-fetching GitHub past the 6h TTL, plus the concurrent-fetch optimizations in `_loadOverlays`/`_fetchAndCache` (#1093, #1087).
3. **Campaign send leases bullet** — extended with the new `group_token` (migration `033`) mechanism for recovered oversized lease groups (#1085).
4. **Acceptance criteria confidence-hidden-from-visitors bullet** — named the actual enforcement mechanism (`redactImpactForVisitor()`, #1067/#1122) now that it's a server-side payload guarantee, not just a UI convention.
5. **Data & types list** — added `PublicImpactV6Result`/`ClientImpactV6Result`.

### `CHANGELOG.md`
Populated the previously-empty `[Unreleased]` section with `### Fixed` (9 bullets: materialize deadline/fallback, avatar-absent caching, read-only cold-key fetch avoidance, campaign lease group recovery, Resend webhook dedup release, challenge email failure surfacing, fetch-retry network-error retry, OAuth error banner + `session_storage` code, a11y fixes) and `### Changed` (4 bullets: server-side confidence redaction, share page no longer ISR, generation-progress error UX, warm-cache time budget + SVG pre-warming), matching the file's existing Keep-a-Changelog style (bold lead sentence + explanatory paragraph, no per-bullet issue-number headers).

## Flagged for review
None. No diagrams exist to mark `[NEEDS REVIEW]`.

## Out-of-scope items surfaced during discovery (not fixed this cycle — didn't trace to a change in this release window)
- `docs/demo.md` — missing GitLab mention (GitLab support predates this window).
- `docs/spec.md` — possibly superseded by `README.md` + `docs/how-it-works.md`.
- `docs/badge-svg-spec-v1.2.md` — 5 months stale relative to badge render perf work, but that work predates this window too.
- `docs/scoring-explainer-video.md` — predates #1001/#1060/#1061 scoring corrections (also predate this window).
- `docs/health-report-2026-02-16.md` — a 6-month-old point-in-time report sitting in `docs/` root instead of `docs/agents/`.
- `docs/preparing-private-repo-for-public-release.md` — generic externally-sourced content, low Chapa-specific value.
- `docs/badge-embed-testing.md` — reads like a personal scratch note.
- `.claude/skills/` vs `.agents/skills/` divergence (`react-pdf` only in `.agents/`, `shell-tools` only in `.claude/`) — a tree-consistency question, not content staleness.

These were flagged by the doc-inventory agent as candidates for a future cleanup pass but don't trace back to an actual code change in `b59858b4..HEAD`, so per the "refresh, not expand, only what changed" scope rule they were left untouched.

## Lint status
Neither `CLAUDE.md` nor `CHANGELOG.md` has a markdownlint config in this repo, and no CI workflow runs markdownlint — both files were already far out of MD013/MD022/MD024/MD032 compliance before this change (556 pre-existing errors in `CHANGELOG.md`, 218 in `CLAUDE.md`, mostly long lines and duplicate `### Fixed`/`### Changed` headings across historical version sections — expected for a running changelog). The new content matches the existing (uncompliant) house style and introduces no new categories of lint error.
