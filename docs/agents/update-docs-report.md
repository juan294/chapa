# Documentation Update Report

> Generated on 2026-04-27 | Branch: `chore/update-docs-v2.8.0` | Changes since `v2.7.2`

## Summary

- **3 documents updated** with content reflecting v2.8.0 work
- **1 diagram refreshed** (architecture diagram updated in-place)
- **0 version references corrected** in this pass (deferred to `/release`)
- **0 inline doc blocks updated** (recent additions documented themselves correctly when they were created)
- **0 items flagged `[NEEDS REVIEW]`**

## Changes by File

### `CLAUDE.md`

Added two bullets to **Caching rules**:

- **Supplemental EMU stats** persistence layer (#825): documents the new `supplemental_stats` Supabase table, the Redis-as-hot-path / Supabase-as-fallback pattern in `getStats()`, and the fire-and-forget Redis rehydration on DB hit.
- **Same-day refresh signal** (#826): documents the `stats:dirty:<handle>` Redis marker, how `materializeProfile` reads it, how `smoothScore` bypasses the same-day EMA lock when set, and how `runPublicProfileSideEffects` routes through `dbReplaceSnapshot` and clears the marker.

Added one acceptance criterion under **Quality dimension**:

- The cliff guard (#827): collaborative `computeQuality` returns `max(collaborativeFormula, soloFormula)` so users with strong solo signals don't drop sharply when crossing the 0.15 review-to-PR threshold.

### `docs/impact-v6.md`

Added a new subsection under **Score Recalculation** titled *"Same-day refresh after a CLI supplemental upload (#826)"*. It documents:

1. Why the supplemental-upload path differs from the `/api/recalculate` path (it does not call recalculate directly).
2. How `isStatsDirty()` is read in `materializeProfile` and threaded through as `inputsChanged`.
3. How `smoothScore`'s `bypassSameDayLock` switches from "return today's value verbatim" to "apply EMA against today's already-smoothed value" so the new score lands without breaking the feedback-loop guard.
4. How `runPublicProfileSideEffects` routes today's snapshot through `dbReplaceSnapshot`, bypasses the SETNX dedup guard, and clears the dirty marker after a successful write.
5. Why the existing same-day lock behavior is preserved when the marker is absent.

The cliff guard section (added in commit 3340092) was already present and correct from the #827 fix; no change.

### `docs/cli-guide.md`

Updated the **§6 Verifying it worked** section:

- Replaced "Your badge should update on the next refresh (within 24 hours, or force-refresh if available)" with "Your badge updates on the **next page render**" and explained the same-day refresh marker.
- Added a callout explaining that supplemental data is now persisted to Supabase, not Redis-only — a missed CLI day no longer drops EMU contributions silently.

### `docs/chapa-architecture.drawio`

Refreshed in-place to reflect v2.8.0 scoring changes:

- Expanded the **Data Layer** swimlane (height 120 → 270) to fit two new content blocks.
- Added a **Supabase tables** block listing all tables, with `supplemental_stats   ← new (#825)` highlighted.
- Added a **Redis keys** block listing all keys, with `stats:dirty:<handle>   ← new (#826)` highlighted.
- Updated the existing CLI → Impact Engine edge (e9) label to: *"POST /api/supplemental (EMU stats → Redis + Supabase)"*.
- Added a new CLI → Data Layer edge (e10) for the `stats:dirty:<handle>` signal that drives same-day refresh.
- Updated cell descriptions on the cache module (now mentions `dirty-stats`), impact module (mentions cliff guard), DB CRUD module (mentions `supplemental`), and platforms module (mentions supplemental merge).

Validated by re-exporting to PNG — XML is well-formed and the layout renders correctly. The `[NEEDS REVIEW]` flag has been removed.

## Out of scope (deferred to `/release`)

- `apps/web/package.json` version bump `2.7.2` → `2.8.0`
- `CHANGELOG.md`: rename `[Unreleased]` → `[2.8.0] - 2026-04-27` and append the comparison link anchor
- New CHANGELOG section content based on the change-analyst's categorized list

## Lint

`npx markdownlint` on the three changed markdown files reports **+9 line-length warnings** (MD013) on the lines I added — consistent with the existing one-bullet-per-line style throughout these files. No structural violations (MD022 / MD032) introduced. No reformat performed since MD013 is not enforced by the project's CI.

## Discovery agents

Four read-only agents informed this plan:

- **change-analyst**: 119 commits since v2.7.2, 401 files changed (+21,997/-9,283). Categorized into scoring (#825/#826/#827), security (#807/#806/#793/#689), reliability (#792/#794/#799), observability, UX, localization. Two new migrations (023, 024). No breaking changes, no removed routes.
- **doc-inventory**: catalogued ~30 user-facing markdown files, 51 plan files, 19 research files, 6 runbooks, 12+ agent-report files. Most don't need updates because they're either (a) historical artifacts (plans, research) or (b) auto-generated (agent reports). Inline JSDoc style: `@param`/`@returns`, file-level docblocks, formula explanations.
- **diagram-analyzer**: 4 diagrams found (1 DrawIO, 3 ASCII). The DrawIO architecture diagram has been refreshed in this pass (see above). ASCII diagrams in `impact-v6.md`, `README.md`, and `scheduled-agents-admin-panel.md` are current.
- **version-scanner**: authoritative version is `apps/web/package.json` (currently 2.7.2, target 2.8.0). All other version references are tool/CI pins and should not be touched. Cache version (`v2`) and HMAC payload version (`v2`) are intentionally pinned to schema versions, independent of app version.
