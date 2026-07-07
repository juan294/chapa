# Documentation Update Report

> Generated on 2026-07-07 | Branch: `docs/update-post-2.16.0` | Changes since `v2.16.0`

## Summary

- **4 documents updated** (`CHANGELOG.md`, `docs/impact-v6.md`, `CLAUDE.md`, `docs/how-it-works.md`)
- **1 diagram refreshed** (the scoring-pipeline ASCII data-flow in `docs/impact-v6.md`)
- **0 version references corrected** (v2.16.0 is current everywhere; nothing stale)
- **0 inline doc blocks updated** (the #1001/#1002 JSDoc was written as part of those fixes and is already current; refresh-not-expand scope excludes adding new JSDoc to `stats.ts`)
- **0 items flagged [NEEDS REVIEW]**

Discovery ran 4 parallel read-only agents (change-analyst, doc-inventory, diagram-analyzer, version-scanner). The delta since `v2.16.0` is 8 commits: two scoring fixes (#1001, #1002), one admin fix (#1003), a telemetry-coverage chore, and doc syncs. No routes, env vars, shared types, or public APIs changed.

## Changes by File

### `CHANGELOG.md`

Populated the empty `[Unreleased]` section with three `### Fixed` entries:

- **#1002** — Delivery score collapse from partial GitHub fetches (zero-PR guard).
- **#1001** — headline score now consistent with dimensions (fresh headline; EMA only for the trend snapshot).
- **#1003** — admin user search returning zero results (OR semantics restored).

### `docs/impact-v6.md`

- **Refreshed the Scoring Pipeline diagram** (was `ImpactV6Result → EMA smoothing → Badge/Share`). After #1001 the flow branches: `ImpactV6Result → Badge/Share/verification (FRESH headline)` and `ImpactV6Result → EMA smoothing → persisted trend snapshot + next-day EMA prior (sparkline only)`.
- Added a **"Display vs. trend smoothing (#1001)"** note explaining the fresh headline / smoothed-snapshot split and why it exists.
- Added a **"Degraded-fetch guard (#1002)"** note (token-scoped fetch → `prsMergedCount: 0` → served last-known-good).
- Corrected the Score Recalculation paragraph that claimed "EMA smoothing continues to apply for passive badge views" — the displayed headline is now always fresh; smoothing applies only to the trend snapshot.

### `CLAUDE.md`

Caching-rules section:

- Rewrote the **Same-day refresh signal** bullet: the dirty-marker/#826 bypass now governs the persisted trend snapshot, not what the user sees (headline is always fresh since #1001).
- Added a **Display vs. trend smoothing (#1001)** bullet (`displayImpact = rawImpact`; smoothing confined to the snapshot).
- Added a **Degraded-fetch protection (#1002)** bullet (`isDegradedPrFetch`, last-known-good served, `stats:stale` preserved, `github_degraded_pr_fetch` telemetry event, self-heals on authenticated fetch).

Route list and env-var list verified unchanged — not touched.

### `docs/how-it-works.md`

Added a concise **"Partial-fetch protection (#1002)"** blockquote after the EMU badge-request flow diagram, noting the primary GitHub fetch is guarded against degraded (zero-PR) results.

## Checked — No Update Needed

- `README.md`, `apps/web/app/llms.txt/route.ts`, `apps/web/app/llms-full.txt/route.ts` — grep confirmed **no** smoothed-headline or degraded-fetch references; nothing contradicts current content (removed from scope after verification).
- `docs/how-it-works.md` scoring narrative — does not describe the displayed score as smoothed (only trend/data-export mentions of "adjusted composite"), so no #1001 correction needed there.
- `docs/chapa-architecture.drawio` — #1002 reuses existing `stats:v2:*` / `stats:stale:*` nodes and the `lib/github/` client node; #1001 is below its component granularity. No change.
- Version references — `v2.16.0` current across `package.json`, `CHANGELOG` headers, and compare links. All other `v2.x`/`v6`/dependency/Node references are spec versions, dependency pins, CI matrix values, or historical entries (intentionally pinned).
- `docs/impact-v4.md`, `docs/impact-v5.md` — deprecated/superseded banners accurate.
- Inline JSDoc in `lib/impact/*`, `lib/github/*`, `lib/profile/*` — the #1001/#1002 comments were added with the fixes and are current.

## Flagged for Review

None.

## Notes

- **markdownlint**: the repo has no markdownlint config and does not follow default rules (existing files use long lines and heading/list spacing that default MD013/MD022/MD032/MD024 rules flag). markdownlint is not part of the project's CI gate. All edits deliberately match each file's existing conventions; reformatting whole files to satisfy the default ruleset was intentionally avoided (preserve voice and structure).
- No `$LINT_CMD` (eslint) run needed — only Markdown files changed; no source code was touched.
