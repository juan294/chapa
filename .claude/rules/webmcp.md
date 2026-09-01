---
description: WebMCP tool authoring -- registration lifecycle, adapter isolation, and the tool contract
paths:
  - "**/*webmcp*"
  - "**/*WebMcp*"
---

# WebMCP Rules

Chapa's WebMCP surface: the adapter and shared tools live in
`apps/web/lib/webmcp/`; per-page tool registrations are the
`*WebMcpTools*` files under `apps/web/app/` (studio, share page, verify
page). The whole surface is gated by `NEXT_PUBLIC_WEBMCP_ENABLED`.

## Adapter Isolation

- The `document.modelContext` global is pre-standard and shipping behind
  a Chrome origin trial. Confine every reference to it to a single
  adapter module (`apps/web/lib/webmcp/use-model-context-tools.ts`).
- Tool handlers import the adapter -- they never touch the global
  directly. When the spec moves, the change is one file.
- This is rule #91.

## Edit-Time Checklist

- One function per tool -- no multi-purpose dispatch tools.
- Name the tool by its effect, not its implementation.
- Accept raw input -- never internal IDs the model cannot see.
- Validate strictly in code, not by trusting the model's input.
- Return errors as recovery instructions, not stack traces.
- Register and unregister the tool with the view's lifecycle,
  not once at load time.

For the full tool contract and worked examples, see the webmcp skill.
