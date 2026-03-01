# cc-rpi Sync Report — 2026-03-01

**Blueprint version:** v1.3.0 (`23c0b72`)
**Previous sync:** v1.2.1 (`25ec671`) on 2026-02-25
**Commit:** `2042cf0`

## Blueprint Changes (7 commits since last sync)

- `23c0b72` release: v1.3.0 — /simplify and /batch integration
- `4454ad8` docs: add post-adoption /pre-launch recommendation to /adopt command
- `0c77adc` docs: add errors #39-#43 — gh deprecation, venv bypass, Python escaping, module imports, JSON indexing
- `c4abb20` feat: integrate /simplify and /batch into RPI workflow
- `4f3c1d6` fix: quote $(whoami) in shell templates to pass shellcheck SC2046
- `4866803` fix: launchd plist must use bash -c exec wrapper (error #37/#38)
- `a3b3e34` docs: add errors #32-#36 — merge policy, unstaged rebase, 403 retry, pending checks, mega one-liners

## Commands Updated

| Command | Change |
|---------|--------|
| `/implement` | Added `/batch` eligibility check (step 4), `/simplify` code quality pass (step 5e), reviewer now focused on plan compliance |
| `/plan` | Added batch-eligible phase identification (step 11), renumbered steps 12-13 |
| `/pre-launch` | Added "After the Audit" section recommending `/simplify` for code quality findings |
| `/validate` | Added step 5: recommend `/simplify` for code quality issues |

## CLAUDE.md Sections Updated

| Section | Change |
|---------|--------|
| Rules for Implementation | Expanded atomic loop with `/simplify` and plan compliance annotations; added `/batch` eligible phase check |

## settings.json

No changes needed — project permissions are a superset of the template.

## Notable New Content in Blueprint

- **New error patterns (#32-#43):** merge policy checks, unstaged rebase failures, 403 retry strategy, pending CI check detection, mega one-liner avoidance, gh CLI deprecation, venv bypass, Python escaping, module imports, JSON indexing
- **`/simplify` integration:** New native skill that spawns 3 specialized agents (code reuse, code quality, efficiency) — now woven into `/implement`, `/validate`, and `/pre-launch`
- **`/batch` integration:** New parallel execution mode for independent plan phases — one worktree per phase, each opens a PR
- **launchd fixes:** ProgramArguments must use `/bin/bash -c exec` wrapper (errors #37/#38)
