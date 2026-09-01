# WebMCP Agentic-Workflows Enhancements

Date: 2026-09-01
Status: Complete. Local implementation and validation passed.
Source analysis: 2026-09-01 session applying Chrome's "Build your user's
agentic workflows with WebMCP tools" article (2026-08-26) to the shipped
catalog in `docs/webmcp.md`.
Deadline context: hackathon submission targeted 2026-09-02, hard deadline
2026-09-03 13:00 PT. v2.27.0 is already on `main` (PR #1246); these changes
need one more `develop` to `main` release before the demo recording. The
release itself is Juan-gated and outside this plan.

## Goal

Close the four gaps the article's framework exposed in the WebMCP catalog,
plus document the methodology, without changing any existing invariant
(human-gated save, redaction, sanitization, annotations).

The five enhancements:

1. Docs-only methodology section in `docs/webmcp.md` (user goal, initial
   state, role-play, failure/recovery table per the article's four error
   classes).
2. Agent-callable recovery messages and description ordering hints
   (`apply_badge_style` references `list_style_options`; `compare_profiles`
   404 adds the `/u/<handle>` growth-loop hint).
3. Wrong-state guard on `save_badge_config` (no pointless human gate when
   nothing is dirty).
4. New read-only `get_embed_snippet` tool on the share page.
5. Telemetry outcome dimension on `webmcp_tool_called`
   (`ok | invalid_input | error`).

## Decisions already made (with Juan, 2026-09-01)

- **Telemetry shape**: amend the existing `webmcp_tool_called` event. It now
  fires once, when execution settles, carrying `outcome` and `durationMs`.
  WebMCP was never flag-enabled in production, so no dashboard continuity is
  lost. The `client_error` event on thrown errors is kept unchanged.
- **Demo assets for `get_embed_snippet`**: add it to the `docs/webmcp.md`
  catalog and one step in the demo script's written judge instructions. The
  timed video script (already at 2:50 of 3:00) gets no new content.
- **Authorized Phase 4 corrections**: replace the timed script's retired
  `celebration` call with a live `heatmapAnimation` value without changing the
  segment timing; narrow the recovery rule to what the tools guarantee;
  correct the README's category and saved-config behavior; and update the
  agent-facing `llms-full.txt` category list to include color palette.

## Verified facts the plan builds on

- `saveState` starts `{ status: "saved" }` and flips `"dirty"` on any config
  change in both real and demo mode
  (`apps/web/app/studio/StudioClient.tsx:190,335,453`). The hook already
  receives `saveStatus` and lists it in its memo deps, so the guard sees the
  live value.
- The Markdown embed snippet is built once server-side
  (`apps/web/app/u/[handle]/page.tsx:342-344`, the #1165 "build once"
  lesson) but the HTML variant is still built independently in
  `apps/web/components/SharePageOwnerContent.tsx:138`. Phase 3 lifts the
  HTML build into `page.tsx` and threads it down, so the tool, the Copy
  button, and the keyboard shortcut can never drift apart.
- `GET /api/profile/:handle` returns 404 exactly when no persisted snapshot
  exists (`apps/web/app/api/profile/[handle]/route.ts:88-95`). Visiting
  `/u/:handle` materializes and persists one, so the growth-loop recovery
  hint is truthful.
- `invalidInput()` exists only as a local helper in
  `apps/web/app/studio/useStudioWebMcpTools.ts:99-101`; the share page and
  `shared-tools.ts` inline equivalent strings. Centralizing it (with an
  exported prefix constant) gives the instrumentation a non-brittle
  `invalid_input` classifier.
- Import direction: `lib/webmcp/shared-tools.ts` already imports types from
  `lib/webmcp/use-model-context-tools.ts`. The shared helper therefore lives
  in `use-model-context-tools.ts` (beside the instrumentation that consumes
  the prefix) to avoid introducing a cycle that `pnpm run check:circular`
  would reject.
- All four touched code files have existing test suites
  (`use-model-context-tools.test.ts`, `shared-tools.test.ts`,
  `useStudioWebMcpTools.test.ts`, `SharePageWebMcpTools.render.test.tsx`).
  TDD applies per phase: failing test first.

## Invariants that must not change

- `save_badge_config` never calls the save API; only a human click confirms.
- Visitor payload redaction (`redactImpactForVisitor`) and
  `sanitizeFreeTextForAgent` at the tool boundary stay exactly as they are.
- `readOnlyHint` / `untrustedContentHint` annotation policy: the new share
  page tool uses `WEBMCP_READ_ONLY_UNTRUSTED_ANNOTATIONS` like its siblings.
- The SVG and share-page HTML render paths are untouched.
- New user-facing strings and doc prose follow the writing rules: no
  em-dashes, plain simple sentences (existing strings keep their bytes).
- No new CI gates, eval harnesses, or release steps. The role-play doc plus
  unit tests are the accepted evidence level.

## Phases

| Phase | Content | Files | Depends on | Batch |
| --- | --- | --- | --- | --- |
| 1 | Shared `invalidInput` helper + telemetry outcome (#5, part of #2's plumbing) | `lib/webmcp/use-model-context-tools.ts`, `lib/webmcp/shared-tools.ts` + their tests | none | sequential first |
| 2 | Studio tools: recovery message + description hint (#2), save wrong-state guard (#3) | `app/studio/useStudioWebMcpTools.ts` + test | 1 | [batch-eligible] |
| 3 | Share page: `compare_profiles` growth hint (#2), `get_embed_snippet` (#4), embed-HTML single build site | `app/u/[handle]/SharePageWebMcpTools.tsx`, `app/u/[handle]/page.tsx`, `components/SharePageOwnerContent.tsx`, `components/SharePageOwnerContentLazy.tsx` + tests | 1 | [batch-eligible] |
| 4 | Docs: methodology section, catalog update, judge instructions, README and agent-facing summary corrections (#1) | `docs/webmcp.md`, `docs/webmcp-demo-script.md`, `README.md`, `app/llms-full.txt/route.ts` + test | 2, 3 | sequential last |

Phases 2 and 3 share no files and only depend on Phase 1's exported helper;
they are marked `[batch-eligible]` for parallel execution.

Phase files: `2026-09-01-webmcp-agentic-workflows-enhancements-phases/phase-N.md`.

## Success criteria

Automated (all must pass before merge to `develop`):

- [x] `pnpm run test` (includes the new failing-first tests listed per phase)
- [x] `pnpm run typecheck`
- [x] `pnpm run lint`
- [x] `pnpm run check:circular` (guards the helper placement decision)

Manual (after merge, before recording; all Juan-gated, outside this plan):

- Second `develop` to `main` release per `docs/release/release-playbook.md`.
- Flagged Chrome 151 smoke of the changed tools per the preflight in
  `docs/webmcp-demo-script.md` (now including `get_embed_snippet`).
- Devpost assets re-check: `docs/webmcp.md` counts and judge instructions
  match the deployed catalog.
