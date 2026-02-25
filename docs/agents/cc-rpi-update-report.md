# cc-rpi Update Report
> Generated: 2026-02-25 | Blueprint: v1.2.0 → v1.2.1 | Commit: `25ec671`

## Summary

Synced from cc-rpi v1.2.0 to v1.2.1. **No project file changes required** — all updates were to blueprint-internal files (patterns, CI, README).

## Blueprint Changes Since Last Sync (7 commits)

| Commit | Description |
|--------|-------------|
| `25ec671` | fix: don't default to open-source license badge in templates |
| `c8efd94` | docs: add CI status badge to README |
| `6bc51d1` | fix: skip fenced code blocks in CI link checker |
| `f8a72c3` | docs: add errors #30-#31, expand #1 scope to all tool types |
| `3274424` | docs: add errors #28-#29 — linter auto-fix and uv Python version |
| `30ab298` | docs: add errors #26-#27 and expand #25 with git push variant |
| `30fb65b` | release: add v1.2.1 version badge to README |

## Changed Blueprint Files

- `patterns/agent-errors.md` — 6 new error patterns (#26-#31)
- `patterns/quick-reference.md` — 6 new rules (#26-#31), Error #1 expanded to all tool types
- `.github/workflows/validate.yml` — CI link checker fix
- `README.md` — version badge
- `templates/README-header.md` — license badge fix
- `templates/setup-checklist.md` — setup checklist update

## Project File Status

| Area | Status | Details |
|------|--------|---------|
| Slash commands (6) | No changes needed | All 6 match blueprint templates |
| CLAUDE.md blueprint sections (7) | No changes needed | All match template |
| settings.json | No changes needed | Has all template entries + project additions |
| Sync metadata | Updated | v1.2.0 → v1.2.1 |

## New Knowledge Internalized

New error patterns added to the blueprint (not requiring project file changes, but useful for agents):

- **#26**: Don't build complex regex pipelines in shell — use dedicated tools
- **#27**: Only pass correct file types to linters — don't fight intentional patterns
- **#28**: Use `--fix` for auto-fixable linter issues — don't manually edit
- **#29**: Specify Python version for `uv sync` — system default may be too new
- **#30**: Always `git push -u` before `gh pr create`
- **#31**: Don't guess CLI flags on unfamiliar tools — run `--help` first
- **#1 expanded**: Sibling tool call error now documents all tool types (Bash, TaskOutput, Read), not just Bash
