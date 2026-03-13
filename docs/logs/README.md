# Agent Error & Success Logs

Systematic improvement framework for learning from agent sessions. Markdown in git — native to both humans and agents, with full history via git blame/search.

## Structure

```
docs/logs/
├── errors/        # What went wrong and how to prevent it
├── successes/     # What went right and how to reproduce it
└── README.md      # This file (index + instructions)
```

## Error Logs

File pattern: `YYYY-MM-DD-brief-description.md`

Five categories of errors (user skill, not model failures):

| Category | Examples |
|----------|----------|
| **Prompt Errors** | Ambiguous instructions, missing constraints, wrong abstraction level |
| **Context Errors** | Context rot, stale context, context overflow |
| **Harness Errors** | Wrong agent type, parallel when sequential needed, no guardrails |

### Template

```markdown
# Error: [Brief Description]

**Date:** YYYY-MM-DD
**Category:** Prompt / Context / Harness
**Severity:** High / Medium / Low

## What Happened
[Factual description of what went wrong]

## Primary Cause
[Root cause analysis — what specifically triggered the error]

## Exact Triggering Prompt
> [The prompt or instruction that led to the error]

## What Was Wrong
[Why the approach/prompt/context was incorrect]

## What Should Have Been Done
[The correct approach]

## Prevention
- [ ] [Specific action to prevent recurrence]
```

## Success Logs

File pattern: `YYYY-MM-DD-brief-description.md`

Log notably smooth completions to identify repeatable patterns.

### Template

```markdown
# Success: [Brief Description]

**Date:** YYYY-MM-DD
**Task Type:** Feature / Bug Fix / Refactor / Research

## What Happened
[What was accomplished]

## Why It Worked
- [Specific factor 1]
- [Specific factor 2]

## Exact Prompt
> [The prompt that initiated the task]

## Contributing Factors
[Context quality, tool choices, agent config, etc.]

## Reproducibility
[How to replicate this pattern for similar tasks]
```

## Lessons Index

<!-- Update this section as new logs are added -->

### Key Lessons
- **2026-03-13** — Bootstrap early + sync daily = zero adoption gaps at audit time.
