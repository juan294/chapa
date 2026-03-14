Commit succeeded. All pre-commit checks passed (typecheck, lint, tests).

## cc-rpi sync: updated to v1.6.0

**Blueprint version:** v1.6.0 (`f39ba4c`)
**Previous version:** v1.5.0 (`7add6d5`)

### Changes applied

**CLAUDE.md** — 1 section updated:
- Replaced `## Research Documents` + `## Implementation Plans` (6 lines) with new `## Project File Locations` table (10 lines)
- The new table provides direct paths for agent reports, logs, scripts, ADRs, PR descriptions, research docs, and plans — eliminating the need to search the codebase for these locations

**Sync metadata** — `.claude/cc-rpi-sync.json` updated to v1.6.0

### No changes needed
- Slash commands: unchanged since v1.5.0
- `.claude/settings.json`: unchanged since v1.5.0

### Notable new content
- **Project File Locations table** — a quick-reference lookup for common project paths, designed so agents go directly to files instead of searching. All 7 listed paths exist in this project.
