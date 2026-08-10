# Documentation Update Report

> Generated on 2026-08-10 | Branch: `develop` | Changes since `v2.19.1`

## Summary

- **7 documents updated**
- **1 architecture diagram refreshed** (native draw.io source and PNG export)
- **3 version-reference groups corrected**
- **0 inline doc blocks updated**
- **0 items flagged [NEEDS REVIEW]**

## Discovery

Four read-only discovery roles audited changes since the released `v2.19.1`
tree: change analysis, documentation inventory, diagram analysis, and version
scanning. Because `v2.19.1` was squash-merged to `main`, the tag is not an
ancestor of `develop`; reconciliation commit `8f4591e3` has the same tree as
the release and is the accurate content boundary.

The unreleased delta contains 21 commits across 152 files. The documentation-
relevant changes are exact-SHA E2E Pro release verification, `/api/version`,
atomic campaign delivery retries and acknowledgements, GitHub-stat visibility
and cache corrections, overlap-safe server jobs, dependency security floors,
and cc-rpi v1.28.2 workflow synchronization. SEO work remains research and
planning only.

## Changes by File

### `CHANGELOG.md`

- Refreshed the existing prepared v2.20.0 release section; no release was
  published or tagged.
- Added atomic campaign retry/acknowledgement, server-job overlap safety,
  GitHub-stat visibility/cache integrity, and dependency security fixes.
- Corrected the `[Unreleased]` comparison base to `v2.19.1` and restored the
  missing v2.18.0 through v2.19.1 comparison references.

### `README.md`

- Refreshed the verified test totals to 8,688 tests across 513 files.
- Added the no-store `/api/version` deployment-identity endpoint.

### `CLAUDE.md`

- Documented the campaign invariant: stable lease-bound batch membership,
  retry-stable provider identity, complete transactional acknowledgement, and
  fail-closed handling of incomplete persistence.

### `CONTRIBUTING.md`

- Aligned the dependency-license policy with the enforced permissive allowlist
  and documented-exception requirement.

### `LICENSE-THIRD-PARTY.md`

- Aligned the inventory introduction and review policy with the same license
  allowlist and package-specific exception workflow.

### `docs/accepted-risks.md`

- Replaced the obsolete one-route admin description with the current dashboard
  and 12-route-module surface, including campaign mutations.
- Updated the future centralized-guard wording for Next.js `proxy.ts`.
- Removed stale, abbreviated allowlist wording from dependency-risk entries.

### `quality/evidence/README.md`

- Updated the concrete release-evidence baseline example from `v2.19.0` to
  `v2.19.1`.

### `docs/chapa-architecture.drawio`

- Added `/api/version` to public endpoints.
- Added durable Creator Studio configuration and the `studio_configs` table.
- Replaced the old lease-only campaign label with atomic claim, full-batch
  acknowledgement, and stable retry identity.
- Removed obsolete “new” annotations from Supabase and Redis inventory items.

### `docs/chapa-architecture.drawio.png`

- Re-exported the updated architecture at 1244 x 1211 with embedded draw.io XML.
- Visually inspected the export for legibility and clipping.

## Verification

- `pnpm run lint`: **PASS** for all workspace projects.
- `git diff --check`: **PASS**.
- Draw.io XML well-formedness, unique IDs, edge geometry, embedded PNG source,
  and visual inspection: **PASS**.
- `quality/evidence/README.md` Markdown lint: **PASS**.
- Strict Markdown violations across the edited Markdown baseline decreased from
  924 to 919; no edited file gained a new violation.
- The workflow's broad Markdown command did not pass. Its root-only
  `--ignore node_modules` argument traversed nested workspace `node_modules`
  and `node_modules.nosync` trees, and tracked historical documents already
  contain default-rule violations such as long lines and repeated changelog
  headings. These failures predate this update.
- `scripts/verify-counts.sh`, `scripts/verify-version.sh`,
  `scripts/verify-skills.sh`, and `scripts/check-tree-drift.sh` are referenced
  by the generic workflow but do not exist in this repository.

## Flagged for Review

None.

## Notes

- `apps/web/package.json` remains at the prepared `2.20.0` candidate version.
  No version bump, tag, publication, push, or deployment was performed.
- Run `/release` next if v2.20.0 is ready to enter the release workflow.
- `/pre-launch` covers security, performance, and accessibility checks that
  `/update-docs` does not.
