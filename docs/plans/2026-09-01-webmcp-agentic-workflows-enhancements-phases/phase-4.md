# Phase 4: Documentation — methodology section, catalog, judge instructions

Enhancement #1. Runs last: it documents the final catalog produced by
Phases 2 and 3. Docs prose follows the writing rules: no em-dashes, short
plain sentences, no emojis.

Status: Complete.

## Files

- `docs/webmcp.md`
- `docs/webmcp-demo-script.md`
- `README.md`
- `apps/web/app/llms-full.txt/route.ts`
- `apps/web/app/llms-full.txt/route.test.ts`

## Changes

### `docs/webmcp.md`

1. Counts in the intro (line 3): 16 registrations across 15 names becomes
   **17 registrations across 16 distinct names** (`explain_dimension` still
   shared).
2. Public profile table: add the `get_embed_snippet` row (input `EMPTY`,
   `readOnlyHint` yes, behavior: returns the page's canonical Markdown and
   HTML embed snippets for the badge).
3. Registration section (line 101): update the telemetry sentence. Tool
   calls emit `webmcp_tool_called` once at settle time with
   `outcome: ok | invalid_input | error` and `durationMs`; thrown errors
   also emit the bounded `client_error` event.
4. New section, **Design methodology**, placed after the tool catalog and
   before "Three drivers, one Studio state". Content:
   - One paragraph naming the framework and citing the Chrome article
     "Build your user's agentic workflows with WebMCP tools" (2026-08-26)
     and `docs/webmcp-demo-script.md` as the role-play artifact.
   - Per tool group (Studio, public profile, verification page), a compact
     block with: **User goal** (one sentence), **Initial state** (page,
     auth, flags, seeded fixtures for demo), **Role-play** (link to the
     matching demo-script segment).
     - Studio goal: co-design the badge and propose a save the human
       confirms. Initial state: `/studio` authenticated or `/studio?demo=1`
       seeded fixtures; flags `studio_enabled` + `webmcp_enabled`
       (+ `studio_demo_enabled` for demo).
     - Public profile goal: read, compare, verify, and embed a public
       credential. Initial state: any `/u/:handle` with computed stats;
       visitor payloads redacted server-side.
     - Verification goal: confirm what a verification code proves and does
       not prove. Initial state: `/verify/:hash` with a found record.
   - One **failure and recovery** table covering the article's four error
     classes, each mapped to a live behavior:

     | Error class | Example tool | Response the agent receives |
     | --- | --- | --- |
     | Wrong state / missing prerequisite | `save_badge_config` with nothing dirty | "No unsaved changes. The current configuration is already saved." |
     | Invalid parameters | `apply_badge_style` with a malformed token | Invalid-input message that names `list_style_options` as the recovery step |
     | Unexpected upstream data | `compare_profiles` when the other handle has no snapshot | 404 message with the `/u/<handle>` generation hint and a retry instruction |
     | Business-rule violation | `save_badge_config` in any state | The save API is never called by the agent; only the on-page human confirmation can continue |

   - One accurate sentence on recovery behavior: the new
     `apply_badge_style` invalid-input response names `list_style_options`;
     wrong-state save responses explain that no action is needed or name
     `preview_badge`; and the new `compare_profiles` 404 response gives the
     generation URL and retry step. Do not generalize this to all errors.
5. Judge demo section: add `get_embed_snippet` to the public trust flow
   sentence (step after `verify_badge`).

### `docs/webmcp-demo-script.md`

- Judge instructions: insert a step after the current step 6
  (`get_impact_profile`, `verify_badge`): call `get_embed_snippet` and
  confirm the returned Markdown matches the on-page embed snippet.
  Renumber the following steps.
- Correct the retired timed-script call without adding a new beat or changing
  the segment timing: replace the `celebration` interruption with "Use a
  calmer column sweep. Keep everything else." and
  `apply_badge_style { "category": "heatmapAnimation", "value": "fade-in" }`.
  The Maximum preset sets `scatter`, so this remains a visible change.
- In the earlier timed beat, replace the sibling retired phrase "spring
  stats" with "spinning border and shimmering score". Keep its timing and
  existing `background: solid` call unchanged.
- Make the 1:48-2:05 verification segment a Markdown heading so its
  methodology link has a real anchor. Do not change its timing or content.
- In judge step 8, state that `verify_badge` in step 6 returned the
  verification URL.
- Grep the complete script for the retired concepts `celebration`, `confetti`,
  `tilt`, `counter`, `spring stats`, and `statsDisplay`; no retired category
  instruction may remain.

### `README.md`

- In the WebMCP / eligibility section (locate at implement time; the
  "Prior work and submission period work" anchor exists), add one line
  pointing to the Design methodology section of `docs/webmcp.md`, so a
  repo-reading judge finds the framework without opening the code.
- Correct the Creator Studio feature summary to seven categories. State the
  post-#1191 behavior: a saved Studio config changes the public SVG badge and
  share page and invalidates the badge cache.

### `apps/web/app/llms-full.txt/route.ts`

- Update the agent-facing Creator Studio summary from six to seven categories
  and include color palette in the list.
- Add a failing-first route test for the exact seven-category summary before
  changing the route string.

## Success criteria

Automated:

- [x] No old WebMCP tool-count assertions remain in `layout.render.test.tsx`
  or the render tests. The root plan owns the final full test run after all
  phases are combined.
- [x] `rg -n '16 browser-native|15 distinct' docs/webmcp.md` returns nothing.
- [x] The focused `llms-full.txt` route test passes with the seven-category list.

Manual:

- [x] Read-through: no em-dashes or emojis in the added prose; every claim in
  the failure/recovery table matches shipped behavior byte-for-byte (copy
  the strings from the merged Phases 2 and 3, do not re-type them).
- [x] Demo-script placeholder rule still holds:
  `rg -n 'TODO_[A-Z]' docs/webmcp-demo-script.md` output is unchanged by
  this phase (no new placeholders introduced).
- [x] `rg -ni 'celebration|confetti|tilt|counter|spring stats|statsDisplay' docs/webmcp-demo-script.md`
  returns nothing.
