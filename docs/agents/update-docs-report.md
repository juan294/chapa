# Documentation Update Report

> Generated on 2026-03-23 | Branch: `develop` | Changes since v2.1.0 (17 commits)

## Summary
- 7 documents updated
- 0 diagrams refreshed (1 flagged `[NEEDS REVIEW]`)
- 2 version/spec references corrected
- 0 inline doc blocks updated (refresh only — no expansion)
- 1 item flagged `[NEEDS REVIEW]`

## Changes by File

| File | What Changed | Why |
|------|-------------|-----|
| `CLAUDE.md` | Added `POST /api/admin/campaigns/:id/test` route | Missing from route listing |
| `CLAUDE.local.md:235` | "Impact v4" → "Impact v6" | Stale scoring version reference |
| `docs/spec.md:82` | `docs/impact-v4.md` → `docs/impact-v6.md` | Stale spec reference |
| `README.md:145` | Test counts "337+ files, 5,760+" → "345+ files, 5,720+" | Updated to match current state |
| `CHANGELOG.md` | Added `[Unreleased]` section with 17 post-v2.1.0 commits | New features, fixes, refactors not yet tracked |
| `docs/badge-design-v1.md:4` | `badge-svg-spec-v1.0.md` → `badge-svg-spec-v1.2.md` | Broken cross-reference |
| `docs/badge-svg-spec-v1.2.md:405` | Added `[NEEDS REVIEW]` comment above radar diagram | Diamond-only diagram; pentagon variant undocumented |

## Flagged for Review

1. **`docs/badge-svg-spec-v1.2.md:405`** — The radar chart ASCII diagram shows only the 4-axis diamond layout. When the Craft dimension is present, the badge renders a 5-axis pentagon. The diagram and surrounding spec text (section 5b "Axes (4-point diamond)") should be expanded to document both variants. This requires understanding the exact pentagon geometry from the renderer code.

## Items Verified Current (No Update Needed)
- `docs/impact-v6.md` — unchanged, still current spec
- `docs/how-it-works.md` — updated in v2.1.0 pass, still accurate
- `docs/scoring-explainer-video.md` — new since v2.1.0, already current
- `docs/design-system.md` — `--color-complement` and `animate-hex-cell-in` already documented
- `docs/accepted-risks.md` — reviewed, current
- All agent reports — freshly generated today
