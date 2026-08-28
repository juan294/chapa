# Documentation Update Report

> Generated on 2026-08-28 | Branch: `chore/update-docs-post-v2.24.0` | Changes since `v2.24.0`

## Summary

- 4 documentation files updated
- 0 diagrams refreshed (none of the 12 real commits touch a system any living diagram depicts)
- 2 version/changelog references corrected
- 0 inline JSDoc/docstring blocks updated (no signature changes in this cycle)
- 0 items flagged `[NEEDS REVIEW]`
- 2 additional pre-existing staleness fixes made at user request (not caused by this release's changes)

## Release boundary

`v2.24.0` is a squash-merge commit on `main`. `git log v2.24.0..HEAD` returns
613 entries, but almost all of that is pre-existing `develop` history never
linearly descended from the squash commit — not new work. The true new work
is `git log e58e0101..HEAD` (`e58e0101` = "chore: back-merge main into
develop — reconcile v2.24.0 squash divergence"): **12 commits, 23 files
changed**. Verified via `git diff v2.24.0..HEAD --stat`.

All 12 commits are release-process/infrastructure tooling — nothing touches
scoring, badge rendering, OAuth, or any documented route/API/caching
behavior.

## Changes by file

### `CHANGELOG.md`
- Added an `[Unreleased]` section (previously empty despite the 12 merged
  commits) covering:
  - **Fixed**: EMU handle exclusion from the warm-cache user registry
    (#1199); push-guard hook false-positive on compound commands
  - **Changed**: release playbook's 6-gate → 2-gate collapse; 4 of 6 manual
    release QA obligations automated
  - **Added**: `.github/workflows/auto-backmerge.yml`;
    `scripts/recalculate-handles.ts`
- Fixed the `[Unreleased]` compare link (was still based on
  `v2.23.0...HEAD`; now `v2.24.0...HEAD`) and added the missing `[2.24.0]`
  compare-link entry, matching the existing chain's pattern.

### `CLAUDE.md`
- **Caching rules**: added a line documenting that `dbUpsertUser`/
  `dbGetAllUserHandles` now reject EMU-shaped handles via `isValidHandle`
  (#1199) — verified directly against the commit diff, not just the
  discovery agent's summary.
- **Caching rules**: added a mention of `scripts/recalculate-handles.ts`
  alongside the existing `heal-poisoned-stats` reference, following this
  file's established convention of naming maintenance scripts inline where
  relevant.
- **Git Workflow**: added a note on `.github/workflows/auto-backmerge.yml`
  under the squash-merge-to-`main` step, since it changes the git-ancestry
  model between `develop` and `main` after every release — verified against
  the actual workflow file, not just the discovery agent's summary.

### `docs/spec.md` (pre-existing staleness, not part of this release's changes)
- Corrected the Creator Studio config description: it previously said
  Supabase is the source of truth "with Redis as a cached payload layer"
  (#935/migration 027). That Redis mirror was fully removed in #1186/BE-L1 —
  CLAUDE.md already documents Supabase as the only store. This doc had not
  been updated to match and was flagged by the doc-inventory discovery agent
  as a live contradiction.

### `docs/how-it-works.md` (pre-existing staleness, not part of this release's changes)
- The CLI/badge-merge ASCII sequence diagram's step 5 said supplemental
  stats are stored in "Redis (24h)" only. Corrected the diagram to say
  Supabase (the durable store) and added a callout paragraph after the
  diagram — matching the existing "Partial-fetch protection" /
  "Scoring-data integrity contract" callout style — explaining the full
  Supabase-durable / Redis-hot-path model, consistent with CLAUDE.md's
  caching-rules section.

## Diagrams

No diagram updates were needed. `diagram-analyzer` inventoried every diagram
in living documentation (`docs/chapa-architecture.drawio`,
`docs/impact-v6.md`, `docs/webmcp.md`, `docs/badge-svg-spec-v1.2.md`,
`docs/badge-design-v1.md`, `docs/how-it-works.md`, `docs/scheduled-agents-admin-panel.md`,
`docs/email-forwarding-setup.md`, `docs/decisions/2026-06-20-package-extraction-roadmap.md`,
`docs/logs/README.md`, `README.md`) and confirmed CLAUDE.md, the design
system doc, all ADRs, all playbooks, and all runbooks contain no diagrams at
all. None of the found diagrams depict release process, the warm-cache
registry, the auto-backmerge mechanism, or push-guard hooks — the only
things that changed this cycle.

An initial pass by the diagram-analyzer discovery agent over-scoped into
`docs/plans/**` (153 historical planning files) and `docs/research/**`,
which are point-in-time snapshots excluded from this refresh by the same
convention applied to `docs/agents/*-report.md`. That sweep was stopped
mid-flight once noticed and excluded from this report.

## Flagged for review

None from the 12-commit change set itself.

Two items surfaced by the doc-inventory discovery agent were **not** caused
by this release's changes and are left as-is (not part of this pass beyond
the two fixed above):
- `docs/impact-v3.md` is self-labeled deprecated but not listed among
  CLAUDE.md's required historical docs (v4/v5/v6 + svg-design.md) — low
  risk, self-documenting.
- `docs/runbooks/secret-rotation.md` / `docs/runbooks/observability.md`
  were flagged as worth checking against `docs/accepted-risks.md`'s
  2026-08-18 "no new gates/monitoring infra" policy — not verified this
  cycle, no evidence of an actual contradiction found.

## Verification

- `git diff v2.24.0..HEAD --stat` confirmed the true change scope (23
  files) before drafting any update.
- The EMU-handle-exclusion fix (#1199) and the auto-backmerge workflow were
  each independently re-verified by reading the actual commit diff / workflow
  file, not taken solely from the discovery agent's summary.
- `npx markdownlint` was evaluated and found not applicable — this repo has
  no `.markdownlint` config, no `markdownlint` script in `package.json`, and
  no CI reference to it. Running it ad hoc against `CHANGELOG.md` produces
  hundreds of pre-existing false positives (`MD024` on the standard
  "repeated `### Added`/`### Fixed` per version" Keep-a-Changelog format,
  `MD013` line-length on prose that predates this change) — not a real
  signal for this repo's conventions, so it was not used as a gate.

## Next steps

- Recommend running `/release` next if a new version is being prepared —
  none of these doc changes require a version bump on their own.
- No items are flagged `[NEEDS REVIEW]`.
- Mention: `/pre-launch` catches issues `/update-docs` does not (security,
  performance, accessibility).
