# cc-rpi Update Report
> 2026-04-18 | Synced to v1.17.1 (d68bf69)

## Status: SYNCED

Previous version: v1.16.0 (5e1fae2)
New version: v1.17.1 (d68bf69)
Commits: 4 (v1.17.0 + v1.17.1 alignment fix)

## Changes Applied

### Commands Updated
- `fix-ci.md` — Last rule updated: branch verification now says "Normal CI repair happens on the branch under test. Never push directly to a protected production branch without explicit approval."
- `implement.md` — Step 4 updated: "integration branch" replaces "main" for generality
- `remediate.md` — Step 1/Step 4: "documented integration branch" replaces "documented default branch"

### Skills Updated
- `ci-workflow/SKILL.md` — Push Accountability section now uses generic `<branch-under-test>` instead of hardcoded `develop`; added introductory note about topology-aware branch selection
- `deployment-safety/SKILL.md` — "Merging to Main" and "Dependency Batching" sections now include both develop/main and main-only topology examples
- `error-patterns/SKILL.md` — Full catalog count updated from 62 to 63 errors

### Rules Updated
- `deployment-safety.md` — Body updated to generic language: "protected production branch" replaces hardcoded `main`; Dependabot guidance is now topology-agnostic; frontmatter paths preserved
- `rpi-details.md` — "integration branch" replaces "default branch"; "temporary branches" replaces "feature branches"

### AGENTS.md Updated
- `/simplify` translation: now mentions `codex-simplify` as primary option
- New "Codex-Only Skills" section added (after Claude-to-Codex Translation)
- Skills section: added "Personal Codex-only skills" closing paragraph
- Verification and Git: added branch topology bullet

### Hook Updated
- `.claude/hooks/guard-bash.sh` — Error #48 message updated to generic "push to a non-production branch" with both topology examples (develop and feature branch)

### Settings
- No changes needed — project settings.json is already a superset of template

### CLAUDE.md
- No changes needed — managed sections (RPI Workflow, Agent Behavior, Project File Locations) match template

## Commit
`53ab75e` — chore: sync with cc-rpi blueprint v1.17.1
