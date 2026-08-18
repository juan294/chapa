# Documentation Update Report

> Generated on 2026-08-18 | Branch: `docs/update-docs-2026-08-18` | Changes since `v2.21.0`

## Summary

- **2 documents updated** (version-reference fixes)
- **1 architecture diagram refreshed** (native draw.io source and PNG export)
- **2 version-reference groups corrected**
- **0 inline doc blocks updated**
- **0 items flagged [NEEDS REVIEW]**

## Discovery

Four read-only discovery agents (change-analyst, doc-inventory, diagram-analyzer,
version-scanner) audited the project since the last release tag, `v2.21.0`
(tagged 2026-08-12 at `dda3f060` on `main`). Because releases are squash-merged
from `develop` to `main`, that tag is not an ancestor of `develop`; commit
`b59858b4` has the same tree as the release and is the accurate content
boundary.

The delta since `b59858b4` is 3 commits / 11 files, entirely triage/agent-report
housekeeping (`docs/agents/*`, `.claude/cc-rpi-sync.json`, one
`docs/accepted-risks.md` addition) — **zero application code changed**. None
of that delta needed documentation changes; the `accepted-risks.md` addition
already is its own complete documentation.

The actual findings below are pre-existing drift the discovery agents caught
during a general freshness check, unrelated to this specific delta.

## Changes by File

### `quality/evidence/README.md`

- Updated the example `--baseline-tag` in the `release:prepare-run` usage
  snippet from `v2.19.1` to `v2.21.0` (line 12) — the example had drifted two
  releases behind the actual latest tag.

### `docs/playbooks/e2e-pro-release-verification.md`

- Updated the example `"baselineTag"` value in the evidence-manifest JSON
  sample from `"v2.19.1"` to `"v2.21.0"` (line 688) — same stale-example
  pattern as above, same doc family.

### `docs/chapa-architecture.drawio`

Five corrections to bring the diagram in line with shipped changes:

1. **OAuth State node** — was labeled "Redis-backed CSRF"; the actual
   implementation (#1027) stores the CSRF nonce in a per-platform cookie
   (`chapa_<provider>_oauth_state_store`), not a shared Redis key. Relabeled
   to "Per-platform cookie CSRF".
2. **Supabase views** — the Supabase node listed only the 11 tables; added
   the 2 views (`admin_users`, `latest_snapshots`) that CLAUDE.md documents
   alongside them.
3. **i18n module box** — predated #1023's static-rendering migration; added
   mention of `proxy.ts` (Next.js 16 root proxy rewrite) and the 9
   statically-rendered `app/[locale]/*` content pages.
4. **Public Endpoints bucket** — was missing `/api/history/:handle` (score
   history/trend/diff); added alongside `/api/profile`, `/api/version`, and
   the badge route.
5. **Redis key list** — `stats:stale:*` corrected to `stats:stale:v2:<handle>`
   (actual key prefix); the now-nonexistent `oauthstate:*` key (removed by
   #1027's cookie-based CSRF) replaced with the real `svg:badge:*` pattern,
   which was previously missing from the diagram entirely.

### `docs/chapa-architecture.drawio.png`

- Re-exported the updated architecture at 1244×1211 with embedded draw.io XML
  (`/Applications/draw.io.app` CLI, `-e -b 10`).
- Visually inspected the export for legibility and clipping — all text
  renders cleanly, no overlap, no truncation.

## Verification

- `npx markdownlint quality/evidence/README.md`: **0 errors** (clean file).
- `npx markdownlint docs/playbooks/e2e-pro-release-verification.md`: line 688
  (the edited line) has **0 errors**. The file as a whole carries pre-existing
  MD013 (line-length) and MD060 (table-pipe-style) violations scattered
  throughout — matching the documented precedent from the prior
  (2026-08-10) update-docs cycle, where this same broad-command failure was
  noted as pre-existing and unrelated to that update. No markdownlint config
  is checked into the repo, so these rules aren't part of this project's
  actual lint gate (`pnpm run lint` is ESLint-only).
- `pnpm run lint` (`eslint .`, both `packages/shared` and `apps/web`): **PASS**.
- `git diff --check`: **PASS** (no whitespace errors).
- Draw.io XML well-formedness (parsed via `xml.etree.ElementTree`), unique
  `mxCell` IDs (checked via sort/uniq), embedded PNG source, and visual
  inspection: **PASS**.

## Flagged for Review

None.

## Notes

- The frontend swimlane's 5-box simplification (Landing/Share/Studio/
  About+Archetypes/Admin) omits several real pages (`/verify/:hash`,
  `/generating/:handle`, `/cli/authorize`, `/privacy`, `/terms`,
  `/coming-soon`, `/experiments/*`). This was flagged by diagram-analyzer for
  awareness only — it reads as an intentional level-of-abstraction choice
  (the swimlane is a "page category" overview, not an exhaustive route map)
  rather than drift, so it was left as-is. Revisit if the diagram's intended
  scope changes.
- `apps/web/package.json`'s version, `CHANGELOG.md`'s latest entry, README.md
  badges, and CI workflow Node-version pins were all confirmed current
  against `v2.21.0` — no changes needed there.
- `docs/design-system.md`, `docs/impact-v6.md`, `docs/svg-design.md`,
  `docs/accepted-risks.md`, and the most recent ADR were all confirmed
  current against the live codebase by doc-inventory — no changes needed.
