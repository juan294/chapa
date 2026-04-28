---
phase: 11F
release: v2.11.0
issues: ["#783"]
batch_eligible: true
effort: XS
---

# Phase 11F — Close `#783` as by-design

## Goal

`#783` proposes adding an "escape hatch" from the terminal metaphor for
non-developer visitors to the landing page. Per user direction, the
terminal aesthetic IS the brand — it is intentionally polarizing and
serves the audience the product targets (developers).

Close the issue with a comment explaining the decision. No code change.

## Pseudocode

```bash
gh issue close 783 --comment "Closing as by-design.

The terminal-first landing page is the brand identity — it is the most
distinctive visual element of Chapa and a deliberate signal to the
audience the product serves (developers). A 'simple mode' toggle would
dilute that signal.

If we discover that non-developer adoption is materially higher than
expected and the metaphor is blocking sign-ups, we will revisit. Until
then, this is intentional design.

See @docs/design-system.md for the broader brand identity rationale."
```

## Files

(none)

## Acceptance criteria

### Automated
- [ ] `gh issue view 783` shows state CLOSED with the by-design comment
- [ ] Nothing else changes

### Manual
- N/A
