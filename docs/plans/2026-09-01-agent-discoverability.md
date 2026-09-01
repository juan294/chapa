# Agent Discoverability Track

Date: 2026-09-01
Issues: #1255, #1256, #1257, #1258, #1259, #1260, #1261, #1262
Research basis: this plan was built from a same-day repo audit plus live web
verification of every external directory and submission process (see the
issue bodies for source URLs). External facts marked VERIFIED were fetched
from the named primary source on 2026-09-01.

## Problem

Chapa ships 19 WebMCP tool registrations (18 distinct names, 4 surfaces),
live in production since v2.28.0. Nothing outside the running page can
discover them:

- `llms.txt` and `llms-full.txt` (`apps/web/app/llms.txt/route.ts`,
  `llms-full.txt/route.ts`) never mention WebMCP or any tool name.
- The landing page has no static prose about agent capability. Registration
  happens only at runtime in client JS, invisible to any agent that does not
  execute JS.
- JSON-LD exists (`SoftwareApplication` in `app/layout.tsx:141`, `Person` on
  `/u/:handle`) but contains zero `potentialAction` entries.
- `app/.well-known/` serves only `security.txt`. Directory scanners look for
  `.well-known/mcp.json` style markers.
- Chapa is listed in no WebMCP directory, no llms.txt directory, and no MCP
  registry, and has no remote MCP endpoint for non-browser clients.

## Goal

Make Chapa discoverable and operable through every currently available
agent channel: static declaration files, structured data, WebMCP
directories, llms.txt directories, a hosted remote MCP endpoint, the MCP
registries, and the ChatGPT app directory, with agent traffic measured.

## Key facts the plan builds on (all verified in-repo on 2026-09-01)

1. **Server reuse seam.** `lib/webmcp/shared-tools.ts` is server-hostile
   only because it value-imports `invalidInput` from the `"use client"`
   adapter (`use-model-context-tools.ts:28-32`). Everything else in its
   graph is pure. The per-page input schemas
   (`FIND_PROFILE_INPUT_SCHEMA`, `COMPARE_PROFILES_INPUT_SCHEMA`, Studio's
   three), `VERIFICATION_EXPLANATION`, the `get_site_capabilities` payload,
   and helpers `publicStats`/`compareDimensions` are module-level consts in
   `"use client"` files and are not exported anywhere.
2. **`SITE_TOOL_MAP` is pure and server-importable today**
   (`lib/webmcp/site-tool-map.ts`, zero imports). Its drift test
   (`site-tool-map.test.ts`) is a line-oriented regex over the four
   registration files matching literal `name: "..."` lines. Tool names and
   descriptions must stay inline in those files; schemas can move freely.
3. **Gates.** A new route must live under `apps/web/app/api/` to be seen by
   `check:write-registration` (`scripts/check-write-registration.ts:26`,
   root `DEFAULT_API_ROOT`) and by the CORS mutation guard
   (`app/api/cors-mutation-guard.test.ts`), which fails any POST route with
   wildcard CORS. So the MCP endpoint is `/api/mcp`, with no wildcard CORS.
4. **Telemetry already half-exists.** The adapter emits `webmcp_tool_called`
   with `{tool, outcome, durationMs}` (`use-model-context-tools.ts:42-78`).
   Server-side capture goes through `captureServerEvent`
   (`lib/analytics/server-errors.ts`), which no-ops without PostHog env and
   never throws.
5. **Static rendering constraints.** The landing page is `force-static`;
   `LandingContent.tsx` must stay free of `"use client"`, `useTranslation`,
   and `window` (enforced by `LandingContent.test.ts` and
   `static-generation.test.ts`). `page.responsive.test.ts` requires every
   `grid-cols-N` to carry a `sm:`/`md:`/`lg:` prefix. The i18n parity test
   pins `landing.navLinks` to length 4, so this plan adds no nav link.
6. **Dependencies for the MCP endpoint** (VERIFIED against the npm registry
   2026-09-01): `mcp-handler@2.1.1` (Vercel, Apache-2.0, peers
   `@modelcontextprotocol/server` + `next`) and
   `@modelcontextprotocol/server@2.0.0` (MIT). Both licenses are on the
   allowlist. No `@modelcontextprotocol/*` package exists in the repo today.
7. **External submission mechanics** (VERIFIED live): webmcp.cool 301s to
   webmcp.com (one directory, 449 sites, homepage "Add your site" box,
   scanner verifies live tools, agent API at `/api/v1/*`);
   webmcpdirectory.com form at `/submit` (auto-scans for
   `navigator.modelContext` / `registerTool` / `.well-known/mcp.json`
   markers); webmcplist.com homepage form (human-reviewed);
   llmstxt.site/submit and directory.llmstxt.cloud/submit; official MCP
   registry via `mcp-publisher` CLI; mcpservers.org/submit; Glama claim
   flow. ChatGPT apps submit via the plugin portal with
   `.well-known/openai-apps-challenge` domain verification, 5 positive + 3
   negative test cases, `*Hint` annotations, verified OpenAI identity, and
   a compliant privacy policy.
8. **Deadline context.** `docs/webmcp-demo-script.md` carries a Devpost
   hackathon deadline of 2026-09-03 13:00 PT (target 2026-09-02). Phases 1
   and 2 are small and make the submission story stronger; the heavier MCP
   server phases must not block the recording.

## Design decisions

- **One catalog, two channels.** Phase 3 extracts the unexported schemas,
  payloads, and helpers into a pure `lib/webmcp/catalog.ts` consumed by
  both the client registrations and the server MCP route. Tool `name` and
  `description` literals stay in the registration files so the existing
  drift test keeps working unmodified.
- **The MCP endpoint calls libs, not HTTP.** Server tools reuse the same
  functions the public API routes call (`materializeDisplayProfile` with
  `readOnly: true`, `getSnapshots`/`computeTrend`, verification store +
  `toPublicVerificationRecord`, `score-explanation` with `getServerT`),
  not `fetch` against our own API.
- **Raw JSON Schemas, hand validation.** The WebMCP tools already validate
  in code and carry raw JSON Schema objects. The server endpoint reuses
  them verbatim through the SDK's low-level path rather than rewriting
  them in Zod. If `mcp-handler`'s high-level API forces Zod, the fallback
  is the SDK `Server` class with a hand-wired streamable HTTP POST handler.
- **Separate kill switch.** The remote endpoint gets its own
  `mcp_server_enabled` DB flag (seeded by migration, per the #1209/#1210
  lesson that every flag key read must have a row) plus `MCP_SERVER_ENABLED`
  env fallback through `lib/env.ts`. Killing browser WebMCP must not kill
  the remote channel or vice versa.
- **Static advertising is sourced from `SITE_TOOL_MAP`.** The landing
  section renders it directly (LandingContent is a server component and the
  map is pure). The llms.txt routes stay zero-dynamic template literals,
  with new test assertions importing `SITE_TOOL_MAP` to fail on drift.
- **Tool names are not translated**, matching the archetype-name precedent
  in the dictionaries.
- **Fail-open rate limiting** on all new public read surfaces, keyed
  `ratelimit:mcp:<ip>`, matching `/api/profile`.
- **No new CI or release gates.** Everything added is tests inside the
  existing suites and registrations in existing contracts.

## Phases

| Phase | Issue | Scope | Depends on |
|---|---|---|---|
| 1 [batch-eligible] | #1256 | Static advertising: llms.txt, llms-full.txt, landing section, `.well-known/mcp.json` | none |
| 2 [batch-eligible] | #1257 | `potentialAction` JSON-LD (layout + share page) | none |
| 3 [batch-eligible] | #1259 (part) | Server-safe WebMCP catalog refactor | none |
| 4 | #1259 | `/api/mcp` remote MCP endpoint + flag + contract test | 1, 3 |
| 5 | #1262 | Agent traffic analytics (UA classification + server events) | 1, 4 |
| 6 | #1260 | ChatGPT app pack: challenge route + test-case doc | 4 |
| 7 | #1255, #1258, #1259 (registries) | Production release, then directory and registry submissions | release of 1-5 |
| 8 | #1261 | Agent-operability write-up + landing transcript link | 1, ideally 7 |

Phases 1, 2, and 3 have no file overlap and no cross-dependency; `/batch`
can run them in parallel worktrees. Phases 4 and later are sequential.

Phase files: `2026-09-01-agent-discoverability-phases/phase-N.md`.

## Verification commands (per code phase)

```
pnpm run test
pnpm run typecheck
pnpm run lint
pnpm run check:circular
pnpm run check:write-registration   # phase 4
pnpm run check:licenses             # phase 4 (new deps)
pnpm run build                      # bundle budget; phases 1, 2, 8 touch pages
```

## Manual gates (user authorization required, per Production Safety)

- Any release PR to `main` (before phase 7).
- Every outward-facing submission in phase 7 (each form submit publishes).
- Setting `OPENAI_APPS_CHALLENGE_TOKEN` and `MCP_SERVER_ENABLED` in Vercel
  production (phases 4 and 6).
- OpenAI identity verification and the final plugin submission (phase 6).
- Choice of publication venue and the actual publishing in phase 8.

## Out of scope

- The Devpost hackathon submission itself (tracked in
  `docs/webmcp-demo-script.md`, not in these issues).
- Any paid placement (mcpservers.org fast-track, llmstxt.cloud featured).
- mcp.so submission is optional and attempted only because the repo is
  public; its "public GitHub repo" constraint is unconfirmed (their site
  blocked direct verification).
- Dashboards or alerts for agent analytics (#1262 reads PostHog directly).
