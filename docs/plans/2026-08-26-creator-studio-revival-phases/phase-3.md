# Phase 3 — Preview parity [batch-eligible with Phase 2; requires Phase 1 merged (page.tsx overlap)]

Goal: the Studio preview shows what the served badge shows. The badge gained
two footer elements the preview lacks (research §3): the multi-platform
branding row (`lib/render/BadgeSvg.tsx:124-129` via `BadgeBranding.tsx`) and
the verification strip (`VerificationStrip.ts`). Representative parity, not
pixel parity: same data, same meaning, React idiom.

## 3A. New client component `app/studio/PreviewFooter.tsx`

```
interface PreviewFooterProps {
  linkedPlatforms: Platform[];        // ["github", ...stats.linkedPlatforms≠github] — mirror BadgeSvg.tsx:118-120
  verification: { hash: string; date: string } | null;
}
```
- Branding row: platform logos in canonical order (reuse `PLATFORM_LOGOS`
  paths + `PLATFORM_ORDER` from `lib/render/BadgeBranding.tsx` — export
  them; they are plain data, no SVG-string coupling) + the domain text from
  `getBaseUrl()` host.
- Verification: when non-null, a subtle "VERIFIED · {hash} · {date}" strip
  in the strip's coral (`#E05A47` — take the exported constant, export it
  from `VerificationStrip.ts` rather than duplicating); when null, render
  nothing (matches the served badge, which omits the strip without
  verification — `BadgeSvg.tsx:128-133`).

## 3B. Wire the data

```
// app/studio/page.tsx — after Phase 1's shape
+ import { getPublicProfileVerification } from <same module badge.svg/route.ts:222 imports>
+ derive `verification` the way the badge route does; pass to <StudioClient verification={...}>
  [IMPL CHECK: getPublicProfileVerification takes the materialized profile —
   confirm its input is derivable from what page.tsx already loads; if it
   requires the materializer, call the same materialize step the badge route
   uses read-only. If that pulls in more than ~20 lines, fall back to
   verification={null} for v1 and file an issue — the strip correctly
   disappears, no wrong data shown.]

// StudioClient.tsx — accept + forward `verification` to BadgePreviewCard
// BadgePreviewCard.tsx — render <PreviewFooter> inside the card div, below
//   <BadgeContent>, so background/border/tilt wrappers apply to it too
```

AMENDMENT (2026-08-26, found during /implement exploration): BadgeContent.tsx
:263-274 already renders a legacy GitHub-only footer ("Powered by GitHub" +
hardcoded domain) — rendering PreviewFooter below it would duplicate footers.
Correction, approved:
- Add `showFooter?: boolean` (default `true`) to `BadgeContentProps`; wrap the
  legacy footer block in it. Default preserves behavior for any other consumer.
- `BadgePreviewCard` passes `showFooter={false}` and renders `PreviewFooter`
  once in its place.
- BadgeContent regression tests: footer present by default, absent with
  `showFooter={false}`; existing tests stay green.
- The strip's coral (#E05A47) is an explicit design-system exception, justified
  by served-badge parity (the phase's purpose).

RED first: new `PreviewFooter.render.test.tsx` (platforms render in
canonical order; verification strip present iff verification non-null;
domain text = getBaseUrl host). Extend `BadgePreviewCard.render.test.tsx`
to assert the footer receives the forwarded props. Existing 168 studio
tests stay green.

## Verification
Automated: full suite. Manual (non-blocking, at Phase 5): eyeball
`/studio` preview vs `/u/<handle>` badge side by side.
