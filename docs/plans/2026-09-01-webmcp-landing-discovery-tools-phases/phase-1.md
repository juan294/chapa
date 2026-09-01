# Phase 1: Site tool map + landing discovery tools

Prerequisite: the parent plan
(`2026-09-01-webmcp-agentic-workflows-enhancements.md`) is merged to
`develop`. This phase imports its shared `invalidInput` helper from
`@/lib/webmcp/use-model-context-tools` and pins its final tool names.

Status: Complete.

## Files

- `apps/web/lib/webmcp/site-tool-map.ts` (new)
- `apps/web/lib/webmcp/site-tool-map.test.ts` (new)
- `apps/web/components/LandingWebMcpTools.tsx` (new)
- `apps/web/components/LandingWebMcpTools.render.test.tsx` (new)
- `apps/web/app/[locale]/page.tsx` (mount the component)
- (check at implement time) `app/[locale]/page.render.test.tsx` and
  `static-generation.test.ts` if they assert the landing component tree.

## Static-page constraint (load-bearing)

Pure client component, no request-state reads, no `DynamicRouteShell`
import. Flag gating via `useClientFeatureFlags()` only. Both static locale
variants (`/en`, `/es`) mount the same component; registration is
client-side and locale-independent. Tool text is hardcoded English like
every other tool result string.

## Step 1 (RED): failing tests

`site-tool-map.test.ts` (the drift guard):

- The manifest lists exactly four route groups (`/`, `/studio` +
  `/studio?demo=1`, `/u/:handle`, `/verify/:hash`) with the exact shipped
  tool names: landing 2, Studio 9, share page 6 (including
  `get_embed_snippet`), verify 2. Adding or renaming a tool anywhere
  fails this test until the manifest is updated.

`LandingWebMcpTools.render.test.tsx` (mirror
`SharePageWebMcpTools.render.test.tsx` conventions):

- Registers exactly 2 tools when `webmcpEnabled` is true, none when
  false.
- `get_site_capabilities` has `readOnlyHint`; its JSON output includes
  `toolMap` (equal to `SITE_TOOL_MAP`), `entryPoints`, and a `boundaries`
  list stating login and saves require a human.
- `find_profile` with an invalid handle returns
  `invalidInput("find_profile", "handle must be a public GitHub handle")`.
- `find_profile` with a valid handle returns JSON containing
  `https://chapa.thecreativetoken.com/u/<handle>` and
  `.../u/<handle>/badge.svg`, a note that the profile is generated on
  first visit, and a note that the share page registers further tools.

## Step 2 (GREEN): implementation

`lib/webmcp/site-tool-map.ts`:

```pseudo
export const SITE_TOOL_MAP = [
  { route: "/", goal: "Discover Chapa and route to the right page",
    tools: ["get_site_capabilities", "find_profile"] },
  { route: "/studio (and /studio?demo=1)",
    goal: "Co-design the badge; agent proposes, human confirms saves",
    tools: [ the 9 Studio names ] },
  { route: "/u/:handle",
    goal: "Read, compare, verify, and embed a public credential",
    tools: [ the 6 share-page names ] },
  { route: "/verify/:hash",
    goal: "Confirm what a verification code proves and does not prove",
    tools: ["get_verification_record", "explain_verification"] },
] as const;
```

`components/LandingWebMcpTools.tsx`:

```pseudo
"use client";
export function LandingWebMcpTools() {
  const { webmcpEnabled } = useClientFeatureFlags();
  tools = useMemo(() => !webmcpEnabled ? [] : [
    {
      name: "get_site_capabilities",
      description: "Describe Chapa and list the WebMCP tools each page registers.",
      inputSchema: WEBMCP_EMPTY_INPUT_SCHEMA,
      annotations: WEBMCP_READ_ONLY_ANNOTATIONS,   // static first-party copy, not untrusted
      execute: () => JSON.stringify({
        whatIsChapa: one-paragraph static English summary,
        toolMap: SITE_TOOL_MAP,
        entryPoints: {
          demoStudio: "https://chapa.thecreativetoken.com/studio?demo=1",
          profile: "https://chapa.thecreativetoken.com/u/<handle>",
          scoringMethodology: "https://chapa.thecreativetoken.com/about/scoring",
          llmsTxt: "https://chapa.thecreativetoken.com/llms.txt",
        },
        boundaries: [
          "Login uses GitHub OAuth and only a human can complete it.",
          "Configuration saves are proposed by agents and confirmed by a human on-page.",
          "Tools register per page; navigate to a route to use its tools.",
        ],
      }),
    },
    {
      name: "find_profile",
      description: "Resolve a GitHub handle to its Chapa profile and badge URLs.",
      inputSchema: { type: "object",
        properties: { handle: { type: "string" } },
        required: ["handle"], additionalProperties: false },
      annotations: WEBMCP_READ_ONLY_ANNOTATIONS,
      execute: (inputs) => {
        handle = isWebMcpRecord(inputs) && typeof inputs.handle === "string"
          ? inputs.handle.trim() : "";
        if (!isValidHandle(handle))
          return invalidInput("find_profile", "handle must be a public GitHub handle");
        return JSON.stringify({
          handle,
          sharePageUrl: `https://chapa.thecreativetoken.com/u/${encodeURIComponent(handle)}`,
          badgeSvgUrl: `https://chapa.thecreativetoken.com/u/${encodeURIComponent(handle)}/badge.svg`,
          notes: [
            "The profile is generated on first visit if it does not exist yet.",
            "Opening the share page registers six more tools, including get_impact_profile and get_embed_snippet.",
          ],
        });
      },
    },
  ], [webmcpEnabled]);
  useModelContextTools(tools, webmcpEnabled);
  return null;
}
```

`app/[locale]/page.tsx`: mount `<LandingWebMcpTools />` once in the page
body (position irrelevant; it renders null).

Notes:

- No `fetch` anywhere in this catalog. `find_profile` deliberately does
  not probe `/api/profile` for existence; the share page answers that
  after navigation, and the parent plan's `compare_profiles` growth-loop
  message covers the missing-profile case.
- `get_site_capabilities` returns only first-party static copy, so the
  plain read-only annotations are correct; `untrustedContentHint` is not
  needed (contrast with the share-page tools, which carry
  GitHub-controlled text).

## Step 3: verify

`pnpm run test -- LandingWebMcpTools site-tool-map`, then the full
`pnpm run test && pnpm run typecheck && pnpm run lint &&
pnpm run check:circular`.

## Success criteria (automated)

- [x] All new tests pass; the drift test pins the parent plan's final names.
- [x] `static-generation.test.ts` and `DynamicRouteShell.boundary.test.ts`
  unchanged and green.
