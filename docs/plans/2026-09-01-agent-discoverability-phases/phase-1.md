# Phase 1: Static advertising of the WebMCP surface (#1256) [batch-eligible]

Branch: `feature/1256-static-agent-advertising`

Agents that fetch pages without executing JS must be able to learn that
Chapa has agent tools, which tools, and on which pages. Four static
surfaces, all sourced from `SITE_TOOL_MAP` so they cannot drift.

## Step 1 (tests first): drift assertions

Extend `apps/web/app/llms.txt/route.test.ts` and
`apps/web/app/llms-full.txt/route.test.ts`:

```ts
import { SITE_TOOL_MAP } from "@/lib/webmcp/site-tool-map";

it("lists every registered WebMCP tool", async () => {
  const text = await new Response((GET()).body).text();  // match existing style
  for (const entry of SITE_TOOL_MAP)
    for (const tool of entry.tools) expect(text).toContain(tool);
});
it("mentions WebMCP by name", ...);            // toContain("WebMCP")
```

New `apps/web/app/.well-known/mcp.json/route.test.ts` copying the
`security.txt/route.test.ts` template: status 200,
`content-type: application/json`, parses as JSON, contains every tool name
from `SITE_TOOL_MAP`, and a `webmcp` key.

Extend `apps/web/app/[locale]/page.render.test.tsx` (or a focused
`LandingContent` render test): the rendered landing HTML contains the new
section id `agent-tools`, the string `WebMCP`, and every tool name from
`SITE_TOOL_MAP` (loop, same as above).

## Step 2: llms.txt

`apps/web/app/llms.txt/route.ts`: add one section to the template literal,
after `## Endpoints`:

```
## Agent Tools (WebMCP)

Chapa registers browser-native WebMCP tools (document.modelContext) on 4
pages. An agent driving a WebMCP-capable browser can operate the site
directly. 18 tools:

- `/` : get_site_capabilities, find_profile
- `/studio` (and `/studio?demo=1`, no login): list_style_options, ... (all 9)
- `/u/{handle}` : get_impact_profile, ... (all 6)
- `/verify/{hash}` : get_verification_record, explain_verification

Tool registration happens at page load in client JS. Full catalog:
https://chapa.thecreativetoken.com/llms-full.txt
Machine-readable: https://chapa.thecreativetoken.com/.well-known/mcp.json
```

Counts and names are written literally in the template (the route stays a
zero-import literal); the Step 1 tests are what keep them honest.

## Step 3: llms-full.txt

`apps/web/app/llms-full.txt/route.ts`: add `## Agent Tools (WebMCP)` with
one line per tool (name, page, one-sentence behavior, read-only or not),
condensed from the catalog tables in `docs/webmcp.md:23-68`. Mention that
`/studio?demo=1` needs no login and that saves always require a human
click (the boundaries story). Keep the existing verified/public-metrics
claim discipline; do not claim ChatGPT compatibility (untested, per
`docs/webmcp.md:7`).

## Step 4: `.well-known/mcp.json`

New `apps/web/app/.well-known/mcp.json/route.ts` following the
`security.txt` route pattern (plain GET, same cache headers, but
`content-type: application/json`). Build the body from real imports, not a
literal, because this file is the machine-readable contract:

```ts
import { SITE_TOOL_MAP } from "@/lib/webmcp/site-tool-map";
const BODY = JSON.stringify({
  name: "Chapa",
  description: "...one line...",
  homepage: "https://chapa.thecreativetoken.com",
  webmcp: { pages: SITE_TOOL_MAP },   // route, goal, tools per page
  llms: ["/llms.txt", "/llms-full.txt"],
}, null, 2);
export function GET(): Response { ... }
```

At implement time, check webmcpdirectory.com's documented marker
expectations and the current `.well-known/mcp.json` draft shape; if a
canonical schema exists, match its field names and nest the above under a
vendor extension key rather than inventing top-level fields. Phase 4
appends the remote endpoint URL to this file.

## Step 5: landing section

`apps/web/app/LandingContent.tsx`: new `<section id="agent-tools">` inside
the `space-y-20` wrapper, after `#enterprise` (before line 420's closing
div). Server component; import `SITE_TOOL_MAP` and render the four
route/goal/tools rows directly. Pseudocode:

```tsx
<section id="agent-tools">
  <SectionHeader
    command="chapa mcp"
    title={sections.agentTools}
    meta={interpolate(sectionMeta.agentTools!, { tools: "18", pages: "4" })}
  />
  <p>{agentTools.intro}</p>            // "This site speaks WebMCP..."
  {SITE_TOOL_MAP.map(entry => (
    <div key={entry.route}>            // route (mono), goal (secondary),
      ...                              // tool names as small mono chips
    </div>
  ))}
  <p>{agentTools.boundary}</p>         // human-confirmation boundary line
</section>
```

Constraints from existing tests: no bare `grid-cols-N` (prefix with `sm:`),
no `"use client"`, no `useTranslation`, strings come off `t` via
`tObject`/`interpolate`. Do NOT add a 5th `landing.navLinks` entry (parity
test pins length 4; keeping nav unchanged is deliberate).

## Step 6: i18n keys

`en.ts` + `es.ts`, identical shapes (parity test enforces):

- `landing.sections.agentTools` ("Agent tools" / "Herramientas para agentes")
- `landing.sectionMeta.agentTools` ("exit 0 · {tools} tools · {pages} pages"
  / es equivalent)
- `landing.agentTools.{intro, boundary}` prose. Tool and route names are
  rendered from `SITE_TOOL_MAP`, untranslated.

## Success criteria

Automated: new tests from Step 1 pass; full `pnpm run test`, `typecheck`,
`lint`, `check:circular`, `pnpm run build` green; parity, static-generation,
LandingContent, and responsive tests untouched and green.

Manual: `curl localhost:3001/llms.txt` and `/.well-known/mcp.json` read
correctly; landing section renders in both locales and both themes.
