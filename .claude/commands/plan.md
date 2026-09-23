Create an implementation plan for: $ARGUMENTS

Model tier: **opus** — Opus session. All subagents: `model: "opus"`.

Process:
1. Read ALL mentioned files completely.
2. Spawn research subagents (Explore, model: `"opus"`) to find relevant code, patterns, and docs.
3. Read everything the subagents identify.
4. Present your understanding with focused questions — only ask what code can't answer.
5. After clarifications, spawn deeper research if needed.
6. Present design options with trade-offs.
7. Propose phase structure, get feedback.
8. Write detailed plan with separate phase files.
9. Use pseudocode notation for changes.
10. When the plan specifies behavior, prefer pointing at an executable or checkable
    artifact (a failing test, a module with the semantics to match, a mockup, a rubric)
    over describing the behavior in prose.
11. Separate automated vs. manual success criteria.
12. Add a **Stuck states and recovery** section. For every state the change can
    enter that fails closed, blocks work, or degrades output (a barrier, a lock,
    a fallback, a disabled path, a cached error), state:
    - who sees it (end user, owner, operator) and what they see;
    - how it ends without insider knowledge (automatic recovery, or a visible
      prompt that starts the fix);
    - the test that proves it ends or that the user is told.
    A safety test alone is not enough: each stuck state also needs a
    recovery-or-disclosure test. "Recovery requires a manual step" is only
    acceptable when the user is shown that step.
13. Add a **Consumer sweep** section. When the change alters what a shared
    function, type, cache format or fixture returns or stores (especially on
    failure), list every caller and writer found by grep, with the command used.
    Mark each one covered by a phase or explicitly excluded with a reason.
    Include test fixtures, E2E helpers and scripts that write the same data.
14. Identify batch-eligible phases: phases that are independent (no file overlap, no
    dependency on another phase's output) get marked `[batch-eligible]` in the plan.
    This tells `/implement` that `/batch` can execute them in parallel.
15. Maximum 3 [NEEDS CLARIFICATION] markers.
16. Iterate with user until all questions resolved.

Save to docs/plans/YYYY-MM-DD-[description].md
Phase files: docs/plans/YYYY-MM-DD-[description]-phases/phase-N.md

No unresolved questions in the final plan.
