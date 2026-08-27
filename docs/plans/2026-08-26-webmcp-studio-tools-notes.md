# WebMCP studio tools — implementation deviations

## Deviations

### Phase 0 — Chrome execution proof

- Plan said: install Model Context Tool Inspector and use it to list and execute
  `chapa_hello` in flagged Chrome.
- Found: the Chrome Web Store blocks scripted browser control, while flagged
  Chrome exposes the native `getTools()` and `executeTool()` testing interfaces
  to the page's main world.
- Chose: add a preview-only, production-404 main-world execution probe and use it
  to discover and execute `chapa_hello`.
- Why: it proves the same provider registration, discovery, schema, and execution
  path without requiring Juan to perform another manual step. The probe and its
  route remain inaccessible in production.

### Phase 1 — migration sequence

- Plan said: create `035_seed_webmcp_flags.sql` because migration `034` was the
  highest migration during planning.
- Found: current `origin/develop` already contains
  `035_version_studio_config_cache.sql`.
- Chose: create `036_seed_webmcp_flags.sql`.
- Why: migration identifiers must remain unique and ordered; reusing `035` would
  make application order ambiguous and fail migration validation. Juan approved
  this deviation on 2026-08-27.
