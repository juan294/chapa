# Phase 2 — Command-layer cleanup [batch-eligible]

## 2A. One alias table

`CATEGORY_ALIASES` in `components/terminal/command-registry.ts:51-62` is the
canonical copy (feeds `resolveCategory`). Export it and derive the reverse
map once:

```
// command-registry.ts
- const CATEGORY_ALIASES: Record<string, string> = {...}
+ export const CATEGORY_ALIASES: Record<string, string> = {...}   // alias → key
+ export const CATEGORY_KEY_TO_ALIAS: Record<string, string> =
+   Object.fromEntries(Object.entries(CATEGORY_ALIASES).map(([a, k]) => [k, a]));

// app/studio/useStudioCommands.ts:28-39 — delete the inline object literal;
//   alias lookup becomes CATEGORY_KEY_TO_ALIAS[c.key] ?? c.key
// app/studio/QuickControls.tsx:15-25 — delete local CATEGORY_ALIAS;
//   import CATEGORY_KEY_TO_ALIAS from the registry
```

RED first: add a parity test in `command-registry.test.ts` asserting
`CATEGORY_KEY_TO_ALIAS` covers exactly the 9 `BadgeConfig` keys (drive from
`BADGE_CONFIG_OPTIONS` so schema growth fails the test). Existing
`useStudioCommands.render.test.ts` / `QuickControls.render.test.tsx`
behavior tests must stay green unchanged — this is a pure refactor of source
of truth.

## 2B. Base URL

`app/studio/useStudioCommands.ts:151-165` (`/embed`, `/share`): replace the
four hardcoded `https://chapa.thecreativetoken.com` literals with
`getBaseUrl()` from `@/lib/env` (`env.ts:130-136`; `NEXT_PUBLIC_BASE_URL` is
build-inlined, safe in client hooks). Compute `const base = getBaseUrl()`
once inside the memo.

RED first: extend `useStudioCommands.render.test.ts` — with
`NEXT_PUBLIC_BASE_URL` set to a test origin, `/embed` and `/share` output
contains that origin and not the prod domain.

Out of scope (noted, untouched): the share page's own hardcoded embed
snippet (`app/u/[handle]/page.tsx:301`) and the SVG-side literals in
`BadgeBranding.tsx:65` / `VerificationStrip.ts:20` — different surfaces,
not studio commands.

## Verification
Automated only: full suite + lint/typecheck.
