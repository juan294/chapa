# WebMCP Landing Discovery Tools (addendum)

Date: 2026-09-01
Status: Complete. Local implementation and verification passed.
Parent plan: `2026-09-01-webmcp-agentic-workflows-enhancements.md` (in
implementation in a separate session when this addendum was decided; that
plan's files and phases are deliberately untouched).

**Sequencing rule: implement this addendum only after the parent plan has
merged to `develop`.** Phase 1 imports the parent's Phase 1 helper, the
tool-map drift test pins the parent's final tool names (including
`get_embed_snippet`), and Phase 2 edits the same docs files the parent's
Phase 4 rewrites.

## Goal

Give the landing page (`/`) a WebMCP catalog so an agent arriving at the
site's front door discovers what Chapa is, which page-scoped tools exist
elsewhere, and where the boundaries are, then navigates deliberately
instead of blindly. This closes the "no tools on the landing page" gap
from the 2026-09-01 framework analysis (application state: the tool list
is the state signal, and the front door currently signals nothing).

Guardrail (from
`docs/research/2026-08-26-webmcp-hackathon-fit-chapa-recommendation.md`):
no data tools on the landing page. A `get_profile(handle)` here would wrap
the public `/api/profile` REST endpoint, the documented anti-pattern, and
`/llms.txt` already serves crawler orientation. Landing tools orient and
navigate only.

## The two tools

1. `get_site_capabilities` (empty input, read-only): one-paragraph "what
   is Chapa", the site tool map (each route group, its user goal, its tool
   names), entry-point URLs (`/studio?demo=1`, `/u/<handle>`,
   `/about/scoring`, `/llms.txt`), and a `boundaries` list (login is
   human-only OAuth; saves are agent-proposed, human-confirmed; tools
   register per page).
2. `find_profile` (input: `handle`, read-only): validates with
   `isValidHandle`, returns the share-page and badge URLs plus two notes:
   the profile is generated on first visit, and the share page registers
   six more tools. Invalid input uses the parent plan's shared
   `invalidInput` helper.

## Verified facts this plan builds on

- The root layout resolves `webmcpEnabled` through DB-backed
  `unstable_cache` helpers and mounts `ClientFeatureFlagsProvider`
  globally (`apps/web/app/layout.tsx:98-113,197`). A landing client
  component gates itself with `useClientFeatureFlags()` with no per-page
  plumbing and no dynamic rendering.
- The landing page (`app/[locale]/page.tsx`) is one of the 9 statically
  generated locale-segmented pages. The new component must be a pure
  client component reading no request state, and must not import
  `DynamicRouteShell` (`DynamicRouteShell.boundary.test.ts` enforces
  this). This is the `NavbarClient` pattern.
- Canonical production domain in returned URLs
  (`https://chapa.thecreativetoken.com`), matching the embed snippets: a
  URL handed to an agent for later use must not point at a preview.

## Phases

| Phase | Content | Files | Depends on |
| --- | --- | --- | --- |
| 1 | Tool map + landing tools component | `lib/webmcp/site-tool-map.ts` (new), `components/LandingWebMcpTools.tsx` (new), `app/[locale]/page.tsx` + tests | parent plan merged |
| 2 | Docs delta on top of the parent's Phase 4 output | `docs/webmcp.md`, `docs/webmcp-demo-script.md` | 1 |

Phase files:
`2026-09-01-webmcp-landing-discovery-tools-phases/phase-N.md`.

## Success criteria

Automated:

- [x] `pnpm run test && pnpm run typecheck && pnpm run lint &&
  pnpm run check:circular` green, including the new
  `site-tool-map.test.ts` drift guard and
  `LandingWebMcpTools.render.test.tsx`.
- [x] `static-generation.test.ts` and `DynamicRouteShell.boundary.test.ts`
  unchanged and green (proves the landing page stayed static).

Manual (Juan-gated, outside this plan):

- Ships in the same second release as the parent plan if timing allows,
  otherwise the next one; flag flips and recording preflight per
  `docs/webmcp-demo-script.md`.
