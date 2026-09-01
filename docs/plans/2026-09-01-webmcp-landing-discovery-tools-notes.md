# WebMCP Landing Discovery Tools: Implementation Deviations

## Deviations

### Judge instruction ordering

- Plan said: Insert landing discovery before the current first judge step.
- Found: The current first step opens the demo Studio, while the second step enables WebMCP and relaunches Chrome. Landing discovery cannot call `get_site_capabilities` before WebMCP is enabled.
- Chose: Move Chrome setup to step 1. Put landing discovery in step 2, then run the existing demo Studio checks after arrival. Keep all remaining steps in their current relative order.
- Why: The judge must enable WebMCP before discovering or calling a WebMCP tool.

### Placeholder verification

- Plan said: Keep the line-numbered `rg -n` output unchanged while inserting judge instructions.
- Found: Inserting lines necessarily changes the line numbers in that output.
- Chose: Compare `rg -o 'TODO_[A-Z_]+' docs/webmcp-demo-script.md | sort | uniq -c` before and after the phase.
- Why: The placeholder names and counts are the invariant. Their line numbers are not.

### Landing handle schema shorthand

- Plan said: Add `find_profile` to the catalog table without defining its input shorthand.
- Found: The table uses named schema shorthands, and none represents the required `handle` property.
- Chose: Add the approved `HANDLE` schema shorthand and use it for `find_profile`.
- Why: This keeps the landing catalog precise and consistent with the existing table convention.
