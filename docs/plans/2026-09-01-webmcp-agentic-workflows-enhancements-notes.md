# WebMCP Agentic-Workflows Enhancements: Implementation Deviations

## Deviations

### Recovery rule

- Plan said: State that every error message names an agent-callable next step.
- Found: Some terminal responses have no agent-callable recovery. A missing verification record is one example. A saved configuration already satisfies the goal and needs no recovery. The broad invalid-input wording also covered tools that this enhancement did not change.
- Chose: Describe only the new `apply_badge_style` invalid-input recovery, the two wrong-state save responses, and the new `compare_profiles` 404 recovery.
- Why: This matches the shipped tool behavior and avoids a false catalog claim.

### Timed demo interruption

- Plan said: Keep the timed 0:00-2:50 script unchanged.
- Found: The interruption used the retired `celebration` category and asked for confetti to be disabled. An earlier beat also used the retired phrase "spring stats" for the removed `statsDisplay` category.
- Chose: Keep the same timing and replace the first phrase with "spinning border and shimmering score". Replace the later call with `heatmapAnimation` set to `fade-in`.
- Why: The Maximum preset starts with `scatter`, so the replacement remains a visible live change without adding a new beat.

### Creator Studio summaries

- Plan said: Add only the methodology link to the README and leave other product summaries unchanged.
- Found: The README claimed nine categories and said saved settings do not affect the public badge. The agent-facing `llms-full.txt` summary listed only six categories and omitted color palette.
- Chose: Correct the README to seven categories and the post-#1191 saved-config behavior. Correct `llms-full.txt` to seven categories and include color palette.
- Why: Both summaries now match the shipped seven-category badge configuration and its public render path.
