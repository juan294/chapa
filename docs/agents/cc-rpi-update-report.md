## cc-rpi sync report — 2026-03-24

**Blueprint version:** v1.10.0 (`4df170e`)
**Previous sync:** 2026-03-21 (`7909f35`)
**Blueprint commits since last sync:** 1

### Changes applied

| Area | Status |
|------|--------|
| Slash commands | No changes (no template updates) |
| CLAUDE.md sections | No changes (no template updates) |
| settings.json | No changes (no template updates) |
| Sync metadata | Updated (`cc-rpi-sync.json`) |

### New knowledge internalized

The single new commit (`4df170e`) adds git conflict resolution patterns:

- **Error #54**: `git checkout --` fails on unmerged (conflicted) files — must use `--ours`/`--theirs` or abort the merge/rebase
- **Error #55**: `git merge` blocked by untracked working tree files — common in multi-agent workflows where main repo and worktree agents create files at the same paths; remove untracked copies before merging
- **Rule #60**: Use `--ours`/`--theirs` or abort for conflict resolution, never plain `git checkout --`
- **Rule #61**: Remove conflicting untracked files before `git merge` in multi-agent workflows

**Commit:** `93ece45` — `chore: sync with cc-rpi blueprint v1.10.0`
