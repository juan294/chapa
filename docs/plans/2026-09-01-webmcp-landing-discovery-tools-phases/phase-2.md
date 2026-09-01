# Phase 2: Docs delta for the landing catalog

Applies on top of the parent plan's Phase 4 docs output. Same writing
rules: no em-dashes, short plain sentences, no emojis.

## Files

- `docs/webmcp.md`
- `docs/webmcp-demo-script.md`

## Changes

### `docs/webmcp.md`

1. Add this input schema shorthand and use `HANDLE` in the landing catalog
   table's input column:
   `HANDLE`: `{"type":"object","properties":{"handle":{"type":"string"}},"required":["handle"],"additionalProperties":false}`.
2. Counts in the intro: 17 registrations across 16 names (the parent
   plan's values) becomes **19 registrations across 18 distinct names**
   (`explain_dimension` still the only shared name; landing 2, Studio 9,
   share page 6, verify 2).
3. New catalog table for the landing group (`/`):
   `get_site_capabilities` and `find_profile`, both `readOnlyHint` yes,
   with one-line behaviors. Note in the group intro that these tools
   orient and navigate only; they fetch no data, per the REST-wrap
   anti-pattern.
4. Design methodology section (created by the parent's Phase 4): add the
   landing block. User goal: discover what Chapa is and which page-scoped
   tools exist, then navigate. Initial state: any visitor, no auth, flag
   `webmcp_enabled`; the catalog is the site's front-door tool map.
5. Judge demo section: one sentence noting agents can start from the
   landing page via `get_site_capabilities` and follow its `demoStudio`
   entry point.

### `docs/webmcp-demo-script.md`

- Judge instructions: move the Chrome flag setup and relaunch to step 1.
  Add step 2: "Open `TODO_LIVE_URL/`. Call `get_site_capabilities` and
  follow its `demoStudio` entry point to `/studio?demo=1`." Put the
  existing `DEMO` marker and local-save checks next, after arrival in the
  demo Studio. Keep every remaining step in its current relative order and
  renumber it. Add no new `TODO_` placeholders.
- Do NOT touch the timed 0:00-2:50 video script.

## Success criteria

Automated:

- `pnpm run test` still green.
- `rg -n '17 browser-native|16 distinct' docs/webmcp.md` returns nothing.

Manual:

- The counts and names in `docs/webmcp.md` match `SITE_TOOL_MAP` exactly
  (copy from the merged Phase 1, do not re-type).
- The output of
  `rg -o 'TODO_[A-Z_]+' docs/webmcp-demo-script.md | sort | uniq -c` is
  identical before and after this phase.
