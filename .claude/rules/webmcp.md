---
description: WebMCP tool authoring -- registration lifecycle, adapter isolation, and the tool contract
paths:
  - "**/*webmcp*"
  - "**/*WebMcp*"
---

# WebMCP Rules

Chapa's WebMCP surface: the adapter, the shared tools, and the published
route/tool map live in `apps/web/lib/webmcp/`. Per-page tool registrations
sit beside the page they belong to, so they are not all in one directory:
the landing tools are `apps/web/components/LandingWebMcpTools.tsx`, and the
studio, share and verify tools are the `*WebMcpTools*` files under
`apps/web/app/`. Four surfaces, 19 registrations across 18 distinct names.
The whole surface is gated by `NEXT_PUBLIC_WEBMCP_ENABLED`.

`SITE_TOOL_MAP` (`site-tool-map.ts`) is what the landing page answers
"what can I do here" with, so it is a contract rather than a comment:
`site-tool-map.test.ts` reads the four registration files and fails when
the published map and the real registrations disagree. Adding or renaming
a tool means updating that map in the same commit.

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
