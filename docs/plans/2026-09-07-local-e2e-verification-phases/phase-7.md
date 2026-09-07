# Phase 7 — WebMCP page tools and the remote MCP endpoint

Goal: the agent-facing surface behaves as `docs/webmcp.md` and
`lib/webmcp/site-tool-map.ts` publish it. Two halves: the remote endpoint
(pure HTTP, scriptable) and the in-page registrations (real Chrome only;
there is no polyfill and no Playwright hook, by design).

## 7.1 Remote MCP: `POST /api/mcp`

`mcp_server_enabled` is true in production, which is what localhost reads.
The rate-limit buckets (`ratelimit:mcp:127.0.0.1`) live in the production
Redis; they expire in 60 s and only ever count localhost. Helper:

```bash
mcp() { curl -sS -X POST http://localhost:3001/api/mcp \
  -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' \
  -d "$1" | sed -n 's/^data: //p; /^{/p' | jq .; }
mcp '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"local-e2e","version":"0"}}}'
mcp '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
```

Assert `tools/list` names are exactly: `get_site_capabilities`,
`find_profile`, `get_impact_profile`, `get_impact_history`, `verify_badge`,
`explain_verification`, `explain_dimension`, `compare_profiles`,
`get_embed_snippet` (9; Studio mutations absent by design), with the raw
JSON Schemas byte-equal to the catalog. Then one `tools/call` per tool:

| Tool | Arguments | Expect |
|---|---|---|
| `get_site_capabilities` | `{}` | includes `transport.endpoint` |
| `find_profile` | `{"handle":"octocat"}` / `{"handle":"bad handle!"}` | profile URL / `isError:true` with the recovery string |
| `get_impact_profile` | `{"handle":"juan294"}` | same headline as Phase 6.1 |
| `get_impact_history` | `{"handle":"juan294"}` | trend matches `/api/history` |
| `verify_badge` | the hex hash from `/u/octocat`; the withdrawn `v7.` token from Phase 6 | valid / revoked |
| `explain_verification` | `{}` | text |
| `explain_dimension` | `{"handle":"juan294","dimension":"consistency"}` | explanation, invalid dimension → recovery string |
| `compare_profiles` | `{"handle":"juan294","other_handle":"octocat"}` | both numbers match their badges |
| `get_embed_snippet` | `{"handle":"juan294"}` | Markdown and HTML with the badge URL |

Every response carries `Cache-Control: no-store`. Then:
- Rate limit: 61 requests in a minute from localhost → the 61st is 429 with
  `Retry-After: 60` (local IP is a trusted IP; if `NO_TRUSTED_IP` applies the
  shared bucket trips at 11).
- `GET` and `DELETE` → 405 with `Allow: POST`.
- Flag off → 503 before rate limiting: not exercised here, because the flag
  is a production row. `app/api/mcp/route.test.ts` covers it; note that in
  the report.
- Discovery: `/.well-known/mcp.json`, `/llms.txt`, `/llms-full.txt` and
  `server.json` all name the same endpoint path and the `package.json`
  version (2.29.5 today; a version bump belongs to the release, not here).

## 7.2 In-page WebMCP in real Chrome

Prerequisite: `chrome://flags/#enable-webmcp-testing` enabled in the Chrome
that Claude in Chrome drives, then restart Chrome. Feature detection is
`"modelContext" in document`; without the flag every host renders no tools,
which is the correct silent state and is confirmed first (`getTools` is
undefined, no console error).

With the flag, on each page run through `javascript_tool`:

```js
const names = (await document.modelContext.getTools()).map(t => t.name).sort();
console.log("[webmcp]", location.pathname, JSON.stringify(names));
```

| Page | Expected names (from `SITE_TOOL_MAP`) |
|---|---|
| `/` | `find_profile`, `get_site_capabilities` |
| `/u/juan294` | `compare_profiles`, `explain_dimension`, `get_embed_snippet`, `get_impact_history`, `get_impact_profile`, `verify_badge` |
| `/studio` (owner) and `/studio?demo=1` | `apply_badge_style`, `apply_preset`, `explain_dimension`, `list_style_options`, `preview_badge`, `reset_badge_config`, `save_badge_config`, `simulate_score`, `suggest_improvements` |
| `/verify/<valid hash>` | `explain_verification`, `get_verification_record` |
| `/verify/<unknown hash>`, `/about`, `/settings` | none |

Lifecycle: navigate `/` → `/u/juan294` → `/about` with client-side
navigation and re-read `getTools()` after each; the previous page's tools
must be gone (registration is bound to the view's `AbortController`).

Execution, via `document.modelContext.executeTool(name, args)`:
- Landing: `find_profile` with `juan294` and with an invalid handle.
- Profile: `get_impact_profile`, `get_impact_history`, `compare_profiles`
  against `octocat`, `verify_badge` with the strip's hash, `get_embed_snippet`,
  `explain_dimension` for all four core dimensions and for `craft`.
- Studio (owner): `list_style_options`, then `apply_badge_style` for a palette
  and a background → the preview and the config summary change on screen;
  `apply_preset`; `preview_badge`; `simulate_score` with a what-if and confirm
  it uses the same calculator as the dashboard (`lib/impact/simulate.ts`);
  `suggest_improvements`; `save_badge_config` → `PUT /api/studio/config` 200
  and the public badge updates; `reset_badge_config` → Ice defaults. Then
  restore the reference config exactly as in Phase 5.3 (`PUT` the JSON from
  `evidence/phase1/juan294-studio-config.json`) and verify the `GET`.
- Studio demo: mutations change the preview but `save_badge_config` reports
  that the demo cannot save.
- Verify page: both tools, in EN and ES.
- Flag-off behaviour (`webmcp_enabled` false → no tools) is covered by the
  jsdom render tests and is not exercised against the production row.

Landing `/mcp` command: scrolls to `#agent-tools`, which lists 18 distinct
tool names and the same route map; the transcript link resolves.

## Exit criteria

- 7.1: 9 names, 9 successful calls, 2 recovery strings, 429 at the limit,
  405s, discovery documents agree.
- 7.2: per-page names equal the table on every page and both locales,
  tools unregister on navigation, every listed execution returns a result,
  Studio mutations are visible on screen and persisted where they should be.
  Console output captured under `evidence/phase7/`.
