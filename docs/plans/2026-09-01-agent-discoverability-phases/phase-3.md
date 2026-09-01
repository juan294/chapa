# Phase 3: server-safe WebMCP catalog refactor (#1259, part 1) [batch-eligible]

Branch: `refactor/1259-webmcp-catalog`

Pure refactor, no behavior change. Makes the tool schemas, payloads, and
helpers importable from a route handler so phase 4 duplicates nothing.

## The seam (verified)

- `lib/webmcp/shared-tools.ts` is server-hostile solely because it
  value-imports `invalidInput` from the `"use client"` adapter
  (`use-model-context-tools.ts:28-32`).
- These are module-level consts inside `"use client"` files, not exported:
  `FIND_PROFILE_INPUT_SCHEMA` (`LandingWebMcpTools.tsx:20-27`), the
  `get_site_capabilities` payload (`:35-57`, incl. `entryPoints` and
  `boundaries`), `COMPARE_PROFILES_INPUT_SCHEMA`
  (`SharePageWebMcpTools.tsx:45-52`), `publicStats` (`:63-80`),
  `compareDimensions` (`:82-95`), `VERIFICATION_EXPLANATION`
  (`VerifyPageWebMcpTools.tsx:30-45`).
- The drift test (`site-tool-map.test.ts`) regex-matches literal
  `name: "..."` lines in the four registration files. Names and
  descriptions must stay inline there. Schemas and payloads can move.

## Step 1 (test first): a boundary test

New `apps/web/lib/webmcp/catalog.boundary.test.ts`, following the
`DynamicRouteShell.boundary.test.ts` idiom: read `catalog.ts`,
`shared-tools.ts`, `errors.ts` and every relative file they import;
assert none contains `"use client"`, and that `shared-tools.ts` no longer
imports from `use-model-context-tools`.

## Step 2: extract `invalidInput`

New `apps/web/lib/webmcp/errors.ts` (pure):

```ts
export const WEBMCP_INVALID_INPUT_PREFIX = "Invalid input for ";
export function invalidInput(tool: string, message: string): string { ... }
```

Moved verbatim from the adapter. The adapter re-exports both
(`export { ... } from "./errors"`) so all existing client imports keep
working unchanged. `shared-tools.ts` switches its import to `./errors`.

## Step 3: extract the catalog

New `apps/web/lib/webmcp/catalog.ts` (pure) exporting, moved verbatim:

- `FIND_PROFILE_INPUT_SCHEMA`, `COMPARE_PROFILES_INPUT_SCHEMA`
- `SITE_CAPABILITIES` builder: `{ whatIsChapa, entryPoints, boundaries }`
  plus `PRODUCTION_BASE_URL` (from `LandingWebMcpTools.tsx:18,44-55`)
- `publicStats`, `compareDimensions` (typed over their existing inputs)
- `VERIFICATION_EXPLANATION` and the `codeFormat` derivation
  (from `VerifyPageWebMcpTools.tsx:30-45,56-58`)

The three registration files import these instead of their local copies.
`name:` and `description:` literals do not move. Studio's three schemas
stay put (phase 4 does not expose Studio tools).

## Step 4: verify nothing drifted

No test expectations change. The existing suites are the harness:
`site-tool-map.test.ts` (names still found in the four files),
`shared-tools.test.ts`, `LandingWebMcpTools.render.test.tsx` (asserts
`toolMap` and `entryPoints.llmsTxt`), `SharePageWebMcpTools` and
`VerifyPageWebMcpTools` tests.

## Success criteria

Automated: boundary test passes; whole suite, typecheck, lint,
`check:circular` green with zero modified expectations in existing tests.

Manual: none.
