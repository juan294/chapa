# Phase 4: `/api/mcp` remote MCP endpoint (#1259, part 2)

Branch: `feature/1259-remote-mcp-server`
Depends on: phases 1 and 3.

One tool contract, second transport. A stateless streamable-HTTP MCP
endpoint exposing only public read-only tools, calling the same libs the
public API routes call.

## Dependencies

`pnpm add mcp-handler @modelcontextprotocol/server` in `apps/web`
(verified 2026-09-01: `mcp-handler@2.1.1` Apache-2.0, peers
`@modelcontextprotocol/server@2.0.0` MIT + next; both allowlisted).
Run `pnpm run check:licenses` immediately; transitive deps of
`@modelcontextprotocol/server` (ajv, hono, jose, express, zod, ...) must
pass or this phase stops for a decision.

Primary path: `mcp-handler`'s Next.js route adapter in stateless mode (no
Redis, no SSE legacy transport). Fallback if its API forces Zod schemas or
misfits Next 16: use `@modelcontextprotocol/server`'s low-level `Server`
class directly, wiring ListTools/CallTool handlers over its streamable
HTTP transport in the route. Either way the tool schemas are the raw JSON
Schema objects from `lib/webmcp/catalog.ts`, and validation stays
hand-written like every WebMCP handler.

## Route placement and gates

`apps/web/app/api/mcp/route.ts` (POST, plus GET returning 405 with an
explanatory JSON body, plus DELETE 405). Under `app/api/` so
`check:write-registration` sees it; sibling `route.contract.test.ts` with
a literal `import { POST } from "./route"` registers it. No wildcard CORS
on this route (the CORS mutation guard fails a POST route with
`Access-Control-Allow-Origin: *`; MCP clients are not browsers and need
none).

Public URL for all submissions: `https://chapa.thecreativetoken.com/api/mcp`.

## Gating and limits

```
POST handler order:
  1. if !(await isMcpServerEnabled()) -> 503 { error, hint }
  2. ip = getClientIp(req); rateLimit(`ratelimit:mcp:${ip}`, 60, 60)  // fail-open
  3. hand off to the MCP handler
Wrapped in withErrorCapture("/api/mcp", ...).
```

- New env accessor in `lib/env.ts`: `getMcpServerEnabledEnv()` reading
  `MCP_SERVER_ENABLED` (server-only, no `NEXT_PUBLIC_`). Documented in
  `.env.example` and CLAUDE.md's env table.
- New flag plumbing mirroring `isWebmcpEnabled()`
  (`lib/feature-flags.ts:143-150`): `isMcpServerEnabled()` checking DB key
  `mcp_server_enabled` with the env fallback.
- New migration `supabase/migrations/038_seed_mcp_server_flag.sql` seeding
  the row `('mcp_server_enabled', false, 'Remote MCP endpoint kill switch')`,
  per the #1209/#1210 rule that every flag key read has a seeded row.

## Tools (9, all read-only, names shared with WebMCP)

Server variants take explicit params where the page tool read page state.
Schemas: reuse catalog schemas; where a page tool used `EMPTY`, the server
variant uses a `HANDLE` or hash-bearing schema.

| Tool | Input | Backing calls (same as the API routes) |
|---|---|---|
| `get_site_capabilities` | empty | `SITE_CAPABILITIES` + `SITE_TOOL_MAP` + a note that this is the remote transport |
| `find_profile` | `{handle}` | `isValidHandle` + URL construction (pure) |
| `get_impact_profile` | `{handle}` | `getCachedLatestSnapshot` / `materializeDisplayProfile({readOnly:true})` + `dbGetToolInsights`, shaped like `/api/profile/[handle]` |
| `get_impact_history` | `{handle}` | `getSnapshots` + `computeTrend`, confidence stripped, shaped like `/api/history/[handle]` |
| `verify_badge` | `{hash}` | verification store lookup + `toPublicVerificationRecord` (hash validated against `HASH_PATTERN`) |
| `explain_verification` | empty | `VERIFICATION_EXPLANATION` from the catalog |
| `explain_dimension` | `{handle, dimension}` | profile fetch as above + `createExplainDimensionTool` logic with `getServerT("en")` as `t` |
| `compare_profiles` | `{handle, other_handle}` | two profile fetches + `compareDimensions` |
| `get_embed_snippet` | `{handle}` | pure string construction of the Markdown/HTML snippets |

Annotations: `readOnlyHint: true` on all; `untrustedContentHint: true`
where the WebMCP twin has it. Every handler returns the recovery-style
error strings via `invalidInput` from `lib/webmcp/errors.ts` and applies
`sanitizeFreeTextForAgent` to platform-controlled names. Redaction rule
holds: no `confidence`/`confidencePenalties` ever leaves the endpoint.

Implementation shape: `apps/web/lib/webmcp/server-tools.ts` (pure tool
definitions + handlers, unit-testable without the transport), route file
only does gating + transport wiring.

## Tests (first)

- `lib/webmcp/server-tools.test.ts`: per tool, mock the lib collaborators
  (`vi.mock` per module, existing route-test idiom) and assert output
  shape, validation errors as recovery strings, redaction (no
  `confidence` key anywhere in serialized output).
- `app/api/mcp/route.test.ts`: 503 when flag off; 429 path; JSON-RPC
  `tools/list` returns the 9 names; a `tools/call` round-trip with mocks.
- `app/api/mcp/route.contract.test.ts`: payload matrix
  (`generatePayloads` over the JSON-RPC envelope fields) with
  `runMatrix(..., { allowedStatuses: [400, 405, 406, 415, 503] })`; no 5xx
  on any legal or malformed input. Flag mocked on via the contract setup's
  feature-flag mock.
- Extend `site-tool-map.test.ts` scope deliberately NOT: the server file
  is a fifth surface the regex harness does not scan. Instead
  `server-tools.test.ts` asserts every server tool name exists in the union
  of `SITE_TOOL_MAP[].tools`, keeping one names contract.

## Static file updates (files created in phase 1)

- `.well-known/mcp.json`: add `mcpEndpoint: ".../api/mcp"` and transport
  note; update its test.
- `llms.txt` + `llms-full.txt`: one line each under the agent section:
  remote MCP endpoint URL, streamable HTTP, tool parity; update tests.
- `docs/webmcp.md`: new "Remote MCP endpoint" section (transport, flag,
  tool table delta, the explicit statement that Studio mutation tools are
  browser-only by design because saves need a human click).

## Success criteria

Automated: all new tests green; `check:write-registration` passes with the
new route registered; `check:licenses`, `check:circular`, full suite,
typecheck, lint, build green.

Manual: with the flag on locally,
`npx @modelcontextprotocol/inspector http://localhost:3001/api/mcp` lists
9 tools and `get_impact_profile {handle: "juan294"}` returns real data;
`claude mcp add --transport http chapa http://localhost:3001/api/mcp`
works in Claude Code. Production env `MCP_SERVER_ENABLED` and the DB flag
flip are user-authorized post-release actions.
