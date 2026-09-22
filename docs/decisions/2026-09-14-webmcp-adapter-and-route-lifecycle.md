# WebMCP uses one browser adapter and route-scoped registrations

- **Date**: 2026-09-14
- **Status**: Accepted
- **Supersedes**: nothing. This records the architecture already implemented by the WebMCP surface.

## Context

Chapa exposes browser-native tools on four rendered surfaces: the landing page,
Creator Studio, public profiles, and verification pages. The browser API is the
pre-standard `document.modelContext` contract, currently available behind a
Chrome origin trial. Its shape can change independently of Chapa's tool handlers.

The available tools also depend on the rendered page and its state. A Studio
tool must disappear after navigation away from Studio, and a public-profile tool
must execute against the profile currently on screen. Registrations that outlive
their view would advertise stale capabilities or capture stale page data.

Chapa also exposes a separate stateless remote MCP endpoint at `/api/mcp` for
clients that do not operate a browser page. It shares public tool definitions and
validation with WebMCP, but it does not replace the browser lifecycle contract.

## Decision

All direct access to `document.modelContext` stays in
`apps/web/lib/webmcp/use-model-context-tools.ts`. Page components and tool
handlers import that adapter and do not read or write the browser global.

Each page registers its complete tool array from a React effect tied to that
view. The effect creates an `AbortController`, passes its signal to every
registration, and aborts the controller during cleanup. Catalog-definition
changes replace the complete registration set. State-only changes keep the
registrations stable while tool execution resolves the latest handler state.

The published `SITE_TOOL_MAP` remains a checked contract between the landing
discovery tools and the four registration hosts. Adding, removing, or renaming a
browser tool requires updating the map in the same change.

## Consequences

- A browser API revision is isolated to one adapter instead of every page tool.
- Navigation removes tools that no longer match the rendered view.
- Tool calls read current page state without forcing re-registration for every
  state update.
- Missing, malformed, or unsupported browser APIs degrade without breaking the
  page.
- The registration hosts and `SITE_TOOL_MAP` must change together; the drift
  test enforces that relationship.
- Remote MCP tools remain stateless and public-read-only. Studio mutations stay
  browser-only because they act on visible page state and saving requires human
  confirmation.

## Alternatives considered

- **Reference `document.modelContext` from each tool host.** Rejected because a
  browser contract change would require coordinated edits across all surfaces.
- **Register one global catalog for the application lifetime.** Rejected because
  it would expose tools for views that are no longer rendered and risk stale
  closures after navigation.
- **Re-register on every state change.** Rejected because current execution
  state can be resolved through the adapter without repeatedly replacing an
  unchanged catalog.
