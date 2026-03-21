Commit successful. Here's the sync report:

---

## cc-rpi sync: v1.9.0 → v1.10.0

**Synced to:** v1.10.0 (`7909f35`)
**Commit:** `cc2d191`

### Changes applied

**CLAUDE.md — 1 section added:**
- **Conditional Blocks for Context-Specific Rules** (new) — Rule #59: guidance on using `<important if="condition">` tags to wrap domain-specific CLAUDE.md sections so the agent only activates them when relevant. Placed before Agent Operational Rules.

**CLAUDE.md — 6 sections verified, no changes needed:**
- RPI Workflow (+ subsections) — already in sync
- Agent Operational Rules (+ subsections) — already in sync
- Push Accountability — already in sync
- TDD Protocol — already in sync
- Agent Autonomy — already in sync
- Memory Management — already in sync
- CRITICAL: Run verification commands sequentially — already in sync

**Commands:** No changes (templates/commands/ unchanged in v1.10.0)

**settings.json:** No changes (templates/settings.json.template unchanged in v1.10.0)

### Notable new content in v1.10.0
- **Rule #59** (conditional blocks) — new pattern for keeping CLAUDE.md lean as it grows
- **Skills authoring guide** — new methodology doc for creating `.claude/skills/`
- **Session stability improvements** — context engineering and on-demand hooks guidance
- Updated quick-reference with Rule #59
